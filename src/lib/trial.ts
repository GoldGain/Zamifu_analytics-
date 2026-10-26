// Server-authoritative trial and subscription calculations. Legacy plan IDs
// remain in the type only so historic receipts can still be rendered.
import { DEFAULT_ANNUAL_FEE_PER_LEARNER, DEFAULT_FEE_PER_LEARNER } from './reseller';

export const TRIAL_DAYS = 60;
export const PRICE_PER_LEARNER = DEFAULT_FEE_PER_LEARNER;
export const ANNUAL_PRICE_PER_LEARNER = DEFAULT_ANNUAL_FEE_PER_LEARNER;
export type SubscriptionPlanId = 'full_access_20' | 'full_access_50' | 'exam_analysis_junior' | 'exam_analysis_primary' | 'timetabler_only' | 'generator_only' | 'sms_non_subscriber';
export interface SubscriptionPlanOption { id: SubscriptionPlanId; name: string; price: number; unit: 'learner' | 'school' | 'sms'; period: 'term' | 'annual'; featureSummary: string; includesSms: boolean; }

export const SUBSCRIPTION_PLANS: SubscriptionPlanOption[] = [
  { id: 'full_access_20', name: 'Full Access — Term', price: 10, unit: 'learner', period: 'term', featureSummary: 'Every feature for one learner for one term. Examination papers are billed separately at KES 20 per paper.', includesSms: true },
  { id: 'full_access_50', name: 'Full Access — Annual', price: 20, unit: 'learner', period: 'annual', featureSummary: 'Every feature for one learner for one year. Examination papers are billed separately at KES 20 per paper.', includesSms: true },
];
export const SMS_NON_SUBSCRIBER_PLAN: SubscriptionPlanOption = { id: 'sms_non_subscriber', name: 'SMS Credits (All Schools)', price: 1, unit: 'sms', period: 'term', featureSummary: 'Keep purchasing SMS credits from the SMS Wallet.', includesSms: false };
export interface TrialData { trialStartDate: string; trialEndDate: string; hasPaid: boolean; paymentDate?: string; learnersCount: number; paymentReference?: string; paidAmount?: number; }
export interface ServerBillingRecord { id: string; subscription_plan?: string | null; subscription_status?: string | null; subscription_expires_at?: string | null; trial_started_at?: string | null; trial_expires_at?: string | null; reseller_unlock_at?: string | null; reseller_unlock_subscription_status?: string | null; reseller_unlock_subscription_expires_at?: string | null; reseller_unlock_trial_expires_at?: string | null; created_at?: string | null; }
export interface TrialStatus { isActive: boolean; daysRemaining: number; isExpired: boolean; isPaid: boolean; trialData: TrialData; progressPercent: number; subscriptionStatus: string; subscriptionExpiresAt: string | null; }
const DAY_MS = 86400000;
export const calculatePaymentAmount = (learnersCount: number, feePerLearner: number = PRICE_PER_LEARNER): number => Math.max(0, learnersCount) * (feePerLearner > 0 ? feePerLearner : PRICE_PER_LEARNER);

export const buildTrialStatus = (school: ServerBillingRecord): TrialStatus => {
  const now = Date.now();
  const trialStart = school.trial_started_at || school.created_at || new Date(now).toISOString();
  const trialEnd = school.trial_expires_at || school.subscription_expires_at || new Date(new Date(trialStart).getTime() + TRIAL_DAYS * DAY_MS).toISOString();
  const subscriptionStatus = String(school.subscription_status || 'trial').toLowerCase();
  const subscriptionEndMs = school.subscription_expires_at ? new Date(school.subscription_expires_at).getTime() : NaN;
  const isPaid = subscriptionStatus === 'active' && Number.isFinite(subscriptionEndMs) && subscriptionEndMs > now;
  const trialEndMs = new Date(trialEnd).getTime();
  const trialStartMs = new Date(trialStart).getTime();
  const resellerUnlockAtMs = school.reseller_unlock_at ? new Date(school.reseller_unlock_at).getTime() : NaN;
  const resellerUnlockIsCurrent = Number.isFinite(resellerUnlockAtMs) && resellerUnlockAtMs <= now && String(school.reseller_unlock_subscription_status || '').toLowerCase() === subscriptionStatus && (school.reseller_unlock_subscription_expires_at || null) === (school.subscription_expires_at || null) && (school.reseller_unlock_trial_expires_at || null) === (school.trial_expires_at || null) && resellerUnlockAtMs > Math.min(Number.isFinite(subscriptionEndMs) ? subscriptionEndMs : Infinity, Number.isFinite(trialEndMs) ? trialEndMs : Infinity);
  const effectiveEndMs = isPaid ? subscriptionEndMs : trialEndMs;
  const daysRemaining = isPaid ? 0 : Math.max(0, Math.ceil((effectiveEndMs - now) / DAY_MS));
  const totalMs = Math.max(1, trialEndMs - trialStartMs);
  const progressPercent = isPaid ? 100 : Math.min(100, Math.max(0, ((now - trialStartMs) / totalMs) * 100));
  return { isActive: isPaid || daysRemaining > 0 || resellerUnlockIsCurrent, daysRemaining, isExpired: !isPaid && daysRemaining <= 0 && !resellerUnlockIsCurrent, isPaid, trialData: { trialStartDate: trialStart, trialEndDate: trialEnd, hasPaid: isPaid, learnersCount: 0, paymentDate: isPaid ? school.subscription_expires_at || undefined : undefined }, progressPercent, subscriptionStatus, subscriptionExpiresAt: school.subscription_expires_at || null };
};
