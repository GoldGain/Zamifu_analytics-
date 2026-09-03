import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrial } from '@/contexts/TrialContext';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Lock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { ANNUAL_PRICE_PER_LEARNER, PRICE_PER_LEARNER } from '@/lib/trial';

interface PaystackButtonProps {
  learnersCount: number;
  onSuccess: () => void;
  onClose: () => void;
  feePerLearner?: number;
  billingPeriod?: 'term' | 'annual' | 'school-term';
  subscriptionPlan?: string;
  fixedAmountKsh?: number;
}

const PAYSTACK_PUBLIC_KEY = 'pk_live_c15b4c6c95f06f7408326b14395eb727147a8935';

export const PaystackButton: React.FC<PaystackButtonProps> = ({
  learnersCount,
  onSuccess,
  onClose,
  feePerLearner,
  billingPeriod = 'term',
  subscriptionPlan = 'full_access_20',
  fixedAmountKsh,
}) => {
  const { user } = useAuth();
  const { pricePerLearner, annualPricePerLearner, refreshTrialStatus } = useTrial();
  const [processing, setProcessing] = useState(false);
  const annualFee = annualPricePerLearner > 0 ? annualPricePerLearner : ANNUAL_PRICE_PER_LEARNER;
  const [resolvedFee, setResolvedFee] = useState(
    billingPeriod === 'annual' ? annualFee : (feePerLearner || pricePerLearner || PRICE_PER_LEARNER),
  );

  const isFixedSchoolPlan = billingPeriod === 'school-term' && Number.isFinite(Number(fixedAmountKsh));
  const amountKsh = isFixedSchoolPlan ? Math.max(0, Number(fixedAmountKsh)) : learnersCount * resolvedFee;

  useEffect(() => {
    if (billingPeriod === 'annual') {
      setResolvedFee(annualFee);
      return;
    }
    if (feePerLearner && feePerLearner > 0) {
      setResolvedFee(feePerLearner);
      return;
    }
    if (pricePerLearner && pricePerLearner > 0) setResolvedFee(pricePerLearner);
  }, [billingPeriod, feePerLearner, pricePerLearner, annualFee]);

  useEffect(() => {
    const load = async () => {
      if (billingPeriod === 'annual' || (feePerLearner && feePerLearner > 0)) return;
      if (!user?.schoolId) return;
      const { data } = await (supabase as any)
        .from('schools')
        .select('fee_per_learner_per_term, fee_per_learner_per_year')
        .eq('id', user.schoolId)
        .maybeSingle();
      const fee = Number(data?.fee_per_learner_per_term);
      if (fee > 0) setResolvedFee(fee);
    };
    void load();
  }, [user?.schoolId, feePerLearner, billingPeriod]);

  const amount = amountKsh * 100;

  const loadPaystackScript = (): Promise<void> => new Promise((resolve, reject) => {
    const existing = document.getElementById('paystack-script');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.body.appendChild(script);
  });

  const verifyPaymentOnServer = async (reference: string) => {
    const { data, error } = await supabase.functions.invoke('verify-paystack-subscription', {
      body: { reference },
    });
    if (error) {
      let message = error.message || 'Server verification failed';
      try {
        const responseBody = await (error as any).context?.json?.();
        if (responseBody?.error) message = responseBody.error;
      } catch {
        // Keep the safe generic message when the response body is unavailable.
      }
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error || 'Payment could not be verified');
    await refreshTrialStatus();
    return data;
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);
      await loadPaystackScript();
      const email = user?.email || 'school@example.com';
      const reference = `zamifu_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      let callbackStarted = false;

      // @ts-ignore — Paystack is loaded via the inline script.
      const handler = window.PaystackPop?.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount,
        currency: 'KES',
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: 'School', variable_name: 'school_id', value: user?.schoolId || 'unknown' },
            { display_name: 'Learners', variable_name: 'learners_count', value: String(learnersCount) },
            { display_name: 'Fee per learner', variable_name: 'fee_per_learner', value: isFixedSchoolPlan ? 'N/A' : String(resolvedFee) },
            { display_name: 'Subscription plan', variable_name: 'subscription_plan', value: subscriptionPlan },
            { display_name: 'Period', variable_name: 'period', value: billingPeriod === 'annual' ? 'Annual' : 'One Term' },
          ],
        },
        // Paystack requires a synchronous callback function.
        callback: (response: any) => {
          callbackStarted = true;
          const ref = response?.reference || reference;
          void verifyPaymentOnServer(ref)
            .then((result) => {
              setProcessing(false);
              toast.success(
                `Payment verified. KES ${Number(result.amountKsh || amountKsh).toLocaleString()} subscription activated.`,
                { duration: 5000 },
              );
              onSuccess();
            })
            .catch((error: any) => {
              setProcessing(false);
              toast.error(error?.message || 'Payment verification failed. Keep your reference and contact support before paying again.', { duration: 7000 });
            });
        },
        onClose: () => {
          if (callbackStarted) return;
          setProcessing(false);
          toast.info('Payment cancelled. You can try again anytime.');
          onClose();
        },
      });

      if (handler) {
        handler.openIframe();
      } else {
        throw new Error('Paystack handler could not be initialized');
      }
    } catch (error: any) {
      setProcessing(false);
      toast.error('Payment failed: ' + error.message);
      onClose();
    }
  };

  return (
    <div className="text-center">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">Secure Payment</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">KES {amountKsh.toLocaleString()}</div>
        <p className="text-sm text-gray-600 mt-1">
          for {learnersCount} learner{learnersCount !== 1 ? 's' : ''}           {isFixedSchoolPlan ? 'per school per term' : billingPeriod === 'annual' ? 'per year' : 'per term'}

        </p>
        <div className="mt-2 text-xs text-gray-500">
          {isFixedSchoolPlan ? 'School term plan' : `KES ${resolvedFee.toLocaleString()} × ${learnersCount} learners`} = KES {amountKsh.toLocaleString()}
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={processing || learnersCount <= 0}
        className="w-full bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
        ) : (
          <><CreditCard className="w-4 h-4" /> Pay KES {amountKsh.toLocaleString()} {billingPeriod === 'annual' ? 'annually' : 'for one term'} with Paystack</>
        )}
      </button>

      <div className="flex items-center justify-center gap-1 mt-3">
        <Lock className="w-3 h-3 text-gray-400" />
        <span className="text-xs text-gray-400">SSL encrypted payment. Payment access activates only after server verification.</span>
      </div>
    </div>
  );
};

export default PaystackButton;
