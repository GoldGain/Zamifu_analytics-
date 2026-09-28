/**
 * Live-data timetable harness.
 *
 * Pulls REAL school data from Supabase (classes, assignments, level configs,
 * activities) exactly the way the browser does, builds the same slot clock the
 * Generate screen builds, runs the production solver, and audits the output
 * against all 14 rules.
 *
 * Usage:
 *   tsx scripts/timetable-live-harness.ts                     # all target schools
 *   tsx scripts/timetable-live-harness.ts --school <uuid>      # one school
 *   tsx scripts/timetable-live-harness.ts --json out.json      # write machine data
 */

import { writeFileSync } from 'node:fs';
import { generateSlots, resolveLessonTargets, type TimetableConfig } from '../src/lib/timetable-generator.ts';
import { solveTimetableCsp } from '../src/lib/timetable-csp-solver.ts';
import { auditTimetable } from '../src/lib/timetable-rule-audit.ts';
import { activityMatchesLevel, isPostLessonActivity, resolveActivityLessonSlot } from '../src/lib/timetable-activity.ts';

/**
 * Credentials come from the environment so no secret is ever committed:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
 * Run with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx scripts/timetable-live-harness.ts
 */
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see the note at the top of this file).`);
  return value;
};
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const PAT = requireEnv('SUPABASE_ACCESS_TOKEN');
const PROJECT_REF = requireEnv('SUPABASE_PROJECT_REF');

const TARGET_EMAILS = [
  'aicmutulanij@gmail.com',
  'kiruihillary510@gmail.com',
  'theophillusngewa2@yahoo.com',
  'mgandi912@gmail.com',
];

export const LEVEL_GROUPS = [
  'pre-primary', 'lower-primary', 'upper-primary', 'combined-primary',
  'junior', 'senior', 'form-3-4',
] as const;

const LEVEL_GROUP_GRADE_RANGES: Record<string, number[]> = {
  'pre-primary': [-3, -2, -1, 0],
  'lower-primary': [1, 2, 3],
  'upper-primary': [4, 5, 6],
  'combined-primary': [1, 2, 3, 4, 5, 6],
  'junior': [7, 8, 9],
  'senior': [10, 11, 12],
  'form-3-4': [11, 12],
};

export function classMatchesLevel(cls: any, levelKey: string): boolean {
  const gradeLevel = Number(cls.grade_level ?? cls.level);
  if ((LEVEL_GROUP_GRADE_RANGES[levelKey] || []).includes(gradeLevel)) return true;
  const name = String(cls.name || '').toLowerCase();
  if (levelKey === 'pre-primary' && /(pp\s*[12]|pre[\s-]?primary|playgroup|baby)/.test(name)) return true;
  if (levelKey === 'lower-primary' && /grade\s*[123]\b/.test(name)) return true;
  if (levelKey === 'upper-primary' && /grade\s*[456]\b/.test(name)) return true;
  if (levelKey === 'combined-primary' && /grade\s*[1-6]\b/.test(name)) return true;
  if (levelKey === 'junior' && /grade\s*[789]\b/.test(name)) return true;
  if (levelKey === 'senior' && /grade\s*(10|11|12)\b/.test(name)) return true;
  return levelKey === 'form-3-4' && /form\s*[34]\b/.test(name);
}

async function rest(path: string): Promise<any[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) throw new Error(`REST ${path} -> ${response.status} ${await response.text()}`);
  return response.json() as Promise<any[]>;
}

async function sql<T = any>(query: string): Promise<T[]> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`SQL -> ${response.status} ${await response.text()}`);
  return response.json() as Promise<T[]>;
}
export { sql };

export interface SchoolFixture {
  id: string;
  name: string;
  curriculum: string;
  classes: any[];
  assignments: any[];
  teachers: any[];
  levelConfigs: Record<string, any>;
  activities: any[];
  subjects: any[];
}

export async function loadSchool(schoolId: string, name?: string): Promise<SchoolFixture> {
  const [classes, assignments, teachers, levelConfigRows, activities, subjects] = await Promise.all([
    rest(`classes?school_id=eq.${schoolId}&is_active=eq.true&select=id,name,level,grade_level,stream,stream_name,capacity,class_teacher_id`),
    rest(`teacher_subject_assignments?school_id=eq.${schoolId}&is_active=eq.true&select=*,subjects(name,code),teachers(first_name,last_name)`),
    rest(`teachers?school_id=eq.${schoolId}&is_active=eq.true&select=id,first_name,last_name`),
    rest(`timetable_level_configs?school_id=eq.${schoolId}&select=*`),
    rest(`after_school_activities?school_id=eq.${schoolId}&select=*`),
    rest(`subjects?school_id=eq.${schoolId}&select=id,name,code`),
  ]);
  const levelConfigs: Record<string, any> = {};
  for (const row of levelConfigRows) if (row.level_group) levelConfigs[row.level_group] = row;
  return {
    id: schoolId,
    name: name || schoolId,
    curriculum: '',
    classes, assignments, teachers, levelConfigs, activities, subjects,
  };
}

/**
 * Candidate test schools: the four named accounts first, then the most complex
 * schools in the platform (most classes, assignments, teachers and doubles).
 */
export async function listCandidateSchools(limit = 14): Promise<
  { id: string; name: string; curriculum: string; classes: number; assignments: number; doubles: number; teachers: number }[]
> {
  const placeholders = TARGET_EMAILS.map((email) => `'${email}'`).join(',');
  const named = await sql<any>(`
    select s.id, s.name, s.curriculum,
      (select count(*) from classes c where c.school_id = s.id and c.is_active)::int as classes,
      (select count(*) from teacher_subject_assignments a where a.school_id = s.id and a.is_active)::int as assignments,
      (select count(*) from teacher_subject_assignments a where a.school_id = s.id and a.is_active and a.is_double_lesson)::int as doubles,
      (select count(*) from teachers t where t.school_id = s.id and t.is_active)::int as teachers
    from profiles p
    join school_admins sa on sa.user_id = p.id
    join schools s on s.id = sa.school_id
    where p.email in (${placeholders})
    order by s.name`);

  const complex = await sql<any>(`
    select s.id, s.name, s.curriculum,
      (select count(*) from classes c where c.school_id = s.id and c.is_active)::int as classes,
      (select count(*) from teacher_subject_assignments a where a.school_id = s.id and a.is_active)::int as assignments,
      (select count(*) from teacher_subject_assignments a where a.school_id = s.id and a.is_active and a.is_double_lesson)::int as doubles,
      (select count(*) from teachers t where t.school_id = s.id and t.is_active)::int as teachers
    from schools s
    where exists (select 1 from classes c where c.school_id = s.id and c.is_active)
      and exists (select 1 from teacher_subject_assignments a where a.school_id = s.id and a.is_active)
    order by
      (select count(*) from teacher_subject_assignments a where a.school_id = s.id and a.is_active and a.is_double_lesson) desc,
      (select count(*) from teacher_subject_assignments a where a.school_id = s.id and a.is_active) desc,
      (select count(*) from classes c where c.school_id = s.id and c.is_active) desc
    limit ${limit}`);

  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of [...named, ...complex]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Mirror of mapLevelConfigToFrontend in TimetableGenerate.tsx */
function mapLevelConfigToFrontend(dbConfig: any): TimetableConfig & { activities_start?: string; activities_end?: string } {
  const cut = (value: any): string => (value ? String(value).slice(0, 5) : '');
  return {
    lesson_duration: dbConfig.period_duration || 40,
    school_start: cut(dbConfig.start_time),
    school_end: cut(dbConfig.end_time || dbConfig.activities_end || dbConfig.lunch_end),
    first_break_start: cut(dbConfig.first_break_start),
    first_break_end: cut(dbConfig.first_break_end),
    second_break_start: cut(dbConfig.second_break_start),
    second_break_end: cut(dbConfig.second_break_end),
    lunch_start: cut(dbConfig.lunch_start),
    lunch_end: cut(dbConfig.lunch_end),
    activities_start: cut(dbConfig.activities_start) || undefined,
    activities_end: cut(dbConfig.activities_end) || undefined,
    activities: {},
  };
}

const toMinutes = (value: string | null | undefined): number => {
  const [hours, minutes] = String(value || '').slice(0, 5).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
};

export interface LevelRunResult {
  levelKey: string;
  classes: number;
  entries: number;
  searchNodes: number;
  durationMs: number;
  ok: boolean;
  solverIssues: string[];
  solverWarnings: string[];
  failedClasses: { className: string; reason: string }[];
  engine: string;
  restartCount: number;
  violations: { rule: number; ruleName: string; className: string; detail: string }[];
  warnings: string[];
  error?: string;
  lessonSlots: number;
  expectedWeeklyTotal: number;
}

/**
 * Build the level slot clock exactly like TimetableGenerate does, then solve.
 */
export function runLevel(
  fixture: SchoolFixture,
  levelKey: string,
  options: { maxNodesPerClass?: number; allowIncompleteClasses?: boolean } = {},
): LevelRunResult {
  const base: LevelRunResult = {
    levelKey, classes: 0, entries: 0, searchNodes: 0, durationMs: 0,
    ok: false, solverIssues: [], solverWarnings: [], failedClasses: [], engine: 'none', restartCount: 0,
    violations: [], warnings: [], lessonSlots: 0, expectedWeeklyTotal: 0,
  };
  const levelDbConfig = fixture.levelConfigs[levelKey];
  if (!levelDbConfig) {
    base.error = `no saved Timetable Setup for ${levelKey}`;
    return base;
  }
  const config = mapLevelConfigToFrontend(levelDbConfig);
  for (const field of ['school_start', 'first_break_start', 'first_break_end', 'second_break_start', 'second_break_end', 'lunch_start', 'lunch_end'] as const) {
    if (!config[field]) {
      base.error = `missing ${field} in saved setup for ${levelKey}`;
      return base;
    }
  }

  const classesToProcess = fixture.classes.filter((cls) => classMatchesLevel(cls, levelKey));
  base.classes = classesToProcess.length;
  if (classesToProcess.length === 0) {
    base.error = `no active classes match ${levelKey}`;
    return base;
  }

  const targets = resolveLessonTargets(levelKey, config);
  const activities = fixture.activities || [];
  const generationConfig = {
    ...config,
    activities_start: activities.length ? undefined : (config as any).activities_start,
    activities_end: activities.length ? undefined : (config as any).activities_end,
    lessons_per_day: targets.totalLessons,
    after_lunch_lessons: targets.afterLunch,
  };
  const baseSlots = generateSlots(generationConfig, targets.totalLessons, levelKey);

  const activityCandidates = activities
    .filter((a) => activityMatchesLevel(a.target_level_group, levelKey))
    .filter((a) => a.activity_name && toMinutes(a.end_time) > toMinutes(a.start_time))
    .filter((a) => !(['lower-primary', 'pre-primary'].includes(levelKey)) || toMinutes(a.start_time) < toMinutes(config.lunch_start));

  const postLessonActivities = activityCandidates.filter((a) => isPostLessonActivity(baseSlots, a));
  const activityGroups = new Map<string, any[]>();
  for (const activity of postLessonActivities) {
    const key = `${activity.start_time}-${activity.end_time}`;
    activityGroups.set(key, [...(activityGroups.get(key) || []), activity]);
  }
  const combinedSlots = [
    ...baseSlots,
    ...[...activityGroups.values()].map((group) => ({
      slot_order: 0,
      label: `ACTIVITY: ${group.map((a: any) => a.activity_name).join(' / ')}`,
      slot_type: 'activities' as const,
      start_time: group[0].start_time,
      end_time: group[0].end_time,
    })),
  ]
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time) || (a.slot_type === 'activities' ? 1 : -1))
    .map((slot, index) => ({ ...slot, slot_order: index + 1 }));

  const createdSlots = combinedSlots.map((slot) => ({
    ...slot,
    id: `slot-${levelKey}-${slot.slot_order}-${Math.random().toString(36).slice(2, 8)}`,
    school_id: fixture.id,
    level_group: levelKey,
    slot_type: slot.slot_type === 'activities' ? 'activity' : slot.slot_type,
  }));
  const lessonSlots = createdSlots
    .filter((slot) => slot.slot_type === 'lesson')
    .sort((a, b) => a.slot_order - b.slot_order);
  base.lessonSlots = lessonSlots.length;
  base.expectedWeeklyTotal = lessonSlots.length * 5;

  const subjectNames = new Map<string, string>();
  const classIdsInLevel = new Set(classesToProcess.map((cls) => String(cls.id)));
  const levelAssignments = fixture.assignments.filter((a) => classIdsInLevel.has(String(a.class_id)));
  for (const assignment of levelAssignments) {
    subjectNames.set(String(assignment.subject_id), String(assignment.subjects?.name || assignment.subject_name || ''));
  }

  const started = Date.now();
  let solverResult: any;
  try {
    solverResult = solveTimetableCsp({
      schoolId: fixture.id,
      levelKey,
      classes: classesToProcess,
      assignments: levelAssignments,
      lessonSlots,
      maxSearchNodesPerClass: options.maxNodesPerClass,
      // The live UI lets an admin continue past a Rule 14 lesson-count warning;
      // the harness mirrors that so the same path can be measured.
      allowIncompleteClasses: options.allowIncompleteClasses,
    });
  } catch (error: any) {
    base.error = `solver threw: ${error?.message || String(error)}`;
    base.durationMs = Date.now() - started;
    return base;
  }
  base.durationMs = Date.now() - started;
  base.searchNodes = solverResult.searchNodes;
  base.entries = solverResult.entries.length;
  base.solverIssues = (solverResult.issues || []).map((issue: any) => `[${issue.code}] ${issue.message}`);
  base.solverWarnings = (solverResult.warnings || []).map((warning: any) => `[${warning.code}] ${warning.message}`);
  base.failedClasses = (solverResult.failedClasses || []).map((item: any) => ({ className: item.className, reason: item.reason }));
  base.engine = solverResult.engine;
  base.restartCount = solverResult.restartCount;

  if (solverResult.issues?.length || solverResult.entries.length === 0) {
    base.error = 'solver returned no complete grid';
    return base;
  }

  const audit = auditTimetable({
    entries: solverResult.entries,
    slots: createdSlots.filter((slot) => slot.slot_type === 'lesson'),
    classes: classesToProcess,
    assignments: levelAssignments.map((assignment) => ({
      class_id: String(assignment.class_id),
      subject_id: String(assignment.subject_id),
      subject_name: String(assignment.subjects?.name || ''),
      teacher_id: assignment.teacher_id,
      lessons_per_week: Number(assignment.lessons_per_week || 0),
    })),
    subjectNames,
    levelGroup: levelKey,
    expectedWeeklyTotal: base.expectedWeeklyTotal,
    days: [1, 2, 3, 4, 5],
    // When the admin chose to continue past a Rule 14 warning, the cells a class
    // has no lessons for are expected to be empty; every other rule still applies.
    allowBlankSlots: Boolean(options.allowIncompleteClasses),
    // Classes the solver reported as blocked by their own data are surfaced
    // separately, so they are not counted as broken rules here.
    skippedClasses: (solverResult.failedClasses || []).map((entry: any) => String(entry.classId)),
  });
  base.violations = audit.violations.map((violation) => ({
    rule: violation.rule,
    ruleName: violation.ruleName,
    className: violation.className,
    detail: violation.detail,
  }));
  base.warnings = audit.warnings;
  base.ok = base.violations.length === 0 && base.warnings.length === 0;
  return base;
}

export function runSchool(
  fixture: SchoolFixture,
  options: { maxNodesPerClass?: number; allowIncompleteClasses?: boolean } = {},
) {
  const results: LevelRunResult[] = [];
  for (const levelKey of LEVEL_GROUPS) {
    const hasClasses = fixture.classes.some((cls) => classMatchesLevel(cls, levelKey));
    if (!hasClasses) continue;
    // A level with no saved Timetable Setup has no lesson structure at all, so it
    // cannot be generated for - skip it rather than reporting a solver failure.
    if (!fixture.levelConfigs?.[levelKey]) continue;
    const levelAssignments = fixture.assignments.filter((a) =>
      fixture.classes.some((cls) => classMatchesLevel(cls, levelKey) && String(cls.id) === String(a.class_id)));
    if (levelAssignments.length === 0) continue;
    results.push(runLevel(fixture, levelKey, options));
  }
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const schoolArgIndex = argv.indexOf('--school');
  const schoolsArgIndex = argv.indexOf('--schools');
  const jsonIndex = argv.indexOf('--json');
  const onlySchool = schoolArgIndex >= 0 ? argv[schoolArgIndex + 1] : null;
  const explicitSchools = schoolsArgIndex >= 0 ? argv[schoolsArgIndex + 1].split(',').filter(Boolean) : null;
  const maxNodesIndex = argv.indexOf('--max-nodes');
  const maxNodesPerClass = maxNodesIndex >= 0 ? Number(argv[maxNodesIndex + 1]) : undefined;
  const allowIncompleteClasses = argv.includes('--continue-data-warnings');

  let schools: { id: string; name: string }[];
  if (onlySchool) {
    schools = [{ id: onlySchool, name: onlySchool }];
  } else if (explicitSchools) {
    const list = explicitSchools.map((id) => `'${id}'`).join(',');
    schools = await sql<{ id: string; name: string }>(`select id, name from schools where id in (${list})`);
  } else {
    const placeholders = TARGET_EMAILS.map((email) => `'${email}'`).join(',');
    schools = await sql<{ id: string; name: string }>(`
      select s.id, s.name, p.email
      from profiles p
      join schools s on s.id = coalesce(
        (select sa.school_id from school_admins sa where sa.user_id = p.id limit 1), p.school_id)
      where p.email in (${placeholders})
      order by s.name`);
  }

  const report: any[] = [];
  let failures = 0;
  for (const school of schools) {
    const fixture = await loadSchool(school.id, school.name);
    const results = runSchool(fixture, { maxNodesPerClass, allowIncompleteClasses });
    const levels = results.filter((result) => result.classes > 0);
    const okAll = results.length > 0 && results.every((result) => result.ok);
    if (!okAll) failures += 1;
    console.log(`\n${'='.repeat(78)}`);
    console.log(`${okAll ? 'PASS' : 'FAIL'}  ${school.name}  (${school.id})`);
    console.log(`${'='.repeat(78)}`);
    console.log(`  classes=${fixture.classes.length} assignments=${fixture.assignments.length} teachers=${fixture.teachers.length} levels=${levels.map((l) => l.levelKey).join(',')}`);
    for (const result of results) {
      const tag = result.ok ? 'OK  ' : 'BAD ';
      console.log(`  ${tag} ${result.levelKey.padEnd(18)} classes=${String(result.classes).padStart(2)} `
        + `entries=${String(result.entries).padStart(4)} slots=${result.lessonSlots} `
        + `nodes=${String(result.searchNodes).padStart(8)} ${String(result.durationMs).padStart(6)}ms `
        + `${result.engine}#${result.restartCount}`);
      if (result.error) console.log(`        ERROR: ${result.error}`);
      for (const failed of result.failedClasses.slice(0, 4)) console.log(`        FAILED CLASS ${failed.className}: ${failed.reason.slice(0, 300)}`);
      for (const issue of result.solverIssues.slice(0, 6)) console.log(`        solver: ${issue}`);
      if (result.solverIssues.length > 6) console.log(`        solver: ... and ${result.solverIssues.length - 6} more`);
      for (const warning of result.solverWarnings.slice(0, 8)) console.log(`        SOLVER-WARN: ${warning}`);
      for (const warning of result.warnings.slice(0, 8)) console.log(`        WARN: ${warning}`);
      // Group violations by rule for compact reporting
      const byRule = new Map<number, typeof result.violations>();
      for (const violation of result.violations) {
        byRule.set(violation.rule, [...(byRule.get(violation.rule) || []), violation]);
      }
      for (const [rule, list] of [...byRule.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(`        RULE ${rule} ${list[0].ruleName}: ${list.length} violation(s)`);
        for (const violation of list.slice(0, 3)) console.log(`           - ${violation.className}: ${violation.detail}`);
        if (list.length > 3) console.log(`           - ... and ${list.length - 3} more`);
      }
    }
    report.push({ school, results, okAll });
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log(`SUMMARY: ${schools.length - failures}/${schools.length} schools fully clean`);
  console.log(`${'='.repeat(78)}`);
  for (const entry of report) {
    console.log(`  ${entry.okAll ? 'PASS' : 'FAIL'}  ${entry.school.name}`);
  }
  if (jsonIndex >= 0 && argv[jsonIndex + 1]) {
    writeFileSync(argv[jsonIndex + 1], JSON.stringify(report, null, 2));
    console.log(`\nJSON written to ${argv[jsonIndex + 1]}`);
  }
  process.exit(failures === 0 ? 0 : 1);
}

if (process.argv[1]?.includes('timetable-live-harness')) {
  main().catch((error) => {
    console.error('HARNESS ERROR', error);
    process.exit(2);
  });
}
