import { useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PaystackConfig {
  publicKey: string;
  amount: number; // in kobo (multiply KES by 100)
  email: string;
  metadata?: Record<string, any>;
  onSuccess: (reference: string) => void;
  onCancel?: () => void;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: any) => { openIframe: () => void };
    };
  }
}

export function usePaystack() {
  const { user } = useAuth();

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paystack'));
      document.head.appendChild(script);
    });
  };

  const initiatePayment = useCallback(async (config: PaystackConfig) => {
    await loadPaystackScript();
    if (!window.PaystackPop) throw new Error('Paystack not loaded');

    const handler = window.PaystackPop.setup({
      key: config.publicKey,
      email: config.email,
      amount: config.amount * 100, // convert to kobo
      currency: 'KES',
      metadata: config.metadata || {},
      // NOTE: Paystack V1 inline.js rejects async arrow functions in callbacks
      // ("Attribute callback must be a valid function") — keep the callback sync;
      // onSuccess handlers must wrap their own async logic
      callback: (response: any) => {
        try { config.onSuccess(response.reference); }
        catch (err) { console.error('[Paystack] onSuccess handler failed', err); }
      },
      onClose: () => {
        config.onCancel?.();
      },
    });
    handler.openIframe();
  }, []);

  const recordPayment = useCallback(async (params: {
    studentId: string;
    studentName: string;
    schoolId: string;
    schoolName: string;
    resellerId: string;
    resellerName: string;
    amount: number;
    paymentType: 'view_results' | 'pdf_report';
    paystackReference: string;
  }) => {
    const { error } = await supabase.from('parent_payments').insert({
      parent_id: user?.id,
      parent_name: user ? `${user.firstName} ${user.lastName}` : 'Parent',
      student_id: params.studentId,
      student_name: params.studentName,
      school_id: params.schoolId,
      school_name: params.schoolName,
      reseller_id: params.resellerId,
      reseller_name: params.resellerName,
      amount: params.amount,
      payment_type: params.paymentType,
      status: 'success',
      paystack_reference: params.paystackReference,
    });
    return error;
  }, [user]);

  return { initiatePayment, recordPayment };
}
