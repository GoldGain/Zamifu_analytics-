import assert from 'node:assert/strict';
import { getSubjectCode } from '../src/lib/timetable-subject-code';

const cases = [
  ['Creative Arts', '', 'CAS'],
  ['Creative Arts and Sports', '', 'CAS'],
  ['creative arts', 'CRE', 'CAS'],
  ['CRE', '908', 'CRE'],
  ['Christian Religious Education', '', 'CRE'],
  ['Mathematics', '', 'MATH'],
  ['', 'CAS', 'CAS'],
  ['', 'CRE', 'CRE'],
] as const;

for (const [name, code, expected] of cases) {
  assert.equal(getSubjectCode(name, code), expected, `${name || code} should map to ${expected}`);
}

console.log(`Passed ${cases.length} timetable subject-code regression cases.`);
