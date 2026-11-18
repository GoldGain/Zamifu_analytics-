import { createClient } from '@supabase/supabase-js';

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status: (statusCode: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

function jsonError(response: ResponseLike, status: number, error: string): void {
  response.status(status).json({ error });
}

function bearer(headers: RequestLike['headers']): string | null {
  const raw = headers.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

function parsePrompt(body: unknown): string | null {
  let value = body;
  if (typeof body === 'string') {
    try { value = JSON.parse(body); } catch { return null; }
  }
  const prompt = value && typeof value === 'object' ? (value as { prompt?: unknown }).prompt : null;
  if (typeof prompt !== 'string') return null;
  const trimmed = prompt.trim();
  return trimmed && trimmed.length <= 14_000 ? trimmed : null;
}

const firstHeaderValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();

/**
 * Per-IP sliding-window limiter for the AI routes, backed by public.bump_rate_limit().
 * Inlined per route: files under api/_lib are not bundled by Vercel.
 * Fails open so a limiter outage can never take generation down.
 */
async function allowAiRequest(
  request: RequestLike,
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

export default async function handler(request: RequestLike, response: ResponseLike): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') {
    response.setHeader('Allow', 'POST, OPTIONS');
    response.status(204).end();
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    jsonError(response, 405, 'Method not allowed.');
    return;
  }

  if (!(await allowAiRequest(request, 'curriculum-ai', 30, 60))) {
    jsonError(response, 429, 'Too many requests. Please wait a minute and try again.');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const deepSeekKey = process.env.DEEPSEEK_API_KEY;
  if (!supabaseUrl || !serviceRoleKey || !deepSeekKey) {
    jsonError(response, 503, 'The secure curriculum AI service is not configured.');
    return;
  }

  const token = bearer(request.headers);
  const prompt = parsePrompt(request.body);
  if (!token || !prompt) {
    jsonError(response, 400, 'A valid signed-in request and a concise prompt are required.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await (supabase.auth as any).getUser(token);
  if (authError || !user) {
    jsonError(response, 401, 'Your session could not be verified.');
    return;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.school_id || !['teacher', 'school_admin'].includes(profile.role)) {
    jsonError(response, 403, 'Only authorised teachers and school administrators may use curriculum generation.');
    return;
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepSeekKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
        messages: [
          { role: 'system', content: 'You are a Kenyan CBC/CBE curriculum assistant. Return only the requested content. Where JSON is requested, return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: prompt.toLowerCase().includes('json') ? { type: 'json_object' } : undefined,
        temperature: 0.45,
        max_tokens: 4500,
      }),
    });
    const payload = await upstream.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!upstream.ok) throw new Error(payload.error?.message || `The AI service returned status ${upstream.status}.`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('The AI service returned an empty response.');
    response.status(200).json({ content });
  } catch (error) {
    jsonError(response, 502, error instanceof Error ? error.message : 'The curriculum AI service is unavailable.');
  }
}
