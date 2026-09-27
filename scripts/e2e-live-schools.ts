/**
 * Live end-to-end timetable verification across many schools.
 *
 * For each school it performs the same work the School Admin portal does:
 *   1. load the school's saved setup and assignments exactly as Generate does,
 *   2. run the production CSP solver over every configured level,
 *   3. audit the produced grid with the independent 14-rule auditor,
 *   4. report PASS / WARN / BLOCK with the specific data reason.
 *
 * The solver and auditor are the same modules the deployed UI imports, so this
 * is a faithful live test; the browser session is used for screenshots.
 *
 * Usage: tsx scripts/e2e-live-schools.ts [--schools a,b,c] [--json out.json]
 */
import { loadSchool, runSchool, sql, classMatchesLevel, LEVEL_GROUPS } from './timetable-live-harness.ts';

export interface SchoolE2EResult {
  id: string;
  name: string;
  verdict: 'PASS' | 'WARN' | 'BLOCK';
  levels: {
    levelKey: string;
    classes: number;
    entries: number;
    nodes: number;
    ms: number;
    complete: boolean;
    violations: number;
    shortClasses: { className: string; reason: string }[];
    blockedClasses: { className: string; reason: string }[];
  }[];
  reason?: string;
}

export async function e2eSchool(schoolId: string, name?: string): Promise<SchoolE2EResult> {
  const fixture = await loadSchool(schoolId, name);
  const strict = runSchool(fixture, { maxNodesPerClass: 500_000 }).filter((r) => r.classes > 0);
  const relaxed = runSchool(fixture, { maxNodesPerClass: 500_000, allowIncompleteClasses: true })
    .filter((r) => r.classes > 0);

  const levels = strict.map((result) => {
    const soft = relaxed.find((r) => r.levelKey === result.levelKey);
    const violations = result.violations.length;
    return {
      levelKey: result.levelKey,
      classes: result.classes,
      entries: result.entries,
      nodes: result.searchNodes,
      ms: result.durationMs,
      complete: result.ok,
      violations,
      shortClasses: result.failedClasses,
      blockedClasses: (soft?.failedClasses || []).filter((f) => /no active teacher assignments|no lessons to schedule/i.test(f.reason)),
    };
  });

  const anyComplete = levels.some((level) => level.entries > 0 && level.violations === 0);
  const allComplete = levels.every((level) => level.complete && level.violations === 0);
  const anyProduced = levels.some((level) => level.entries > 0);
  const verdict: SchoolE2EResult['verdict'] = allComplete ? 'PASS' : anyComplete || anyProduced ? 'WARN' : 'BLOCK';
  const firstProblem = levels.flatMap((level) => level.shortClasses)[0];
  return {
    id: schoolId,
    name: fixture.name,
    verdict,
    levels,
    reason: verdict === 'PASS' ? undefined : firstProblem?.reason,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const schoolsIndex = argv.indexOf('--schools');
  const jsonIndex = argv.indexOf('--json');
  let targets: { id: string; name?: string }[] = [];
  if (schoolsIndex >= 0 && argv[schoolsIndex + 1]) {
    const list = argv[schoolsIndex + 1].split(',').filter(Boolean);
    const rows = await sql<any>(`select id, name from schools`);
    targets = list.map((entry) => {
      const match = rows.find((r: any) => r.id === entry || (r.name || '').toLowerCase().includes(entry.toLowerCase()));
      if (!match) throw new Error(`No school matched ${entry}`);
      return { id: match.id, name: match.name };
    });
  } else {
    targets = await sql<any>(`
      select s.id, s.name from schools s
      where exists (select 1 from timetable_level_configs c where c.school_id = s.id)
        and exists (select 1 from classes k where k.school_id = s.id and coalesce(k.is_active, true) = true)
      order by s.name`);
  }

  const results: SchoolE2EResult[] = [];
  for (const target of targets) {
    const result = await e2eSchool(target.id, target.name);
    results.push(result);
    const detail = result.levels.map((level) => {
      const state = level.violations > 0 ? `VIOLATIONS ${level.violations}`
        : level.complete ? 'complete'
        : `${level.entries} entries`;
      return `${level.levelKey}:${level.classes}cls/${state}/${level.nodes}n`;
    }).join(' ');
    console.log(`${result.verdict.padEnd(6)} ${String(result.name || '').slice(0, 36).padEnd(38)} ${detail}`);
    if (result.reason) console.log(`       ${result.reason.replace(/\s+/g, ' ').slice(0, 150)}`);
  }

  const pass = results.filter((r) => r.verdict === 'PASS').length;
  const warn = results.filter((r) => r.verdict === 'WARN').length;
  const block = results.filter((r) => r.verdict === 'BLOCK').length;
  const solverFailures = results.reduce((sum, r) =>
    sum + r.levels.filter((l) => l.entries === 0 && l.shortClasses.length === 0).length, 0);
  console.log(`\nschools=${results.length} PASS=${pass} WARN=${warn} BLOCK=${block}`);
  console.log(`opaque solver failures (no named data reason): ${solverFailures}`);
  if (jsonIndex >= 0 && argv[jsonIndex + 1]) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(argv[jsonIndex + 1], JSON.stringify(results, null, 2));
    console.log(`JSON written to ${argv[jsonIndex + 1]}`);
  }
}

if (process.argv[1]?.includes('e2e-live-schools')) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
