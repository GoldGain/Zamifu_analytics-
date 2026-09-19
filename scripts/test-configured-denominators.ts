import { getRequiredLearningAreas } from '../src/lib/grading';

const assert = (actual: number | null, expected: number, label: string) => {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
};

assert(getRequiredLearningAreas({ grade_level: 7 }, 4), 9, 'Junior remains fixed at 9');
assert(getRequiredLearningAreas({ grade_level: 9 }, 6), 9, 'Junior remains fixed at 9 for Grade 9');
assert(getRequiredLearningAreas({ grade_level: 2 }, 4), 4, 'Lower Primary uses configured count');
assert(getRequiredLearningAreas({ grade_level: 5 }, 4), 4, 'Upper Primary uses configured count');
assert(getRequiredLearningAreas({ grade_level: 10 }, 4), 4, 'Senior uses configured count');
assert(getRequiredLearningAreas({ name: 'PP1' }, 3), 3, 'Pre-Primary uses configured count');

console.log('Configured denominator tests passed');
