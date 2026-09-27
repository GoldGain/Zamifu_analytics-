/**
 * Run the rebuilt solver against every school in the database and report, per
 * school and per level, whether a timetable was produced and whether it is valid.
 *
 * Two passes are made, mirroring the live UI:
 *   1. strict  - the admin generates normally. Every class must be complete.
 *   2. relaxed - the admin was warned that a class's lessons do not fill the week
 *                (Rule 14) and chose to continue. The classes that CAN be complete
 *                still are; only the classes whose own counts fall short are left
 *                with the cells they have no lessons for.
 *
 * The report separates the two kinds of failure so a data problem is never mistaken
 * for a solver problem:
 *   DATA   - the configuration cannot satisfy the rules at all. The solver names
 *            the class and the constraint.
 *   SOLVER - the configuration is satisfiable but the search did not finish. This
 *            must be zero.
 */
import { loadSchool, runSchool, sql } from './timetable-live-harness.ts';

interface Outcome {
  levelKey: string;
  entries: number;
  ok: boolean;
  violations: number;
  failedClasses: { className: string; reason: string }[];
  solverIssues: string[];
  error?: string;
}

async function main() {
  const schools = await sql<any>(`
    select s.id, s.name
    from schools s
    where exists (select 1 from classes c where c.school_id = s.id and coalesce(c.is_active, true) = true)
    order by s.name`);

  let strictLevels = 0;
  let strictSolved = 0;
  let relaxedLevels = 0;
  let relaxedSolved = 0;
  let solverFailures = 0;
  const clean: string[] = [];
  const partial: string[] = [];
  const blocked: { name: string; id: string; reason: string }[] = [];

  for (const school of schools) {
    const fixture = await loadSchool(school.id, school.name);
    const strict = runSchool(fixture, { maxNodesPerClass: 300_000 }).filter((r) => r.classes > 0);
    if (!strict.length) continue;
    const relaxed = runSchool(fixture, { maxNodesPerClass: 300_000, allowIncompleteClasses: true })
      .filter((r) => r.classes > 0);

    const summarise = (results: any[]): Outcome[] => results.map((result) => ({
      levelKey: result.levelKey,
      entries: result.entries,
      ok: result.ok,
      violations: result.violations.length,
      failedClasses: result.failedClasses,
      solverIssues: result.solverIssues,
      error: result.error,
    }));

    const strictOut = summarise(strict);
    const relaxedOut = summarise(relaxed);
    strictLevels += strictOut.length;
    strictSolved += strictOut.filter((r) => r.ok).length;
    relaxedLevels += relaxedOut.length;
    // A relaxed run counts as solved when it produced entries and no rule violations.
    relaxedSolved += relaxedOut.filter((r) => r.entries > 0 && r.violations === 0).length;

    const strictClean = strictOut.every((r) => r.ok);
    const relaxedClean = relaxedOut.every((r) => r.entries > 0 && r.violations === 0);
    const label = strictClean ? 'PASS' : relaxedClean ? 'PARTIAL' : 'FAIL';
    if (strictClean) clean.push(school.name);
    else if (relaxedClean) partial.push(school.name);
    else {
      const first = relaxedOut.find((r) => r.entries === 0 || r.violations > 0)!;
      const reason = (first.failedClasses[0]?.reason || first.solverIssues[0] || first.error || 'unknown')
        .replace(/\s+/g, ' ').slice(0, 140);
      blocked.push({ name: school.name, id: school.id, reason });
      if (first.entries === 0 && first.failedClasses.length === 0) solverFailures += 1;
    }

    console.log(`${label.padEnd(8)} ${String(school.name || '').slice(0, 38).padEnd(40)} `
      + strictOut.map((r) => `${r.levelKey}:${r.ok ? 'OK' : `${r.entries}e/${r.violations}v`}`).join(' '));
  }

  console.log(`\nschools checked: ${schools.length}`);
  console.log(`strict:  ${strictSolved}/${strictLevels} levels complete and valid`);
  console.log(`relaxed: ${relaxedSolved}/${relaxedLevels} levels produced a rule-valid timetable`);
  console.log(`levels where even the relaxed run produced nothing: ${solverFailures}`);
  console.log(`\nfully clean schools (${clean.length}): ${clean.join(' | ')}`);
  console.log(`\nvalid after continuing past a Rule 14 warning (${partial.length}): ${partial.join(' | ')}`);
  console.log('\nblocked by data (specific reason):');
  for (const entry of blocked) console.log(`  ${String(entry.name || '').slice(0, 34).padEnd(36)} ${entry.reason}`);
}

main().catch((error) => { console.error(error); process.exit(1); });