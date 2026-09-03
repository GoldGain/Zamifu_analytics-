// ============================================================
// SERVER-AUTHORITATIVE TRIAL AND SUBSCRIPTION CALCULATIONS
// Trial data is loaded from Supabase by TrialContext. This module
// intentionally does not read or write browser storage.
// ============================================================

import { DEFAULT_ANNUAL_FEE_PER_LEARNER, DEFAULT_FEE_PER_LEARNER } from './reseller';

export const TRIAL_DAYS = 60;
export const PRICE_PER_LEARNER = DEFAULT_FEE_PER_LEARNER;
export const ANNUAL_PRICE_PER_LEARNER = DEFAULT_ANNUAL_FEE_PER_LEARNER;

export type SubscriptionPlanId = 'full_access_20' | 'full_access_50' | 'results_only' | 'timetabler_only' | 'generator_only';

export interface SubscriptionPlanOption {
  id: SubscriptionPlanId;
  name: string;
  price: number;
  unit: 'learner' | 'school';
  period: 'term' | 'annual';
  featureSummary: string;
  includesSms: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanOption[] = [
  { id: 'full_access_20', name: 'Full Access (Per Learner)', price: 20, unit: 'learner', period: 'term', featureSummary: 'Full access to all features', includesSms: true },
  { id: 'full_access_50', name: 'Full Access (Per Learner)', price: 50, unit: 'learner', period: 'annual', featureSummary: 'Full access to all features', includesSms: true },
  { id: 'results_only', name: 'Results Access Only', price: 1000, unit: 'school', period: 'term', featureSummary: 'Results access only; SMS at KES 1 each', includesSms: false },
  { id: 'timetabler_only', name: 'Timetabler Access Only', price: 500, unit: 'school', period: 'term', featureSummary: 'Timetable generation only', includesSms: false },
  { id: 'generator_only', name: 'Generator Access Only', price: 500, unit: 'school', period: 'term', featureSummary: 'Exam Generator, Scheme of Work, Notes and Lesson Plan', includesSms: false },
];

export interface TrialData {
  trialStartDate: string;
  trialEndDate: string;
  hasPaid: boolean;
  paymentDate?: string;
  learnersCount: number;
  paymentReference?: string;
  paidAmount?: number;
}

export interface ServerBillingRecord {
  id: string;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  created_at?: string | null;
}

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  isExpired: boolean;
  isPaid: boolean;
  trialData: TrialData;
  progressPercent: number;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export const calculatePaymentAmount = (
  learnersCount: number,
  feePerLearner: number = PRICE_PER_LEARNER,
): number => {
  const fee = feePerLearner > 0 ? feePerLearner : PRICE_PER_LEARNER;
  return Math.max(0, learnersCount) * fee;
};

export const buildTrialStatus = (school: ServerBillingRecord): TrialStatus => {
  const now = Date.now();
  const trialStart = school.trial_started_at || school.created_at || new Date(now).toISOString();
  const trialEnd = school.trial_expires_at || school.subscription_expires_at || new Date(new Date(trialStart).getTime() + TRIAL_DAYS * DAY_MS).toISOString();
  const subscriptionStatus = String(school.subscription_status || 'trial').toLowerCase();
  const subscriptionEndMs = school.subscription_expires_at ? new Date(school.subscription_expires_at).getTime() : NaN;
  const isPaid = subscriptionStatus === 'active' && Number.isFinite(subscriptionEndMs) && subscriptionEndMs > now;
  const trialEndMs = new Date(trialEnd).getTime();
  const trialStartMs = new Date(trialStart).getTime();
  const effectiveEndMs = isPaid ? subscriptionEndMs : trialEndMs;
  const daysRemaining = isPaid
    ? 0
    : Math.max(0, Math.ceil((effectiveEndMs - now) / DAY_MS));
  const totalMs = Math.max(1, trialEndMs - trialStartMs);
  const elapsedMs = Math.max(0, now - trialStartMs);
  const progressPercent = isPaid
    ? 100
    : Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

  return {
    isActive: isPaid || daysRemaining > 0,
    daysRemaining,
    isExpired: !isPaid && daysRemaining <= 0,
    isPaid,
    trialData: {
      trialStartDate: trialStart,
      trialEndDate: trialEnd,
      hasPaid: isPaid,
      learnersCount: 0,
      paymentDate: isPaid ? school.subscription_expires_at || undefined : undefined,
    },
    progressPercent,
    subscriptionStatus,
    subscriptionExpiresAt: school.subscription_expires_at || null,
  };
};
