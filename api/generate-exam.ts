import { createClient } from '@supabase/supabase-js';
import {
  generateExamWithDeepSeek,
  DeepSeekConfigurationError,
  DeepSeekResponseError,
} from '../src/lib/deepseek-api.js';
import {
  generateExamWithGemini,
  GeminiConfigurationError,
  GeminiResponseError,
} from '../src/lib/gemini-api.js';
import {
  validateExamRequest,
  type ExamGenerationRequest,
  type ExamBlueprint,
  type QuestionType,
  makeBalancedBlueprint,
  makeFormatBlueprint,
} from '../src/lib/exam-schema.js';
import { filterUnnecessaryExamVisual, withRenderedExamVisual } from '../src/lib/exam-visuals.js';
import { validateGeneratedExam } from '../src/lib/exam-validation.js';
import { getStrandPacks } from '../src/lib/kicd-knowledge.js';

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

function parseBlueprint(value: unknown): ExamBlueprint | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as { sections?: unknown; total_marks?: unknown; estimated_minutes?: unknown };
  if (!Array.isArray(raw.sections)) return undefined;
  const sections = raw.sections.slice(0, 20).flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const section = entry as Record<string, unknown>;
    const allowedTypes: QuestionType[] = ['multiple_choice', 'multiple_response', 'modified_true_false', 'completion', 'matching', 'short_answer', 'numeric_response', 'case_study', 'essay'];
    const type = allowedTypes.includes(section.question_type as QuestionType) ? section.question_type as QuestionType : null;
    const count = Number(section.count);
    const marks = Number(section.marks_per_question);
    if (!type || !Number.isFinite(count) || !Number.isFinite(marks) || count < 1 || marks < 1) return [];
    return [{
      id: typeof section.id === 'string' ? section.id.slice(0, 80) : `section-${index + 1}`,
      title: typeof section.title === 'string' ? section.title.slice(0, 160) : undefined,
      question_type: type,
      count: Math.min(60, Math.round(count)),
      marks_per_question: Math.min(30, Math.round(marks)),
      difficulty: section.difficulty === 'easy' || section.difficulty === 'medium' || section.difficulty === 'hard' || section.difficulty === 'mixed' ? section.difficulty : 'mixed',
      strand: typeof section.strand === 'string' ? section.strand.slice(0, 180) : undefined,
      sub_strand: typeof section.sub_strand === 'string' ? section.sub_strand.slice(0, 180) : undefined,
      topic: typeof section.topic === 'string' ? section.topic.slice(0, 180) : undefined,
      competency: typeof section.competency === 'string' ? section.competency.slice(0, 180) : undefined,
    }];
  });
  if (!sections.length) return undefined;
  const totalMarks = Number(raw.total_marks);
  const estimatedMinutes = Number(raw.estimated_minutes);
  return {
    sections,
    total_marks: Number.isFinite(totalMarks) ? Math.round(totalMarks) : sections.reduce((sum, section) => sum + section.count * section.marks_per_question, 0),
    estimated_minutes: Number.isFinite(estimatedMinutes) ? Math.round(estimatedMinutes) : undefined,
  };
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
    level: body.level === 'pre_primary' || body.level === 'lower_primary' || body.level === 'upper_primary' || body.level === 'junior_secondary' || body.level === 'senior_secondary' ? body.level : undefined,
    curriculumVersion: typeof body.curriculumVersion === 'string' ? body.curriculumVersion.trim().slice(0, 80) : undefined,
    learningOutcomes: stringArray(body.learningOutcomes, 30),
    competencies: stringArray(body.competencies, 20),
    blueprint: parseBlueprint(body.blueprint),
    preset: typeof body.preset === 'string' ? body.preset.trim().slice(0, 80) : undefined,
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

