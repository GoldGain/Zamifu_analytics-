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
  const mode = String(body.mode || 'promote');
  const studentIds = Array.isArray(body.studentIds)
    ? (body.studentIds as unknown[]).map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const fromClass = String(body.fromClassId || '').trim();
  const toClass = String(body.toClassId || '').trim();
  if (mode !== 'undo' && (!fromClass || !toClass)) { response.status(400).json({ error: 'Choose both the current class and the next class.' }); return; }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) { response.status(401).json({ error: 'Your session could not be verified. Sign in again.' }); return; }

  const { data: profile } = await supabase.from('profiles').select('school_id, role').eq('id', user.id).maybeSingle();
  const role = String((profile as { role?: string } | null)?.role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    response.status(403).json({ error: `Only a school administrator can promote a class (your role is "${role || 'unknown'}").` });
    return;
  }

  // ── Undo graduation ────────────────────────────────────────────────────────
  // Kept on this endpoint so the project stays within the Hobby plan's 12-function limit.
  if (mode === 'undo') {
    if (!studentIds.length) { response.status(400).json({ error: 'Select at least one learner.' }); return; }
    if (studentIds.length > 1000) { response.status(400).json({ error: 'Undo at most 1000 learners at a time.' }); return; }

    const { data: learners, error: learnerError } = await supabase
      .from('students').select('id, school_id').in('id', studentIds);
    if (learnerError) { response.status(400).json({ error: learnerError.message }); return; }
    if (!learners || learners.length === 0) { response.status(404).json({ error: 'Those learners could not be found.' }); return; }

    const schools = new Set(learners.map((row) => String((row as { school_id?: string }).school_id || '')));
    if (schools.size !== 1) { response.status(400).json({ error: 'All selected learners must belong to the same school.' }); return; }
    const undoSchool = [...schools][0];
    if (!undoSchool) { response.status(400).json({ error: 'Those learners are not attached to a school.' }); return; }

    const undoProfileSchool = (profile as { school_id?: string } | null)?.school_id || null;
    const undoSuperRoles = new Set(['master_super_admin', 'reseller_super_admin', 'super_admin']);
    if (undoProfileSchool && undoProfileSchool !== undoSchool && !undoSuperRoles.has(role)) {
      response.status(403).json({ error: 'Those learners belong to another school.' });
      return;
    }

    const { data: undoResult, error: undoError } = await supabase.rpc('undo_graduation', {
      p_school_id: undoSchool,
      p_student_ids: learners.map((row) => (row as { id: string }).id),
    });
    if (undoError) { response.status(400).json({ error: undoError.message }); return; }
    response.status(200).json({ result: undoResult });
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

  if (mode === 'graduate') {
    const { data: graduated, error: gradError } = await supabase.rpc('graduate_class', {
      p_school_id: fromRow.school_id,
      p_class_id: fromClass,
    });
    if (gradError) { response.status(400).json({ error: gradError.message }); return; }
    response.status(200).json({ result: graduated });
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
