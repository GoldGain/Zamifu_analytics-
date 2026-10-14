import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subscriptionPlanAmount, subscriptionPlanPrice } from '../src/lib/subscriptionPricing.ts';

const termPlan = { price: 10, unit: 'learner' as const, period: 'term' as const };
const annualPlan = { price: 20, unit: 'learner' as const, period: 'annual' as const };
const fixedPlan = { price: 500, unit: 'school' as const, period: 'term' as const };

assert.equal(subscriptionPlanPrice(termPlan, 10, 30), 10, 'Term price must use the school-configured term rate.');
assert.equal(subscriptionPlanPrice(annualPlan, 10, 30), 30, 'Annual price must use the school-configured annual rate.');
assert.equal(subscriptionPlanPrice(fixedPlan, 10, 30), 500, 'School-priced options must not be changed by per-learner fees.');
assert.equal(subscriptionPlanPrice(termPlan, 0, 30), 10, 'Invalid configured values should fall back to the published plan price.');
assert.equal(subscriptionPlanAmount(termPlan, 12, 10, 30), 120, 'Term totals must multiply learners by the configured term rate.');
assert.equal(subscriptionPlanAmount(annualPlan, 12, 10, 30), 360, 'Annual totals must multiply learners by the configured annual rate.');
assert.equal(subscriptionPlanAmount(fixedPlan, 12, 10, 30), 500, 'School-priced plan totals must remain fixed.');

const trialCountdown = readFileSync(new URL('../src/components/TrialCountdown.tsx', import.meta.url), 'utf8');
assert.match(trialCountdown, /subscriptionPlanPrice\(selectedPlan, pricePerLearner, annualFee\)/);
assert.match(trialCountdown, /feePerLearner=\{selectedPlan\.unit === 'learner' \? selectedPlanPrice : undefined\}/);

const schoolAdminPage = readFileSync(new URL('../src/pages/dashboard/school-admin/SubscriptionReceipts.tsx', import.meta.url), 'utf8');
assert.match(schoolAdminPage, /Your school’s current subscription rate/);
assert.match(schoolAdminPage, /fee_per_learner_per_term/);
assert.match(schoolAdminPage, /fee_per_learner_per_year/);

const resellerPricingPage = readFileSync(new URL('../src/pages/dashboard/reseller-admin/Pricing.tsx', import.meta.url), 'utf8');
assert.match(resellerPricingPage, /Search by school name, code, or email/);
assert.match(resellerPricingPage, /fee_per_learner_per_term:\s*value/);
assert.match(resellerPricingPage, /fee_per_learner_per_year:\s*annualValue/);

console.log('School-specific subscription pricing and UI regression tests passed.');
