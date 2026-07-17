import { supabase } from '@/lib/supabase/client';

export const DEFAULT_FEE_PER_LEARNER = 50;

export interface ResellerRecord {
  id: string;
  name: string;
  email?: string | null;
  status?: string | null;
  parent_pay_enabled?: boolean | null;
  default_fee_per_learner?: number | null;
  paystack_public_key?: string | null;
}

export async function getResellerForUser(userId: string): Promise<ResellerRecord | null> {
  const { data, error } = await (supabase as any)
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

export function money(n: number | null | undefined): string {
  return `KES ${Number(n || 0).toLocaleString()}`;
}

export function feeOrDefault(value: number | null | undefined, fallback = DEFAULT_FEE_PER_LEARNER): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}
