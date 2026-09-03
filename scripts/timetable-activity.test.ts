import assert from 'node:assert/strict';
import {
  generateSlots,
  getDefaultPriorityBand,
  getDefaultPriorityLesson,
  resolveLessonTargets,
} from '../src/lib/timetable-generator.ts';
import {
  isPostLessonActivity,
  resolveActivityLessonSlot,
  timeIntervalsOverlap,
} from '../src/lib/timetable-activity.ts';
import { buildWeeklyLessonSummary } from '../src/lib/timetable-summary.ts';

const juniorConfig = {
  lesson_duration: 40,
  school_start: '08:20',
  school_end: '17:00',
  first_break_start: '09:40',
  first_break_end: '09:50',
  second_break_start: '11:10',
  second_break_end: '11:30',
  lunch_start: '12:50',
  lunch_end: '14:00',
  activities_start: undefined,
  activities_end: undefined,
  lessons_per_day: 8,
  after_lunch_lessons: 2,
};

const lowerPrimaryConfig = {
  lesson_duration: 35,
  school_start: '08:20',
  school_end: '14:00',
  first_break_start: '09:10',
  first_break_end: '09:20',
  second_break_start: '11:20',
  second_break_end: '11:40',
  lunch_start: '12:45',
  lunch_end: '14:00',
  lessons_per_day: 6,
  after_lunch_lessons: 0,
};

const juniorTargets = resolveLessonTargets('junior', juniorConfig);
assert.deepEqual(juniorTargets, { totalLessons: 8, afterLunch: 2 });
const juniorSlots = generateSlots(juniorConfig, 8, 'junior');
assert.equal(juniorSlots.filter((slot) => slot.slot_type === 'lesson').length, 8);
assert.equal(juniorSlots.filter((slot) => slot.slot_type === 'lesson' && slot.start_time >= juniorConfig.lunch_end).length, 2);
assert.equal(juniorSlots.find((slot) => slot.label === 'Lesson 1')?.start_time, '08:20');
assert.equal(juniorSlots.find((slot) => slot.label === 'Lesson 1')?.end_time, '09:00');
assert.equal(juniorSlots.find((slot) => slot.label === 'FIRST BREAK')?.start_time, '09:40');
assert.equal(juniorSlots.find((slot) => slot.label === 'FIRST BREAK')?.end_time, '09:50');

const lessonNumber = (label: string) => Number(label.match(/Lesson (\d+)/)?.[1]);
const lessonsByBand = {
  early_morning: juniorSlots.filter((slot) => slot.slot_type === 'lesson' && lessonNumber(slot.label) <= 2),
  mid_morning: juniorSlots.filter((slot) => slot.slot_type === 'lesson' && lessonNumber(slot.label) >= 3 && lessonNumber(slot.label) <= 4),
  late_morning: juniorSlots.filter((slot) => slot.slot_type === 'lesson' && lessonNumber(slot.label) >= 5 && lessonNumber(slot.label) <= 6),
  afternoon: juniorSlots.filter((slot) => slot.slot_type === 'lesson' && lessonNumber(slot.label) >= 7),
};
assert.deepEqual(Object.fromEntries(Object.entries(lessonsByBand).map(([band, slots]) => [band, slots.length])), {
  early_morning: 2,
  mid_morning: 2,
  late_morning: 2,
  afternoon: 2,
});
assert.equal(getDefaultPriorityBand('Mathematics'), 'early_morning');
assert.equal(getDefaultPriorityBand('English'), 'early_morning');
assert.equal(getDefaultPriorityBand('Integrated Science'), 'mid_morning');
assert.equal(getDefaultPriorityBand('Agriculture'), 'mid_morning');
assert.equal(getDefaultPriorityBand('Kiswahili'), 'late_morning');
assert.equal(getDefaultPriorityBand('Social Studies'), 'afternoon');
assert.equal(getDefaultPriorityBand('Creative Arts'), 'afternoon');
assert.equal(getDefaultPriorityLesson('Mathematics'), 1);
assert.equal(getDefaultPriorityLesson('English'), 2);

const summarySlots = juniorSlots.filter((slot) => slot.slot_type === 'lesson').map((slot, index) => ({
  id: `summary-${index}`,
  slot_type: slot.slot_type,
}));
const summary = buildWeeklyLessonSummary(
  [{ id: 'class-a' }, { id: 'class-b' }],
  summarySlots,
  (day, classId, slot) => day === 1 && classId === 'class-a' && slot.id === 'summary-0'
    ? [{ subject_id: 'math', subject_name: 'Mathematics' }, { subject_id: 'math', subject_name: 'Mathematics' }]
    : [],
  [
    { class_id: 'class-a', subject_id: 'math', subject_name: 'Mathematics', lessons_per_week: 1 },
    { class_id: 'class-b', subject_id: 'math', subject_name: 'Mathematics', lessons_per_week: 1 },
  ],
);
assert.equal(summary[0]?.totalLessons, 1, 'a duplicated subject in one cell must count once');
assert.equal(summary[0]?.status, 'under', 'a per-class shortfall must remain under');

const legacyPpi = {
  activity_name: 'PPI',
  start_time: '08:00',
  end_time: '09:00',
  blocks_lessons: true,
};
const ppiSlot = resolveActivityLessonSlot(juniorSlots, legacyPpi);
assert.equal(ppiSlot?.label, 'Lesson 1');
assert.equal(ppiSlot?.start_time, '08:20');
assert.equal(ppiSlot?.end_time, '09:00');
assert.equal(isPostLessonActivity(juniorSlots, { activity_name: 'GAMES', start_time: '15:20', end_time: '16:10', blocks_lessons: true }), true);
assert.equal(timeIntervalsOverlap('09:40', '09:50', '09:00', '09:40'), false);

const lowerTargets = resolveLessonTargets('lower-primary', lowerPrimaryConfig);
assert.deepEqual(lowerTargets, { totalLessons: 6, afterLunch: 0 });
const lowerSlots = generateSlots(lowerPrimaryConfig, 6, 'lower-primary');
assert.equal(lowerSlots.filter((slot) => slot.slot_type === 'lesson').length, 6);
assert.equal(lowerSlots.filter((slot) => slot.slot_type === 'lesson' && slot.start_time >= '12:45').length, 0);
assert.equal(resolveActivityLessonSlot(lowerSlots, { ...legacyPpi, end_time: '09:00' })?.label, 'Lesson 1');

console.log('TIMETABLE ACTIVITY REGRESSION PASS');
