// ============================================================
// FRONTEND TRIAL PERIOD MANAGEMENT
// All trial data stored in localStorage — NO Supabase changes
// ============================================================

export const TRIAL_DAYS = 90;
export const PRICE_PER_LEARNER = 50; // fallback default KES per learner per term

export interface TrialData {
  trialStartDate: string;
  trialEndDate: string;
  hasPaid: boolean;
  paymentDate?: string;
  learnersCount: number;
  paymentReference?: string;
  paidAmount?: number;
}

export const getTrialStorageKey = (schoolId: string): string => `trial_${schoolId}`;

export const getTrialData = (schoolId: string): TrialData => {
  const key = getTrialStorageKey(schoolId);
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      return JSON.parse(stored) as TrialData;
    } catch {
      // If corrupted, start fresh trial
    }
  }

  // First login — start trial
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + TRIAL_DAYS);

  const trialData: TrialData = {
    trialStartDate: now.toISOString(),
    trialEndDate: end.toISOString(),
    hasPaid: false,
    learnersCount: 0,
  };

  localStorage.setItem(key, JSON.stringify(trialData));
  return trialData;
};

export const updateTrialData = (schoolId: string, updates: Partial<TrialData>): TrialData => {
  const key = getTrialStorageKey(schoolId);
  const current = getTrialData(schoolId);
  const updated = { ...current, ...updates };
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
};

export const markTrialAsPaid = (
  schoolId: string,
  learnersCount: number,
  reference: string,
  feePerLearner: number = PRICE_PER_LEARNER
): TrialData => {
  const fee = feePerLearner > 0 ? feePerLearner : PRICE_PER_LEARNER;
  return updateTrialData(schoolId, {
    hasPaid: true,
    paymentDate: new Date().toISOString(),
    learnersCount,
    paymentReference: reference,
    paidAmount: learnersCount * fee,
  });
};

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  isExpired: boolean;
  isPaid: boolean;
  trialData: TrialData;
  progressPercent: number;
}

export const checkTrialStatus = (schoolId: string): TrialStatus => {
  const trialData = getTrialData(schoolId);
  const now = new Date();
  const end = new Date(trialData.trialEndDate);
  const totalMs = end.getTime() - new Date(trialData.trialStartDate).getTime();
  const elapsedMs = now.getTime() - new Date(trialData.trialStartDate).getTime();
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

  // Paid users always have active access
  if (trialData.hasPaid) {
    return {
      isActive: true,
      daysRemaining: 0,
      isExpired: false,
      isPaid: true,
      trialData,
      progressPercent: 100,
    };
  }

  return {
    isActive: daysRemaining > 0,
    daysRemaining,
    isExpired: daysRemaining <= 0,
    isPaid: false,
    trialData,
    progressPercent,
  };
};

// For testing: simulate trial expiry
export const simulateTrialExpiry = (schoolId: string): void => {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 1);
  const start = new Date(now);
  start.setDate(start.getDate() - 91);

  updateTrialData(schoolId, {
    trialStartDate: start.toISOString(),
    trialEndDate: past.toISOString(),
  });
};

// Reset trial (for admin/testing)
export const resetTrial = (schoolId: string): TrialData => {
  localStorage.removeItem(getTrialStorageKey(schoolId));
  return getTrialData(schoolId);
};

// Calculate payment amount
export const calculatePaymentAmount = (
  learnersCount: number,
  feePerLearner: number = PRICE_PER_LEARNER
): number => {
  const fee = feePerLearner > 0 ? feePerLearner : PRICE_PER_LEARNER;
  return learnersCount * fee;
};
