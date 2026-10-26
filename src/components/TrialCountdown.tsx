import React, { useEffect, useState } from 'react';
import { useTrial } from '@/contexts/TrialContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AlertTriangle, CheckCircle, Clock, CreditCard, Loader2 } from 'lucide-react';
import { ANNUAL_PRICE_PER_LEARNER, PRICE_PER_LEARNER, SMS_NON_SUBSCRIBER_PLAN, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@/lib/trial';
import { PaystackButton } from './Payment/PaystackButton';

export const TrialCountdown: React.FC = () => {
  const { trialStatus, isLoading } = useTrial();
  const { user } = useAuth();
  const [showPayment, setShowPayment] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('full_access_20');
  const [learnersCount, setLearnersCount] = useState(0);
  const [billingLearnerCount, setBillingLearnerCount] = useState<number | null>(null);
  const [fetchingLearners, setFetchingLearners] = useState(false);

  useEffect(() => {
    if (!user?.schoolId) return;
    setFetchingLearners(true);
    void Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId).eq('is_active', true).eq('status', 'active'),
      supabase.from('schools').select('billing_learner_count').eq('id', user.schoolId).maybeSingle(),
    ]).then(([students, school]) => {
      if (!students.error && students.count !== null) setLearnersCount(students.count);
      const saved = Number(school.data?.billing_learner_count);
      setBillingLearnerCount(Number.isSafeInteger(saved) && saved > 0 ? saved : null);
    }).finally(() => setFetchingLearners(false));
  }, [user?.schoolId]);

  if (isLoading || !trialStatus) return <div className="h-14 animate-pulse rounded-2xl border bg-gray-50" />;
  const selectedPlan = SUBSCRIPTION_PLANS.find((plan) => plan.id === selectedPlanId) || SUBSCRIPTION_PLANS[0];
  const selectedPrice = selectedPlan.period === 'annual' ? ANNUAL_PRICE_PER_LEARNER : PRICE_PER_LEARNER;
  const chargeLearnersCount = billingLearnerCount ?? learnersCount;
  const selectedAmount = selectedPrice * chargeLearnersCount;
  const billing = <div className="rounded-xl border border-blue-100 bg-white p-4 text-sm"><div className="flex justify-between gap-3"><span>Learners billed</span><strong>{fetchingLearners ? 'Loading…' : chargeLearnersCount.toLocaleString()}</strong></div><p className="mt-1 text-xs text-gray-500">Uses the saved billing count, or the current active learner total.</p></div>;
  const plans = <div className="grid gap-3 sm:grid-cols-2">{SUBSCRIPTION_PLANS.map((plan) => {
    const price = plan.period === 'annual' ? ANNUAL_PRICE_PER_LEARNER : PRICE_PER_LEARNER;
    return <button type="button" key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className={`rounded-xl border-2 p-4 text-left ${selectedPlan.id === plan.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}><span className="block font-bold">{plan.name}</span><span className="mt-1 block text-sm font-semibold text-blue-700">KES {price} per learner per {plan.period === 'annual' ? 'year' : 'term'}</span><span className="mt-2 block text-xs leading-5 text-gray-600">{plan.featureSummary}</span><span className="mt-2 block text-xs font-bold">Total: KES {(price * chargeLearnersCount).toLocaleString()}</span></button>;
  })}</div>;
  const sms = <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-gray-700"><strong>{SMS_NON_SUBSCRIBER_PLAN.name}:</strong> KES {SMS_NON_SUBSCRIBER_PLAN.price} per SMS. Purchase credits from the SMS Wallet.</p>;
  const payment = showPayment ? <div className="space-y-3 rounded-xl border bg-white p-4">{plans}{sms}<PaystackButton learnersCount={chargeLearnersCount} feePerLearner={selectedPrice} subscriptionPlan={selectedPlan.id} billingPeriod={selectedPlan.period} onSuccess={() => { setShowPayment(false); setExpanded(false); }} onClose={() => setShowPayment(false)} /><button onClick={() => setShowPayment(false)} className="w-full text-xs text-gray-500">Cancel</button></div> : null;

  if (trialStatus.isPaid) return <div className="space-y-3">{billing}<div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4"><CheckCircle className="h-5 w-5 text-green-600" /><div><p className="text-sm font-semibold text-green-800">Full-access subscription active</p><p className="text-xs text-green-700">All school features are included. Examination generation is KES 20 per paper.</p></div></div></div>;
  if (trialStatus.isExpired) return <div className="space-y-4">{billing}<div className="flex gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4"><AlertTriangle className="h-6 w-6 text-red-600" /><div><h3 className="font-bold text-red-800">Trial period expired</h3><p className="text-sm text-red-700">Choose term or annual full access to continue.</p></div></div>{payment || <div className="space-y-4 rounded-2xl border bg-white p-6">{plans}{sms}<button onClick={() => setShowPayment(true)} disabled={fetchingLearners || chargeLearnersCount <= 0} className="mx-auto flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"><CreditCard className="h-4 w-4" />Subscribe — KES {selectedAmount.toLocaleString()}</button></div>}</div>;

  const urgent = trialStatus.daysRemaining <= 7;
  return <div className="space-y-3">{billing}<div className={`rounded-2xl border p-4 ${urgent ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}><div className="flex items-center gap-3"><Clock className="h-5 w-5" /><div className="flex-1"><div className="flex justify-between gap-2"><p className="text-sm font-semibold">Free Trial: {trialStatus.daysRemaining} days remaining</p><button onClick={() => setExpanded(!expanded)} className="text-xs underline">{expanded ? 'Hide' : 'Details'}</button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className={`h-full ${urgent ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${trialStatus.progressPercent}%` }} /></div>{expanded && <div className="mt-3 border-t pt-3 text-xs">{payment || <><p>Two full-access options: KES 10 per learner per term, or KES 20 per learner annually.</p><p className="mt-1">Examination generation is separate at KES 20 per paper, including its marking scheme.</p><button onClick={() => setShowPayment(true)} className="mt-2 font-semibold underline">View subscription plans</button></>}</div>}</div></div></div></div>;
};
export default TrialCountdown;
