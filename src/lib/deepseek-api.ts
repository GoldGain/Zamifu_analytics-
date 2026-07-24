import {
  allocateQuestionBlueprint,
  makeExamTitle,
  type ExamGenerationRequest,
  type ExamPaper,
  type GeneratedExamQuestion,
  type QuestionType,
} from './exam-schema';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

interface DeepSeekChoice {
  message?: { content?: string | null };
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  error?: { message?: string };
}

export class DeepSeekConfigurationError extends Error {}
export class DeepSeekResponseError extends Error {}

function toSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function toSafeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function normalizeQuestionType(value: unknown, fallback: QuestionType): QuestionType {
  const allowed = new Set<QuestionType>([
    'multiple_choice', 'multiple_response', 'modified_true_false', 'completion',
    'matching', 'short_answer', 'numeric_response', 'case_study', 'essay',
  ]);
  return typeof value === 'string' && allowed.has(value as QuestionType) ? value as QuestionType : fallback;
}

function normalizeDifficulty(value: unknown, fallback: 'easy' | 'medium' | 'hard'): 'easy' | 'medium' | 'hard' {
  return value === 'easy' || value === 'medium' || value === 'hard' ? value : fallback;
}

function normalizeQuestion(raw: unknown, fallbackType: QuestionType, fallbackDifficulty: 'easy' | 'medium' | 'hard'): GeneratedExamQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const questionText = toSafeString(item.question_text);
  if (!questionText) return null;
  const marksValue = Number(item.marks);
  const marks = Number.isFinite(marksValue) && marksValue > 0 && marksValue <= 30 ? Math.round(marksValue) : 1;
  return {
    question_type: normalizeQuestionType(item.question_type, fallbackType),
    question_text: questionText.slice(0, 1800),
    options: toSafeArray(item.options).slice(0, 8),
    correct_answer: toSafeString(item.correct_answer, 'Teacher to assess according to the marking guidance.').slice(0, 1200),
    marking_scheme: toSafeString(item.marking_scheme, toSafeString(item.correct_answer, 'Teacher to assess according to the marking guidance.')).slice(0, 1800),
    marks,
    difficulty: normalizeDifficulty(item.difficulty, fallbackDifficulty),
    strand: toSafeString(item.strand).slice(0, 180),
    sub_strand: toSafeString(item.sub_strand).slice(0, 180),
    topic: toSafeString(item.topic).slice(0, 180),
    image_url: null,
    source_website: null,
  };
}

function fallbackDifficulty(request: ExamGenerationRequest): 'easy' | 'medium' | 'hard' {
  return request.difficulty === 'mixed' ? 'medium' : request.difficulty;
}

function buildExamPrompt(request: ExamGenerationRequest, knowledgeContext: string): string {
  const blueprint = allocateQuestionBlueprint(request);
  const selectedStrands = request.strands.length ? request.strands.join('; ') : 'Use the selected curriculum topic context.';
  const selectedSubStrands = request.subStrands.length ? request.subStrands.join('; ') : 'Not separately constrained.';
  const selectedTopics = request.topics.length ? request.topics.join('; ') : 'Not separately constrained.';
  const imageDirection = request.includeImages
    ? 'At most two questions may need a simple instructional visual. For each visual, write a concise image_prompt field. Do not invent an image URL.'
    : 'Do not require any images.';

  return `You are a senior Kenyan CBE/CBC assessment specialist. Create an original, age-appropriate, classroom-ready assessment. Do not reproduce copyrighted questions, proprietary marking schemes, or web text. Align questions to the stated grade, subject, strand, sub-strand, and topics. Use inclusive language, realistic Kenyan classroom contexts where suitable, clear command words, and internally consistent marks.\n\nAssessment context:\n- Grade: ${request.gradeLevel}\n- Subject: ${request.subject}\n- Strand(s): ${selectedStrands}\n- Sub-strand(s): ${selectedSubStrands}\n- Topic(s): ${selectedTopics}\n- Format: ${request.format.toUpperCase()}\n- Difficulty: ${request.difficulty}\n- Total marks target: ${request.totalMarks}\n- Duration: ${request.durationMinutes} minutes\n- Required question blueprint: ${blueprint.map((entry) => `${entry.count} ${entry.type} items totaling about ${entry.marks} marks`).join('; ')}\n- ${imageDirection}\n\nVetted internal curriculum context (use only as high-level guidance; do not quote it verbatim):\n${knowledgeContext || 'No additional knowledge records were supplied. Use established CBE assessment practice and the selected curriculum context.'}\n\nReturn json only. Use exactly this object shape:\n{\n  "title": "string",\n  "instructions": ["string"],\n  "questions": [\n    {\n      "question_type": "multiple_choice | multiple_response | modified_true_false | completion | matching | short_answer | numeric_response | case_study | essay",\n      "question_text": "string",\n      "options": ["string"],\n      "correct_answer": "string",\n      "marking_scheme": "string",\n      "marks": 1,\n      "difficulty": "easy | medium | hard",\n      "strand": "string",\n      "sub_strand": "string",\n      "topic": "string",\n      "image_prompt": "string or empty"\n    }\n  ]\n}\nThe word json is intentionally included to enable structured JSON output.`;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object.');
    return parsed as Record<string, unknown>;
  } catch {
    throw new DeepSeekResponseError('The AI response could not be parsed as the requested structured JSON. Please try again.');
  }
}

export async function generateExamWithDeepSeek(request: ExamGenerationRequest, knowledgeContext = ''): Promise<ExamPaper> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekConfigurationError('The exam-generation service is not configured. Add DEEPSEEK_API_KEY to the server environment.');
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
      messages: [
        { role: 'system', content: 'You create original, curriculum-aligned Kenyan school assessments. Return valid json only.' },
        { role: 'user', content: buildExamPrompt(request, knowledgeContext) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.45,
      max_tokens: 7000,
      stream: false,
    }),
  });

  const payload = await response.json().catch(() => ({})) as DeepSeekResponse;
  if (!response.ok) {
    const providerMessage = payload.error?.message || `The AI service returned status ${response.status}.`;
    throw new DeepSeekResponseError(providerMessage);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new DeepSeekResponseError('The AI service returned an empty response. Please try again.');

  const parsed = parseJsonObject(content);
  const fallbackType = request.questionTypes[0] || 'multiple_choice';
  const normalizedQuestions = Array.isArray(parsed.questions)
    ? parsed.questions.map((entry) => normalizeQuestion(entry, fallbackType, fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
    : [];

  if (!normalizedQuestions.length) {
    throw new DeepSeekResponseError('The AI service did not provide any valid questions. Please try again with a narrower curriculum selection.');
  }

  const targetQuestionLimit = Math.min(60, Math.max(3, Math.ceil(request.totalMarks / 1)));
  const questions = normalizedQuestions.slice(0, targetQuestionLimit).map((question, index) => ({ ...question, question_number: index + 1 }));
  const computedMarks = questions.reduce((sum, question) => sum + question.marks, 0);

  return {
    title: toSafeString(parsed.title, makeExamTitle(request)).slice(0, 255),
    school_name: request.schoolName || undefined,
    grade_level: request.gradeLevel,
    subject: request.subject,
    term: request.term || undefined,
    year: new Date().getFullYear(),
    duration_minutes: request.durationMinutes,
    total_marks: computedMarks || request.totalMarks,
    instructions: toSafeArray(parsed.instructions).slice(0, 8),
    questions,
    format: request.format,
    generated_at: new Date().toISOString(),
  };
}
