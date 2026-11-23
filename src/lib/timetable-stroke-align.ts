/**
 * Align "stroked" learning areas (CRE / IRE) so that every stream taught by the
 * same teacher takes the lesson in the SAME period.
 *
 * The pass swaps the stroked lesson with whatever already sits in a common
 * period, so weekly counts never change. It is deliberately conservative:
 *   • never puts two lessons of the same subject on one day for a class,
 *   • never splits a double lesson,
 *   • never moves a subject onto a day where that class already has it,
 *   • verifies the finished grid and reverts the whole pass if anything breaks.
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
const dayOf = (entry: StrokeEntry): number => Number(entry.day_of_week);
const isLesson = (entry: StrokeEntry): boolean => String(entry.entry_type || '').startsWith('lesson');
const isDouble = (entry: StrokeEntry): boolean => String(entry.entry_type || '').includes('double');

export function alignStrokedSubjects(
  entries: StrokeEntry[],
  strokedSubjectIds: string[],
): { aligned: number; skipped: number; reverted: boolean } {
  const lessons = entries.filter((entry) => isLesson(entry) && entry.class_id && entry.time_slot_id && entry.subject_id);
  if (!lessons.length || !strokedSubjectIds.length) return { aligned: 0, skipped: 0, reverted: false };

  const snapshot = entries.map((entry) => ({
    entry,
    day_of_week: entry.day_of_week,
    time_slot_id: entry.time_slot_id,
    effective_start_time: entry.effective_start_time,
    effective_end_time: entry.effective_end_time,
    is_stroked: entry.is_stroked,
  }));

  const byClass = new Map<string, Map<string, StrokeEntry>>();
  for (const entry of lessons) {
    const classId = String(entry.class_id);
    if (!byClass.has(classId)) byClass.set(classId, new Map());
    byClass.get(classId)!.set(cellKey(entry), entry);
  }

  const subjectOnDay = (classId: string, subjectId: string, day: number, except?: StrokeEntry): boolean =>
    [...(byClass.get(classId)?.values() || [])].some((entry) =>
      entry !== except && String(entry.subject_id) === String(subjectId) && dayOf(entry) === day);

  const teacherBusyElsewhere = (classId: string, key: string, teacherId: string): boolean => {
    if (!teacherId) return false;
    for (const [otherClass, cells] of byClass) {
      if (otherClass === classId) continue;
      const occupant = cells.get(key);
      if (occupant && String(occupant.teacher_id || '') === teacherId) return true;
    }
    return false;
  };

  const hasDoubleNeighbour = (classId: string, entry: StrokeEntry): boolean => {
    if (isDouble(entry)) return true;
    const day = dayOf(entry);
    const sameSubject = [...(byClass.get(classId)?.values() || [])].filter((other) =>
      other !== entry && String(other.subject_id) === String(entry.subject_id) && dayOf(other) === day);
    return sameSubject.length > 0; // only two per day at most; treat the pair as a unit
  };

  let aligned = 0;
  let skipped = 0;

  for (const subjectId of strokedSubjectIds) {
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
          .sort((a, b) => dayOf(a[1]) - dayOf(b[1])
            || String(a[1].effective_start_time || '').localeCompare(String(b[1].effective_start_time || '')))
          .map(([key]) => key);
        subjectCells.set(classId, cells);
      }

      const lessonCount = Math.min(...classIds.map((id) => subjectCells.get(id)!.length));
      const usedTargets = new Set<string>();
      const handledDays = new Set<string>();

      for (let index = 0; index < lessonCount; index += 1) {
        // Skip a lesson that belongs to a double: moving one half would split it.
        if (classIds.some((classId) => {
          const entry = byClass.get(classId)!.get(subjectCells.get(classId)![index]);
          return !entry || hasDoubleNeighbour(classId, entry);
        })) { skipped += 1; continue; }

        const candidates = [...new Set(classIds.flatMap((id) => [...byClass.get(id)!.keys()]))]
          .sort((a, b) => {
            const [dayA, slotA] = a.split('|').map(Number);
            const [dayB, slotB] = b.split('|').map(Number);
            return dayA - dayB || slotB - slotA;
          });

        let target: string | null = null;
        for (const key of candidates) {
          if (usedTargets.has(key)) continue;
          const targetDay = Number(key.split('|')[0]);
          if (handledDays.has(`${targetDay}`)) continue; // one shared period per day keeps them spread
          let ok = true;

          for (const classId of classIds) {
            const cells = byClass.get(classId)!;
            const ownKey = subjectCells.get(classId)![index];
            const ownEntry = cells.get(ownKey)!;
            const occupant = cells.get(key);
            if (!occupant || key === ownKey) { ok = false; break; }
            if (String(occupant.subject_id) === String(subjectId)) { ok = false; break; }
            if (isDouble(occupant)) { ok = false; break; }

            // no two lessons of a subject on one day, for either moved lesson
            if (subjectOnDay(classId, String(subjectId), targetDay, ownEntry)) { ok = false; break; }
            if (subjectOnDay(classId, String(occupant.subject_id), dayOf(ownEntry), occupant)) { ok = false; break; }

            if (teacherBusyElsewhere(classId, ownKey, String(occupant.teacher_id || ''))) { ok = false; break; }
            if (teacherBusyElsewhere(classId, key, String(cells.get(ownKey)?.teacher_id || ''))) { ok = false; break; }
          }
          if (ok) { target = key; break; }
        }

        if (!target) { skipped += 1; continue; }

        for (const classId of classIds) {
          const cells = byClass.get(classId)!;
          const own = subjectCells.get(classId)![index];
          const strokedEntry = cells.get(own)!;
          const occupant = cells.get(target)!;

          const moved = { day: strokedEntry.day_of_week, slot: strokedEntry.time_slot_id,
            start: strokedEntry.effective_start_time, end: strokedEntry.effective_end_time };

          strokedEntry.day_of_week = occupant.day_of_week;
          strokedEntry.time_slot_id = occupant.time_slot_id;
          strokedEntry.effective_start_time = occupant.effective_start_time;
          strokedEntry.effective_end_time = occupant.effective_end_time;

          occupant.day_of_week = moved.day;
          occupant.time_slot_id = moved.slot;
          occupant.effective_start_time = moved.start;
          occupant.effective_end_time = moved.end;

          cells.set(target, strokedEntry);
          cells.set(own, occupant);
          strokedEntry.is_stroked = true;
        }

        usedTargets.add(target);
        handledDays.add(String(Number(target.split('|')[0])));
        aligned += 1;
      }
    }
  }

  // ── Verify the finished grid; revert everything if any rule broke ──────────
  const problems: string[] = [];
  const seen = new Map<string, { subjectId: string; teacherId: string; stroked: boolean }>();
  for (const entry of lessons) {
    const key = `${entry.class_id}|${cellKey(entry)}`;
    const previous = seen.get(key);
    if (previous) {
      const sharedStrokedLesson = previous.stroked && entry.is_stroked
        && previous.subjectId === String(entry.subject_id) && previous.teacherId === String(entry.teacher_id);
      if (!sharedStrokedLesson) problems.push(`cell clash in ${key}`);
    } else {
      seen.set(key, { subjectId: String(entry.subject_id), teacherId: String(entry.teacher_id || ''), stroked: entry.is_stroked === true });
    }
  }
  for (const classId of byClass.keys()) {
    const perDaySubject = new Set<string>();
    for (const entry of byClass.get(classId)!.values()) {
      const token = `${dayOf(entry)}|${String(entry.subject_id)}`;
      if (perDaySubject.has(token) && !isDouble(entry)) problems.push(`same subject twice on one day in ${classId}`);
      perDaySubject.add(token);
    }
  }

  if (problems.length) {
    for (const state of snapshot) {
      state.entry.day_of_week = state.day_of_week;
      state.entry.time_slot_id = state.time_slot_id;
      state.entry.effective_start_time = state.effective_start_time;
      state.entry.effective_end_time = state.effective_end_time;
      state.entry.is_stroked = state.is_stroked;
    }
    console.warn('[timetable] stroked alignment reverted:', problems.slice(0, 3).join('; '));
    return { aligned: 0, skipped, reverted: true };
  }

  return { aligned, skipped, reverted: false };
}
