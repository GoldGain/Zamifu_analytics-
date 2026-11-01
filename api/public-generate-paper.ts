import { createClient } from '@supabase/supabase-js';

type Req = { method?: string; body?: unknown };
type Res = { status: (c: number) => Res; json: (b: unknown) => void; setHeader: (n: string, v: string) => void; end: () => void };

const bodyOf = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
};

/** Generates one paper against a paid ticket. No sign-in required. */
export default async function handler(request: Req, response: Res): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.status(204).end(); return; }
  if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed.' }); return; }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!url || !serviceKey || !deepseekKey) { response.status(503).json({ error: 'Paper generation is not configured.' }); return; }

  const token = String(bodyOf(request.body).ticketToken || '').trim();
  if (!token) { response.status(400).json({ error: 'A paid ticket is required.' }); return; }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: ticket } = await supabase.from('public_exam_tickets').select('*').eq('ticket_token', token).maybeSingle();
  if (!ticket) { response.status(404).json({ error: 'That ticket is not valid.' }); return; }
  if (new Date(ticket.expires_at).getTime() < Date.now()) {
    response.status(410).json({ error: 'This ticket has expired. Purchase a new paper.' });
    return;
  }
  if (ticket.status === 'used' && ticket.paper) { response.status(200).json({ paper: ticket.paper, reused: true }); return; }
  if (ticket.status !== 'paid') { response.status(402).json({ error: 'This ticket has not been paid for.' }); return; }

  const req = (ticket.request || {}) as { subject?: string; gradeLevel?: string; format?: string; marks?: number; term?: string };
  const prompt = `Write a Kenyan school examination paper.
Learning area: ${req.subject}
Class: ${req.gradeLevel}
Term: ${req.term || 'Term 1'}
Format: ${req.format || 'CBE school assessment'}
Total marks: ${req.marks || 50}
Rules: plain text only (no LaTeX, no dollar signs, no backslashes);
mix multiple-choice and structured questions; every question carries marks;
return strict JSON: {"title":string,"instructions":string,"questions":[{"question_number":number,"question_text":string,"marks":number,"answer":string}]}`;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a Kenyan examiner. Reply with strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) { response.status(502).json({ error: 'The paper could not be written right now. Your ticket is still valid - try again.' }); return; }

  const payload = await res.json();
  let paper: Record<string, unknown> | null = null;
  try {
    paper = JSON.parse(String(payload.choices?.[0]?.message?.content || '').replace(/^```(?:json)?/i, '').replace(/```\s*$/i, '').trim());
  } catch { paper = null; }
  if (!paper || !Array.isArray((paper as { questions?: unknown[] }).questions)) {
    response.status(502).json({ error: 'The paper came back empty. Your ticket is still valid - try again.' });
    return;
  }

  await supabase.from('public_exam_tickets')
    .update({ status: 'used', used_at: new Date().toISOString(), paper })
    .eq('id', ticket.id);

  response.status(200).json({ paper });
}
