import assert from 'node:assert/strict';
import { assertTimetableRules, validateTimetableRules } from '../src/lib/timetable-validator.ts';

const slots = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => ({
  id: `lesson-${number}`,
  slot_order: number,
  slot_type: 'lesson',
  label: `Lesson ${number}`,
}));
const subjectNames = new Map([
  ['math', 'Mathematics'],
  ['english', 'English'],
  ['science', 'Integrated Science'],
  ['pretech', 'Pre-Technical Studies'],
  ['kiswahili', 'Kiswahili'],
  ['art', 'Creative Arts'],
  ['social', 'Social Studies'],
  ['religious', 'Religious Education'],
  ['study', 'Study'],
]);
const entry = (subject_id: string, time_slot_id: string, day = 1, entry_type = 'lesson') => ({
  class_id: 'class-1',
  day_of_week: day,
  time_slot_id,
  subject_id,
  teacher_id: `${subject_id}-teacher`,
  entry_type,
  level_group: 'junior',
});
const allRequiredEntries = [
  entry('math', 'lesson-1'),
  entry('english', 'lesson-2'),
  entry('science', 'lesson-3'),
  entry('pretech', 'lesson-4'),
  entry('kiswahili', 'lesson-5'),
];

assert.equal(
  validateTimetableRules({ entries: allRequiredEntries, slots, subjectNames, levelGroup: 'junior' })
    .some((issue) => issue.rule === 'subject-window'),
  false,
  'subjects may use any of Lessons 1–5',
);

assert.doesNotThrow(() => assertTimetableRules({
  entries: [entry('science', 'lesson-3', 1, 'lesson_double'), entry('science', 'lesson-4', 1, 'lesson_double')],
  slots,
  subjectNames,
  classes: [{ id: 'class-1' }],
  days: [1],
  levelGroup: 'junior',
}));

const duplicateSubjectIssues = validateTimetableRules({
  entries: [entry('math', 'lesson-1'), entry('math', 'lesson-2')],
  slots,
  subjectNames,
  levelGroup: 'junior',
});
assert.equal(duplicateSubjectIssues.some((issue) => issue.rule === 'once-per-day'), true);

const strictWindowIssues = validateTimetableRules({
  entries: [entry('math', 'lesson-7'), entry('english', 'lesson-8'), entry('science', 'lesson-6'), entry('pretech', 'lesson-7')],
  slots,
  subjectNames,
  levelGroup: 'junior',
});
assert.equal(strictWindowIssues.filter((issue) => issue.rule === 'subject-window').length, 4);

const adjacencyIssues = validateTimetableRules({
  entries: [entry('math', 'lesson-1'), entry('science', 'lesson-2')],
  slots,
  subjectNames,
  levelGroup: 'junior',
});
assert.equal(adjacencyIssues.some((issue) => issue.rule === 'math-science-adjacency'), true);

const invalidDoubleIssues = validateTimetableRules({
  entries: [entry('science', 'lesson-3', 1, 'lesson_double'), entry('science', 'lesson-5', 1, 'lesson_double')],
  slots,
  subjectNames,
  levelGroup: 'junior',
});
assert.equal(invalidDoubleIssues.some((issue) => issue.rule === 'once-per-day'), true);

const blankIssues = validateTimetableRules({
  entries: allRequiredEntries.slice(0, 7),
  slots,
  subjectNames,
  classes: [{ id: 'class-1', name: 'Grade 7' }],
  days: [1],
  levelGroup: 'junior',
  requireComplete: true,
});
assert.equal(blankIssues.some((issue) => issue.rule === 'no-blanks'), true);

const fillerIssues = validateTimetableRules({
  entries: [entry('study', 'lesson-3')],
  slots,
  subjectNames,
  levelGroup: 'junior',
});
assert.equal(fillerIssues.some((issue) => issue.rule === 'real-subject'), true);

console.log('TIMETABLE HARD-RULE VALIDATOR PASS');
