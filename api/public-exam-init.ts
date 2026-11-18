import { createClient } from '@supabase/supabase-js';

const firstHeaderValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();

/**
 * Per-IP sliding-window limiter backed by public.bump_rate_limit().
 * Inlined per route on purpose: files under api/_lib are not bundled by Vercel.
 * Fails open so a limiter outage can never take the endpoint down.
 */
async function allowRequest(
  request: { headers?: Record<string, string | string[] | undefined> },
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return true;
  const ip = firstHeaderValue(request.headers?.['x-forwarded-for']) || firstHeaderValue(request.headers?.['x-real-ip']) || 'unknown';
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc('bump_rate_limit', {
      p_key: `${bucket}:${ip}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}


const PRICE_KOBO = 2000; // KES 20

type Req = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (c: number) => Res; json: (b: unknown) => void; setHeader: (n: string, v: string) => void; end: () => void };

const bodyOf = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
};

/** Creates a pending ticket for one public exam paper (no sign-in required). */
export default async function handler(request: Req, response: Res): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.status(204).end(); return; }
  if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed.' }); return; }

  if (!(await allowRequest(request, 'public-exam-init', 20, 60))) {
    response.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { response.status(503).json({ error: 'Public papers are not configured.' }); return; }

  const body = bodyOf(request.body);
  const subject = String(body.subject || '').trim();
  const gradeLevel = String(body.gradeLevel || '').trim();
  const format = String(body.format || 'cbe').trim();
  if (!subject || !gradeLevel) { response.status(400).json({ error: 'Choose a class and a learning area.' }); return; }

  const reference = `PE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { error } = await supabase.from('public_exam_tickets').insert({
    reference,
    amount_kobo: PRICE_KOBO,
    email: body.email ? String(body.email).slice(0, 120) : null,
    phone: body.phone ? String(body.phone).slice(0, 30) : null,
    request: { subject, gradeLevel, format, marks: Number(body.marks) || 50, term: String(body.term || 'Term 1') },
  });
  if (error) { response.status(503).json({ error: 'Could not start that purchase. Please try again.' }); return; }

  response.status(200).json({ reference, amountKobo: PRICE_KOBO, currency: 'KES' });
}
