import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase/client';
import {
  checkTrialStatus,
  updateTrialData,
  markTrialAsPaid,
  calculatePaymentAmount,
  getTrialData,
  resetTrial,
  simulateTrialExpiry,
  type TrialStatus,
  type TrialData,
  TRIAL_DAYS,
  PRICE_PER_LEARNER,
} from '@/lib/trial';

interface TrialContextType {
  trialStatus: TrialStatus | null;
  isLoading: boolean;
  refreshTrialStatus: () => void;
  updateLearnersCount: (count: number) => void;
  handlePaymentSuccess: (learnersCount: number, reference: string) => void;
  paymentAmount: number;
  resetTrialPeriod: () => void;
  simulateExpiry: () => void;
  trialDays: number;
  pricePerLearner: number;
}

const TrialContext = createContext<TrialContextType>({
  trialStatus: null,
  isLoading: true,
  refreshTrialStatus: () => {},
  updateLearnersCount: () => {},
  handlePaymentSuccess: () => {},
  paymentAmount: 0,
  resetTrialPeriod: () => {},
  simulateExpiry: () => {},
  trialDays: TRIAL_DAYS,
  pricePerLearner: PRICE_PER_LEARNER,
});

export function TrialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pricePerLearner, setPricePerLearner] = useState(PRICE_PER_LEARNER);

  const schoolId = user?.schoolId || '';

  const refreshTrialStatus = useCallback(() => {
    if (!schoolId) {
      setTrialStatus(null);
      setIsLoading(false);
      return;
    }
    const status = checkTrialStatus(schoolId);
    setTrialStatus(status);
    setIsLoading(false);
  }, [schoolId]);

  useEffect(() => {
    refreshTrialStatus();
  }, [refreshTrialStatus]);

  useEffect(() => {
    const loadFee = async () => {
      if (!schoolId) {
        setPricePerLearner(PRICE_PER_LEARNER);
        return;
      }
      try {
        const { data } = await (supabase as any)
          .from('schools')
          .select('fee_per_learner_per_term')
          .eq('id', schoolId)
          .maybeSingle();
        const fee = Number(data?.fee_per_learner_per_term);
        setPricePerLearner(fee > 0 ? fee : PRICE_PER_LEARNER);
      } catch {
        setPricePerLearner(PRICE_PER_LEARNER);
      }
    };
    loadFee();
  }, [schoolId]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!schoolId) return;
    const interval = setInterval(() => {
      refreshTrialStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [schoolId, refreshTrialStatus]);

  const updateLearnersCount = useCallback((count: number) => {
    if (!schoolId) return;
    updateTrialData(schoolId, { learnersCount: count });
    refreshTrialStatus();
  }, [schoolId, refreshTrialStatus]);

  const handlePaymentSuccess = useCallback((learnersCount: number, reference: string) => {
    if (!schoolId) return;
    markTrialAsPaid(schoolId, learnersCount, reference, pricePerLearner);
    refreshTrialStatus();
  }, [schoolId, refreshTrialStatus, pricePerLearner]);

  const paymentAmount = trialStatus
    ? calculatePaymentAmount(trialStatus.trialData.learnersCount, pricePerLearner)
    : 0;

  const resetTrialPeriod = useCallback(() => {
    if (!schoolId) return;
    resetTrial(schoolId);
    refreshTrialStatus();
  }, [schoolId, refreshTrialStatus]);

  const simulateExpiry = useCallback(() => {
    if (!schoolId) return;
    simulateTrialExpiry(schoolId);
    refreshTrialStatus();
  }, [schoolId, refreshTrialStatus]);

  return (
    <TrialContext.Provider
      value={{
        trialStatus,
        isLoading,
        refreshTrialStatus,
        updateLearnersCount,
        handlePaymentSuccess,
        paymentAmount,
        resetTrialPeriod,
        simulateExpiry,
        trialDays: TRIAL_DAYS,
        pricePerLearner,
      }}
    >
      {children}
    </TrialContext.Provider>
  );
}

export function useTrial() {
  return useContext(TrialContext);
}
