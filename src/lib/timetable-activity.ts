export interface ActivityInterval {
  start_time: string;
  end_time: string;
  target_level_group?: string | null;
  blocks_lessons?: boolean | null;
  [key: string]: unknown;
}

/** Return true when an activity applies to the requested timetable level. */
export function activityMatchesLevel(
  targetLevelGroup: string | null | undefined,
  levelKey: string,
): boolean {
  const target = String(targetLevelGroup || 'all').trim().toLowerCase().replace(/_/g, '-');
  const level = String(levelKey || '').trim().toLowerCase().replace(/_/g, '-');
  return !target || target === 'all' || target === 'all-levels' || target === level;
}

/** Existing rows default to blocking mode; only an explicit false opts out. */
export function activityBlocksLessons(activity: Pick<ActivityInterval, 'blocks_lessons'>): boolean {
  return activity.blocks_lessons !== false;
}

export interface TimedSlot {
  start_time: string;
  end_time: string;
  slot_type?: string;
  slot_order?: number;
  label?: string;
  [key: string]: unknown;
}

/** Return true when two time intervals overlap. Endpoints touching is not an overlap. */
export function timeIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

/**
 * Map a blocking activity to one normal lesson slot it owns. This replaces the
 * lesson content without adding a structural slot or changing the level's
 * saved lesson count. A legacy activity that begins before the school start is
 * assigned to the first lesson slot it touches.
 */
export function resolveActivityLessonSlot<T extends TimedSlot>(
  baseSlots: T[],
  activity: ActivityInterval,
): T | null {
  if (!activityBlocksLessons(activity)) return null;
  const lessons = baseSlots
    .filter((slot) => slot.slot_type === 'lesson')
    .sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));
  const overlapping = lessons.filter((lesson) =>
    timeIntervalsOverlap(lesson.start_time, lesson.end_time, activity.start_time, activity.end_time),
  );
  if (overlapping.length === 0) return null;
  const activityStart = timeToMinutes(activity.start_time);
  return overlapping.find((lesson) => {
    const start = timeToMinutes(lesson.start_time);
    const end = timeToMinutes(lesson.end_time);
    return activityStart >= start && activityStart < end;
  }) || overlapping[0] || null;
}

/** True when a blocking activity starts at or after the final lesson. */
export function isPostLessonActivity<T extends TimedSlot>(
  baseSlots: T[],
  activity: ActivityInterval,
): boolean {
  const lessons = baseSlots
    .filter((slot) => slot.slot_type === 'lesson')
    .sort((a, b) => timeToMinutes(b.end_time) - timeToMinutes(a.end_time));
  const lastLesson = lessons[0];
  return Boolean(lastLesson && timeToMinutes(activity.start_time) >= timeToMinutes(lastLesson.end_time));
}

const timeToMinutes = (value: string | null | undefined): number => {
  const [hours, minutes] = String(value || '').slice(0, 5).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
};

const minutesToTime = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(safe / 60) % 24).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

/**
 * Keep fixed activities at their exact configured times. Shift only the normal
 * lesson/break/lunch slots that overlap them. The returned slots never overlap
 * one another, and an empty activity list returns the original schedule.
 */
export function shiftSlotsAroundActivities<T extends TimedSlot>(
  baseSlots: T[],
  activities: ActivityInterval[],
): T[] {
  if (activities.length === 0) return baseSlots;
  const orderedActivities = [...activities].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  let cursor = -Infinity;

  return baseSlots.map((slot) => {
    const duration = Math.max(1, timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time));
    let start = Math.max(timeToMinutes(slot.start_time), cursor);
    let end = start + duration;
    let guard = 0;

    // Preserve the exact activity interval by moving the whole slot after it.
    // The cursor also prevents a shifted break/lunch from overlapping the next
    // lesson when the original clock contains fixed anchors.
    while (guard++ < orderedActivities.length + 2) {
      const overlapping = orderedActivities.find((activity) =>
        start < timeToMinutes(activity.end_time) && end > timeToMinutes(activity.start_time)
      );
      if (!overlapping) break;
      start = Math.max(start, timeToMinutes(overlapping.end_time));
      end = start + duration;
    }

    cursor = end;
    return { ...slot, start_time: minutesToTime(start), end_time: minutesToTime(end) };
  });
}
