import assert from 'node:assert/strict';
import {
  getAssessmentLevelLabel,
  getEffectiveGradeLevel,
  matchesAssessmentScope,
} from '../src/lib/assessment-progress.ts';

const levels = [
  [-3, 'Playgroup'],
  [-2, 'PP1'],
  [-1, 'PP2'],
  [1, 'Grade 1'],
  [2, 'Grade 2'],
  [3, 'Grade 3'],
  [4, 'Grade 4'],
  [6, 'Grade 6'],
  [7, 'Grade 7'],
  [9, 'Grade 9'],
  [10, 'Grade 10'],
  [11, 'Grade 11'],
  [12, 'Grade 12'],
] as const;

for (const [gradeLevel, label] of levels) {
  const classRecord = { id: String(gradeLevel), name: label, grade_level: gradeLevel };
  assert.equal(getEffectiveGradeLevel(classRecord), gradeLevel);
  assert.equal(getAssessmentLevelLabel(classRecord), label);
}

const form3 = { id: 'form-3', name: 'Form 3', level: 11 };
assert.equal(getEffectiveGradeLevel(form3), 11);
assert.equal(getAssessmentLevelLabel(form3), 'Form 3');

const playgroup = { id: 'playgroup', name: 'Playgroup', grade_level: -3 };
assert.equal(matchesAssessmentScope({ target_type: 'school' }, playgroup), true);
assert.equal(matchesAssessmentScope({ target_type: 'grade', target_grade_level: -3 }, playgroup), true);
assert.equal(matchesAssessmentScope({ target_type: 'grade', target_grade_level: -2 }, playgroup), false);
assert.equal(matchesAssessmentScope({ target_type: 'class', target_class_id: 'playgroup' }, playgroup), true);
assert.equal(matchesAssessmentScope({ target_type: 'class', target_class_id: 'other' }, playgroup), false);

console.log('ASSESSMENT PROGRESS LEVEL REGRESSION PASS');
