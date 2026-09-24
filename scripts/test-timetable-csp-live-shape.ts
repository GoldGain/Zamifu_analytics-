import assert from 'node:assert/strict';
import { solveTimetableCsp } from '../src/lib/timetable-csp-solver.ts';

const slots = Array.from({ length: 8 }, (_, index) => ({
  id: `slot-${index + 1}`,
  slot_order: index + 1,
  slot_type: 'lesson',
  label: `Lesson ${index + 1}`,
  start_time: `08:${String(index * 40).padStart(2, '0')}`,
  end_time: `09:${String(index * 40).padStart(2, '0')}`,
}));
const classes = [
  { id: 'grade-7', name: 'Grade 7' },
  { id: 'grade-8', name: 'Grade 8' },
  { id: 'grade-9', name: 'Grade 9' },
];
const subjectDefinitions = [
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
const assignments = classes.flatMap((cls) => subjectDefinitions.map(([subjectId, subjectName, lessons, isDouble, teacherId]) => ({
  class_id: cls.id,
  subject_id: subjectId,
  teacher_id: teacherId,
  lessons_per_week: lessons,
  is_double_lesson: isDouble,
  available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  subjects: { name: subjectName },
})));
const diagnostics: string[] = [];
for (const cls of classes) {
  const result = solveTimetableCsp({
    schoolId: 'target-school',
    levelKey: 'junior',
    classes: [cls],
    assignments: assignments.filter((assignment) => assignment.class_id === cls.id),
    lessonSlots: slots,
  });
  assert.equal(result.entries.length, 0);
  assert.ok(result.issues.some((issue) => issue.code === 'teacher-day-capacity'));
  diagnostics.push(...result.issues.filter((issue) => issue.code === 'teacher-day-capacity').map((issue) => issue.message));
}
console.log('TIMETABLE CSP LIVE-SHAPE IMPOSSIBILITY DIAGNOSTIC PASS', JSON.stringify({
  classes: classes.length,
  diagnosticCount: diagnostics.length,
  diagnostics,
}));
