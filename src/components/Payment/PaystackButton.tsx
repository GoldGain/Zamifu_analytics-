import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrial } from '@/contexts/TrialContext';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Lock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { ANNUAL_PRICE_PER_LEARNER, PRICE_PER_LEARNER } from '@/lib/trial';

interface PaystackButtonProps { learnersCount: number; onSuccess: () => void; onClose: () => void; feePerLearner?: number; billingPeriod?: 'term' | 'annual' | 'school-term'; subscriptionPlan?: string; fixedAmountKsh?: number; }
const PAYSTACK_PUBLIC_KEY = 'pk_live_c15b4c6c95f06f7408326b14395eb727147a8935';

export const PaystackButton: React.FC<PaystackButtonProps> = ({ learnersCount, onSuccess, onClose, billingPeriod = 'term', subscriptionPlan = 'full_access_20' }) => {
  const { user } = useAuth();
  const { refreshTrialStatus } = useTrial();
  const [processing, setProcessing] = useState(false);
  const annual = billingPeriod === 'annual';
  const resolvedFee = annual ? ANNUAL_PRICE_PER_LEARNER : PRICE_PER_LEARNER;
  const amountKsh = learnersCount * resolvedFee;
  const loadPaystackScript = (): Promise<void> => new Promise((resolve, reject) => {
    if (document.getElementById('paystack-script')) { resolve(); return; }
    const script = document.createElement('script');
    script.id = 'paystack-script'; script.src = 'https://js.paystack.co/v1/inline.js'; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.body.appendChild(script);
  });
  const verifyPaymentOnServer = async (reference: string) => {
    const { data, error } = await supabase.functions.invoke('verify-paystack-subscription', { body: { reference } });
    if (error) {
      let message = error.message || 'Server verification failed';
      try { const body = await (error as any).context?.json?.(); if (body?.error) message = body.error; } catch { /* safe generic message */ }
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error || 'Payment could not be verified');
    await refreshTrialStatus(); return data;
  };
  const handlePayment = async () => {
    try {
      if (!['full_access_20', 'full_access_50'].includes(subscriptionPlan)) throw new Error('Choose a term or annual full-access subscription.');
      if (!Number.isSafeInteger(learnersCount) || learnersCount <= 0) throw new Error('A positive learner count is required.');
      setProcessing(true); await loadPaystackScript();
      const reference = `zamifu_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      let callbackStarted = false;
      // @ts-ignore Paystack inline script
      const handler = window.PaystackPop?.setup({
        key: PAYSTACK_PUBLIC_KEY, email: user?.email || 'school@example.com', amount: amountKsh * 100, currency: 'KES', ref: reference,
        metadata: { custom_fields: [
          { display_name: 'School', variable_name: 'school_id', value: user?.schoolId || 'unknown' },
          { display_name: 'Learners', variable_name: 'learners_count', value: String(learnersCount) },
          { display_name: 'Billing learner count', variable_name: 'billing_learner_count', value: String(learnersCount) },
          { display_name: 'Fee per learner', variable_name: 'fee_per_learner', value: String(resolvedFee) },
          { display_name: 'Subscription plan', variable_name: 'subscription_plan', value: subscriptionPlan },
          { display_name: 'Period', variable_name: 'period', value: annual ? 'Annual' : 'One Term' },
        ] },
        callback: (response: any) => {
          callbackStarted = true;
          void verifyPaymentOnServer(response?.reference || reference).then((result) => {
            setProcessing(false); toast.success(`Payment verified. KES ${Number(result.amountKsh || amountKsh).toLocaleString()} subscription activated.`); onSuccess();
          }).catch((error: any) => { setProcessing(false); toast.error(error?.message || 'Payment verification failed. Keep your reference and contact support before paying again.'); });
        },
        onClose: () => { if (callbackStarted) return; setProcessing(false); toast.info('Payment cancelled.'); onClose(); },
      });
      if (handler) handler.openIframe(); else throw new Error('Paystack could not be initialized');
    } catch (error: any) { setProcessing(false); toast.error(error.message || 'Payment failed'); onClose(); }
  };
  return <div className="text-center"><div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4"><Lock className="mx-auto h-4 w-4 text-blue-600" /><div className="mt-2 text-2xl font-bold">KES {amountKsh.toLocaleString()}</div><p className="text-sm text-gray-600">KES {resolvedFee} × {learnersCount} learners · {annual ? 'one year' : 'one term'}</p><p className="mt-2 text-xs text-gray-500">Full access to all features. Examination papers are paid separately.</p></div><button onClick={handlePayment} disabled={processing || learnersCount <= 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-medium text-white disabled:opacity-50">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{processing ? 'Processing…' : `Pay KES ${amountKsh.toLocaleString()} with Paystack`}</button><p className="mt-3 text-xs text-gray-400">Access activates only after server verification.</p></div>;
};
export default PaystackButton;
