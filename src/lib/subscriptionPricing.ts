export interface SubscriptionPricingPlan {
  price: number;
  unit: 'learner' | 'school' | 'sms';
  period: 'term' | 'annual';
}

export function subscriptionPlanPrice(
  plan: SubscriptionPricingPlan,
  termFeePerLearner: number,
  annualFeePerLearner: number,
): number {
  if (plan.unit !== 'learner') return plan.price;
  const configured = plan.period === 'annual' ? annualFeePerLearner : termFeePerLearner;
  return Number.isFinite(configured) && configured > 0 ? configured : plan.price;
}

export function subscriptionPlanAmount(
  plan: SubscriptionPricingPlan,
  learnersCount: number,
  termFeePerLearner: number,
  annualFeePerLearner: number,
): number {
  if (plan.unit !== 'learner') return plan.price;
  return Math.max(0, Number(learnersCount) || 0)
    * subscriptionPlanPrice(plan, termFeePerLearner, annualFeePerLearner);
}
