import assert from 'node:assert/strict';
import { generateSlots, resolveLessonTargets } from '../src/lib/timetable-generator.ts';
import {
  isPostLessonActivity,
  resolveActivityLessonSlot,
  timeIntervalsOverlap,
} from '../src/lib/timetable-activity.ts';

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
