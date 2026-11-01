import { createClient } from '@supabase/supabase-js';

type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void; setHeader: (name: string, value: string) => void; end: () => void };
const error = (response: ResponseLike, status: number, message: string) => response.status(status).json({ error: message });
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
  if (!url || !serviceKey) { error(response, 503, 'Secure wallet top-up verification is not configured.'); return; }
  const rawAuthorization = request.headers.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) { error(response, 401, 'Sign in to verify your wallet top-up.'); return; }
  const body = bodyOf(request.body);
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
  const requestedAmount = Number(body?.amountKes);
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) { error(response, 400, 'A valid Paystack reference is required.'); return; }
  if (!Number.isInteger(requestedAmount) || requestedAmount < 20 || requestedAmount > 100000) {
    error(response, 400, 'Choose a top-up between KES 20 and KES 100,000.'); return;
  }

  if (!paystackKey) {
    const rawRelayAuthorization = request.headers.authorization;
    const relayAuthorization = Array.isArray(rawRelayAuthorization) ? rawRelayAuthorization[0] : rawRelayAuthorization;
    try {
      const relay = await fetch('https://zamifulearn.company/api/analytics/exam-wallet-topup', {
        method: 'POST',
        headers: { Authorization: relayAuthorization || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, amountKes: requestedAmount }),
        signal: AbortSignal.timeout(30000),
      });
      const payload = await relay.json() as unknown;
      response.status(relay.status).json(payload);
    } catch {
      error(response, 503, 'Secure wallet verification is temporarily unavailable. Please retry.');
    }
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) { error(response, 401, 'Your session could not be verified. Please sign in again.'); return; }
  const { data: profile } = await supabase.from('profiles').select('id,school_id,role').eq('id', user.id).maybeSingle();
  if (!profile?.school_id || !['teacher', 'school_admin'].includes(profile.role)) {
    error(response, 403, 'Only school teachers and administrators can top up an examination wallet.'); return;
  }

  const { data: existing, error: existingError } = await supabase.from('exam_wallet_topups').select('user_id,school_id,amount_kes').eq('paystack_reference', reference).maybeSingle();
  if (existingError) { error(response, 503, 'The top-up record could not be checked. Please retry verification.'); return; }
  if (existing) {
    if (existing.user_id !== user.id || existing.school_id !== profile.school_id || Number(existing.amount_kes) !== requestedAmount) {
      error(response, 403, 'This payment reference belongs to another wallet top-up.'); return;
    }
    const { data: wallet } = await supabase.from('exam_wallets').select('balance_kes').eq('school_id', profile.school_id).eq('user_id', user.id).maybeSingle();
    response.status(200).json({ verified: true, reference, alreadyProcessed: true, wallet: { balanceKes: Number(wallet?.balance_kes || 0) } });
    return;
  }

  type PaystackVerification = {
    id?: number | string; status?: string; reference?: string; currency?: string; amount?: number;
    metadata?: { purpose?: unknown; school_id?: unknown; purchased_by?: unknown };
  };
  let verification: PaystackVerification | undefined;
  try {
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackKey}` }, signal: AbortSignal.timeout(20000),
    });
    const payload = await paystackResponse.json() as { status?: boolean; message?: string; data?: PaystackVerification };
    if (!paystackResponse.ok || payload?.status !== true) throw new Error(payload?.message || 'Paystack could not verify this transaction.');
    verification = payload.data;
  } catch (caught) {
    error(response, 502, caught instanceof Error ? caught.message : 'Paystack verification failed. Please retry.'); return;
  }
  const metadata = verification?.metadata || {};
  const verifiedAmountKes = Number(verification?.amount) / 100;
  if (verification?.status !== 'success' || verification?.reference !== reference || verification?.currency !== 'KES'
      || !Number.isInteger(verifiedAmountKes) || verifiedAmountKes !== requestedAmount
      || verifiedAmountKes < 20 || verifiedAmountKes > 100000
      || metadata?.purpose !== 'exam_wallet_topup' || metadata?.school_id !== profile.school_id || metadata?.purchased_by !== user.id) {
    error(response, 402, 'This transaction does not match the requested wallet top-up for your account and school.'); return;
  }

  const { data: credited, error: creditError } = await supabase.rpc('credit_verified_exam_wallet_topup', {
    p_reference: reference,
    p_transaction_id: verification?.id === undefined ? null : String(verification.id),
    p_user_id: user.id,
    p_school_id: profile.school_id,
    p_amount_kes: verifiedAmountKes,
  });
  if (creditError || !credited || credited.status !== 'verified') {
    error(response, 503, 'Payment was verified but the wallet could not be credited. Retry verification or contact support with your Paystack reference.'); return;
  }
  response.status(200).json({
    verified: true,
    reference,
    alreadyProcessed: Boolean(credited.already_processed),
    wallet: { balanceKes: Number(credited.balance || 0) },
  });
}
