import { createClient } from '@supabase/supabase-js';
import {
  generateExamWithDeepSeek,
  DeepSeekConfigurationError,
  DeepSeekResponseError,
} from '../src/lib/deepseek-api.js';
import {
  validateExamRequest,
  type ExamGenerationRequest,
  type QuestionType,
} from '../src/lib/exam-schema.js';

const allowedQuestionTypes = new Set<QuestionType>([
  'multiple_choice', 'multiple_response', 'modified_true_false', 'completion',
  'matching', 'short_answer', 'numeric_response', 'case_study', 'essay',
]);

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;
const rateLedger = new Map<string, number[]>();

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};

type ResponseLike = {
  status: (statusCode: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

function jsonError(response: ResponseLike, status: number, message: string): void {
  response.status(status).json({ error: message });
}

function readBearerToken(headers: RequestLike['headers']): string | null {
  const value = headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

function parseBody(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function stringArray(value: unknown, limit = 20): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean).slice(0, limit)
    : [];
}

function parseExamRequest(raw: unknown): ExamGenerationRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const questionTypes = stringArray(body.questionTypes, 9).filter((value): value is QuestionType => allowedQuestionTypes.has(value as QuestionType));
  const totalMarks = Number(body.totalMarks);
  const durationMinutes = Number(body.durationMinutes);
  const difficulty = body.difficulty === 'easy' || body.difficulty === 'medium' || body.difficulty === 'hard' || body.difficulty === 'mixed'
    ? body.difficulty : 'mixed';
  const format = body.format === 'cbe' || body.format === 'kpsea' || body.format === 'kjsea' || body.format === 'custom'
    ? body.format : 'cbe';
  return {
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 255) : undefined,
    gradeLevel: typeof body.gradeLevel === 'string' ? body.gradeLevel.trim().slice(0, 32) : '',
    subject: typeof body.subject === 'string' ? body.subject.trim().slice(0, 100) : '',
    strands: stringArray(body.strands),
    subStrands: stringArray(body.subStrands),
    topics: stringArray(body.topics),
    questionTypes,
    totalMarks: Number.isFinite(totalMarks) ? Math.round(totalMarks) : 0,
    durationMinutes: Number.isFinite(durationMinutes) ? Math.round(durationMinutes) : 0,
    difficulty,
    includeImages: Boolean(body.includeImages),
    includeMarkingScheme: body.includeMarkingScheme !== false,
    format,
    term: typeof body.term === 'string' ? body.term.trim().slice(0, 30) : undefined,
    schoolName: typeof body.schoolName === 'string' ? body.schoolName.trim().slice(0, 255) : undefined,
  };
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (rateLedger.get(key) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateLedger.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLedger.set(key, recent);
  return true;
}

async function loadVettedContext(
  supabase: ReturnType<typeof createClient>,
  request: ExamGenerationRequest,
): Promise<{ context: string; sourceSummary: string[] }> {
  const { data, error } = await supabase
    .from('exam_knowledge_chunks')
    .select('content_summary, subject, grade_level, strand, sub_strand, source_name')
    .eq('is_approved', true)
    .eq('subject', request.subject)
    .limit(12);

  if (error || !data?.length) return { context: '', sourceSummary: [] };
  const matching = data.filter((row: any) => !row.grade_level || row.grade_level === request.gradeLevel).slice(0, 8);
  return {
    context: matching.map((row: any) => [row.strand, row.sub_strand, row.content_summary].filter(Boolean).join(': ')).join('\n'),
    sourceSummary: matching.map((row: any) => row.source_name).filter(Boolean),
  };
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
    jsonError(response, 503, 'The secure exam service is not configured.');
    return;
  }

  const accessToken = readBearerToken(request.headers);
  if (!accessToken) {
    jsonError(response, 401, 'Sign in as a teacher or school administrator to generate an exam.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userData.user;
  if (userError || !user) {
    jsonError(response, 401, 'Your session could not be verified. Please sign in again.');
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, school_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.school_id) {
    jsonError(response, 403, 'Account verification failed. Please contact your school administrator.');
    return;
  }
  const isAuthorised = ['teacher', 'school_admin', 'super_admin'].includes(profile.role || '');
  if (!isAuthorised) {
    jsonError(response, 403, 'Only authorised teachers and school administrators can generate exams.');
    return;
  }

  const rateKey = `${user.id}:${request.socket?.remoteAddress || 'unknown'}`;
  if (!checkRateLimit(rateKey)) {
    jsonError(response, 429, 'Generation limit reached. Please wait a few minutes before trying again.');
    return;
  }

  const parsedRequest = parseExamRequest(parseBody(request.body));
  if (!parsedRequest) {
    jsonError(response, 400, 'Invalid exam-generation request.');
    return;
  }
  const validationErrors = validateExamRequest(parsedRequest);
  if (validationErrors.length) {
    jsonError(response, 400, validationErrors.join(' '));
    return;
  }

  try {
    const vetted = await loadVettedContext(supabase, parsedRequest);
    const paper = await generateExamWithDeepSeek(parsedRequest, vetted.context);
    const { data: storedQuestions, error: questionError } = await supabase
      .from('exam_questions')
      .insert(paper.questions.map((question) => ({
        school_id: profile.school_id,
        created_by: user.id,
        source_website: 'AI-generated from vetted Zamifu curriculum context',
        source_kind: 'generated',
        grade_level: paper.grade_level,
        subject: paper.subject,
        strand: question.strand || 'General',
        sub_strand: question.sub_strand || 'General',
        question_type: question.question_type,
        question_text: question.question_text,
        options: question.options?.length ? question.options : null,
        correct_answer: question.correct_answer,
        marking_scheme: question.marking_scheme,
        image_url: question.image_url || null,
        difficulty: question.difficulty,
        marks: question.marks,
        topic: question.topic || null,
        metadata: { generated_at: paper.generated_at, format: paper.format },
      })))
      .select('id');

    if (questionError) throw new Error(`Could not save generated questions: ${questionError.message}`);

    const questionIds = (storedQuestions || []).map((question: { id: string }) => question.id);
    const persistedQuestions = paper.questions.map((question, index) => ({
      ...question,
      id: questionIds[index] || question.id,
    }));
    const { data: storedPaper, error: paperError } = await supabase
      .from('exam_papers')
      .insert({
        school_id: profile.school_id,
        created_by: user.id,
        title: paper.title,
        grade_level: paper.grade_level,
        subject: paper.subject,
        term: paper.term || null,
        year: paper.year,
        questions: questionIds,
        marking_scheme: paper.questions.map((question, index) => `Q${index + 1}: ${question.marking_scheme}`).join('\n'),
        instructions: paper.instructions.join('\n'),
        duration_minutes: paper.duration_minutes,
        total_marks: paper.total_marks,
        format: paper.format,
        source_summary: vetted.sourceSummary,
      })
      .select('id')
      .single();

    if (paperError) throw new Error(`Could not save the exam paper: ${paperError.message}`);
    response.status(200).json({
      paper: { ...paper, id: storedPaper?.id, questions: persistedQuestions },
      sourceSummary: vetted.sourceSummary,
    });
  } catch (error) {
    const message = error instanceof DeepSeekConfigurationError || error instanceof DeepSeekResponseError
      ? error.message
      : error instanceof Error ? error.message : 'The exam could not be generated at this time.';
    jsonError(response, 502, message);
  }
}
