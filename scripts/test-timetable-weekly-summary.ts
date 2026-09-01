import assert from 'node:assert/strict';
import { buildWeeklyLessonSummary } from '../src/lib/timetable-summary.ts';

const classes = [{ id: 'A' }, { id: 'B' }];
const slots = [
  { id: 'lesson-1', slot_type: 'lesson' },
  { id: 'break-1', slot_type: 'break' },
  { id: 'lesson-2', slot_type: 'lesson' },
  { id: 'lunch-1', slot_type: 'lunch' },
];

const cells: Record<string, Array<{ subject_id?: string | null; subject_name?: string | null; entry_type?: string | null }>> = {
  '1-A-lesson-1': [
    { subject_id: 'math', subject_name: 'Mathematics', entry_type: 'lesson' },
    { subject_id: 'math', subject_name: 'Mathematics', entry_type: 'lesson' },
  ],
  '1-A-lesson-2': [{ subject_id: null, subject_name: 'PPI', entry_type: 'activity' }],
  '1-B-lesson-1': [{ subject_id: 'math', subject_name: 'Mathematics', entry_type: 'lesson' }],
  '1-B-lesson-2': [{ subject_id: 'science', subject_name: 'Integrated Science', entry_type: 'lesson' }],
  '1-A-break-1': [{ subject_id: 'ignored-break', subject_name: 'Mathematics', entry_type: 'break' }],
  '1-B-lunch-1': [{ subject_id: 'ignored-lunch', subject_name: 'Science', entry_type: 'lunch' }],
  '2-A-lesson-1': [{ subject_id: 'math', subject_name: 'Mathematics', entry_type: 'lesson' }],
  '2-B-lesson-1': [{ subject_id: 'science', subject_name: 'Integrated Science', entry_type: 'lesson' }],
  '2-B-lesson-2': [{ subject_id: 'art', subject_name: 'Creative Arts', entry_type: 'lesson_double' }],
  '3-A-lesson-1': [{ subject_id: 'math', subject_name: 'Mathematics', entry_type: 'lesson' }],
  '3-B-lesson-1': [{ subject_id: 'math', subject_name: 'Mathematics', entry_type: 'lesson' }],
  '4-B-lesson-1': [{ subject_id: 'science', subject_name: 'Integrated Science', entry_type: 'lesson' }],
  '5-A-lesson-1': [{ subject_id: 'science', subject_name: 'Integrated Science', entry_type: 'lesson' }],
};

const summary = buildWeeklyLessonSummary(classes, slots, (day, classId, slot) =>
  cells[`${day}-${classId}-${slot.id}`] || [],
);

assert.deepEqual(
  summary.map(({ key, label, totalLessons, perClass }) => ({ key, label, totalLessons, perClass })),
  [
    { key: 'art', label: 'Creative Arts', totalLessons: 1, perClass: { A: 0, B: 1 } },
    { key: 'science', label: 'Integrated Science', totalLessons: 4, perClass: { A: 1, B: 3 } },
    { key: 'math', label: 'Mathematics', totalLessons: 5, perClass: { A: 3, B: 2 } },
  ].sort((a, b) => a.label.localeCompare(b.label)),
);

assert.equal(summary.some((row) => row.label === 'PPI'), false, 'PPI must not appear as a learning-area count');
assert.equal(summary.some((row) => row.label === 'Science'), false, 'break/lunch entries must not be counted');

const compared = buildWeeklyLessonSummary(
  classes,
  slots,
  (day, classId, slot) => cells[`${day}-${classId}-${slot.id}`] || [],
  [
    { class_id: 'A', subject_id: 'math', subject_name: 'Mathematics', lessons_per_week: 3 },
    { class_id: 'A', subject_id: 'science', subject_name: 'Integrated Science', lessons_per_week: 2 },
    { class_id: 'B', subject_id: 'math', subject_name: 'Mathematics', lessons_per_week: 1 },
    { class_id: 'B', subject_id: 'science', subject_name: 'Integrated Science', lessons_per_week: 4 },
    { class_id: 'B', subject_id: 'art', subject_name: 'Creative Arts', lessons_per_week: 2 },
  ],
);
assert.deepEqual(
  compared.map(({ key, requiredLessons, totalLessons, requiredPerClass, perClass, status }) => ({ key, requiredLessons, totalLessons, requiredPerClass, perClass, status })),
  [
    { key: 'art', requiredLessons: 2, totalLessons: 1, requiredPerClass: { A: 0, B: 2 }, perClass: { A: 0, B: 1 }, status: 'under' },
    { key: 'science', requiredLessons: 6, totalLessons: 4, requiredPerClass: { A: 2, B: 4 }, perClass: { A: 1, B: 3 }, status: 'under' },
    { key: 'math', requiredLessons: 4, totalLessons: 5, requiredPerClass: { A: 3, B: 1 }, perClass: { A: 3, B: 2 }, status: 'over' },
  ],
);
console.log('Weekly timetable summary invariants passed.');
