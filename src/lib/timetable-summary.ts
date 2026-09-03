
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
  entry_type?: string | null;
}

export interface TimetableSummaryRequirement {
  class_id: string;
  subject_id?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
  lessons_per_week?: number | null;
}

export type WeeklyLessonStatus = 'ok' | 'under' | 'over';

export interface WeeklyLessonSummaryRow {
  key: string;
  label: string;
  requiredLessons: number;
  totalLessons: number;
  requiredPerClass: Record<string, number>;
  perClass: Record<string, number>;
  status: WeeklyLessonStatus;
}

/**
 * Count real subject cells in the generated five-day timetable and compare the
 * result with each class/subject's configured lessons_per_week requirement.
 * Activities, breaks, and lunch are intentionally excluded. A subject appearing
 * twice in one cell is counted once for that cell. Status is evaluated per class
 * before the aggregate row is rendered, so one class cannot hide another
 * class’s shortfall by having extra lessons.
 */
export function buildWeeklyLessonSummary(
  classes: TimetableSummaryClass[],
  slots: TimetableSummarySlot[],
  getEntries: (day: number, classId: string, slot: TimetableSummarySlot) => TimetableSummaryEntry[],
  requirements: TimetableSummaryRequirement[] = [],
): WeeklyLessonSummaryRow[] {
  const rows = new Map<string, {
    label: string;
    requiredLessons: number;
    totalLessons: number;
    requiredPerClass: Record<string, number>;
    perClass: Record<string, number>;
  }>();
  const lessonSlots = slots.filter((slot) => slot.slot_type === 'lesson');

  const ensureRow = (key: string, label: string) => {
    const existing = rows.get(key);
    if (existing) {
      if (!existing.label && label) existing.label = label;
      return existing;
    }
    const created = {
      label,
      requiredLessons: 0,
      totalLessons: 0,
      requiredPerClass: Object.fromEntries(classes.map((item) => [item.id, 0])),
      perClass: Object.fromEntries(classes.map((item) => [item.id, 0])),
    };
    rows.set(key, created);
    return created;
  };

  for (const requirement of requirements) {
    if (!classes.some((item) => item.id === requirement.class_id)) continue;
    const label = String(requirement.subject_name || requirement.subject_code || '').trim();
    const subjectKey = String(requirement.subject_id || requirement.subject_code || label).trim().toLowerCase();
    if (!subjectKey) continue;
    const row = ensureRow(subjectKey, label || subjectKey);
    const lessons = Math.max(0, Number(requirement.lessons_per_week) || 0);
    row.requiredLessons += lessons;
    row.requiredPerClass[requirement.class_id] = (row.requiredPerClass[requirement.class_id] || 0) + lessons;
  }

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

          const existing = ensureRow(key, label);
          existing.totalLessons += 1;
          existing.perClass[cls.id] = (existing.perClass[cls.id] || 0) + 1;
        }
      }
    }
  }

  return Array.from(rows.entries())
    .map(([key, row]) => {
      const hasUnder = classes.some((cls) =>
        (row.perClass[cls.id] || 0) < (row.requiredPerClass[cls.id] || 0)
      );
      const hasOver = classes.some((cls) =>
        (row.perClass[cls.id] || 0) > (row.requiredPerClass[cls.id] || 0)
      );
      return {
        key,
        ...row,
        // Under takes precedence when a row contains both a shortfall and an
        // overage across classes; the per-class columns expose both numbers.
        status: hasUnder ? 'under' : hasOver ? 'over' : 'ok',
      };
    })
    .filter((row) => row.requiredLessons > 0 || row.totalLessons > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}
