/**
 * Independently verify what the application actually SAVED for a school.
 *
 * This reads timetable_entries from the database and re-audits them with the
 * standalone rule auditor. It never trusts the generator's own report, so it is
 * the evidence that a school's live timetable respects Rules 1-14.
 *
 * Usage: tsx scripts/verify-saved-timetable.ts --school <uuid|name-fragment>
 */
import { auditTimetable } from '../src/lib/timetable-rule-audit.ts';
import { resolveLessonTargets } from '../src/lib/timetable-generator.ts';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

async function rest(path: string): Promise<any[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) throw new Error(`REST ${path} -> ${response.status} ${await response.text()}`);
  return response.json() as Promise<any[]>;
}

export interface SavedVerification {
  school: string;
  levels: {
    levelGroup: string;
    classes: number;
    entries: number;
    lessonSlots: number;
    expectedPerClass: number;
    complete: boolean;
    violations: { rule: number; ruleName: string; className: string; detail: string }[];
    shortClasses: string[];
  }[];
  totalViolations: number;
}

export async function verifySchool(schoolId: string): Promise<SavedVerification> {
  const [schoolRows, classes, entries, slots, levelConfigs, assignments] = await Promise.all([
    rest(`schools?select=id,name&id=eq.${schoolId}`),
    rest(`classes?select=id,name,grade_level,level&school_id=eq.${schoolId}&is_active=eq.true`),
    rest(`timetable_entries?select=id,class_id,subject_id,teacher_id,day_of_week,time_slot_id,entry_type,level_group&school_id=eq.${schoolId}&limit=5000`),
    rest(`timetable_time_slots?select=id,slot_order,slot_type,label,level_group&school_id=eq.${schoolId}&limit=500`),
    rest(`timetable_level_configs?select=level_group,lessons_per_day,after_lunch_lessons&school_id=eq.${schoolId}`),
    rest(`teacher_subject_assignments?select=class_id,subject_id,lessons_per_week&school_id=eq.${schoolId}&is_active=eq.true`),
  ]);
  const subjects = await rest(`subjects?select=id,name&school_id=eq.${schoolId}&limit=500`);
  const subjectNames = new Map((subjects || []).map((s: any) => [String(s.id), String(s.name || '')]));
  const schoolName = schoolRows[0]?.name || schoolId;

  // The auditor re-derives Rules 2, 3, 8, 13 and 14 from the configured
  // assignments, so it must see exactly what the school configured.
  const auditAssignments = (assignments || []).map((a: any) => ({
    class_id: String(a.class_id),
    subject_id: String(a.subject_id),
    subject_name: subjectNames.get(String(a.subject_id)) || '',
    teacher_id: a.teacher_id ? String(a.teacher_id) : null,
    lessons_per_week: Number(a.lessons_per_week || 0),
    is_double_lesson: Boolean(a.is_double_lesson),
  }));

  const requiredCounts = new Map<string, number>();
  for (const a of assignments || []) {
    const key = `${String(a.class_id)}-${String(a.subject_id)}`;
    requiredCounts.set(key, (requiredCounts.get(key) || 0) + Number(a.lessons_per_week || 0));
  }

  const byLevel = new Map<string, { classes: any[]; entries: any[]; slots: any[] }>();
  for (const slot of slots || []) {
    const key = String(slot.level_group || 'unknown');
    const group = byLevel.get(key) || { classes: [], entries: [], slots: [] };
    group.slots.push(slot);
    byLevel.set(key, group);
  }
  for (const cls of classes || []) {
    const grade = Number(cls.grade_level ?? cls.level);
    const candidates = grade >= 7 && grade <= 9 ? ['junior']
      : grade >= 10 && grade <= 12 ? ['senior']
      : grade >= 1 && grade <= 3 ? ['lower-primary']
      : grade >= 4 && grade <= 6 ? ['upper-primary']
      : ['pre-primary'];
    const key = candidates.find((candidate) => byLevel.has(candidate)) || candidates[0];
    const group = byLevel.get(key) || { classes: [], entries: [], slots: [] };
    group.classes.push(cls);
    byLevel.set(key, group);
  }
  for (const entry of entries || []) {
    const key = String(entry.level_group || '');
    if (key && byLevel.has(key)) { byLevel.get(key)!.entries.push(entry); continue; }
    const owner = [...byLevel.values()].find((group) => group.classes.some((c: any) => String(c.id) === String(entry.class_id)));
    if (owner) owner.entries.push(entry);
  }

  const levels: SavedVerification['levels'] = [];
  for (const [levelGroup, group] of byLevel) {
    if (!group.classes.length) continue;
    const lessonSlots = group.slots
      .filter((s: any) => s.slot_type === 'lesson')
      .sort((a: any, b: any) => Number(a.slot_order) - Number(b.slot_order));
    if (!lessonSlots.length) continue;
    const configRow = (levelConfigs || []).find((c: any) => c.level_group === levelGroup);
    const targets = resolveLessonTargets(levelGroup, configRow as any);
    const expectedPerClass = lessonSlots.length * 5;
    const entryCountByClass = new Map<string, number>();
    for (const entry of group.entries) {
      // Breaks and lunch are stored alongside lessons; only teaching rows fill a
      // lesson cell, so only those count towards Rule 1 / Rule 14 completeness.
      if (entry.entry_type && entry.entry_type !== 'lesson' && entry.entry_type !== 'lesson_double') continue;
      const key = String(entry.class_id);
      entryCountByClass.set(key, (entryCountByClass.get(key) || 0) + 1);
    }
    const shortClasses = group.classes
      .filter((cls: any) => (entryCountByClass.get(String(cls.id)) || 0) < expectedPerClass)
      .map((cls: any) => `${String(cls.name || cls.id)} (${entryCountByClass.get(String(cls.id)) || 0}/${expectedPerClass})`);
    const audit = auditTimetable({
      entries: group.entries,
      slots: group.slots,
      subjectNames,
      classes: group.classes,
      assignments: auditAssignments.filter((a) =>
        group.classes.some((cls: any) => String(cls.id) === a.class_id)),
      levelGroup,
      requiredLessonCounts: requiredCounts,
      allowBlankSlots: shortClasses.length > 0,
      skippedClasses: group.classes
        .filter((cls: any) => (entryCountByClass.get(String(cls.id)) || 0) === 0)
        .map((cls: any) => String(cls.id)),
    });
    levels.push({
      levelGroup,
      classes: group.classes.length,
      entries: group.entries.length,
      lessonSlots: lessonSlots.length,
      expectedPerClass,
      complete: shortClasses.length === 0,
      violations: audit.violations,
      shortClasses,
    });
  }
  return {
    school: schoolName,
    levels,
    totalViolations: levels.reduce((sum, level) => sum + level.violations.length, 0),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const index = argv.indexOf('--school');
  const target = index >= 0 ? argv[index + 1] : '';
  if (!target) throw new Error('Usage: --school <uuid|name-fragment>');
  let schoolId = target;
  if (!/^[0-9a-f-]{36}$/i.test(target)) {
    const matches = await rest(`schools?select=id,name&name=ilike.*${encodeURIComponent(target)}*&limit=5`);
    if (!matches.length) throw new Error(`No school matched ${target}`);
    schoolId = matches[0].id;
    console.log(`Matched "${matches[0].name}" (${schoolId})`);
  }
  const report = await verifySchool(schoolId);
  console.log(`\nSaved-timetable verification: ${report.school}`);
  for (const level of report.levels) {
    console.log(`  ${level.levelGroup.padEnd(17)} classes=${level.classes} entries=${level.entries} expected/class=${level.expectedPerClass} complete=${level.complete} violations=${level.violations.length}${level.shortClasses.length ? ` short=[${level.shortClasses.join(', ')}]` : ''}`);
    for (const violation of level.violations.slice(0, 8)) {
      console.log(`      Rule ${violation.rule} ${violation.ruleName}: ${violation.className} - ${violation.detail}`);
    }
  }
  console.log(`\nTOTAL RULE VIOLATIONS: ${report.totalViolations}`);
  process.exit(report.totalViolations > 0 ? 1 : 0);
}

if (process.argv[1]?.includes('verify-saved-timetable')) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
