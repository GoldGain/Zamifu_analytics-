import { generateSlots, resolveLessonTargets } from '../src/lib/timetable-generator.ts';

const fixtures: Record<string, { lessons: number; afterLunch: number; duration: number; start: string; lunch: string; lunchEnd: string }> = {
  'pre-primary': { lessons: 6, afterLunch: 0, duration: 25, start: '08:30', lunch: '12:00', lunchEnd: '12:30' },
  'lower-primary': { lessons: 6, afterLunch: 0, duration: 40, start: '08:20', lunch: '12:50', lunchEnd: '14:00' },
  'upper-primary': { lessons: 7, afterLunch: 1, duration: 35, start: '08:20', lunch: '12:50', lunchEnd: '14:00' },
  'combined-primary': { lessons: 7, afterLunch: 1, duration: 35, start: '08:20', lunch: '12:50', lunchEnd: '14:00' },
  junior: { lessons: 8, afterLunch: 2, duration: 40, start: '08:20', lunch: '12:55', lunchEnd: '14:00' },
  senior: { lessons: 9, afterLunch: 3, duration: 40, start: '08:20', lunch: '12:55', lunchEnd: '14:00' },
  'form-3-4': { lessons: 9, afterLunch: 3, duration: 40, start: '08:20', lunch: '12:55', lunchEnd: '14:00' },
};

for (const [level, f] of Object.entries(fixtures)) {
  const cfg = { lesson_duration: f.duration, school_start: f.start, school_end: '17:00', first_break_start: '09:30', first_break_end: '09:50', second_break_start: '11:00', second_break_end: '11:30', lunch_start: f.lunch, lunch_end: f.lunchEnd, lessons_per_day: f.lessons, after_lunch_lessons: f.afterLunch };
  const targets = resolveLessonTargets(level, cfg);
  const slots = generateSlots(cfg, f.lessons, level);
  const lessons = slots.filter((s) => s.slot_type === 'lesson');
  const lunchIndex = slots.findIndex((s) => s.slot_type === 'lunch');
  const afterLunch = slots.slice(lunchIndex + 1).filter((s) => s.slot_type === 'lesson').length;
  if (targets.totalLessons !== f.lessons || targets.afterLunch !== f.afterLunch || lessons.length !== f.lessons || afterLunch !== f.afterLunch) {
    throw new Error(`${level} mismatch: targets=${JSON.stringify(targets)} generated=${lessons.length}/${afterLunch}`);
  }
  if (f.afterLunch === 0 && lessons.some((s) => slots.indexOf(s) > lunchIndex)) throw new Error(`${level} has a post-lunch lesson`);
  console.log(`${level}: ${lessons.length} lessons, ${afterLunch} after lunch, lunch=${slots[lunchIndex].start_time}-${slots[lunchIndex].end_time}`);
}

console.log('All level slot invariants passed.');
