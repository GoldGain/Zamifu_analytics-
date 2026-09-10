import { generateSlots, resolveLessonTargets } from '../src/lib/timetable-generator.ts';

const config = {
  lesson_duration: 35,
  school_start: '08:00',
  school_end: '16:10',
  first_break_start: '09:40',
  first_break_end: '10:20',
  second_break_start: '11:40',
  second_break_end: '12:00',
  lunch_start: '12:50',
  lunch_end: '14:00',
  activities_start: '15:30',
  activities_end: '16:10',
  lessons_per_day: 7,
  after_lunch_lessons: 1,
};

const targets = resolveLessonTargets('upper-primary', config);
const slots = generateSlots(config, 6, 'upper-primary');
const lessons = slots.filter((slot) => slot.slot_type === 'lesson');
const lunchIndex = slots.findIndex((slot) => slot.slot_type === 'lunch');
const lunch = slots[lunchIndex];
const postLunchLessons = slots.slice(lunchIndex + 1).filter((slot) => slot.slot_type === 'lesson');
const activities = slots.filter((slot) => slot.slot_type === 'activities');

if (targets.totalLessons !== 6 || targets.afterLunch !== 0) {
  throw new Error(`Upper Primary target mismatch: ${JSON.stringify(targets)}`);
}
if (lessons.length !== 6 || postLunchLessons.length !== 0) {
  throw new Error(`Upper Primary lesson count mismatch: total=${lessons.length}, postLunch=${postLunchLessons.length}`);
}
if (!lunch || lessons.at(-1)?.end_time !== lunch.start_time) {
  throw new Error(`Upper Primary Lesson 6 must end at lunch start: lunch=${lunch?.start_time}, lesson6=${lessons.at(-1)?.end_time}`);
}
if (activities.length !== 0) {
  throw new Error(`Upper Primary must not add a post-lunch activity column: ${JSON.stringify(activities)}`);
}

console.log('Upper Primary slot invariants passed: 6 lessons ending at lunch, no post-lunch activity column.');
