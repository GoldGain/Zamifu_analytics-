import { supabaseUntyped } from '@/lib/supabase/client';

export const DEFAULT_FEE_PER_LEARNER = 20;
export const DEFAULT_ANNUAL_FEE_PER_LEARNER = 50;
export const DEFAULT_CURRENCY = 'KES';

export interface ResellerRecord {
  id: string;
  name: string;
  email?: string | null;
  status?: string | null;
  parent_pay_enabled?: boolean | null;
  default_fee_per_learner?: number | null;
  default_fee_per_learner_per_year?: number | null;
  paystack_public_key?: string | null;
}

export async function getResellerForUser(userId: string): Promise<ResellerRecord | null> {
  const { data, error } = await supabaseUntyped
    .from('resellers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[reseller] getResellerForUser', error);
    return null;
  }
  return data as ResellerRecord | null;
}

export function currencyCode(value: string | null | undefined): string {
  const normalized = String(value || DEFAULT_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3,10}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
}

export function money(n: number | null | undefined, currency: string | null | undefined = DEFAULT_CURRENCY): string {
  const amount = Number(n || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const label = currencyCode(currency) === 'KES' ? 'KSh' : currencyCode(currency);
  return `${label} ${safeAmount.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

export function feeOrDefault(value: number | null | undefined, fallback = DEFAULT_FEE_PER_LEARNER): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}