function normalizeContextKey(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function embeddedCurriculumContext(request: ExamGenerationRequest): { context: string; sourceSummary: string[] } {
  const packs = getStrandPacks(request.subject);
  const requestedStrands = new Set(request.strands.map(normalizeContextKey));
  const requestedSubStrands = new Set(request.subStrands.map(normalizeContextKey));
  const requestedTopics = new Set(request.topics.map(normalizeContextKey));
  const lines: string[] = [];
  for (const pack of packs) {
    if (requestedStrands.size && !requestedStrands.has(normalizeContextKey(pack.strand))) continue;
    for (const subStrand of pack.subStrands) {
      if (requestedSubStrands.size && !requestedSubStrands.has(normalizeContextKey(subStrand.name))) continue;
      const topics = requestedTopics.size
        ? subStrand.topics.filter((topic) => requestedTopics.has(normalizeContextKey(topic)))
        : subStrand.topics;
      if (!topics.length && requestedTopics.size) continue;
      const outcomes = subStrand.slos.slice(0, 3).join('; ');
      lines.push([pack.strand, subStrand.name, topics.slice(0, 8).join(', '), outcomes].filter(Boolean).join(': '));
    }
  }
  return {
    context: lines.slice(0, 18).join('\n'),
    sourceSummary: lines.length ? [`Embedded KICD-aligned curriculum pack for ${request.subject}`] : [],
  };
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
    .limit(24);

  const requestedGrade = normalizeContextKey(request.gradeLevel);
  const matching = (error ? [] : (data || []))
    .filter((row: any) => !row.grade_level || normalizeContextKey(row.grade_level) === requestedGrade)
    .slice(0, 10);
  const databaseContext = matching.map((row: any) => [row.strand, row.sub_strand, row.content_summary].filter(Boolean).join(': ')).join('\n');
  const databaseSources = matching.map((row: any) => row.source_name).filter(Boolean);
  const embedded = embeddedCurriculumContext(request);
  const context = [databaseContext, embedded.context].filter(Boolean).join('\n');
  return {
    context,
    sourceSummary: Array.from(new Set([...databaseSources, ...embedded.sourceSummary])).slice(0, 12),
  };
}

type ExamProfile = {
  id: string;
  school_id: string | null;
  role: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

function assertGenerationAccess(profile: ExamProfile): string | null {
  if (!profile.school_id) return 'Your account is not linked to a school.';
  if (!['teacher', 'school_admin'].includes(profile.role)) {
    return 'Only teachers and school administrators can generate assessment papers.';
  }
  // Exam Generator is an authoring tool for the school, not a marks-entry tool.
  // Keep authentication, school linkage, role checks, rate limits, review, and
  // school-scoped persistence, but do not require the teacher to be assigned the
  // selected learning area before drafting an original assessment paper.
  return null;
}

async function handleExamGeneration(
  response: ResponseLike,
  supabase: ReturnType<typeof createClient>,
  profile: ExamProfile,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  request: RequestLike,
): Promise<void> {
  const rawParsedRequest = parseExamRequest(parseBody(request.body));
  if (!rawParsedRequest) {
    jsonError(response, 400, 'Invalid exam-generation request.');
    return;
  }
  const parsedRequest: ExamGenerationRequest = rawParsedRequest.blueprint
    ? rawParsedRequest
    : {
        ...rawParsedRequest,
        blueprint: ['kpsea', 'kjsea'].includes(rawParsedRequest.format)
          ? makeFormatBlueprint(rawParsedRequest.format, rawParsedRequest.totalMarks, rawParsedRequest.difficulty)
          : makeBalancedBlueprint(rawParsedRequest.questionTypes, rawParsedRequest.totalMarks, rawParsedRequest.difficulty),
      };
  const accessError = assertGenerationAccess(profile);
  if (accessError) {
    jsonError(response, 403, accessError);
    return;
  }
  const rateKey = `${user.id}:${request.socket?.remoteAddress || 'unknown'}`;
  if (!checkRateLimit(rateKey)) {
    jsonError(response, 429, 'Generation limit reached. Please wait a few minutes before trying again.');
    return;
  }

  const validationErrors = validateExamRequest(parsedRequest);
  if (validationErrors.length) {
    jsonError(response, 400, validationErrors.join(' '));
    return;
  }

  let generationJobId: string | null = null;
  const configuredProvider = String(process.env.AI_EXAM_PROVIDER || '').trim().toLowerCase();
  const useGemini = configuredProvider === 'gemini' || (!configuredProvider && Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY));
  const primaryProvider = useGemini ? 'gemini' : 'deepseek';
  const primaryModel = useGemini ? (process.env.GEMINI_MODEL || 'gemini-3.7-flash') : (process.env.AI_EXAM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat');
  let actualProvider = primaryProvider;
  let actualModel = primaryModel;
  try {
    const { data: generationJob, error: generationJobError } = await supabase
      .from('exam_generation_jobs')
      .insert({ school_id: profile.school_id, created_by: user.id, status: 'generating', request_payload: parsedRequest, provider: primaryProvider, model: primaryModel })
      .select('id')
      .single();
    if (generationJobError) throw new Error(`Could not start the generation job: ${generationJobError.message}`);
    generationJobId = generationJob?.id || null;
    const vetted = await loadVettedContext(supabase, parsedRequest);
    let draftPaper;
    try {
      draftPaper = useGemini
        ? await generateExamWithGemini(parsedRequest, vetted.context)
        : await generateExamWithDeepSeek(parsedRequest, vetted.context);
    } catch (error) {
      // Gemini is the preferred provider when configured, but a transient
      // quota, model, or structured-output failure must not break the already
      // verified DeepSeek route. Explicit Gemini configuration failures remain
      // actionable instead of being silently masked.
      if (!useGemini || error instanceof GeminiConfigurationError) throw error;
      console.warn('[exam-gen] Gemini primary failed; using DeepSeek fallback:', error instanceof Error ? error.message.slice(0, 240) : 'unknown failure');
      actualProvider = 'deepseek';
      actualModel = process.env.AI_EXAM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      draftPaper = await generateExamWithDeepSeek(parsedRequest, vetted.context);
      if (generationJobId) {
        await supabase.from('exam_generation_jobs').update({ provider: actualProvider, model: actualModel }).eq('id', generationJobId);
      }
    }
    const renderedQuestions = draftPaper.questions
      .map(filterUnnecessaryExamVisual)
      .map(withRenderedExamVisual);
    const validation = validateGeneratedExam(parsedRequest, renderedQuestions);
    if (!validation.passed) {
      throw new DeepSeekResponseError(`The generated paper needs repair before it can be saved: ${validation.issues.filter((issue) => issue.severity === 'critical').map((issue) => issue.message).slice(0, 3).join(' ')}`);
    }
    const paper = { ...draftPaper, questions: renderedQuestions, total_marks: renderedQuestions.reduce((sum, question) => sum + question.marks, 0) };
    const { data: storedQuestions, error: questionError } = await supabase
      .from('exam_questions')
      .insert(paper.questions.map((question) => ({
        school_id: profile.school_id,
        created_by: user.id,
        source_website: 'AI-generated from vetted Zamifu curriculum context',
        source_kind: 'generated',
        grade_level: paper.grade_level,
        subject: paper.subject,
        strand: (question.strand || 'General').slice(0, 100),
        sub_strand: (question.sub_strand || 'General').slice(0, 100),
        question_type: question.question_type,
        question_text: question.question_text,
        options: question.options?.length ? question.options : null,
        correct_answer: question.correct_answer,
        marking_scheme: question.marking_scheme,
        image_url: question.image_url && question.image_url.length <= 500 ? question.image_url : null,
        difficulty: question.difficulty,
        marks: question.marks,
        topic: question.topic || null,
        learning_outcome: question.learning_outcome || null,
        competency: question.competency || null,
        cognitive_level: question.cognitive_level || null,
        review_status: 'draft',
        metadata: {
          generated_at: paper.generated_at,
          format: paper.format,
          visual_spec: question.visual_spec
            ? { ...question.visual_spec, rendered_data_url: question.image_url || null }
            : null,
        },
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
        status: 'draft',
        version_number: 1,
        blueprint: parsedRequest.blueprint || { sections: [], total_marks: parsedRequest.totalMarks },
        validation_results: validation.issues,
      })
      .select('id')
      .single();

    if (paperError) throw new Error(`Could not save the exam paper: ${paperError.message}`);
    const paperId = storedPaper?.id;
    const { error: snapshotError } = await supabase.from('exam_paper_question_snapshots').insert(persistedQuestions.map((question, index) => ({
      paper_id: paperId, question_id: question.id, question_order: index + 1, payload: question,
    })));
    if (snapshotError) throw new Error(`Could not save immutable question snapshots: ${snapshotError.message}`);
    const visualQuestions = persistedQuestions.filter((question) => question.image_url && question.visual_spec);
    if (visualQuestions.length && paperId) {
      const { error: visualError } = await supabase.from('exam_visual_assets').insert(visualQuestions.map((question) => ({
        school_id: profile.school_id, question_id: question.id, paper_id: paperId, asset_type: ['diagram', 'map', 'chart', 'graph', 'shape', 'flowchart', 'illustration', 'table', 'number_line'].includes(String(question.visual_spec?.asset_type || '').toLowerCase()) ? String(question.visual_spec?.asset_type || '').toLowerCase() : 'illustration', source_kind: 'generated', visual_spec: question.visual_spec ? { ...question.visual_spec, rendered_data_url: question.image_url || null } : {}, alt_text: `Generated visual for ${paper.subject} question`, caption: typeof question.visual_spec?.caption === 'string' ? question.visual_spec.caption.slice(0, 500) : null, approval_status: 'draft', created_by: user.id,
      })));
      if (visualError) throw new Error(`Could not save generated visual metadata: ${visualError.message}`);
    }
    if (generationJobId) {
      await supabase.from('exam_generation_jobs').update({ status: 'ready', result_paper_id: paperId, updated_at: new Date().toISOString() }).eq('id', generationJobId);
    }
    if (paperId) {
      await supabase.from('exam_audit_events').insert({ school_id: profile.school_id, actor_id: user.id, event_type: 'paper_generated', entity_type: 'exam_paper', entity_id: paperId, payload: { question_count: persistedQuestions.length, total_marks: paper.total_marks, validation: validation.issues } });
    }
    response.status(200).json({
      paper: { ...paper, id: paperId, status: 'draft', version_number: 1, validation_results: validation.issues, questions: persistedQuestions },
      sourceSummary: vetted.sourceSummary,
    });
  } catch (error) {
    if (generationJobId) {
      await supabase.from('exam_generation_jobs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown generation failure', updated_at: new Date().toISOString() }).eq('id', generationJobId);
    }
    const message = error instanceof DeepSeekConfigurationError || error instanceof DeepSeekResponseError || error instanceof GeminiConfigurationError || error instanceof GeminiResponseError
      ? error.message
      : error instanceof Error ? error.message : 'The exam could not be generated at this time.';
    jsonError(response, 502, message);
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    jsonError(response, 503, 'The secure exam service is not configured.');
    return;
  }

  const accessToken = readBearerToken(request.headers);
  if (!accessToken) {
    jsonError(response, 401, 'Sign in to generate an exam.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await (supabase.auth as any).getUser(accessToken);
  if (userError || !user) {
    jsonError(response, 401, 'Your session could not be verified. Please sign in again.');
    return;
  }

  // Get the authoritative profile. Do not create or infer a profile in a paid/content-generation path.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, school_id, role, first_name, last_name, email')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) {
    jsonError(response, 403, 'Your school profile could not be verified for Exam Generator access.');
    return;
  }
  if (!['teacher', 'school_admin'].includes(profile.role) || !profile.school_id) {
    jsonError(response, 403, 'Only school teachers and school administrators with an active school profile can generate exams.');
    return;
  }
  await handleExamGeneration(response, supabase as any, profile as ExamProfile, user, request);
}
