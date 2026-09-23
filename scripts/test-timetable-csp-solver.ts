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

const badTotal = solveTimetableCsp({
  schoolId,
  levelKey: 'junior',
  classes: [classItem],
  assignments: assignments.slice(0, -1),
  lessonSlots: slots,
});
assert.ok(badTotal.issues.some((issue) => issue.code === 'level-total'));
assert.match(badTotal.issues.map((issue) => issue.message).join('\n'), /configured subject lessons/);

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
