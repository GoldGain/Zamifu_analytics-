export interface ActivityInterval {
  start_time: string;
  end_time: string;
  [key: string]: unknown;
}

export interface TimedSlot {
  start_time: string;
  end_time: string;
  [key: string]: unknown;
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
  let shift = 0;
  return baseSlots.map((slot) => {
    const duration = Math.max(1, timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time));
    let start = timeToMinutes(slot.start_time) + shift;
    let end = start + duration;
    let guard = 0;
    while (guard++ < orderedActivities.length + 2) {
      const overlapping = orderedActivities.find((activity) =>
        start < timeToMinutes(activity.end_time) && end > timeToMinutes(activity.start_time)
      );
      if (!overlapping) break;
      const delta = Math.max(1, timeToMinutes(overlapping.end_time) - start);
      shift += delta;
      start += delta;
      end += delta;
    }
    return { ...slot, start_time: minutesToTime(start), end_time: minutesToTime(end) };
  });
}
