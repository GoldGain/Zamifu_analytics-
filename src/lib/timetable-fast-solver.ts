export interface FastTimetableSolverOptions {
  schoolId: string;
  levelKey: string;
  classes: any[];
  assignments: any[];
  lessonSlots: any[];
  deadlineMs?: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const dayIndex = (value: unknown) => DAYS.findIndex((d) => d.toLowerCase() === String(value ?? '').trim().toLowerCase());
const parseDays = (value: unknown) => {
  let values: unknown[] = [];
  if (Array.isArray(value)) values = value;
  else if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); values = Array.isArray(parsed) ? parsed : value.split(','); }
    catch { values = value.split(','); }
  }
  return [...new Set(values.map(dayIndex).filter((d): d is number => d >= 0))];
};
const family = (name: string) => {
  const n = name.toLowerCase();
  if (/mathemat/.test(n)) return 'math';
  if (/english/.test(n)) return 'english';
  if (/integrated\s*science|\bscience\b|environment/.test(n)) return 'science';
  if (/pre[\s-]*technical|pre[\s-]*tech/.test(n)) return 'pretech';
  if (/kiswahili/.test(n)) return 'kiswahili';
  return 'other';
};
const allowedSlot = (name: string, slot: number) => {
  const f = family(name);
  if (f === 'math') return slot < 4;
  if (f === 'english') return slot < 5;
  if (f === 'science') return slot < 6;
  if (f === 'pretech') return slot < 7;
  return true;
};
const violatesSequence = (a: string, b: string) => /mathemat/.test(a.toLowerCase()) && (/science|environment/.test(b.toLowerCase()));

