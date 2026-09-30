import assert from 'node:assert/strict';
import { calculateCompetencyGrade } from '../src/lib/grading.ts';
import { SMS_TEMPLATES } from '../src/lib/sms.ts';

const message = SMS_TEMPLATES.resultsToParent(
  'Amina Otieno',
  'Grade 7 East',
  [
    { name: 'Mathematics', marks: 50, rawMarks: 5, outOf: 10, grade: 'BE' },
    { name: 'English', marks: 100, rawMarks: 10, outOf: 10, grade: 'EE' },
  ],
  2,
  16,
  1,
  20,
  '',
  { name: 'Grade 7 East', grade_level: 7 },
  { totalMarks: 15, totalPossibleMarks: 20 },
);

const expectedGrade = calculateCompetencyGrade(75, 'junior');
assert.match(message, /Total Marks: 15\/20/);
assert.match(message, /Mean: 75%/);
assert.match(message, new RegExp(`Mean Grade: ${expectedGrade.subLevel}`));
assert.doesNotMatch(message, /Average Marks:/);

console.log('RESULTS SMS TEMPLATE PASS');
