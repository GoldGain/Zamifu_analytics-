import { createClient } from '@supabase/supabase-js';

type RequestLike = { headers?: Record<string, string | string[] | undefined> };

const firstValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();

/**
 * Per-IP sliding-window limiter backed by public.bump_rate_limit().
 * Fails open: if the limiter is not configured or the database errors, the
 * request is allowed, so a limiter outage can never take the endpoint down.
 */
export async function allowRequest(
  request: RequestLike,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return true;
  const ip =
    firstValue(request.headers?.['x-forwarded-for']) ||
    firstValue(request.headers?.['x-real-ip']) ||
    'unknown';
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
