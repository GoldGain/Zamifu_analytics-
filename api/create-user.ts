import { createClient } from '@supabase/supabase-js';

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status: (c: number) => Res; json: (b: unknown) => void; setHeader: (n: string, v: string) => void; end: () => void };

const SUPPORTED = new Set(['super_admin', 'school_admin', 'teacher', 'student', 'parent', 'master_super_admin', 'reseller_super_admin', 'bursar', 'librarian', 'store_keeper']);
const SCHOOL_SCOPED = new Set(['teacher', 'student', 'parent', 'bursar', 'librarian', 'store_keeper']);
const CALLER_ADMIN = new Set(['school_admin', 'super_admin', 'master_super_admin', 'reseller_super_admin']);

const bodyOf = (raw: unknown): Record<string, any> => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
};

/** Creates a staff or learner account. Same contract as the create-user Edge Function. */
export default async function handler(request: Req, response: Res): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.status(204).end(); return; }
  if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed.' }); return; }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { response.status(503).json({ error: 'User creation is not configured.' }); return; }

  const rawAuth = request.headers.authorization;
  const token = (Array.isArray(rawAuth) ? rawAuth[0] : rawAuth)?.replace(/^Bearer\s+/i, '').trim();
  if (!token) { response.status(401).json({ error: 'Sign in to create an account.' }); return; }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) { response.status(401).json({ error: 'Your session could not be verified. Sign in again.' }); return; }

  const { data: callerProfile } = await admin.from('profiles').select('role, school_id').eq('id', caller.user.id).maybeSingle();
  const callerRole = String(callerProfile?.role || '');
  if (!CALLER_ADMIN.has(callerRole)) { response.status(403).json({ error: 'You do not have permission to create accounts.' }); return; }

  const b = bodyOf(request.body);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const requested = String(b.role || '').trim().toLowerCase();
  const role = requested === 'learner' ? 'student' : requested;
  if (!email || !password || !role) { response.status(400).json({ error: 'Missing required fields: email, password, role' }); return; }
  if (!SUPPORTED.has(role)) { response.status(400).json({ error: 'Unsupported account role' }); return; }

  const schoolId = String(b.school_id || callerProfile?.school_id || '').trim();
  if (SCHOOL_SCOPED.has(role) && !schoolId) { response.status(400).json({ error: 'A school is required for this account role' }); return; }
  if (callerRole === 'school_admin') {
    if (!callerProfile?.school_id || schoolId !== callerProfile.school_id) { response.status(403).json({ error: 'You can only create accounts for your own school' }); return; }
    if (!SCHOOL_SCOPED.has(role)) { response.status(403).json({ error: 'School administrators cannot create platform administrator accounts' }); return; }
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: b.first_name || '',
      last_name: b.last_name || '',
      role,
      school_id: schoolId || null,
      ...(b.metadata && typeof b.metadata === 'object' ? b.metadata : {}),
    },
  });
  if (createErr || !created?.user?.id) {
    response.status(400).json({ error: createErr?.message || 'Account was not created.' });
    return;
  }
  const userId = created.user.id;

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: userId,
    role,
    school_id: schoolId || null,
    first_name: String(b.first_name || '') || email.split('@')[0],
    last_name: String(b.last_name || ''),
    email,
  }, { onConflict: 'id' });

  if (profileErr) {
    try { await admin.auth.admin.deleteUser(userId); } catch { /* best effort */ }
    response.status(400).json({ error: `Account could not be saved: ${profileErr.message}` });
    return;
  }

  response.status(200).json({ user: { id: userId, email } });
}
