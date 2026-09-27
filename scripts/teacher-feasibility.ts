/**
 * Rigorous necessary-condition test for a school + level.
 *
 * Two independent necessary conditions must hold for a timetable to exist:
 *
 *  1. CLASS bands (Rules 4-7 + 8 + 13). A learning area whose window ends at
 *     lesson k can only use cells numbered <= k, and may appear at most once per
 *     day. So for each threshold k: (lessons of subjects with window-end <= k)
 *     must fit into (days x k) cells of that class.
 *
 *  2. TEACHER bands (Rules 4-7 + 8 + 11). The same arithmetic, summed over every
 *     class a teacher serves: the lessons that teacher must deliver in subjects
 *     whose window-end is <= k must fit into the (days x k) cells that exist at
 *     or before lesson k, because the teacher can only be in one place at once.
 *
 * A violation of either proves the configuration cannot be scheduled, which means
 * the failure is DATA, not the solver.
 */
import { loadSchool, classMatchesLevel } from './timetable-live-harness.ts';
import { generateSlots, resolveLessonTargets, strictSubjectAllowsLesson, classifySubject } from '../src/lib/timetable-generator.ts';

async function main() {
  const schoolId = process.argv[2];
  const levelKey = process.argv[3];
  const f = await loadSchool(schoolId);
  const cfg: any = f.levelConfigs[levelKey];
  const cut = (v: any) => (v ? String(v).slice(0, 5) : '');
  const config: any = {
    lesson_duration: cfg.period_duration || 40, school_start: cut(cfg.start_time), school_end: cut(cfg.end_time),
    first_break_start: cut(cfg.first_break_start), first_break_end: cut(cfg.first_break_end),
    second_break_start: cut(cfg.second_break_start), second_break_end: cut(cfg.second_break_end),
    lunch_start: cut(cfg.lunch_start), lunch_end: cut(cfg.lunch_end), activities: {},
  };
  const t = resolveLessonTargets(levelKey, config);
  const slots = generateSlots({ ...config, lessons_per_day: t.totalLessons, after_lunch_lessons: t.afterLunch }, t.totalLessons, levelKey)
    .filter((s) => s.slot_type === 'lesson');
  const slotsPerDay = slots.length;
  const lessonNumbers = slots.map((s: any, i: number) => {
    const parsed = Number(String(s.label || '').match(/lesson\s+(\d+)/i)?.[1]);
    return Number.isFinite(parsed) ? parsed : i + 1;
  });

  const classes = f.classes.filter((c) => classMatchesLevel(c, levelKey));
  const classIds = new Set(classes.map((c) => String(c.id)));
  const assignments = f.assignments.filter((a) => classIds.has(String(a.class_id)));

  const maxLessonOf = (name: string): number => {
    let max = 0;
    for (let i = 0; i < slotsPerDay; i += 1) {
      if (strictSubjectAllowsLesson(name, lessonNumbers[i])) max = Math.max(max, lessonNumbers[i]);
    }
    return max;
  };

  console.log(`SCHOOL ${f.name || schoolId}  level=${levelKey}  slotsPerDay=${slotsPerDay}  classes=${classes.length}`);

  // ── 1. class bands ───────────────────────────────────────────────────────
  let classBad = false;
  for (const cls of classes) {
    const as = assignments.filter((a) => String(a.class_id) === String(cls.id));
    const demand = new Map<number, number>();
    for (const a of as) {
      const n = Number(a.lessons_per_week || 0);
      const max = maxLessonOf(String(a.subjects?.name || ''));
      demand.set(max, (demand.get(max) || 0) + n);
    }
    const thresholds = [...demand.keys()].sort((x, y) => x - y);
    let cum = 0;
    for (const th of thresholds) {
      cum += demand.get(th) || 0;
      const cap = 5 * th;
      if (cum > cap) {
        console.log(`  CLASS BAND VIOLATION ${cls.name}: lessons with window-end<=${th} = ${cum} > capacity ${cap}`);
        classBad = true;
      }
    }
  }

  // ── 2. teacher bands ─────────────────────────────────────────────────────
  let teacherBad = false;
  const byTeacher = new Map<string, { name: string; demand: Map<number, number>; total: number; subjects: Set<string> }>();
  for (const a of assignments) {
    const tid = String(a.teacher_id || '');
    if (!tid) continue;
    const name = String(a.subjects?.name || '');
    const n = Number(a.lessons_per_week || 0);
    let row = byTeacher.get(tid);
    if (!row) {
      row = { name: String(a.teacher_name || a.teachers?.name || tid.slice(0, 8)), demand: new Map(), total: 0, subjects: new Set() };
      byTeacher.set(tid, row);
    }
    const max = maxLessonOf(name);
    row.demand.set(max, (row.demand.get(max) || 0) + n);
    row.total += n;
    row.subjects.add(name);
  }

  for (const [tid, row] of byTeacher) {
    const thresholds = [...row.demand.keys()].sort((x, y) => x - y);
    let cum = 0;
    for (const th of thresholds) {
      cum += row.demand.get(th) || 0;
      const cap = 5 * th;
      if (cum > cap) {
        console.log(`  TEACHER BAND VIOLATION ${row.name} (${tid.slice(0, 8)}): cells with window-end<=${th} = ${cum} > capacity ${cap}`);
        console.log(`      subjects: ${[...row.subjects].join(', ')}  total=${row.total}`);
        teacherBad = true;
      }
    }
  }

  // ── 3. plain teacher weekly load ─────────────────────────────────────────
  for (const [tid, row] of byTeacher) {
    if (row.total > 5 * slotsPerDay) {
      console.log(`  TEACHER OVERLOAD ${row.name}: ${row.total} cells > ${5 * slotsPerDay}`);
      teacherBad = true;
    }
    void tid;
  }

  console.log(`  classBand=${classBad ? 'VIOLATED' : 'ok'}  teacherBand=${teacherBad ? 'VIOLATED' : 'ok'}`);
  const totalNeeded = classes.reduce((sum, cls) => {
    return sum + assignments.filter((a) => String(a.class_id) === String(cls.id)).reduce((x, a) => x + Number(a.lessons_per_week || 0), 0);
  }, 0);
  console.log(`  total lesson cells needed = ${totalNeeded}, classes x week = ${classes.length * slotsPerDay * 5}`);
  console.log(`  teacher count=${byTeacher.size}, max load=${Math.max(...[...byTeacher.values()].map((r) => r.total), 0)}`);
  void classifySubject;
}

main().catch((e) => { console.error(e); process.exit(1); });