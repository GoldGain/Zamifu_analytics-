import { generateSlots, resolveLessonTargets, summarizeSlots } from '../src/lib/timetable-generator.ts';

const lowerConfig = {
  lesson_duration: 40,
  school_start: '08:20',
  school_end: '12:50',
  first_break_start: '09:40',
  first_break_end: '10:20',
  second_break_start: '11:40',
  second_break_end: '12:00',
  lunch_start: '12:50',
  lunch_end: '13:30',
  activities_start: '',
  activities_end: '',
  lessons_per_day: 6,
  after_lunch_lessons: 0,
};

const targets = resolveLessonTargets('lower-primary', lowerConfig);
if (targets.totalLessons !== 6 || targets.afterLunch !== 0) throw new Error(`Unexpected Lower Primary targets: ${JSON.stringify(targets)}`);
const slots = generateSlots(lowerConfig, undefined, 'lower-primary');
const summary = summarizeSlots(slots);
if (summary.totalLessons !== 6) throw new Error(`Expected six lessons, got ${summary.totalLessons}`);
if (summary.afterLunch !== 0) throw new Error(`Expected zero lessons after lunch, got ${summary.afterLunch}`);
if (summary.hasActivities) throw new Error('Lower Primary must not receive a generic post-lunch activities slot');
if (!summary.lunchEnd) throw new Error('Expected a visible lunch slot');
const lastLesson = slots.filter(s => s.slot_type === 'lesson').at(-1);
const lunchSlot = slots.find(s => s.slot_type === 'lunch');
if (!lunchSlot || lastLesson?.end_time !== lunchSlot.start_time) throw new Error(`Expected Lesson 6 to end at lunch start, got lesson=${lastLesson?.end_time}, lunch=${lunchSlot?.start_time}`);
console.log('Timetable rule test passed:', JSON.stringify({ targets, summary, lastLesson }));
