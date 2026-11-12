import { createClient } from '@supabase/supabase-js';

const SUPPORTED = ['super_admin','school_admin','teacher','student','parent','master_super_admin','reseller_super_admin','bursar','librarian','store_keeper'];
const SCOPED = ['school_admin','teacher','student','parent','bursar','librarian','store_keeper'];
const CALLERS = ['school_admin','super_admin','master_super_admin','reseller_super_admin'];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { res.status(503).json({ error: 'User creation is not configured.' }); return; }
  const raw = req.headers.authorization;
  const token = (Array.isArray(raw) ? raw[0] : raw || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { res.status(401).json({ error: 'Sign in to create an account.' }); return; }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const caller = await admin.auth.getUser(token);
  if (caller.error || !caller.data || !caller.data.user) { res.status(401).json({ error: 'Your session could not be verified.' }); return; }
  const profile = await admin.from('profiles').select('role, school_id').eq('id', caller.data.user.id).maybeSingle();
  const callerRole = String((profile.data && profile.data.role) || '');
  if (CALLERS.indexOf(callerRole) < 0) { res.status(403).json({ error: 'You do not have permission to create accounts.' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const wanted = String(body.role || '').trim().toLowerCase();
  const role = wanted === 'learner' ? 'student' : wanted;
  if (!email || !password || !role) { res.status(400).json({ error: 'Missing required fields: email, password, role' }); return; }
  if (SUPPORTED.indexOf(role) < 0) { res.status(400).json({ error: 'Unsupported account role' }); return; }
  const schoolId = String(body.school_id || (profile.data && profile.data.school_id) || '').trim();
  if (SCOPED.indexOf(role) >= 0 && !schoolId) { res.status(400).json({ error: 'A school is required for this account role' }); return; }
  if (callerRole === 'school_admin') {
    const own = (profile.data && profile.data.school_id) || '';
    if (!own || schoolId !== own) { res.status(403).json({ error: 'You can only create accounts for your own school' }); return; }
    if (SCOPED.indexOf(role) < 0) { res.status(403).json({ error: 'School administrators cannot create platform administrator accounts' }); return; }
  }
  const created = await admin.auth.admin.createUser({
    email: email, password: password, email_confirm: true,
    user_metadata: { first_name: body.first_name || '', last_name: body.last_name || '', role: role, school_id: schoolId || null },
  });
  if (created.error || !created.data || !created.data.user) { res.status(400).json({ error: (created.error && created.error.message) || 'Account was not created.' }); return; }
  const userId = created.data.user.id;
  const saved = await admin.from('profiles').upsert({
    id: userId, role: role, school_id: schoolId || null,
    first_name: String(body.first_name || '') || email.split('@')[0],
    last_name: String(body.last_name || ''), email: email,
  }, { onConflict: 'id' });
  if (saved.error) {
    try { await admin.auth.admin.deleteUser(userId); } catch (e) { /* ignore */ }
    res.status(400).json({ error: 'Account could not be saved: ' + saved.error.message });
    return;
  }
  res.status(200).json({ user: { id: userId, email: email } });
}
