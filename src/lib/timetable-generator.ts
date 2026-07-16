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
 * | Lower Primary    | 7     | 1           |
 * | Upper Primary    | 7     | 1           |
 * | Junior School    | 8     | 2           |
 * | Senior School    | 9     | 3           |
 * | 8-4-4            | 8     | 2           |
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

/** Built-in defaults — used only when DB does not supply counts */
export const LEVEL_CONFIG: Record<string, LevelLessonConfig> = {
  'pre-primary': { totalLessons: 6, afterLunch: 0 },
  'lower-primary': { totalLessons: 7, afterLunch: 1 },
  'upper-primary': { totalLessons: 7, afterLunch: 1 },
  'combined-primary': { totalLessons: 7, afterLunch: 1 },
  junior: { totalLessons: 8, afterLunch: 2 },
  senior: { totalLessons: 9, afterLunch: 3 },
  'form-3-4': { totalLessons: 8, afterLunch: 2 },
  // legacy aliases
  lower_primary: { totalLessons: 7, afterLunch: 1 },
  upper_primary: { totalLessons: 7, afterLunch: 1 },
  junior_school: { totalLessons: 8, afterLunch: 2 },
  senior_school: { totalLessons: 9, afterLunch: 3 },
  '8-4-4': { totalLessons: 8, afterLunch: 2 },
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

const safeString = (value: string | null | undefined, fallback: string): string => {
  if (!value || typeof value !== 'string' || !value.trim()) return fallback;
  // Normalize to HH:MM
  const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
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
 * Resolve target lesson totals from config + level key.
 * Prefers DB overrides on the config object.
 */
export function resolveLessonTargets(
  levelKey: string,
  config?: Partial<TimetableConfig> | null
): { totalLessons: number; afterLunch: number } {
  const afterFromConfig =
    typeof config?.after_lunch_lessons === 'number' ? config.after_lunch_lessons : null;
  const totalFromConfig =
    typeof config?.lessons_per_day === 'number' ? config.lessons_per_day : null;

  let afterLunch = getAfterLunchCount(levelKey, afterFromConfig);
  let totalLessons = getLessonCountForLevel(levelKey, totalFromConfig);

  // Keep invariants: 6 before lunch + afterLunch = total
  if (afterFromConfig != null && totalFromConfig == null) {
    totalLessons = 6 + afterLunch;
  } else if (totalFromConfig != null && afterFromConfig == null) {
    afterLunch = Math.max(0, Math.min(3, totalLessons - 6));
  } else {
    // Prefer after_lunch as source of truth when both present but inconsistent
    totalLessons = 6 + afterLunch;
  }

  totalLessons = Math.max(6, Math.min(9, totalLessons));
  afterLunch = Math.max(0, Math.min(3, afterLunch));
  return { totalLessons, afterLunch };
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
  const lunchStart = (config?.lunch_start || '').toString().slice(0, 5);
  const lunchEnd = (config?.lunch_end || '').toString().slice(0, 5);
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

  // FIRST BREAK
  slots.push({
    slot_order: order++,
    label: 'FIRST BREAK',
    slot_type: 'break',
    start_time: firstBreakStart,
    end_time: firstBreakEnd,
  });
  currentMinutes = timeToMinutes(firstBreakEnd);

  // Lessons 3–4
  pushLesson(3);
  pushLesson(4);

  // SECOND BREAK
  slots.push({
    slot_order: order++,
    label: 'SECOND BREAK',
    slot_type: 'break',
    start_time: secondBreakStart,
    end_time: secondBreakEnd,
  });
  currentMinutes = timeToMinutes(secondBreakEnd);

  // Lessons 5–6
  pushLesson(5);
  pushLesson(6);

  // LUNCH
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

  // ACTIVITIES — skip for pre-primary style (0 after lunch) unless activities times are set
  const hasActivityTimes = !!(config?.activities_start || config?.activities_end);
  if (afterLunch > 0 || hasActivityTimes) {
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
