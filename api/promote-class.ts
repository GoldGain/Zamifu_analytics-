import { createClient } from '@supabase/supabase-js';

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status: (c: number) => Res; json: (b: unknown) => void; setHeader: (n: string, v: string) => void; end: () => void };

const ADMIN_ROLES = new Set([
  'school_admin', 'super_admin', 'admin', 'master_super_admin', 'reseller_super_admin', 'dos', 'director_of_studies',
]);

const bodyOf = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
};

/** Promotes a whole class to the next class in one transaction. */
export default async function handler(request: Req, response: Res): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.status(204).end(); return; }
  if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed.' }); return; }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { response.status(503).json({ error: 'Promotion is not configured.' }); return; }

  const rawAuth = request.headers.authorization;
  const token = (Array.isArray(rawAuth) ? rawAuth[0] : rawAuth)?.replace(/^Bearer\s+/i, '').trim();
  if (!token) { response.status(401).json({ error: 'Sign in to promote a class.' }); return; }

  const body = bodyOf(request.body);
  const fromClass = String(body.fromClassId || '').trim();
  const toClass = String(body.toClassId || '').trim();
  if (!fromClass || !toClass) { response.status(400).json({ error: 'Choose both the current class and the next class.' }); return; }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) { response.status(401).json({ error: 'Your session could not be verified. Sign in again.' }); return; }

  const { data: profile } = await supabase.from('profiles').select('school_id, role').eq('id', user.id).maybeSingle();
  const role = String((profile as { role?: string } | null)?.role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    response.status(403).json({ error: `Only a school administrator can promote a class (your role is "${role || 'unknown'}").` });
    return;
  }

  // Trust the classes over the profile: some accounts carry no school_id on the profile row.
  const { data: fromRow } = await supabase.from('classes').select('id, name, school_id, level').eq('id', fromClass).maybeSingle();
  const { data: toRow } = await supabase.from('classes').select('id, name, school_id, level').eq('id', toClass).maybeSingle();
  if (!fromRow || !toRow) { response.status(400).json({ error: 'That class could not be found.' }); return; }
  if (fromRow.school_id !== toRow.school_id) { response.status(400).json({ error: 'Both classes must belong to the same school.' }); return; }

  const profileSchool = (profile as { school_id?: string } | null)?.school_id || null;
  if (profileSchool && profileSchool !== fromRow.school_id && !['master_super_admin', 'reseller_super_admin', 'super_admin'].includes(role)) {
    response.status(403).json({ error: 'That class belongs to another school.' });
    return;
  }

  const { data, error } = await supabase.rpc('promote_class', {
    p_school_id: fromRow.school_id,
    p_from_class: fromClass,
    p_to_class: toClass,
  });

  if (error) { response.status(400).json({ error: error.message }); return; }
  response.status(200).json({ result: data });
}
