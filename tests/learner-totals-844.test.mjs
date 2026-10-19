import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'learner-totals-844-'));
await build({
  entryPoints: [join(repoRoot, 'src/lib/learnerTotals.ts'), join(repoRoot, 'src/lib/grading.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: dir,
  outExtension: { '.js': '.mjs' },
  plugins: [{
    name: 'src-alias',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@\// }, (args) => ({
        path: join(repoRoot, 'src', `${args.path.slice(2)}.ts`),
      }));
    },
  }],
});
const { aggregateLearnerTotals, calculateKnecSevenSubjectMetrics } = await import(pathToFileURL(join(dir, 'learnerTotals.mjs')));
const { calculate844Grade } = await import(pathToFileURL(join(dir, 'grading.mjs')));
process.on('exit', () => rm(dir, { recursive: true, force: true }));

const form3 = { id: 'form3', name: 'Form 3', curriculum: '', grade_level: 3 };
const scores = {
  Mathematics: 82,
  English: 75,
  Biology: 70,
  Chemistry: 35,
  History: 30,
  Geography: 20,
  CRE: 10,
};
const makeRows = (subjectScores) => Object.entries(subjectScores).map(([name, percentage]) => ({
  student_id: 'student-1',
  class_id: form3.id,
  students: { id: 'student-1', first_name: 'Test', last_name: 'Student', gender: 'female' },
  subjects: { name },
  marks: percentage,
  out_of: 100,
  percentage,
}));

 test('Form 3/4 overall mean uses 12-point KNEC points and ranks seven subjects out of 84', () => {
  const metrics = calculateKnecSevenSubjectMetrics(scores);
  assert.equal(metrics.subjects.length, 7);
  assert.equal(metrics.totalPoints, 40);

  const summary = aggregateLearnerTotals([
    ...makeRows(scores),
    { student_id: 'student-1', class_id: form3.id, students: { id: 'student-1' }, subjects: { name: 'Physics' }, marks: null, percentage: null, out_of: 100 },
  ], form3)[0];

  assert.equal(summary.count, 7, 'a blank Physics row must not count as a zero mark');
  assert.equal(summary.totalPoints, 40);
  assert.equal(summary.rankingTotalPoints, 40);
  assert.equal(summary.rankingSubjects.length, 7);
  assert.ok(Math.abs(summary.avgPct - (40 / 84 * 100)) < 1e-9);
  assert.equal(calculate844Grade(summary.avgPct).grade, 'C-');
});

test('missing subjects are not added as zeros to the KNEC maximum', () => {
  const fewerScores = { Mathematics: 82, English: 75, Biology: 70, Chemistry: 35, History: 30, Geography: 20 };
  const summary = aggregateLearnerTotals(makeRows(fewerScores), form3)[0];
  assert.equal(summary.rankingSubjects.length, 6);
  assert.equal(summary.rankingTotalPoints, 39);
  assert.ok(Math.abs(summary.avgPct - (39 / 72 * 100)) < 1e-9);
});

test('CBE classes retain the existing competency points and percentage mean', () => {
  const cbeClass = { id: 'grade10', name: 'Grade 10', curriculum: 'CBE', grade_level: 10 };
  const row = {
    student_id: 'student-2', class_id: cbeClass.id,
    students: { id: 'student-2' }, subjects: { name: 'Mathematics' },
    marks: 47, out_of: 100, percentage: 47,
  };
  const summary = aggregateLearnerTotals([row], cbeClass)[0];
  assert.equal(summary.avgPct, 47);
  assert.equal(summary.totalPoints, 5);
  assert.equal(summary.rankingTotalPoints, 5);
});
