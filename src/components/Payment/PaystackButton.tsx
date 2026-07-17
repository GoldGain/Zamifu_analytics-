import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrial } from '@/contexts/TrialContext';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Lock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { PRICE_PER_LEARNER } from '@/lib/trial';

interface PaystackButtonProps {
  learnersCount: number;
  onSuccess: () => void;
  onClose: () => void;
  feePerLearner?: number;
}

const PAYSTACK_PUBLIC_KEY = 'pk_live_c15b4c6c95f06f7408326b14395eb727147a8935';

export const PaystackButton: React.FC<PaystackButtonProps> = ({
  learnersCount,
  onSuccess,
  onClose,
  feePerLearner,
}) => {
  const { user } = useAuth();
  const { handlePaymentSuccess, pricePerLearner } = useTrial();
  const [processing, setProcessing] = useState(false);
  const [resolvedFee, setResolvedFee] = useState(feePerLearner || pricePerLearner || PRICE_PER_LEARNER);

  useEffect(() => {
    if (feePerLearner && feePerLearner > 0) {
      setResolvedFee(feePerLearner);
      return;
    }
    if (pricePerLearner && pricePerLearner > 0) {
      setResolvedFee(pricePerLearner);
    }
  }, [feePerLearner, pricePerLearner]);

  useEffect(() => {
    const load = async () => {
      if (feePerLearner && feePerLearner > 0) return;
      if (!user?.schoolId) return;
      const { data } = await (supabase as any)
        .from('schools')
        .select('fee_per_learner_per_term')
        .eq('id', user.schoolId)
        .maybeSingle();
      const fee = Number(data?.fee_per_learner_per_term);
      if (fee > 0) setResolvedFee(fee);
    };
    load();
  }, [user?.schoolId, feePerLearner]);

  const amountKsh = learnersCount * resolvedFee;
  const amount = amountKsh * 100; // kobo for Paystack

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
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
  };

  const recordSubscriptionPayment = async (reference: string) => {
    if (!user?.schoolId) return;
    try {
      const { data: school } = await (supabase as any)
        .from('schools')
        .select('id, name, reseller_id')
        .eq('id', user.schoolId)
        .maybeSingle();
      let resellerName: string | null = null;
      if (school?.reseller_id) {
        const { data: reseller } = await (supabase as any)
          .from('resellers')
          .select('name')
          .eq('id', school.reseller_id)
          .maybeSingle();
        resellerName = reseller?.name || null;
      }
      await (supabase as any).from('school_subscription_payments').insert({
        school_id: user.schoolId,
        reseller_id: school?.reseller_id || null,
        school_name: school?.name || null,
        reseller_name: resellerName,
        learners_count: learnersCount,
        fee_per_learner: resolvedFee,
        amount: amountKsh,
        currency: 'KES',
        term_label: 'One Term',
        payment_reference: reference,
        payment_method: 'paystack',
        status: 'success',
        paid_by_email: user.email || null,
        paid_by_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      });
    } catch (err) {
      console.error('[payment] failed to record subscription payment', err);
    }
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);
      await loadPaystackScript();
      const email = user?.email || 'school@example.com';
      const reference = `zamifu_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // @ts-ignore — Paystack is loaded via script
      const handler = window.PaystackPop?.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount,
        currency: 'KES',
        ref: reference,
        metadata: {
          custom_fields: [
            {
              display_name: 'School',
              variable_name: 'school_id',
              value: user?.schoolId || 'unknown',
            },
            {
              display_name: 'Learners',
              variable_name: 'learners_count',
              value: String(learnersCount),
            },
            {
              display_name: 'Fee per learner',
              variable_name: 'fee_per_learner',
              value: String(resolvedFee),
            },
            {
              display_name: 'Period',
              variable_name: 'period',
              value: 'One Term',
            },
          ],
        },
        callback: async (response: any) => {
          handlePaymentSuccess(learnersCount, response.reference);
          await recordSubscriptionPayment(response.reference);
          toast.success(
            `Payment successful! KES ${amountKsh.toLocaleString()} paid for ${learnersCount} learners.`,
            { duration: 5000 }
          );
          setProcessing(false);
          onSuccess();
        },
        onClose: () => {
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
          for {learnersCount} learner{learnersCount !== 1 ? 's' : ''} per term
        </p>
        <div className="mt-2 text-xs text-gray-500">
          KES {resolvedFee.toLocaleString()} × {learnersCount} learners = KES {amountKsh.toLocaleString()}
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={processing || learnersCount <= 0}
        className="w-full bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Pay KES {amountKsh.toLocaleString()} with Paystack
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-1 mt-3">
        <Lock className="w-3 h-3 text-gray-400" />
        <span className="text-xs text-gray-400">SSL encrypted payment. Your data is secure.</span>
      </div>
    </div>
  );
};

export default PaystackButton;