export function buildFastTimetableEntries(options: FastTimetableSolverOptions): any[] | null {
  const deadline = Date.now() + (options.deadlineMs ?? 12000);
  const slots = options.lessonSlots.slice().sort((a, b) => Number(a.slot_order) - Number(b.slot_order));
  const K = slots.length;
  if (!K || !options.classes.length) return null;
  const recordsByClass = new Map<string, any[]>();
  for (const cls of options.classes) {
    const records = options.assignments.filter((a) => String(a.class_id) === String(cls.id)).map((a) => ({
      sid: String(a.subject_id), name: String(a.subjects?.name || a.subject_name || ''), teacher: String(a.teacher_id || ''),
      need: Number(a.lessons_per_week || 0), double: Boolean(a.is_double_lesson),
      available: parseDays(a.available_days), doubles: parseDays(a.double_lesson_days),
    })).filter((r) => r.name && r.need > 0);
    if (records.reduce((sum, r) => sum + r.need, 0) !== K * 5) return null;
    recordsByClass.set(String(cls.id), records);
  }

  type Unit = { sid: string; name: string; teacher: string; size: 1 | 2; allowedDays: number[]; order: number };
  const teacherBusy = new Set<string>();
  const chosen: any[] = [];
  const classOrder = options.classes.slice().sort((a, b) => (recordsByClass.get(String(a.id)) || []).length - (recordsByClass.get(String(b.id)) || []).length);

  const scheduleClass = (cls: any, records: any[]): any[] | null => {
    const units: Unit[] = [];
    for (const r of records) {
      if (r.double && r.need >= 2) units.push({ sid: r.sid, name: r.name, teacher: r.teacher, size: 2, allowedDays: r.doubles.length ? r.doubles : (r.available.length ? r.available : [0,1,2,3,4]), order: 0 });
      for (let i = 0; i < r.need - (r.double && r.need >= 2 ? 2 : 0); i++) units.push({ sid: r.sid, name: r.name, teacher: r.teacher, size: 1, allowedDays: r.available.length ? r.available : [0,1,2,3,4], order: i + 1 });
    }
    const dayUnits: Unit[][] = [[], [], [], [], []];
    const subjectDays = new Map<string, Set<number>>();
    const dayLoad = [0, 0, 0, 0, 0];
    const byScarcity = units.slice().sort((a, b) => a.allowedDays.length - b.allowedDays.length || b.size - a.size);
    const assignDays = (index: number): boolean => {
      if (Date.now() > deadline) return false;
      if (index >= byScarcity.length) return dayLoad.every((n) => n === K);
      const unit = byScarcity[index];
      const used = subjectDays.get(unit.sid) || new Set<number>();
      const candidates = unit.allowedDays.slice().sort((a, b) => dayLoad[a] - dayLoad[b] || Math.random() - 0.5);
      for (const day of candidates) {
        if (used.has(day) || dayLoad[day] + unit.size > K) continue;
        used.add(day); subjectDays.set(unit.sid, used); dayUnits[day].push(unit); dayLoad[day] += unit.size;
        if (assignDays(index + 1)) return true;
        dayLoad[day] -= unit.size; dayUnits[day].pop(); used.delete(day);
      }
      return false;
    };
    if (!assignDays(0)) return null;

    const scheduled: any[] = [];
    const scheduleDay = (day: number): boolean => {
      if (day >= 5) return true;
      const unitsForDay = dayUnits[day].slice();
      const cells: Array<Unit | null> = Array(K).fill(null);
      const place = (slot: number): boolean => {
        if (Date.now() > deadline) return false;
        if (slot >= K) return unitsForDay.length === 0;
        if (cells[slot]) return place(slot + 1);
        const candidates = unitsForDay.slice().sort((a, b) => b.size - a.size || b.order - a.order || Math.random() - 0.5);
        for (const unit of candidates) {
          if (unit.size === 2 && slot >= K - 1) continue;
          if (unit.size === 2 && (cells[slot + 1] || cells[slot])) continue;
          if (!allowedSlot(unit.name, slot) || (unit.size === 2 && !allowedSlot(unit.name, slot + 1))) continue;
          const left = slot > 0 ? cells[slot - 1] : null;
          if (left && violatesSequence(left.name, unit.name)) continue;
          const key1 = `${unit.teacher}|${day + 1}|${slots[slot].id}`;
          const key2 = unit.size === 2 ? `${unit.teacher}|${day + 1}|${slots[slot + 1].id}` : '';
          if (teacherBusy.has(key1) || (key2 && teacherBusy.has(key2))) continue;
          const idx = unitsForDay.indexOf(unit); unitsForDay.splice(idx, 1); cells[slot] = unit;
          if (unit.size === 2) cells[slot + 1] = unit;
          if (place(slot + 1)) return true;
          unitsForDay.splice(idx, 0, unit); cells[slot] = null; if (unit.size === 2) cells[slot + 1] = null;
        }
        return false;
      };
      if (!place(0)) return false;
      for (let slot = 0; slot < K; slot++) {
        const unit = cells[slot]!;
        const row = { school_id: options.schoolId, class_id: String(cls.id), day_of_week: day + 1, time_slot_id: slots[slot].id, subject_id: unit.sid, teacher_id: unit.teacher, entry_type: unit.size === 2 ? 'lesson_double' : 'lesson', level_group: options.levelKey, effective_start_time: slots[slot].start_time, effective_end_time: slots[slot].end_time };
        scheduled.push(row); teacherBusy.add(`${unit.teacher}|${day + 1}|${slots[slot].id}`);
      }
      return scheduleDay(day + 1);
    };
    if (!scheduleDay(0)) {
      // A later day can fail after earlier days have already reserved teacher
      // cells. Remove those reservations before retrying this class; otherwise
      // every retry inherits a polluted cross-class occupancy set.
      for (const row of scheduled) {
        teacherBusy.delete(`${row.teacher_id}|${row.day_of_week}|${row.time_slot_id}`);
      }
      return null;
    }
    return scheduled;
  };

  const solve = (index: number): boolean => {
    if (Date.now() > deadline) return false;
    if (index >= classOrder.length) return true;
    const cls = classOrder[index];
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const rows = scheduleClass(cls, recordsByClass.get(String(cls.id)) || []);
      if (!rows) continue;
      chosen.push(...rows);
      if (solve(index + 1)) return true;
      for (const row of rows) teacherBusy.delete(`${row.teacher_id}|${row.day_of_week}|${row.time_slot_id}`);
      chosen.splice(chosen.length - rows.length, rows.length);
    }
    return false;
  };
  return solve(0) ? chosen : null;
}
