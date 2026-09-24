import assert from 'node:assert/strict';
import { solveTimetableCsp } from '../src/lib/timetable-csp-solver.ts';

const slots = Array.from({ length: 8 }, (_, index) => ({ id: `slot-${index + 1}`, slot_order: index + 1, slot_type: 'lesson', label: `Lesson ${index + 1}`, start_time: '08:00', end_time: '08:40' }));
const cls = { id: 'grade-7', name: 'Grade 7' };
const definitions = [
  ['agriculture', 'Agriculture', 4, true, 'teacher-ag-science'],
  ['creative', 'Creative Arts', 5, true, 'teacher-creative-kisw'],
  ['english', 'English', 5, false, 'teacher-english'],
  ['science', 'Integrated Science', 5, true, 'teacher-ag-science'],
  ['kiswahili', 'Kiswahili', 4, false, 'teacher-creative-kisw'],
  ['math', 'Mathematics', 5, false, 'teacher-math-pretech'],
  ['pretech', 'Pre-Technical Studies', 4, true, 'teacher-math-pretech'],
  ['religious', 'Religious Education', 4, false, 'teacher-religious'],
  ['social', 'Social Studies', 4, false, 'teacher-social'],
] as const;
const assignments = definitions.map(([subjectId, subjectName, lessons, isDouble, teacherId]) => ({ class_id: cls.id, subject_id: subjectId, teacher_id: teacherId, lessons_per_week: lessons, is_double_lesson: isDouble, subjects: { name: subjectName } }));
const result = solveTimetableCsp({ schoolId: 'school', levelKey: 'junior', classes: [cls], assignments, lessonSlots: slots, maxSearchNodesPerClass: 500_000 });
assert.ok(result.issues.some((issue) => issue.code === 'teacher-day-capacity'));
assert.equal(result.entries.length, 0);
console.log('ONE CLASS IMPOSSIBILITY DIAGNOSTIC PASS', result.issues.filter((issue) => issue.code === 'teacher-day-capacity').map((issue) => issue.message));
