export type TimetableSummaryEntryType = 'lesson' | 'lesson_double' | 'break' | 'lunch' | 'activities' | 'activity';

export interface TimetableSummaryClass {
  id: string;
}

export interface TimetableSummarySlot {
  id: string;
  slot_type: string;
}

export interface TimetableSummaryEntry {
  subject_id?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
  entry_type?: TimetableSummaryEntryType | string | null;
}

export interface WeeklyLessonSummaryRow {
  key: string;
  label: string;
  totalLessons: number;
  perClass: Record<string, number>;
}

/**
 * Count real subject cells in the generated five-day timetable.
 * Activities, breaks, lunch, and empty cells are intentionally excluded.
 * A subject appearing twice in one cell is counted once for that cell.
 */
export function buildWeeklyLessonSummary(
  classes: TimetableSummaryClass[],
  slots: TimetableSummarySlot[],
  getEntries: (day: number, classId: string, slot: TimetableSummarySlot) => TimetableSummaryEntry[],
): WeeklyLessonSummaryRow[] {
  const rows = new Map<string, { label: string; totalLessons: number; perClass: Record<string, number> }>();
  const lessonSlots = slots.filter((slot) => slot.slot_type === 'lesson');

  for (let day = 1; day <= 5; day += 1) {
    for (const cls of classes) {
      for (const slot of lessonSlots) {
        const cellSubjectKeys = new Set<string>();
        for (const entry of getEntries(day, cls.id, slot)) {
          if (entry.entry_type === 'activity' || entry.entry_type === 'activities' || entry.entry_type === 'break' || entry.entry_type === 'lunch') continue;
          const label = String(entry.subject_name || entry.subject_code || '').trim();
          if (!label) continue;
          const key = String(entry.subject_id || entry.subject_code || label).trim().toLowerCase();
          if (!key || cellSubjectKeys.has(key)) continue;
          cellSubjectKeys.add(key);

          const existing = rows.get(key) || {
            label,
            totalLessons: 0,
            perClass: Object.fromEntries(classes.map((item) => [item.id, 0])),
          };
          existing.totalLessons += 1;
          existing.perClass[cls.id] = (existing.perClass[cls.id] || 0) + 1;
          rows.set(key, existing);
        }
      }
    }
  }

  return Array.from(rows.entries())
    .map(([key, row]) => ({ key, ...row }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
