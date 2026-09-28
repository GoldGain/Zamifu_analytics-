import assert from 'node:assert/strict';
import { solveTimetableCsp } from '../src/lib/timetable-csp-solver.ts';
import { validateTimetableRules } from '../src/lib/timetable-validator.ts';

const slots = Array.from({ length: 8 }, (_, index) => ({
  id: `slot-${index + 1}`,
  slot_order: index + 1,
  slot_type: 'lesson',
  label: `Lesson ${index + 1}`,
  start_time: `${String(8 + index).padStart(2, '0')}:00`,
  end_time: `${String(9 + index).padStart(2, '0')}:00`,
}));
const schoolId = 'school-1';
const classId = 'class-1';
const classItem = { id: classId, name: 'Grade 7' };
const subjects = [
  ['math', 'Mathematics', 4, false],
  ['english', 'English', 5, false],
  ['science', 'Integrated Science', 5, false],
  ['pretech', 'Pre-Technical Studies', 5, false],
  ['kisw', 'Kiswahili', 5, false],
  ['cas', 'Creative Arts and Sports', 5, false],
  ['social', 'Social Studies', 5, false],
  ['art', 'Agriculture', 5, false],
  ['music', 'Music', 1, false],
] as const;
const assignments = subjects.map(([id, name, lessons, isDouble]) => ({
  class_id: classId,
  subject_id: id,
  teacher_id: `teacher-${id}`,
  lessons_per_week: lessons,
  is_double_lesson: isDouble,
  subjects: { name },
}));
const subjectNames = new Map(subjects.map(([id, name]) => [id, name]));
const requiredLessonCounts = new Map(assignments.map((a) => [`${a.class_id}-${a.subject_id}`, a.lessons_per_week]));

const result = solveTimetableCsp({
  schoolId,
  levelKey: 'junior',
  classes: [classItem],
  assignments,
  lessonSlots: slots,
  maxSearchNodesPerClass: 500_000,
});
assert.equal(result.issues.length, 0, result.issues.map((issue) => issue.message).join('\n'));
assert.equal(result.entries.length, 40, 'one class must have one entry per lesson cell');

const validationIssues = validateTimetableRules({
  entries: result.entries,
  slots,
  subjectNames,
  classes: [classItem],
  levelGroup: 'junior',
  requireComplete: true,
  requiredLessonCounts,
});
assert.deepEqual(validationIssues, [], validationIssues.map((issue) => issue.message).join('\n'));

for (const entry of result.entries) {
  const name = subjectNames.get(String(entry.subject_id)) || '';
  const lesson = Number(String(slots.find((slot) => slot.id === entry.time_slot_id)?.label).match(/(\d+)/)?.[1]);
  if (/mathemat/i.test(name)) assert.ok(lesson <= 4, `Maths was placed in Lesson ${lesson}`);
  if (/english/i.test(name)) assert.ok(lesson <= 5, `English was placed in Lesson ${lesson}`);
  if (/science|pre-technical/i.test(name)) assert.ok(lesson <= 6, `${name} was placed in Lesson ${lesson}`);
  if (/kiswahili/i.test(name)) assert.ok(lesson <= 7, `Kiswahili was placed in Lesson ${lesson}`);
}

// Rule 14 — a class whose weekly lessons do not fill the level's week must WARN
// and let the admin decide, never block outright. Dropping the single Music lesson
// leaves the class one lesson short of the week.
const shortTotal = solveTimetableCsp({
  schoolId,
  levelKey: 'junior',
  classes: [classItem],
  assignments: assignments.slice(0, -1),
  lessonSlots: slots,
});
assert.equal(shortTotal.issues.length, 0, 'a lesson-count mismatch must not be a hard error');
assert.ok(shortTotal.needsConfirmation, 'a lesson-count mismatch must ask the admin');
assert.equal(shortTotal.shortClasses.length, 1);
assert.equal(shortTotal.shortClasses[0].configuredTotal, 39);
assert.equal(shortTotal.shortClasses[0].expectedTotal, 40);
assert.ok(shortTotal.warnings.some((warning) => warning.code === 'weekly-total-mismatch'));
assert.equal(shortTotal.entries.length, 0, 'nothing is saved before the admin answers');

// Choosing to continue places every configured lesson and leaves only the cells
// the class has no lessons for empty.
const continued = solveTimetableCsp({
  schoolId,
  levelKey: 'junior',
  classes: [classItem],
  assignments: assignments.slice(0, -1),
  lessonSlots: slots,
  allowIncompleteClasses: true,
});
assert.equal(continued.issues.length, 0, continued.issues.map((issue) => issue.message).join('\n'));
assert.equal(continued.entries.length, 39, 'every configured lesson must still be placed');
assert.equal(continued.needsConfirmation, false, 'continuing must not ask again');
const continuedIssues = validateTimetableRules({
  entries: continued.entries,
  slots,
  subjectNames,
  classes: [classItem],
  levelGroup: 'junior',
  requireComplete: false,
  requiredLessonCounts: new Map(
    assignments.slice(0, -1).map((a) => [`${a.class_id}-${a.subject_id}`, a.lessons_per_week]),
  ),
});
assert.deepEqual(continuedIssues, [], continuedIssues.map((issue) => issue.message).join('\n'));

// A class with MORE lessons than the week holds is a data warning. The UI shows
// the exact fix and does not offer continuation because no exact grid exists.
const overTotal = solveTimetableCsp({
  schoolId,
  levelKey: 'junior',
  classes: [classItem],
  assignments: [...assignments, { class_id: classId, subject_id: 'extra', teacher_id: 'teacher-extra', lessons_per_week: 3, subjects: { name: 'Extra Subject' } }],
  lessonSlots: slots,
});
assert.equal(overTotal.issues.length, 0);
assert.equal(overTotal.needsConfirmation, true);
assert.ok(overTotal.warnings.some((warning) => warning.code === 'weekly-total-overflow'));

const casDoubleResult = solveTimetableCsp({
  schoolId,
  levelKey: 'junior',
  classes: [classItem],
  assignments: [
    { class_id: classId, subject_id: 'cas', teacher_id: 'teacher-cas', lessons_per_week: 2, is_double_lesson: true, subjects: { name: 'Creative Arts and Sports' } },
    ...Array.from({ length: 6 }, (_, index) => ({
      class_id: classId,
      subject_id: `generic-${index + 1}`,
      teacher_id: `teacher-generic-${index + 1}`,
      lessons_per_week: 5,
      subjects: { name: `Learning Area ${index + 1}` },
    })),
    { class_id: classId, subject_id: 'generic-7', teacher_id: 'teacher-generic-7', lessons_per_week: 4, subjects: { name: 'Learning Area 7' } },
    { class_id: classId, subject_id: 'generic-8', teacher_id: 'teacher-generic-8', lessons_per_week: 4, subjects: { name: 'Learning Area 8' } },
  ],
  lessonSlots: slots,
});
assert.equal(casDoubleResult.issues.length, 0, casDoubleResult.issues.map((issue) => issue.message).join('\n'));
const casCells = casDoubleResult.entries
  .filter((entry) => entry.subject_id === 'cas')
  .map((entry) => slots.findIndex((slot) => slot.id === entry.time_slot_id) + 1);
assert.ok(Math.min(...casCells) >= 3, `CAS double started too early at Lesson ${Math.min(...casCells)}`);

console.log('TIMETABLE CSP SOLVER REGRESSION PASS', JSON.stringify({
  entries: result.entries.length,
  searchNodes: result.searchNodes,
  durationMs: result.durationMs,
}));
