/**
 * Align "stroked" learning areas (CRE / IRE) so that every stream taught by the
 * same teacher takes the lesson in the SAME period.
 *
 * A junior week is usually completely full (40 lessons in 40 periods), so
 * reserving shared periods before solving makes the exact search prove the
 * level impossible and nothing is generated. Instead the solver runs normally
 * and this pass swaps the stroked lesson with whatever already sits in a common
 * period. Every class keeps its weekly counts exactly as configured; only the
 * period of two lessons changes.
 */

type StrokeEntry = {
  class_id?: string;
  day_of_week?: number | string;
  time_slot_id?: string;
  subject_id?: string;
  teacher_id?: string;
  entry_type?: string;
  effective_start_time?: string;
  effective_end_time?: string;
  is_stroked?: boolean;
};

const cellKey = (entry: StrokeEntry): string => `${Number(entry.day_of_week)}|${String(entry.time_slot_id)}`;
const isLesson = (entry: StrokeEntry): boolean => String(entry.entry_type || '').startsWith('lesson');

export function alignStrokedSubjects(
  entries: StrokeEntry[],
  strokedSubjectIds: string[],
): { aligned: number; skipped: number } {
  const lessons = entries.filter((entry) => isLesson(entry) && entry.class_id && entry.time_slot_id && entry.subject_id);
  if (!lessons.length || !strokedSubjectIds.length) return { aligned: 0, skipped: 0 };

  const byClass = new Map<string, Map<string, StrokeEntry>>();
  for (const entry of lessons) {
    const classId = String(entry.class_id);
    if (!byClass.has(classId)) byClass.set(classId, new Map());
    byClass.get(classId)!.set(cellKey(entry), entry);
  }

  /** Would this teacher already be in another class at that period? */
  const teacherBusyElsewhere = (classId: string, key: string, teacherId: string): boolean => {
    if (!teacherId) return false;
    for (const [otherClass, cells] of byClass) {
      if (otherClass === classId) continue;
      const occupant = cells.get(key);
      if (occupant && String(occupant.teacher_id || '') === teacherId) return true;
    }
    return false;
  };

  let aligned = 0;
  let skipped = 0;

  for (const subjectId of strokedSubjectIds) {
    // A stroked lesson can only be shared by classes taught by the same teacher.
    const groups = new Map<string, Set<string>>();
    for (const [classId, cells] of byClass) {
      for (const entry of cells.values()) {
        if (String(entry.subject_id) !== String(subjectId)) continue;
        const teacherId = String(entry.teacher_id || 'none');
        if (!groups.has(teacherId)) groups.set(teacherId, new Set());
        groups.get(teacherId)!.add(classId);
      }
    }

    for (const classIds of [...groups.values()].map((set) => [...set])) {
      if (!classIds.length) continue;

      const subjectCells = new Map<string, string[]>();
      for (const classId of classIds) {
        const cells = [...byClass.get(classId)!.entries()]
          .filter(([, entry]) => String(entry.subject_id) === String(subjectId))
          .sort((a, b) => Number(a[1].day_of_week) - Number(b[1].day_of_week)
            || String(a[1].effective_start_time || '').localeCompare(String(b[1].effective_start_time || '')))
          .map(([key]) => key);
        subjectCells.set(classId, cells);
      }

      const lessonCount = Math.min(...classIds.map((id) => subjectCells.get(id)!.length));
      const usedTargets = new Set<string>();

      for (let index = 0; index < lessonCount; index += 1) {
        const candidates = [...new Set(classIds.flatMap((id) => [...byClass.get(id)!.keys()]))]
          .sort((a, b) => {
            const [dayA, slotA] = a.split('|').map(Number);
            const [dayB, slotB] = b.split('|').map(Number);
            return dayA - dayB || slotB - slotA; // prefer later periods of earlier days
          });

        let target: string | null = null;
        for (const key of candidates) {
          if (usedTargets.has(key)) continue;
          let ok = true;
          for (const classId of classIds) {
            const cells = byClass.get(classId)!;
            const own = subjectCells.get(classId)![index];
            const occupant = cells.get(key);
            if (!occupant || key === own) { ok = false; break; }
            if (String(occupant.subject_id) === String(subjectId)) continue;
            if (teacherBusyElsewhere(classId, own, String(occupant.teacher_id || ''))) { ok = false; break; }
            if (teacherBusyElsewhere(classId, key, String(cells.get(own)?.teacher_id || ''))) { ok = false; break; }
          }
          if (ok) { target = key; break; }
        }

        if (!target) { skipped += 1; continue; }

        for (const classId of classIds) {
          const cells = byClass.get(classId)!;
          const own = subjectCells.get(classId)![index];
          const strokedEntry = cells.get(own)!;
          const occupant = cells.get(target)!;

          const movedDay = strokedEntry.day_of_week;
          const movedSlot = strokedEntry.time_slot_id;
          const movedStart = strokedEntry.effective_start_time;
          const movedEnd = strokedEntry.effective_end_time;

          strokedEntry.day_of_week = occupant.day_of_week;
          strokedEntry.time_slot_id = occupant.time_slot_id;
          strokedEntry.effective_start_time = occupant.effective_start_time;
          strokedEntry.effective_end_time = occupant.effective_end_time;

          occupant.day_of_week = movedDay;
          occupant.time_slot_id = movedSlot;
          occupant.effective_start_time = movedStart;
          occupant.effective_end_time = movedEnd;

          cells.set(target, strokedEntry);
          cells.set(own, occupant);
          strokedEntry.is_stroked = true;
        }

        usedTargets.add(target);
        aligned += 1;
      }
    }
  }

  return { aligned, skipped };
}
