/** Data-quality audit across candidate schools: find every edge case the solver must handle. */
import { loadSchool, listCandidateSchools, classMatchesLevel, LEVEL_GROUPS } from './timetable-live-harness.ts';

const missingTeacher: string[] = [];
const dupSubject: string[] = [];
const badCount: string[] = [];
const doubleTooSmall: string[] = [];
const bothReligious: string[] = [];
const religiousMismatch: string[] = [];
const noAssignClasses: string[] = [];
const totalMismatch: string[] = [];
const teacherOverload: string[] = [];
const activityRows: string[] = [];

async function main() {
  const schools = await listCandidateSchools(40);
  console.log(`Auditing ${schools.length} candidate schools...\n`);
  for (const school of schools) {
    const f = await loadSchool(school.id, school.name);
    for (const lk of LEVEL_GROUPS) {
      const classes = f.classes.filter((c) => classMatchesLevel(c, lk));
      if (!classes.length) continue;
      const cfg: any = f.levelConfigs[lk];
      const perDay = cfg?.lessons_per_day || (['junior', 'senior'].includes(lk) ? 8 : lk === 'form-3-4' ? 7 : 6);
      const expected = perDay * 5;

      for (const cls of classes) {
        const as = f.assignments.filter((a) => String(a.class_id) === String(cls.id));
        if (!as.length) { noAssignClasses.push(`${f.name} / ${lk} / ${cls.name}`); continue; }
        const total = as.reduce((s, a) => s + Number(a.lessons_per_week || 0), 0);
        if (total !== expected) totalMismatch.push(`${f.name} / ${lk} / ${cls.name}: ${total} vs ${expected}`);

        const seen = new Map<string, number>();
        for (const a of as) {
          const sid = String(a.subject_id);
          seen.set(sid, (seen.get(sid) || 0) + 1);
          if (!a.teacher_id) missingTeacher.push(`${f.name} / ${cls.name} / ${a.subjects?.name}`);
          const n = Number(a.lessons_per_week);
          if (!Number.isInteger(n) || n <= 0) badCount.push(`${f.name} / ${cls.name} / ${a.subjects?.name}: ${a.lessons_per_week}`);
          const nm = String(a.subjects?.name || '');
          if (a.is_double_lesson && n < 2) doubleTooSmall.push(`${f.name} / ${cls.name} / ${nm}: ${n}`);
          // window-capacity: a subject restricted to a small window needs enough slots
          const dl = (a.double_lesson_days || []).map(String);
          const av = (a.available_days || []).map(String);
          if (a.is_double_lesson && dl.length && av.length && !dl.some((d) => av.includes(d))) {
            dupSubject.push(`double-day outside available: ${f.name} / ${cls.name} / ${nm}`);
          }
        }
        for (const [sid, n] of seen) if (n > 1) dupSubject.push(`${f.name} / ${cls.name} / subject ${sid} x${n}`);

        const religious = as.filter((a) => /religious|\bcre\b|\bire\b|\bhre\b|islamic|christian/i.test(String(a.subjects?.name || '')));
        const kinds = new Set(religious.map((a) => {
          const n = String(a.subjects?.name || '').toLowerCase();
          return /\bire\b|islamic|muslim/.test(n) ? 'ire' : /\bcre\b|christian/.test(n) ? 'cre' : 'other';
        }));
        if (kinds.has('ire') && kinds.has('cre')) bothReligious.push(`${f.name} / ${cls.name}: ${religious.map((a) => `${a.subjects?.name}(${a.lessons_per_week})`).join(' , ')}`);

        // teacher load vs level capacity
        const load = new Map<string, number>();
        for (const asg of f.assignments) {
          const other = f.classes.find((c) => String(c.id) === String(asg.class_id));
          if (!other || !classMatchesLevel(other, lk)) continue;
          load.set(String(asg.teacher_id), (load.get(String(asg.teacher_id)) || 0) + Number(asg.lessons_per_week || 0));
        }
        const cap = expected;
        for (const [tid, n] of load) {
          if (n > cap) {
            teacherOverload.push(`${f.name} / ${lk} / teacher ${tid}: ${n} > ${cap}`);
          }
        }
      }
    }
    if (f.activities.length) {
      activityRows.push(`${f.name}: ${f.activities.map((a) => `${a.activity_name}@day${a.day_of_week} ${a.start_time}-${a.end_time} lvl=${a.target_level_group} blocks=${a.blocks_lessons}`).join(' | ')}`);
    }
  }

  const show = (label: string, list: string[], max = 12) => {
    console.log(`\n### ${label}: ${list.length}`);
    for (const item of [...new Set(list)].slice(0, max)) console.log(`   - ${item}`);
  };
  show('classes with NO assignments (will be blocked in UI)', noAssignClasses);
  show('weekly total != level capacity', totalMismatch);
  show('missing teacher', missingTeacher);
  show('duplicate assignment for same subject+class', dupSubject);
  show('invalid/zero lesson count', badCount);
  show('double flagged but lessons < 2', doubleTooSmall);
  show('BOTH IRE and CRE offered', bothReligious);
  show('teacher overloaded beyond level capacity', teacherOverload);
  show('activities', activityRows, 40);
}
main().catch((error) => { console.error(error); process.exit(1); });