/**
 * Shared timetable generation logic
 *
 * Structure (always 6 lessons before lunch):
 *   L1, L2 → FIRST BREAK → L3, L4 → SECOND BREAK → L5, L6 → LUNCH
 *   → optional after-lunch lessons (0–3) → ACTIVITIES
 *
 * Default lesson counts (overridable from DB / Timetable Setup):
 * | Level            | Total | After lunch |
 * |------------------|-------|-------------|
 * | Pre-Primary      | 6     | 0           |
 * | Lower Primary    | 6     | 0           |
 * | Primary 1-6      | 6     | 0           |
 * | Junior School    | 8     | 2           |
 * | Senior 10-12     | 7     | 1           |
 * | 8-4-4            | 7     | 1           |
 */

export interface TimetableSlot {
  slot_order: number;
  label: string;
  slot_type: 'lesson' | 'break' | 'lunch' | 'activities';
  start_time: string;
  end_time: string;
}

export interface TimetableConfig {
  lesson_duration: number;
  school_start: string;
  school_end: string;
  first_break_start: string;
  first_break_end: string;
  second_break_start: string;
  second_break_end: string;
  lunch_start: string;
  lunch_end: string;
  activities_start?: string;
  activities_end?: string;
  activities?: Record<string, string>;
  /** Optional overrides from DB (preferred over LEVEL_CONFIG defaults) */
  lessons_per_day?: number;
  after_lunch_lessons?: number;
}

export interface LevelLessonConfig {
  totalLessons: number;
  afterLunch: number;
}

/** Built-in defaults — used only when DB does not supply counts.
 * Senior (Grade 10-12): 7 lessons/day, 1 after lunch.
 * Form 3 & 4 (8-4-4): 7 lessons/day, 1 after lunch.
 */
export const LEVEL_CONFIG: Record<string, LevelLessonConfig> = {
  'pre-primary': { totalLessons: 6, afterLunch: 0 },
  'lower-primary': { totalLessons: 6, afterLunch: 0 },
  'upper-primary': { totalLessons: 6, afterLunch: 0 },
  'combined-primary': { totalLessons: 6, afterLunch: 0 },
  junior: { totalLessons: 8, afterLunch: 2 },
  senior: { totalLessons: 7, afterLunch: 1 },
  'form-3-4': { totalLessons: 7, afterLunch: 1 },
  // legacy aliases
  lower_primary: { totalLessons: 6, afterLunch: 0 },
  upper_primary: { totalLessons: 7, afterLunch: 1 },
  junior_school: { totalLessons: 8, afterLunch: 2 },
  senior_school: { totalLessons: 7, afterLunch: 1 },
  '8-4-4': { totalLessons: 7, afterLunch: 1 },
};

/** @deprecated prefer LEVEL_CONFIG */
export const LESSON_COUNTS: Record<string, number> = Object.fromEntries(
  Object.entries(LEVEL_CONFIG).map(([k, v]) => [k, v.totalLessons])
);

