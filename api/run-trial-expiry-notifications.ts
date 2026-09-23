import { createClient } from '@supabase/supabase-js';

type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined> };
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void; setHeader: (name: string, value: string) => void; end: () => void };

export default async function handler(request: RequestLike, response: ResponseLike): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'GET' && request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed' }); return; }
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.authorization?.replace(/^Bearer\s+/i, '') || request.headers['x-cron-secret'];
  const vercelCron = request.headers['x-vercel-cron'];
  if (!configuredSecret || (suppliedSecret !== configuredSecret && vercelCron !== '1')) { response.status(401).json({ error: 'Unauthorized' }); return; }
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) { response.status(503).json({ error: 'Trial notification worker is not configured' }); return; }
  try {
    const result = await fetch(`${supabaseUrl}/functions/v1/process-trial-expiry-notifications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'x-zamifu-cron-secret': serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'vercel-cron' }),
    });
    const body = await result.json().catch(() => ({}));
    response.status(result.status).json(body);
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : 'Notification worker unavailable' });
  }
}
