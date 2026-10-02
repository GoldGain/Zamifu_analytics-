import { calculateCompetencyGrade } from '../src/lib/grading';

const expected: Array<[number, string]> = [
  [100, 'EE'],
  [76, 'EE'],
  [75, 'ME'],
  [51, 'ME'],
  [50, 'AE'],
  [26, 'AE'],
  [25, 'BE'],
  [0, 'BE'],
];

for (const [score, grade] of expected) {
  const actual = calculateCompetencyGrade(score, 'primary');
  if (actual.subLevel !== grade || actual.grade !== grade || actual.points !== 0) {
    throw new Error(`Primary ${score}% expected ${grade}, got ${actual.subLevel}/${actual.grade}/${actual.points}`);
  }
}

const juniorChecks: Array<[number, string]> = [[75, 'EE2'], [74, 'ME1'], [41, 'ME2'], [40, 'AE1']];
for (const [score, grade] of juniorChecks) {
  const actual = calculateCompetencyGrade(score, 'junior');
  if (actual.subLevel !== grade) throw new Error(`Junior ${score}% changed unexpectedly: ${actual.subLevel}`);
}

const seniorChecks: Array<[number, string]> = [[75, 'EE2'], [74, 'ME1'], [41, 'ME2'], [40, 'AE1']];
for (const [score, grade] of seniorChecks) {
  const actual = calculateCompetencyGrade(score, 'senior');
  if (actual.subLevel !== grade) throw new Error(`Senior ${score}% changed unexpectedly: ${actual.subLevel}`);
}

console.log('Primary grading boundary tests passed; Junior/Senior bands unchanged.');
