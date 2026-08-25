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
const slots = generateSlots(config, 7, 'upper-primary');
const lessons = slots.filter((slot) => slot.slot_type === 'lesson');
const lunchIndex = slots.findIndex((slot) => slot.slot_type === 'lunch');
const lunch = slots[lunchIndex];
const postLunchLessons = slots.slice(lunchIndex + 1).filter((slot) => slot.slot_type === 'lesson');
const activities = slots.filter((slot) => slot.slot_type === 'activities');

if (targets.totalLessons !== 7 || targets.afterLunch !== 1) {
  throw new Error(`Upper Primary target mismatch: ${JSON.stringify(targets)}`);
}
if (lessons.length !== 7 || postLunchLessons.length !== 1) {
  throw new Error(`Upper Primary lesson count mismatch: total=${lessons.length}, postLunch=${postLunchLessons.length}`);
}
if (!lunch || postLunchLessons[0]?.start_time !== lunch.end_time) {
  throw new Error(`Upper Primary Lesson 7 must begin at lunch end: lunch=${lunch?.end_time}, lesson7=${postLunchLessons[0]?.start_time}`);
}
if (postLunchLessons[0]?.label !== 'Lesson 7') {
  throw new Error(`Expected the post-lunch lesson to be Lesson 7, got ${postLunchLessons[0]?.label}`);
}
if (activities.length !== 1 || activities[0]?.start_time !== '15:30' || activities[0]?.end_time !== '16:10') {
  throw new Error(`Upper Primary activity window was not preserved: ${JSON.stringify(activities)}`);
}

console.log('Upper Primary slot invariants passed: 7 lessons, 1 after lunch, Lesson 7 starts at lunch end, activities preserved.');
