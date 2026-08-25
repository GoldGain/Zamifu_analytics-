import assert from 'node:assert/strict';
import { calculateCompetencyGrade, getSchoolLevelBand } from '../src/lib/grading.ts';
import { readFileSync } from 'node:fs';

const resellerSource = readFileSync(new URL('../src/lib/reseller.ts', import.meta.url), 'utf8');

assert.equal(getSchoolLevelBand({ name: 'Playgroup', grade_level: -3, curriculum: 'CBE' }), 'primary');
assert.equal(getSchoolLevelBand({ grade_level: -3, curriculum: 'CBE' }), 'primary');

const playgroupGrade = calculateCompetencyGrade(82, 'primary');
assert.equal(playgroupGrade.grade, 'EE');
assert.equal(playgroupGrade.subLevel, 'EE');
assert.equal(playgroupGrade.points, 0, 'Pre-Primary grading must not assign points');

assert.match(resellerSource, /DEFAULT_FEE_PER_LEARNER\s*=\s*20/);
assert.match(resellerSource, /DEFAULT_ANNUAL_FEE_PER_LEARNER\s*=\s*50/);
assert.match(resellerSource, /if \(!Number\.isFinite\(n\) \|\| n <= 0\) return fallback/);

const classesSource = readFileSync(new URL('../src/pages/dashboard/school-admin/Classes.tsx', import.meta.url), 'utf8');
assert.match(classesSource, /name:\s*['"]Playgroup['"]/);
assert.match(classesSource, /grade_level:\s*-3/);

const pricingSource = readFileSync(new URL('../src/pages/dashboard/reseller-admin/Pricing.tsx', import.meta.url), 'utf8');
assert.match(pricingSource, /annualMap\[s\.id\] = feeOrDefault\(s\.fee_per_learner_per_year, defaultAnnualFee\)/);
assert.doesNotMatch(pricingSource, /annualMap\[s\.id\][\s\S]*termFee \* 3/);

const schoolsSource = readFileSync(new URL('../src/pages/dashboard/reseller-admin/Schools.tsx', import.meta.url), 'utf8');
assert.match(schoolsSource, /s\.fee_per_learner_per_year,[\s\S]*resellerDefaults\.annual/);

const dashboardSource = readFileSync(new URL('../src/lib/reseller-dashboard.ts', import.meta.url), 'utf8');
assert.match(dashboardSource, /DEFAULT_ANNUAL_FEE_PER_LEARNER/);
assert.match(dashboardSource, /feeOrDefault\(school\.fee_per_learner_per_year, DEFAULT_ANNUAL_FEE_PER_LEARNER\)/);

console.log('Playgroup preschool grading and reseller pricing invariants passed.');
