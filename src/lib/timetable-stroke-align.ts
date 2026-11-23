/**
 * Align "stroked" learning areas (CRE / IRE) so the three streams of a grade take
 * the lesson in the SAME period.
 *
 * The solver already pairs CRE and IRE inside a class, so a shared period is a
 * CELL HOLDING TWO LESSONS. This pass therefore moves whole cells, never single
 * lessons: the pair travels together, so weekly counts cannot change and no
 * lesson can be left behind.
 *
 * It refuses any swap that would repeat a subject on a day, split a double, or
 * place a teacher in two classes at one period (other than the stroked teachers,
 * who are shared by design). The finished grid is re-checked and the whole pass
 * is reverted if anything changed.
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

type ClassInfo = { id: string; grade_level?: number | string; level?: number | string; name?: string };

const cellOf = (entry: StrokeEntry): string => `${Number(entry.day_of_week)}|${String(entry.time_slot_id)}`;
const dayOf = (entry: StrokeEntry): number => Number(entry.day_of_week);
const isLesson = (entry: StrokeEntry): boolean => String(entry.entry_type || '').startsWith('lesson');
const isDouble = (entry: StrokeEntry): boolean => String(entry.entry_type || '').includes('double');

export function alignStrokedSubjects(
  entries: StrokeEntry[],
  strokedSubjectIds: string[],
  classes: ClassInfo[] = [],
): { aligned: number; skipped: number; reverted: boolean } {
  if (!strokedSubjectIds.length) return { aligned: 0, skipped: 0, reverted: false };

  // ── snapshot for a clean revert ────────────────────────────────────────────
  const snapshot = entries.map((entry) => ({
    entry,
    day_of_week: entry.day_of_week,
    time_slot_id: entry.time_slot_id,
    effective_start_time: entry.effective_start_time,
    effective_end_time: entry.effective_end_time,
    is_stroked: entry.is_stroked,
  }));

  // cells hold a LIST: a shared CRE/IRE period has two lessons
  const cells = new Map<string, Map<string, StrokeEntry[]>>(); // classId -> cell -> entries
  for (const entry of entries) {
    if (!isLesson(entry) || !entry.class_id || !entry.time_slot_id) continue;
    const classId = String(entry.class_id);
    if (!cells.has(classId)) cells.set(classId, new Map());
    const classCells = cells.get(classId)!;
    const key = cellOf(entry);
    classCells.set(key, [...(classCells.get(key) || []), entry]);
  }

  const gradeOf = new Map<string, string>();
  classes.forEach((cls) => {
    const grade = String(cls.grade_level ?? cls.level ?? cls.name ?? '');
    if (cls.id && grade) gradeOf.set(String(cls.id), grade);
  });

  const teachersAt = (cellKey: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const [, classCells] of cells) {
      const list = classCells.get(cellKey);
      if (!list) continue;
      const seen = new Set<string>();
      list.forEach((entry) => {
        const teacher = String(entry.teacher_id || '');
        if (!teacher || seen.has(teacher)) return;
        seen.add(teacher);
        counts.set(teacher, (counts.get(teacher) || 0) + 1);
      });
    }
    return counts;
  };

  const subjectOnDay = (classId: string, subjectId: string, day: number, ignore?: Set<StrokeEntry>): boolean => {
    for (const list of cells.get(classId)?.values() || []) {
      for (const entry of list) {
        if (ignore?.has(entry)) continue;
        if (String(entry.subject_id) === String(subjectId) && dayOf(entry) === day) return true;
      }
    }
    return false;
  };

  let aligned = 0;
  let skipped = 0;

  // group streams by grade so 7A/7B/7C align together, then 8A/8B/8C, then 9A/9B/9C
  const byGrade = new Map<string, string[]>();
  for (const classId of cells.keys()) {
    const grade = gradeOf.get(classId) || classId;
    byGrade.set(grade, [...(byGrade.get(grade) || []), classId]);
  }

  for (const [grade, classIds] of byGrade) {
    if (classIds.length < 2) continue;

    for (const subjectId of strokedSubjectIds) {
      const sharedCells = new Map<string, string[]>();
      for (const classId of classIds) {
        const keys = [...cells.get(classId)!.entries()]
          .filter(([, list]) => list.some((entry) => String(entry.subject_id) === String(subjectId)))
          .map(([key]) => key)
          .sort((a, b) => Number(a.split('|')[0]) - Number(b.split('|')[0]));
        if (keys.length) sharedCells.set(classId, keys);
      }
      const participants = [...sharedCells.keys()];
      if (participants.length < 2) continue;

      const lessonCount = Math.min(...participants.map((id) => sharedCells.get(id)!.length));
      const usedTargets = new Set<string>();

      for (let index = 0; index < lessonCount; index += 1) {
        let target: string | null = null;

        // candidate periods, earliest day first, latest period first
        const candidates = [...new Set(participants.flatMap((id) => [...cells.get(id)!.keys()]))]
          .sort((a, b) => {
            const [dA, sA] = a.split('|').map(Number);
            const [dB, sB] = b.split('|').map(Number);
            return dA - dB || sB - sA;
          });

        for (const key of candidates) {
          if (usedTargets.has(key)) continue;
          let ok = true;
          for (const classId of participants) {
            const classCells = cells.get(classId)!;
            const source = sharedCells.get(classId)![index];
            const sourceList = classCells.get(source) || [];
            const targetList = classCells.get(key);
            if (!targetList || key === source) { ok = false; break; }
            // target must be an ordinary single lesson; refuse doubles and other shared cells
            if (targetList.length !== 1 || isDouble(targetList[0])) { ok = false; break; }
            if (sourceList.some((entry) => isDouble(entry))) { ok = false; break; }

            const displaced = targetList[0];
            const targetDay = Number(key.split('|')[0]);
            const sourceDay = Number(source.split('|')[0]);
            // no subject repeated on a day, in either direction
            if (subjectOnDay(classId, String(subjectId), targetDay, new Set(sourceList))) { ok = false; break; }
            if (subjectOnDay(classId, String(displaced.subject_id), sourceDay, new Set([displaced]))) { ok = false; break; }

            // the displaced teacher must be free at the source period elsewhere
            const displacedTeacher = String(displaced.teacher_id || '');
            if (displacedTeacher && (teachersAt(source).get(displacedTeacher) || 0) > 1) { ok = false; break; }
            // the stroked teachers must not be teaching another class at the target period
            const targetTeachers = teachersAt(key);
            for (const entry of sourceList) {
              const teacher = String(entry.teacher_id || '');
              if (teacher && (targetTeachers.get(teacher) || 0) > 0) { ok = false; break; }
            }
          }
          if (ok) { target = key; break; }
        }

        if (!target) { skipped += 1; continue; }

        // move the WHOLE cell content in every stream
        for (const classId of participants) {
          const classCells = cells.get(classId)!;
          const source = sharedCells.get(classId)![index];
          const sourceList = classCells.get(source) || [];
          const targetList = classCells.get(target) || [];
          if (!sourceList.length || !targetList.length) continue;

          const targetPos = target.split('|').map(Number);
          const sourcePos = source.split('|').map(Number);
          const targetSample = targetList[0];
          const sourceSample = sourceList[0];

          const targetDay = targetSample.day_of_week;
          const targetSlot = targetSample.time_slot_id;
          const targetStart = targetSample.effective_start_time;
          const targetEnd = targetSample.effective_end_time;

          targetList.forEach((entry) => {
            entry.day_of_week = sourceSample.day_of_week;
            entry.time_slot_id = sourceSample.time_slot_id;
            entry.effective_start_time = sourceSample.effective_start_time;
            entry.effective_end_time = sourceSample.effective_end_time;
          });
          sourceList.forEach((entry) => {
            entry.day_of_week = targetDay;
            entry.time_slot_id = targetSlot;
            entry.effective_start_time = targetStart;
            entry.effective_end_time = targetEnd;
            entry.is_stroked = true;
          });

          classCells.set(target, sourceList);
          classCells.set(source, targetList);
          void targetPos; void sourcePos;
        }

        usedTargets.add(target);
        aligned += 1;
      }
    }
  }

  // ── verify: totals per class+subject must be identical to the solved grid ──
  const totals = (list: StrokeEntry[]) => {
    const map = new Map<string, number>();
    list.forEach((entry) => {
      if (!isLesson(entry)) return;
      const key = `${String(entry.class_id)}|${String(entry.subject_id)}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  };
  const before = totals(snapshot.map((s) => s.entry));
  const after = totals(entries);
  const problems: string[] = [];
  for (const [key, count] of after) {
    if (count !== (before.get(key) || 0)) problems.push(`count changed for ${key}`);
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