const timeToMinutes = (time: string | null | undefined): number => {
  if (!time || typeof time !== 'string') return 0;
  const parts = time.split(':');
  if (parts.length < 2) return 0;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * Normalize any time-like input to Postgres-friendly HH:MM:SS.
 * Returns null for empty/invalid values.
 */
export function normalizeTime(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const mm = m[2];
  const ss = (m[3] || '00').padStart(2, '0');
  const hNum = Number(hh);
  const mNum = Number(mm);
  if (hNum > 23 || mNum > 59) return null;
  return `${hh}:${mm}:${ss}`;
}

export function getLevelConfig(level: string): LevelLessonConfig | null {
  if (LEVEL_CONFIG[level]) return LEVEL_CONFIG[level];
  const normalized = level.replace(/-/g, '_');
  if (LEVEL_CONFIG[normalized]) return LEVEL_CONFIG[normalized];
  return null;
}

export function getLessonCountForLevel(level: string, override?: number | null): number {
  if (typeof override === 'number' && override >= 6 && override <= 9) return override;
  const config = getLevelConfig(level);
  if (config) return config.totalLessons;
  if (LESSON_COUNTS[level] !== undefined) return LESSON_COUNTS[level];
  const normalized = level.replace(/-/g, '_');
  if (LESSON_COUNTS[normalized] !== undefined) return LESSON_COUNTS[normalized];
  return 8;
}

export type TimetablePriorityBand = 'auto' | 'none' | 'early_morning' | 'mid_morning' | 'late_morning' | 'afternoon';

export type SubjectFamily =
  | 'math'
  | 'english'
  | 'science'
  | 'pretech'
  | 'kiswahili'
  | 'religious'
  | 'other';

/** Classify a learning area by its timetable family (case-insensitive). */
export function classifySubject(subjectName: string | null | undefined): SubjectFamily {
  const n = String(subjectName || '').trim().toLowerCase();
  if (/mathemat/.test(n)) return 'math';
  if (/\benglish\b|english\s*language/.test(n)) return 'english';
  if (/integrated\s*science|\bscience\b|environment/.test(n)) return 'science';
  if (/pre[\s-]*technical|pre[\s-]*tech/.test(n)) return 'pretech';
  if (/kiswahili/.test(n)) return 'kiswahili';
  if (/religious|\bcre\b|\bire\b|\bhre\b|islamic|christian|hindu|muslim/.test(n)) return 'religious';
  return 'other';
}

/** Names that are not learning areas and must never be generated as lessons. */
export function isFillerSubject(subjectName: string | null | undefined): boolean {
  const n = String(subjectName || '').trim().toLowerCase();
  return /reading\s*(?:and|&)\s*research|\bstudy\b|\brevision\b|\bproject\s*work\b|\bguided\s*study\b|\bindependent\s*study\b|\breflection\s*&?\s*review\b|\blibrary\s*\/\s*study/i.test(n);
}

/**
 * Final subject placement gate from the timetable requirements.
 *
 * Mathematics and English use Lessons 1–2, Integrated Science and
 * Pre-Technical Studies use Lessons 3–5, Kiswahili may use Lessons 1–7, and
 * other learning areas may use the later lesson periods.
 */
export function strictSubjectAllowsLesson(
  subjectName: string | null | undefined,
  lessonNumber: number,
): boolean {
  const fam = classifySubject(subjectName);
  if (fam === 'math' || fam === 'english') return lessonNumber >= 1 && lessonNumber <= 2;
  if (fam === 'science' || fam === 'pretech') return lessonNumber >= 3 && lessonNumber <= 5;
  if (fam === 'kiswahili') return lessonNumber >= 1 && lessonNumber <= 7;
  return lessonNumber >= 3;
}

export interface LessonUnitSlot {
  slot_order: number;
  slot_type?: string;
  label?: string;
}

/**
 * A double lesson may only occupy two lesson slots that are adjacent in the
 * ordered timetable. The subject window is checked for both cells so a repair
 * pass cannot silently move half of a configured pair into another band.
 */
export function isValidDoubleLessonPair(
  subjectName: string | null | undefined,
  firstSlot: LessonUnitSlot | null | undefined,
  secondSlot: LessonUnitSlot | null | undefined,
): boolean {
  if (!firstSlot || !secondSlot) return false;
  if (firstSlot.slot_type && firstSlot.slot_type !== 'lesson') return false;
  if (secondSlot.slot_type && secondSlot.slot_type !== 'lesson') return false;
  if (secondSlot.slot_order !== firstSlot.slot_order + 1) return false;
  const firstLesson = Number(String(firstSlot.label || '').match(/lesson\s+(\d+)/i)?.[1]);
  const secondLesson = Number(String(secondSlot.label || '').match(/lesson\s+(\d+)/i)?.[1]);
  if (!Number.isFinite(firstLesson) || !Number.isFinite(secondLesson)) return false;
  const family = classifySubject(subjectName);
  if ((family === 'science' || family === 'pretech') && (firstLesson !== 3 || secondLesson !== 4)) return false;
  return strictSubjectAllowsLesson(subjectName, firstLesson)
    && strictSubjectAllowsLesson(subjectName, secondLesson);
}


/** Return true when two adjacent lesson subjects violate the Math/Science rule. */
export function violatesMathScienceSequence(
  currentSubject: string | null | undefined,
  adjacentSubject: string | null | undefined,
): boolean {
  const current = String(currentSubject || '').trim().toLowerCase();
  const adjacent = String(adjacentSubject || '').trim().toLowerCase();
  const currentIsMath = /mathemat/.test(current);
  const currentIsScience = /integrated\s*science|\bscience\b|environment/.test(current);
  const adjacentIsMath = /mathemat/.test(adjacent);
  const adjacentIsScience = /integrated\s*science|\bscience\b|environment/.test(adjacent);
  return (currentIsMath && adjacentIsScience) || (currentIsScience && adjacentIsMath);
}

/**
 * Default subject placement policy used when an administrator creates an
 * assignment and has not yet selected a custom band. These are preferences,
 * not hard overrides: an explicit assignment priority remains authoritative.
 *
 * The canonical four windows are deliberately aligned with the school-day
 * lesson numbers: Early Morning (L1–2), Mid Morning (L3–4), Late Morning
 * (L5–6), and Afternoon (L7+).
 */
export function getDefaultPriorityBand(subjectName: string | null | undefined): TimetablePriorityBand {
  const name = String(subjectName || '').trim().toLowerCase();
  if (/mathemat/.test(name) || /\benglish\b/.test(name)) return 'early_morning';
  if (/integrated\s*science|\bscience\b/.test(name)) return 'mid_morning';
  if (/agricultur|pre[\s-]*technical|pre[\s-]*tech/.test(name)) return 'mid_morning';
  if (/kiswahili|\blanguage(?:s)?\b|french|german|arabic/.test(name)) return 'late_morning';
  if (/social\s*stud|religious|\bcre\b|christian|islamic|creative\s*arts?/.test(name)) return 'afternoon';
  return 'none';
}

/** Default exact lesson anchors for the two core morning subjects. */
export function getDefaultPriorityLesson(subjectName: string | null | undefined): number | null {
  const name = String(subjectName || '').trim().toLowerCase();
  if (/mathemat/.test(name)) return 1;
  if (/\benglish\b/.test(name)) return 2;
  return null;
}

/**
 * Decide whether a fallback scheduling pass should skip a slot that belongs to
 * the preferred priority band. When an assignment has no priority band, its
 * preferred slots are the complete lesson-slot set; the fallback must therefore
 * keep all slots eligible instead of skipping the entire timetable.
 */
export function shouldSkipPreferredSlot(
  skipPreferredStarts: boolean,
  preferredSlotIds: ReadonlySet<string>,
  totalLessonSlotCount: number,
  slotId: string,
): boolean {
  return skipPreferredStarts
    && preferredSlotIds.size < totalLessonSlotCount
    && preferredSlotIds.has(slotId);
}

/**
 * Order weekdays for assignment placement.
 *
 * Non-double assignments should use each available weekday once before a
 * fallback pass is allowed to repeat a day. This prevents a five-lesson
 * assignment from clustering twice on one day when another weekday is still
 * available, while still allowing six-or-more lessons to fit after the unique
 * weekdays have been exhausted.
 */
export function orderAssignmentDays(
  dayOrder: readonly number[],
  dayUsage: ReadonlyMap<number, number>,
  rotationOffset = 0,
  allowRepeatedDays = false,
): number[] {
  const unusedDays = dayOrder.filter((day) => (dayUsage.get(day) || 0) === 0);
  const usedDays = dayOrder.filter((day) => (dayUsage.get(day) || 0) > 0);
  const orderedDays = allowRepeatedDays ? [...unusedDays, ...usedDays] : unusedDays;
  if (orderedDays.length === 0) return [];
  const start = ((rotationOffset % orderedDays.length) + orderedDays.length) % orderedDays.length;
  return [...orderedDays.slice(start), ...orderedDays.slice(0, start)];
}

/**
 * Decide whether a placement unit may use a weekday for an assignment.
 *
 * A non-double assignment with five or fewer weekly lessons must not place a
 * second single lesson on a weekday while an unused available weekday exists.
 * This guard belongs at the actual placement boundary as well as in day-order
 * helpers, otherwise a slot conflict can bypass the intended one-per-day rule.
 */
export function canUseAssignmentDay(
  dayUsage: ReadonlyMap<number, number>,
  day: number,
  isDoubleLesson: boolean,
  lessonsPerWeek: number,
  unitSize: 1 | 2 = 1,
): boolean {
  const alreadyUsed = (dayUsage.get(day) || 0) > 0;
  // A double is one atomic placement and may only be placed on an otherwise
  // unused day. Its two consecutive slots are represented by unitSize=2.
  if (unitSize === 2) return !alreadyUsed;
  // For five or fewer weekly lessons, a single placement must use a weekday
  // only once. Day ordering prefers unused weekdays first, but this boundary
  // guard is required because teacher, class, activity, and adjacency conflicts
  // can otherwise bypass that preference during fallback and repair passes.
  if (lessonsPerWeek <= 5) return !alreadyUsed;
  // More than five weekly lessons cannot fit one per weekday, so reuse is
  // explicitly allowed once every valid weekday has been considered.
  return true;
}

export function getAfterLunchCount(level: string, override?: number | null): number {
  if (typeof override === 'number' && override >= 0 && override <= 3) return override;
  const config = getLevelConfig(level);
  if (config) return config.afterLunch;
  const total = getLessonCountForLevel(level);
  if (total <= 6) return 0;
  if (total === 7) return 1;
  if (total === 8) return 2;
  if (total >= 9) return 3;
  return 2;
}

export function hasLessonsAfterLunch(level: string): boolean {
  return getAfterLunchCount(level) > 0;
}

/**
 * Resolve canonical target lesson totals from the level key. Saved setup
 * controls clock times, but cannot silently change the required level rules.
 */
export function resolveLessonTargets(
  levelKey: string,
  config?: Partial<TimetableConfig> | null
): { totalLessons: number; afterLunch: number } {
  void config;
  const canonical = getLevelConfig(levelKey) || { totalLessons: 8, afterLunch: 2 };
  return { totalLessons: canonical.totalLessons, afterLunch: canonical.afterLunch };
}

/**
 * Generate ordered time slots for a level.
 * @param config - times from Timetable Setup / DB
 * @param maxLessons - optional total lessons (6–9). Prefer config.lessons_per_day when set.
 * @param levelKey - optional level key for default counts
 */
export function generateSlots(
  config: TimetableConfig,
  maxLessons?: number,
  levelKey?: string
): TimetableSlot[] {
  const targets = resolveLessonTargets(levelKey || '', {
    ...config,
    lessons_per_day:
      typeof maxLessons === 'number'
        ? maxLessons
        : config?.lessons_per_day,
  });
  const targetLessons = targets.totalLessons;
  const afterLunch = targets.afterLunch;

  const duration = config?.lesson_duration || 40;
  // Multi-tenant: refuse to invent school-specific clock times.
  const schoolStart = (config?.school_start || '').toString().slice(0, 5);
  const firstBreakStart = (config?.first_break_start || '').toString().slice(0, 5);
  const firstBreakEnd = (config?.first_break_end || '').toString().slice(0, 5);
  const secondBreakStart = (config?.second_break_start || '').toString().slice(0, 5);
  const secondBreakEnd = (config?.second_break_end || '').toString().slice(0, 5);
  let lunchStart = (config?.lunch_start || '').toString().slice(0, 5);
  let lunchEnd = (config?.lunch_end || '').toString().slice(0, 5);
  if (!schoolStart || !firstBreakStart || !firstBreakEnd || !secondBreakStart || !secondBreakEnd || !lunchStart || !lunchEnd) {
    throw new Error(
      'Missing timetable times for this school level. Save Timetable Setup (start, breaks, lunch) before generating.'
    );
  }

  let currentMinutes = timeToMinutes(schoolStart);
  const slots: TimetableSlot[] = [];
  let order = 1;

  const pushLesson = (n: number) => {
    slots.push({
      slot_order: order++,
      label: `Lesson ${n}`,
      slot_type: 'lesson',
      start_time: minutesToTime(currentMinutes),
      end_time: minutesToTime(currentMinutes + duration),
    });
    currentMinutes += duration;
  };

  // Lessons 1–2
  pushLesson(1);
  pushLesson(2);

  // FIRST BREAK. If a saved anchor is earlier than the preceding lessons,
  // move the break after those lessons instead of overlapping Lesson 2.
  const firstBreakDuration = Math.max(1, timeToMinutes(firstBreakEnd) - timeToMinutes(firstBreakStart));
  const normalizedFirstBreakStart = Math.max(currentMinutes, timeToMinutes(firstBreakStart));
  const normalizedFirstBreakEnd = normalizedFirstBreakStart + firstBreakDuration;
  slots.push({
    slot_order: order++,
    label: 'FIRST BREAK',
    slot_type: 'break',
    start_time: minutesToTime(normalizedFirstBreakStart),
    end_time: minutesToTime(normalizedFirstBreakEnd),
  });
  currentMinutes = normalizedFirstBreakEnd;

  // Lessons 3–4
  pushLesson(3);
  pushLesson(4);

  // SECOND BREAK. Keep the anchor after Lessons 3–4 when the saved time is
  // inconsistent with the selected level’s lesson duration.
  const secondBreakDuration = Math.max(1, timeToMinutes(secondBreakEnd) - timeToMinutes(secondBreakStart));
  const normalizedSecondBreakStart = Math.max(currentMinutes, timeToMinutes(secondBreakStart));
  const normalizedSecondBreakEnd = normalizedSecondBreakStart + secondBreakDuration;
  slots.push({
    slot_order: order++,
    label: 'SECOND BREAK',
    slot_type: 'break',
    start_time: minutesToTime(normalizedSecondBreakStart),
    end_time: minutesToTime(normalizedSecondBreakEnd),
  });
  currentMinutes = normalizedSecondBreakEnd;

  // Lessons 5–6
  pushLesson(5);
  pushLesson(6);

  // LUNCH. If saved times are inconsistent with the six pre-lunch lessons,
  // move the lunch window forward rather than creating an overlap or a lesson
  // that appears after lunch. This is especially important for Lower Primary.
  const lunchDuration = Math.max(1, timeToMinutes(lunchEnd) - timeToMinutes(lunchStart));
  const normalizedLunchStart = Math.max(currentMinutes, timeToMinutes(lunchStart));
  const normalizedLunchEnd = normalizedLunchStart + lunchDuration;
  lunchStart = minutesToTime(normalizedLunchStart);
  lunchEnd = minutesToTime(normalizedLunchEnd);
  slots.push({
    slot_order: order++,
    label: 'LUNCH',
    slot_type: 'lunch',
    start_time: lunchStart,
    end_time: lunchEnd,
  });

  // After-lunch lessons (0–3)
  if (afterLunch > 0) {
    currentMinutes = timeToMinutes(lunchEnd);
    for (let i = 0; i < afterLunch; i++) {
      pushLesson(7 + i);
    }
  }

  // Generic activities belong after lessons. A level with zero after-lunch lessons
  // (Pre-Primary / Lower Primary) must end at lunch unless an explicit, separately
  // scheduled activity is supplied by the generator.
  const hasActivityTimes = afterLunch > 0 && !!(config?.activities_start || config?.activities_end);
  if (hasActivityTimes) {
    const activitiesStartTime = config?.activities_start
      ? String(config.activities_start).slice(0, 5)
      : minutesToTime(currentMinutes);

    const activitiesEndTime = config?.activities_end
      ? String(config.activities_end).slice(0, 5)
      : config?.school_end
        ? String(config.school_end).slice(0, 5)
        : '';

    // Only add when this school configured a real activities end time
    if (activitiesEndTime && timeToMinutes(activitiesEndTime) > timeToMinutes(activitiesStartTime)) {
      slots.push({
        slot_order: order++,
        label: 'ACTIVITIES',
        slot_type: 'activities',
        start_time: activitiesStartTime,
        end_time: activitiesEndTime,
      });
    }
  }

  // Sanity: ensure lesson count matches target
  const lessonCount = slots.filter((s) => s.slot_type === 'lesson').length;
  if (lessonCount !== targetLessons) {
    console.warn(
      `[timetable-generator] lesson count mismatch: got ${lessonCount}, expected ${targetLessons} (afterLunch=${afterLunch})`
    );
  }

  return slots;
}

export function getActivityForDay(config: TimetableConfig | null, day: number): string {
  if (!config?.activities) return 'Activity';
  return config.activities[day] || config.activities[String(day)] || 'Activity';
}

export function formatTimeDisplay(time: string | null | undefined): string {
  if (!time || typeof time !== 'string') return '';
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const hour = Number(parts[0]);
  const min = parts[1];
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hour12}:${min}`;
}

export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  return `${formatTimeDisplay(start)}-${formatTimeDisplay(end)}`;
}

/** Summarize slots for View Timetable UI */
export function summarizeSlots(slots: TimetableSlot[]): {
  totalLessons: number;
  afterLunch: number;
  beforeLunch: number;
  hasActivities: boolean;
  schoolEnd: string | null;
  lunchEnd: string | null;
} {
  const lessons = slots.filter((s) => s.slot_type === 'lesson');
  const lunchIdx = slots.findIndex((s) => s.slot_type === 'lunch');
  const afterLunch =
    lunchIdx >= 0
      ? slots.slice(lunchIdx + 1).filter((s) => s.slot_type === 'lesson').length
      : 0;
  const activities = slots.find((s) => s.slot_type === 'activities');
  const lunch = slots.find((s) => s.slot_type === 'lunch');
  const last = slots[slots.length - 1];
  return {
    totalLessons: lessons.length,
    afterLunch,
    beforeLunch: lessons.length - afterLunch,
    hasActivities: !!activities,
    schoolEnd: activities?.end_time || last?.end_time || null,
    lunchEnd: lunch?.end_time || null,
  };
}
