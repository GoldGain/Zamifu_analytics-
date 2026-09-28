import assert from 'node:assert/strict';
import { solveTimetableCsp } from '../src/lib/timetable-csp-solver.ts';
import { strictSubjectAllowsLesson } from '../src/lib/timetable-generator.ts';
import { validateTimetableRules } from '../src/lib/timetable-validator.ts';

const slots = Array.from({ length: 8 }, (_, index) => ({
  id: `fixture-slot-${index + 1}`,
  slot_order: index + 1,
  slot_type: 'lesson',
  label: `Lesson ${index + 1}`,
  start_time: `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
  end_time: `${String(8 + Math.floor(index / 2) + (index % 2 ? 1 : 0)).padStart(2, '0')}:${index % 2 ? '00' : '30'}`,
}));

const classes = [
  { id: 'stream-9a', name: 'Grade 9A', grade_level: 9, stream: 'A' },
  { id: 'stream-9b', name: 'Grade 9B', grade_level: 9, stream: 'B' },
  { id: 'stream-9c', name: 'Grade 9C', grade_level: 9, stream: 'C' },
];

const definitions = [
  ['math', 'Mathematics', 5, false, 'shared-math'],
  ['english', 'English', 5, false, 'shared-english'],
  ['science', 'Integrated Science', 5, false, 'shared-science'],
  ['cas', 'Creative Arts and Sports', 5, false, 'shared-cas'],
  ['life', 'Life Skills', 4, false, 'shared-life'],
  ['computer', 'Computer Studies', 4, false, 'shared-computer'],
  ['social', 'Social Studies', 6, false, 'shared-social'],
  ['agriculture', 'Agriculture', 6, false, 'shared-agriculture'],
] as const;

const assignments = classes.flatMap((classItem) => definitions.map(([subjectId, subjectName, lessons, isDouble, teacherId]) => ({
  class_id: classItem.id,
  subject_id: subjectId,
  // Math, English, and Social Studies deliberately share teachers across
  // streams. Doubles use stream-local teachers so the fixture remains
  // feasible while still exercising shared-teacher reservations.
  teacher_id: ['math', 'english', 'social'].includes(subjectId)
    ? teacherId
    : `${teacherId}-${subjectId}-${classItem.id}`,
  lessons_per_week: lessons,
  is_double_lesson: isDouble,
  available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  double_lesson_days: [],
  subjects: { name: subjectName },
})));

const subjectNames = new Map(definitions.map(([id, name]) => [id, name]));
const result = solveTimetableCsp({
  schoolId: 'fixture-school',
  levelKey: 'junior',
  classes,
  assignments,
  lessonSlots: slots,
  maxSearchNodesPerClass: 800_000,
});
assert.equal(result.issues.length, 0, result.issues.map((issue) => issue.message).join('\n'));
assert.equal(result.entries.length, classes.length * 40, 'every stream must receive a full 40-cell week');

const validation = validateTimetableRules({
  entries: result.entries,
  slots,
  subjectNames,
  classes,
  levelGroup: 'junior',
  requireComplete: true,
  requiredLessonCounts: new Map(assignments.map((row) => [`${row.class_id}-${row.subject_id}`, row.lessons_per_week])),
  requireReligiousPairing: true,
});
assert.deepEqual(validation, [], validation.map((issue) => issue.message).join('\n'));

for (const classItem of classes) {
  const cells = result.entries.filter((entry) => entry.class_id === classItem.id);
  assert.equal(cells.length, 40, `${classItem.name} must have 40 entries`);
  for (const [subjectId, subjectName, lessons] of definitions) {
    assert.equal(cells.filter((entry) => entry.subject_id === subjectId).length, lessons, `${classItem.name} ${subjectName} count`);
  }
}

// The same teacher is shared across all three streams; a valid solution must
// never book that teacher in two streams at the same day and lesson cell.
const teacherCells = new Set<string>();
for (const entry of result.entries) {
  if (!entry.teacher_id) continue;
  const key = `${entry.teacher_id}|${entry.day_of_week}|${entry.time_slot_id}`;
  assert.ok(!teacherCells.has(key), `shared teacher collision at ${key}`);
  teacherCells.add(key);
}

// Pin the exact subject-window edges used by the CSP pre-flight checks.
assert.equal(strictSubjectAllowsLesson('Mathematics', 4), true);
assert.equal(strictSubjectAllowsLesson('Mathematics', 5), false);
assert.equal(strictSubjectAllowsLesson('English', 5), true);
assert.equal(strictSubjectAllowsLesson('English', 6), false);
assert.equal(strictSubjectAllowsLesson('Integrated Science', 6), true);
assert.equal(strictSubjectAllowsLesson('Integrated Science', 7), false);

// A weekly total mismatch is a data warning, not a solver error; the UI can
// explicitly ask the admin to continue and the solver then places all data it can.
const short = solveTimetableCsp({
  schoolId: 'fixture-school',
  levelKey: 'junior',
  classes: [classes[0]],
  assignments: assignments.filter((row) => row.class_id === classes[0].id).slice(0, -1),
  lessonSlots: slots,
});
assert.equal(short.issues.length, 0);
assert.equal(short.needsConfirmation, true);
assert.ok(short.warnings.some((warning) => warning.code === 'weekly-total-mismatch'));
assert.equal(short.entries.length, 0);

// A genuine impossible constraint remains a hard solver error: CAS cannot form
// a legal double when the saved level only has Lessons 1–2.
const impossible = solveTimetableCsp({
  schoolId: 'fixture-school',
  levelKey: 'junior',
  classes: [classes[0]],
  assignments: [{
    class_id: classes[0].id,
    subject_id: 'cas',
    teacher_id: 'fixture-cas',
    lessons_per_week: 2,
    is_double_lesson: true,
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    subjects: { name: 'Creative Arts and Sports' },
  }],
  lessonSlots: slots.slice(0, 2),
});
assert.ok(
  impossible.issues.length > 0 || impossible.failedClasses.length > 0,
  'impossible constraints must block generation',
);

console.log('TIMETABLE CSP FIXTURES PASS', JSON.stringify({
  streams: classes.length,
  entries: result.entries.length,
  sharedTeachers: 6,
  warnings: short.warnings.length,
  impossibleIssues: impossible.issues.length,
}));
