import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrial } from '@/contexts/TrialContext';
import { Loader2, Lock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface PaystackButtonProps {
  learnersCount: number;
  onSuccess: () => void;
  onClose: () => void;
}

// Paystack public key for the school management system
// This is a live key - the payment goes to the client's Paystack account
const PAYSTACK_PUBLIC_KEY = 'pk_live_c15b4c6c95f06f7408326b14395eb727147a8935';

export const PaystackButton: React.FC<PaystackButtonProps> = ({
  learnersCount,
  onSuccess,
  onClose,
}) => {
  const { user } = useAuth();
  const { handlePaymentSuccess } = useTrial();
  const [processing, setProcessing] = useState(false);

  const amount = learnersCount * 30 * 100; // Ksh 30 per learner, converted to kobo (cents)
  const amountKsh = learnersCount * 30;

  // Load Paystack script dynamically
  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if script already exists
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

  const handlePayment = async () => {
    try {
      setProcessing(true);
      await loadPaystackScript();

      // Get the user's email
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
              display_name: 'Period',
              variable_name: 'period',
              value: 'One Term',
            },
          ],
        },
        callback: (response: any) => {
          // Payment successful
          handlePaymentSuccess(learnersCount, response.reference);
          toast.success(
            `Payment successful! Ksh ${amountKsh} paid for ${learnersCount} learners.`,
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
        <div className="text-2xl font-bold text-gray-900">
          Ksh {amountKsh.toLocaleString()}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          for {learnersCount} learner{learnersCount !== 1 ? 's' : ''} per term
        </p>
        <div className="mt-2 text-xs text-gray-500">
          Ksh 30 x {learnersCount} learners = Ksh {amountKsh}
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={processing}
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
            Pay Ksh {amountKsh.toLocaleString()} with Paystack
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-1 mt-3">
        <Lock className="w-3 h-3 text-gray-400" />
        <span className="text-xs text-gray-400">
          SSL encrypted payment. Your data is secure.
        </span>
      </div>
    </div>
  );
};

export default PaystackButton;
