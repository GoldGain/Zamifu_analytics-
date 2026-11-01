import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

type Req = { method?: string; body?: unknown };
type Res = { status: (c: number) => Res; json: (b: unknown) => void; setHeader: (n: string, v: string) => void; end: () => void };

const bodyOf = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
};

/** Verifies a Paystack payment for a public paper and issues a single-use ticket. */
export default async function handler(request: Req, response: Res): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.status(204).end(); return; }
  if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed.' }); return; }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!url || !serviceKey || !paystackKey) { response.status(503).json({ error: 'Payments are not configured.' }); return; }

  const reference = String(bodyOf(request.body).reference || '').trim();
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) { response.status(400).json({ error: 'A valid payment reference is required.' }); return; }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: ticket } = await supabase.from('public_exam_tickets').select('*').eq('reference', reference).maybeSingle();
  if (!ticket) { response.status(404).json({ error: 'That payment reference is not known.' }); return; }
  if (ticket.status !== 'pending') { response.status(200).json({ verified: true, ticketToken: ticket.ticket_token, status: ticket.status }); return; }

  const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey}` },
  });
  const verified = await verifyResponse.json().catch(() => null);
  const paid = Boolean(verified?.status && verified?.data?.status === 'success');
  const amount = Number(verified?.data?.amount || 0);
  if (!paid || amount < Number(ticket.amount_kobo)) {
    response.status(402).json({ verified: false, error: 'That payment could not be confirmed yet. If you were charged, retry in a moment.' });
    return;
  }

  const ticketToken = randomBytes(24).toString('hex');
  await supabase.from('public_exam_tickets')
    .update({ status: 'paid', ticket_token: ticketToken, paid_at: new Date().toISOString() })
    .eq('reference', reference);

  response.status(200).json({ verified: true, ticketToken, status: 'paid' });
}
