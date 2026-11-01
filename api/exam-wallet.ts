import { createClient } from '@supabase/supabase-js';

type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined> };
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void; setHeader: (name: string, value: string) => void; end: () => void };
const error = (response: ResponseLike, status: number, message: string) => response.status(status).json({ error: message });

export default async function handler(request: RequestLike, response: ResponseLike): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.setHeader('Allow', 'GET, OPTIONS'); response.status(204).end(); return; }
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET, OPTIONS'); error(response, 405, 'Method not allowed.'); return; }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { error(response, 503, 'The examination wallet is not configured.'); return; }
  const raw = request.headers.authorization;
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) { error(response, 401, 'Sign in to view your examination wallet.'); return; }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) { error(response, 401, 'Your session could not be verified. Please sign in again.'); return; }
  const { data: profile } = await supabase.from('profiles').select('id,school_id,role').eq('id', user.id).maybeSingle();
  if (!profile?.school_id || !['teacher', 'school_admin'].includes(profile.role)) {
    error(response, 403, 'Only school teachers and administrators can use the examination wallet.'); return;
  }
  const [{ data: wallet, error: walletError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabase.from('exam_wallets').select('balance_kes,updated_at').eq('school_id', profile.school_id).eq('user_id', user.id).maybeSingle(),
    supabase.from('exam_wallet_transactions').select('id,kind,amount_kes,balance_after_kes,generation_job_id,paper_id,created_at').eq('school_id', profile.school_id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
  ]);
  if (walletError || transactionError) { error(response, 503, 'Your wallet balance could not be loaded. Please retry.'); return; }
  response.status(200).json({
    wallet: { balanceKes: Number(wallet?.balance_kes || 0), updatedAt: wallet?.updated_at || null },
    transactions: transactions || [],
  });
}
