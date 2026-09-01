import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase/client';
import {
  buildTrialStatus,
  calculatePaymentAmount,
  PRICE_PER_LEARNER,
  ANNUAL_PRICE_PER_LEARNER,
  type ServerBillingRecord,
  type TrialStatus,
} from '@/lib/trial';

interface TrialContextType {
  trialStatus: TrialStatus | null;
  isLoading: boolean;
  billingError: string | null;
  refreshTrialStatus: (silent?: boolean) => Promise<void>;
  pricePerLearner: number;
  annualPricePerLearner: number;
  paymentAmount: number;
  trialDays: number;
}

const TrialContext = createContext<TrialContextType>({
  trialStatus: null,
  isLoading: true,
  billingError: null,
  refreshTrialStatus: async () => {},
  pricePerLearner: PRICE_PER_LEARNER,
  annualPricePerLearner: ANNUAL_PRICE_PER_LEARNER,
  paymentAmount: 0,
  trialDays: 60,
});

export function TrialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [pricePerLearner, setPricePerLearner] = useState(PRICE_PER_LEARNER);
  const [annualPricePerLearner, setAnnualPricePerLearner] = useState(ANNUAL_PRICE_PER_LEARNER);

  const schoolId = user?.schoolId || '';

  const refreshTrialStatus = useCallback(async (silent = false) => {
    if (!schoolId) {
      setTrialStatus(null);
      setBillingError(null);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('schools')
        .select('id, subscription_plan, subscription_status, subscription_expires_at, trial_started_at, trial_expires_at, created_at, fee_per_learner_per_term, fee_per_learner_per_year')
        .eq('id', schoolId)
        .maybeSingle();

      if (error || !data) {
        if (!silent) {
          setTrialStatus(null);
          setBillingError('The school subscription could not be verified. Please reconnect and try again.');
        } else {
          console.warn('[billing] background verification failed; keeping the last confirmed status', error);
        }
        return;
      }

      const record = data as ServerBillingRecord;
      setTrialStatus(buildTrialStatus(record));
      const fee = Number(data.fee_per_learner_per_term);
      const annualFee = Number(data.fee_per_learner_per_year);
      setPricePerLearner(fee > 0 ? fee : PRICE_PER_LEARNER);
      setAnnualPricePerLearner(annualFee > 0 ? annualFee : ANNUAL_PRICE_PER_LEARNER);
      setBillingError(null);
    } catch (error) {
      console.error('[billing] failed to load server subscription status', error);
      if (!silent) {
        setTrialStatus(null);
        setBillingError('The school subscription could not be verified. Please reconnect and try again.');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void refreshTrialStatus();
  }, [refreshTrialStatus]);

  useEffect(() => {
    if (!schoolId) return;
    const interval = window.setInterval(() => {
      // Refresh server billing state without replacing the active dashboard route.
      void refreshTrialStatus(true);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [schoolId, refreshTrialStatus]);

  const paymentAmount = trialStatus
    ? calculatePaymentAmount(trialStatus.trialData.learnersCount, pricePerLearner)
    : 0;

  return (
    <TrialContext.Provider
      value={{
        trialStatus,
        isLoading,
        billingError,
        refreshTrialStatus,
        pricePerLearner,
        annualPricePerLearner,
        paymentAmount,
        trialDays: 60,
      }}
    >
      {children}
    </TrialContext.Provider>
  );
}

export function useTrial() {
  return useContext(TrialContext);
}
