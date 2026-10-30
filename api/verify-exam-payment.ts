import { createClient } from '@supabase/supabase-js';

type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void; setHeader: (name: string, value: string) => void; end: () => void };
const error = (response: ResponseLike, status: number, message: string) => response.status(status).json({ error: message });
const bearer = (headers: RequestLike['headers']) => {
  const raw = headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : null;
};
const bodyOf = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
};

export default async function handler(request: RequestLike, response: ResponseLike): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.setHeader('Allow', 'POST, OPTIONS'); response.status(204).end(); return; }
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST, OPTIONS'); error(response, 405, 'Method not allowed.'); return; }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!url || !serviceKey || !paystackKey) { error(response, 503, 'Secure examination payment verification is not configured.'); return; }
  const token = bearer(request.headers);
  if (!token) { error(response, 401, 'Sign in to verify examination payment.'); return; }
  const body = bodyOf(request.body);
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) { error(response, 400, 'A valid Paystack reference is required.'); return; }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) { error(response, 401, 'Your session could not be verified. Please sign in again.'); return; }
  const { data: profile } = await supabase.from('profiles').select('id,school_id,role').eq('id', user.id).maybeSingle();
  if (!profile?.school_id || !['teacher', 'school_admin'].includes(profile.role)) { error(response, 403, 'Only school teachers and administrators can purchase examination papers.'); return; }

  const { data: existing, error: existingError } = await supabase.from('exam_paper_payments').select('status,purchased_by,school_id').eq('paystack_reference', reference).maybeSingle();
  if (existingError) { error(response, 503, 'The payment record could not be checked. Please retry verification.'); return; }
  if (existing) {
    if (existing.purchased_by !== user.id || existing.school_id !== profile.school_id) { error(response, 403, 'This payment reference belongs to another account.'); return; }
    response.status(200).json({ verified: true, reference, status: existing.status });
    return;
  }

  type PaystackVerification = {
    status?: string; reference?: string; currency?: string; amount?: number;
    metadata?: { purpose?: unknown; school_id?: unknown; purchased_by?: unknown };
  };
  let verification: PaystackVerification | undefined;
  try {
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${paystackKey}` }, signal: AbortSignal.timeout(20000) });
    const payload = await paystackResponse.json() as { status?: boolean; message?: string; data?: PaystackVerification };
    if (!paystackResponse.ok || payload?.status !== true) throw new Error(payload?.message || 'Paystack could not verify this transaction.');
    verification = payload.data;
  } catch (caught) {
    error(response, 502, caught instanceof Error ? caught.message : 'Paystack verification failed. Please retry.'); return;
  }
  const metadata = verification?.metadata || {};
  if (verification?.status !== 'success' || verification?.reference !== reference || verification?.currency !== 'KES' || Number(verification?.amount) !== 2000
      || metadata?.purpose !== 'exam_paper' || metadata?.school_id !== profile.school_id || metadata?.purchased_by !== user.id) {
    error(response, 402, 'This transaction does not match one KES 20 examination paper for your account and school.'); return;
  }
  const { error: insertError } = await supabase.from('exam_paper_payments').insert({ school_id: profile.school_id, purchased_by: user.id, paystack_reference: reference, amount_kes: 20, currency: 'KES', status: 'available', verified_at: new Date().toISOString() });
  if (insertError) {
    if (insertError.code === '23505') { error(response, 409, 'This payment was verified concurrently. Refresh and retry generation.'); return; }
    error(response, 503, 'Payment was verified but could not be recorded. Please contact support with your Paystack reference.'); return;
  }
  response.status(200).json({ verified: true, reference, status: 'available' });
}
