import { createClient } from '@supabase/supabase-js';
import { retrieveReviewDraft, type CurriculumSourceRecord } from '../src/lib/resource-fetcher.js';

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

function bearer(headers: RequestLike['headers']): string | null {
  const raw = headers.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

function jsonError(response: ResponseLike, status: number, error: string): void {
  response.status(status).json({ error });
}

function bodyValue(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Record<string, unknown>; } catch { return null; }
  }
  return body && typeof body === 'object' ? body as Record<string, unknown> : null;
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    jsonError(response, 503, 'The secure source-review service is not configured.');
    return;
  }
  const accessToken = bearer(request.headers);
  if (!accessToken) {
    jsonError(response, 401, 'A signed-in school administrator is required.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    jsonError(response, 401, 'Your session could not be verified.');
    return;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'school_admin') {
    jsonError(response, 403, 'Only school administrators may review curriculum sources.');
    return;
  }

  const body = bodyValue(request.body);
  const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : null;
  if (!sourceId) {
    jsonError(response, 400, 'A source ID is required.');
    return;
  }

  const { data: source, error: sourceError } = await supabase
    .from('curriculum_sources')
    .select('id, source_name, source_url, license_status, retrieval_status')
    .eq('id', sourceId)
    .maybeSingle();
  if (sourceError || !source) {
    jsonError(response, 404, 'The selected curriculum source was not found.');
    return;
  }

  try {
    const draft = await retrieveReviewDraft(source as CurriculumSourceRecord);
    const { data: chunk, error: insertError } = await supabase
      .from('exam_knowledge_chunks')
      .insert({
        source_id: source.id,
        source_name: source.source_name,
        content_summary: draft.summaryDraft,
        is_approved: false,
      })
      .select('id, source_name, is_approved, created_at')
      .single();
    if (insertError) throw new Error(insertError.message);
    response.status(201).json({
      message: 'Review draft saved. It is not available to exam generation until an authorised reviewer validates and approves it.',
      draft: { ...chunk, title: draft.title, contentType: draft.contentType, retrievedAt: draft.retrievedAt },
    });
  } catch (error) {
    jsonError(response, 400, error instanceof Error ? error.message : 'The source could not be retrieved for review.');
  }
}
