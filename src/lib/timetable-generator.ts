/**
 * Shared timetable generation logic
 * Break order: Lesson 1&2 → FIRST BREAK → Lesson 3&4 → SECOND BREAK → Lesson 5&6 → LUNCH → Lesson 7&8 → ACTIVITIES
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
  // Issue 3: Support explicit activities start/end times
  activities_start?: string;
  activities_end?: string;
  activities?: Record<string, string>;
}

/**
 * Safely convert time string to minutes.
 * Handles null/undefined/invalid formats gracefully.
 */
const timeToMinutes = (time: string | null | undefined): number => {
  if (!time || typeof time !== 'string') {
    return 0;
  }
  const parts = time.split(':');
  if (parts.length < 2) {
    return 0;
  }
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) {
    return 0;
  }
  return h * 60 + m;
};

const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Get a safe string value with a default fallback
 */
const safeString = (value: string | null | undefined, fallback: string): string => {
  if (value && typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
};

/**
 * Level-based lesson count configuration
 * - Lower Primary (Grade 1-3): 7 lessons (1 after lunch)
 * - Upper Primary (Grade 4-6): 7 lessons (1 after lunch)
 * - Junior School (Grade 7-9): 8 lessons (2 after lunch)
 * - Senior School (Grade 10-12): 9 lessons (3 after lunch)
 * - 8-4-4 (Form 1-4): 8 lessons (2 after lunch)
 */
export const LESSON_COUNTS: Record<string, number> = {
  lower_primary: 7,
  upper_primary: 7,
  junior_school: 8,
  senior_school: 9,
  '8-4-4': 8,
};

/** Get lesson count for a given level. Falls back to 8. */
export function getLessonCountForLevel(level: string): number {
  return LESSON_COUNTS[level] || 8;
}

/**
 * Generate time slots following the exact break order from the timetable image:
 * Lesson 1 → Lesson 2 → FIRST BREAK → Lesson 3 → Lesson 4 → SECOND BREAK → Lesson 5 → Lesson 6 → LUNCH → Lesson 7 → Lesson 8 (optional) → Lesson 9 (optional) → ACTIVITIES
 * 
 * @param config - The timetable configuration
 * @param maxLessons - Maximum number of lessons (7, 8, or 9). Defaults to 8.
 */
export function generateSlots(config: TimetableConfig, maxLessons?: number): TimetableSlot[] {
  const targetLessons = maxLessons && maxLessons >= 7 && maxLessons <= 9 ? maxLessons : 8;
  
  // Use defaults for any missing values to prevent crashes
  const duration = config?.lesson_duration || 40;
  const schoolStart = safeString(config?.school_start, '08:20');
  
  // Break times with safe fallbacks
  const firstBreakStart = safeString(config?.first_break_start, '09:40');
  const firstBreakEnd = safeString(config?.first_break_end, '10:20');
  const secondBreakStart = safeString(config?.second_break_start, '11:40');
  const secondBreakEnd = safeString(config?.second_break_end, '12:20');
  const lunchStart = safeString(config?.lunch_start, '12:50');
  const lunchEnd = safeString(config?.lunch_end, '13:30');

  let currentMinutes = timeToMinutes(schoolStart);
  const slots: TimetableSlot[] = [];

  // Lesson 1
  slots.push({
    slot_order: 1,
    label: 'Lesson 1',
    slot_type: 'lesson',
    start_time: minutesToTime(currentMinutes),
    end_time: minutesToTime(currentMinutes + duration),
  });
  currentMinutes += duration;

  // Lesson 2
  slots.push({
    slot_order: 2,
    label: 'Lesson 2',
    slot_type: 'lesson',
    start_time: minutesToTime(currentMinutes),
    end_time: minutesToTime(currentMinutes + duration),
  });
  currentMinutes += duration;

  // FIRST BREAK (after lesson 2)
  slots.push({
    slot_order: 3,
    label: 'FIRST BREAK',
    slot_type: 'break',
    start_time: firstBreakStart,
    end_time: firstBreakEnd,
  });
  currentMinutes = timeToMinutes(firstBreakEnd);

  // Lesson 3
  slots.push({
    slot_order: 4,
    label: 'Lesson 3',
    slot_type: 'lesson',
    start_time: minutesToTime(currentMinutes),
    end_time: minutesToTime(currentMinutes + duration),
  });
  currentMinutes += duration;

  // Lesson 4
  slots.push({
    slot_order: 5,
    label: 'Lesson 4',
    slot_type: 'lesson',
    start_time: minutesToTime(currentMinutes),
    end_time: minutesToTime(currentMinutes + duration),
  });
  currentMinutes += duration;

  // SECOND BREAK (after lesson 4)
  slots.push({
    slot_order: 6,
    label: 'SECOND BREAK',
    slot_type: 'break',
    start_time: secondBreakStart,
    end_time: secondBreakEnd,
  });
  currentMinutes = timeToMinutes(secondBreakEnd);

  // Lesson 5
  slots.push({
    slot_order: 7,
    label: 'Lesson 5',
    slot_type: 'lesson',
    start_time: minutesToTime(currentMinutes),
    end_time: minutesToTime(currentMinutes + duration),
  });
  currentMinutes += duration;

  // Lesson 6
  slots.push({
    slot_order: 8,
    label: 'Lesson 6',
    slot_type: 'lesson',
    start_time: minutesToTime(currentMinutes),
    end_time: minutesToTime(currentMinutes + duration),
  });
  currentMinutes += duration;

  // LUNCH (after lesson 6)
  slots.push({
    slot_order: 9,
    label: 'LUNCH',
    slot_type: 'lunch',
    start_time: lunchStart,
    end_time: lunchEnd,
  });
  currentMinutes = timeToMinutes(lunchEnd);

  // Lesson 7 (always present)
  slots.push({
    slot_order: 10,
    label: 'Lesson 7',
    slot_type: 'lesson',
    start_time: minutesToTime(currentMinutes),
    end_time: minutesToTime(currentMinutes + duration),
  });
  currentMinutes += duration;

  // Lesson 8 (only if targetLessons >= 8)
  if (targetLessons >= 8) {
    slots.push({
      slot_order: 11,
      label: 'Lesson 8',
      slot_type: 'lesson',
      start_time: minutesToTime(currentMinutes),
      end_time: minutesToTime(currentMinutes + duration),
    });
    currentMinutes += duration;
  }

  // Lesson 9 (only if targetLessons >= 9)
  if (targetLessons >= 9) {
    slots.push({
      slot_order: 12,
      label: 'Lesson 9',
      slot_type: 'lesson',
      start_time: minutesToTime(currentMinutes),
      end_time: minutesToTime(currentMinutes + duration),
    });
    currentMinutes += duration;
  }

  // ACTIVITIES — use activities_start/activities_end if configured, else fall back to school_end
  const activitiesStartTime = config?.activities_start
    ? safeString(config.activities_start, minutesToTime(currentMinutes))
    : minutesToTime(currentMinutes);
  
  const activitiesEndTime = config?.activities_end
    ? safeString(config.activities_end, '')
    : config?.school_end
    ? safeString(config.school_end, minutesToTime(currentMinutes + 40))
    : minutesToTime(currentMinutes + 40);

  slots.push({
    slot_order: targetLessons >= 9 ? 13 : targetLessons >= 8 ? 13 : 12,
    label: 'ACTIVITIES',
    slot_type: 'activities',
    start_time: activitiesStartTime,
    end_time: activitiesEndTime || minutesToTime(currentMinutes + 40),
  });

  return slots;
}

/**
 * Get activity name for a specific day from config
 */
export function getActivityForDay(config: TimetableConfig | null, day: number): string {
  if (!config?.activities) return 'Activity';
  return config.activities[day] || config.activities[String(day)] || 'Activity';
}

/**
 * Format time for display (e.g., "08:20" → "8:20")
 * Handles null/undefined safely
 */
export function formatTimeDisplay(time: string | null | undefined): string {
  if (!time || typeof time !== 'string') return '';
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const hour = Number(parts[0]);
  const min = parts[1];
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hour12}:${min}`;
}

/**
 * Format time range for header display
 */
export function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  return `${formatTimeDisplay(start)}–${formatTimeDisplay(end)}`;
}
