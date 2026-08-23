import {
  allocateQuestionBlueprint,
  makeExamTitle,
  type ExamGenerationRequest,
  type ExamPaper,
  type GeneratedExamQuestion,
  type QuestionType,
} from './exam-schema.js';
import { hasCompleteTableVisual, hasUsableVisualSpec } from './exam-visuals.js';

interface DeepSeekChoice {
  message?: { content?: unknown; reasoning_content?: string | null };
  text?: unknown;
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  error?: { message?: string };
}

export class DeepSeekConfigurationError extends Error {}
export class DeepSeekResponseError extends Error {}

function readMessageContent(payload: DeepSeekResponse): string {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'string' ? part : part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (typeof choice?.text === 'string') return choice.text.trim();
  return '';
}

function waitBeforeRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
}

function toSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanOption(value: string): string {
  // Providers sometimes return the display label ("A.", "B.", …) even
  // though the renderer adds that label. Strip only an explicit option prefix
  // so legitimate answers such as "A number greater than five" are preserved.
  return value.trim().replace(/^(?:[A-Ha-h][.)]|\([A-Ha-h]\))\s*/, '').trim();
}

function toSafeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map(cleanOption).filter(Boolean)
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

export function normalizeQuestion(raw: unknown, fallbackType: QuestionType, fallbackDifficulty: 'easy' | 'medium' | 'hard'): GeneratedExamQuestion | null {
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
    learning_outcome: toSafeString(item.learning_outcome).slice(0, 500),
    competency: toSafeString(item.competency).slice(0, 180),
    cognitive_level: toSafeString(item.cognitive_level).slice(0, 80),
    image_url: null,
    source_website: null,
    visual_spec: item.visual_spec && typeof item.visual_spec === 'object'
      ? item.visual_spec as Record<string, unknown>
      : null,
  };
}

export function fallbackDifficulty(request: ExamGenerationRequest): 'easy' | 'medium' | 'hard' {
  return request.difficulty === 'mixed' ? 'medium' : request.difficulty;
}

export function outputTokenBudget(request: ExamGenerationRequest, compact = false): number {
  const scaled = request.totalMarks * (compact ? 110 : 160);
  return Math.min(compact ? 10000 : 14000, Math.max(compact ? 5500 : 7000, scaled));
}

export function alignQuestionsToBlueprint(request: ExamGenerationRequest, questions: GeneratedExamQuestion[]): GeneratedExamQuestion[] {
  const sections = request.blueprint?.sections || [];
  if (!sections.length) return questions;
  const markSequence = sections.flatMap((section) => Array.from({ length: section.count }, () => section.marks_per_question));
  return questions.slice(0, markSequence.length).map((question, index) => ({
    ...question,
    marks: markSequence[index] || question.marks,
  }));
}

const markFlexibility: Record<QuestionType, number> = {
  essay: 9,
  case_study: 8,
  short_answer: 7,
  numeric_response: 6,
  matching: 5,
  completion: 4,
  multiple_response: 3,
  modified_true_false: 2,
  multiple_choice: 1,
};

/**
 * Reconcile provider-supplied marks when a request has no explicit blueprint.
 * Blueprint requests are already aligned to their exact mark sequence above.
 * For flexible CBE/custom requests, adjust one mark at a time, preferring
 * response types that can legitimately carry developed marking guidance, while
 * keeping every question within the 1–30 mark schema bounds.
 */
export function reconcileQuestionMarks(request: ExamGenerationRequest, questions: GeneratedExamQuestion[]): GeneratedExamQuestion[] {
  const aligned = alignQuestionsToBlueprint(request, questions);
  if (request.blueprint?.sections.length || !aligned.length || request.totalMarks <= 0) return aligned;
  let delta = Math.round(request.totalMarks) - aligned.reduce((sum, question) => sum + question.marks, 0);
  if (delta === 0) return aligned;

  const adjusted = aligned.map((question) => ({ ...question }));
  const indices = adjusted.map((question, index) => index).sort((left, right) => {
    const flexibility = markFlexibility[adjusted[right].question_type] - markFlexibility[adjusted[left].question_type];
    return flexibility || adjusted[right].marks - adjusted[left].marks || right - left;
  });
  while (delta !== 0) {
    let changed = false;
    for (const index of indices) {
      const question = adjusted[index];
      if (delta > 0 && question.marks < 30) {
        question.marks += 1;
        delta -= 1;
        changed = true;
      } else if (delta < 0 && question.marks > 1) {
        question.marks -= 1;
        delta += 1;
        changed = true;
      }
      if (delta === 0) break;
    }
    if (!changed) break;
  }
  if (delta !== 0) {
    throw new DeepSeekResponseError(`The generated questions could not be reconciled to the requested ${request.totalMarks} marks.`);
  }
  return adjusted;
}

export function buildExamPrompt(request: ExamGenerationRequest, knowledgeContext: string): string {
  const blueprint = allocateQuestionBlueprint(request);
  const selectedStrands = request.strands.length ? request.strands.join('; ') : 'Use the selected curriculum topic context.';
  const selectedSubStrands = request.subStrands.length ? request.subStrands.join('; ') : 'Not separately constrained.';
  const selectedTopics = request.topics.length ? request.topics.join('; ') : 'Not separately constrained.';
  const curriculumScope = request.curriculumScope?.length
    ? request.curriculumScope.map((node) => `${node.strand} -> ${node.subStrands.join(', ') || 'all sub-strands'} -> ${node.topics.join(', ') || 'all topics'}`).join(' | ')
    : 'Use the selected strand, sub-strand, and topic names only.';
  const variationInstruction = request.variationKey
    ? `Generation variation key: ${request.variationKey}. Treat this as a new paper, not a rewrite of a previous paper.`
    : 'Create a fresh paper variation; do not reuse a memorized template.';
  const avoidedStems = request.avoidQuestionStems?.length
    ? request.avoidQuestionStems.slice(0, 40).map((stem) => `- ${stem.slice(0, 220)}`).join('\n')
    : 'None supplied.';
  const imageDirection = request.includeImages
    ? 'Visual questions are enabled. Include at least one question with a complete structured visual_spec object, but add visual_spec ONLY when the question stem or its sub-parts explicitly require the learner to study, interpret, label, compare, or use a diagram, map, graph, chart, table, flowchart, illustration, picture, image, or number line. For simple recall, multiple-choice, completion, or short-answer questions that do not explicitly require a visual, set visual_spec to null. Never add a generic placeholder visual merely because visuals are enabled. Do not invent an image URL. Prefer precise schematic visuals and static map specifications suitable for a printable exam. For every table visual, provide table_headers with at least two headers and table_rows containing every complete learner-facing row and cell, including all numeric values needed to answer the question; never provide x_labels alone or leave required cells for the renderer to guess. If a visual_spec is present, do not repeat the same Markdown table or bracketed diagram placeholder in question_text; write a concise instruction such as “Study the visual below” and put all labels, readings, units, and values in the structured visual_spec. For measurement diagrams, include precise labels and readings such as graduated scales, water levels, units, and objects; never return a generic decorative rectangle/circle/triangle placeholder.'
    : 'Do not require any images, but preserve a visual_spec only when the question stem explicitly requires a visual to answer the question. If a visual_spec is present, do not repeat its table or bracketed diagram placeholder in question_text.';
  const outcomes = request.learningOutcomes?.length ? request.learningOutcomes.join('; ') : 'Not separately constrained.';
  const competencies = request.competencies?.length ? request.competencies.join('; ') : 'Use suitable CBC core competencies.';
  const formatDirection = request.format === 'kpsea'
    ? 'KPSEA-STYLE REQUIREMENTS: Prefer a clean objective assessment structure. When the blueprint uses multiple_choice, each such item must have exactly four plausible options labelled A, B, C and D, one correct answer, and concise age-appropriate wording. Include answer-sheet guidance in the instructions. Use visual stimuli only when they are genuinely required by the question.'
    : request.format === 'kjsea'
      ? 'KJSEA-STYLE REQUIREMENTS: Prefer structured, scenario-based tasks. Use large numbered questions with lettered sub-parts and roman-numbered sub-items where the blueprint allows. Integrate practical procedures, labelled diagrams, tables, data interpretation, calculations, and extended responses when they fit the selected curriculum. Give marks that add up exactly to each main question and use concise line breaks between sub-parts.'
      : 'Use a clear school-based CBC assessment structure with labelled sections and marks.';
  const blueprintText = request.blueprint?.sections.length
    ? JSON.stringify(request.blueprint.sections.map((section) => ({ type: section.question_type, count: section.count, marks_per_question: section.marks_per_question, difficulty: section.difficulty, strand: section.strand, sub_strand: section.sub_strand, topic: section.topic, competency: section.competency })))
    : blueprint.map((entry) => `${entry.count} ${entry.type} items totaling about ${entry.marks} marks`).join('; ');

  return `You are a senior Kenyan CBE/CBC assessment specialist. Create an original, age-appropriate, classroom-ready assessment. Do not reproduce copyrighted questions, proprietary marking schemes, or web text. Align questions to the stated grade, subject, strand, sub-strand, and topics. Use inclusive language, realistic Kenyan classroom contexts where suitable, clear command words, and internally consistent marks.\n\nOriginality and variation requirements:\n- ${variationInstruction}\n- Change the contexts, names, numbers, data, command words, cognitive demand, and question order where appropriate. Do not copy or lightly paraphrase any avoided stem.\n- Avoid repeated stock openings and avoid using the same examples across questions unless the blueprint deliberately requests a shared case study.\n\nStrict curriculum ancestry law:\n- Treat the curriculum as a hierarchy: strand -> child sub-strand -> child topic.\n- Every question must use a strand from the selected strand set, a sub-strand that belongs to that strand, and a topic that belongs to that sub-strand.\n- If selected topics are provided, every question topic must be one of those selected topics. Never attach a correct-looking label from a different strand or sub-strand.\n- Curriculum scope map: ${curriculumScope}\n\nAvoided question stems from recent papers:\n${avoidedStems}\n\nAssessment context:\n- Grade: ${request.gradeLevel}\n- Subject: ${request.subject}\n- Strand(s): ${selectedStrands}\n- Sub-strand(s): ${selectedSubStrands}\n- Topic(s): ${selectedTopics}\n- Format: ${request.format.toUpperCase()}\n- Format guidance: ${formatDirection}\n- Difficulty: ${request.difficulty}\n- Total marks target: ${request.totalMarks}\n- Duration: ${request.durationMinutes} minutes\n- Required question blueprint: ${blueprintText}\n- Learning outcomes: ${outcomes}\n- Competencies: ${competencies}\n- ${imageDirection}\n\nVetted internal curriculum context (use only as high-level guidance; do not quote it verbatim):\n${knowledgeContext || 'No additional knowledge records were supplied. Use established CBE assessment practice and the selected curriculum context.'}\n\nReturn json only. Use exactly this object shape:\n{\n  "title": "string",\n  "instructions": ["string"],\n  "questions": [\n    {\n      "question_type": "multiple_choice | multiple_response | modified_true_false | completion | matching | short_answer | numeric_response | case_study | essay",\n      "question_text": "string",\n      "options": ["string"],\n      "correct_answer": "string",\n      "marking_scheme": "string",\n      "marks": 1,\n      "difficulty": "easy | medium | hard",\n      "strand": "string",\n      "sub_strand": "string",\n      "topic": "string",\n      "learning_outcome": "string or empty",\n      "competency": "string or empty",\n      "cognitive_level": "remember | understand | apply | analyse | evaluate | create",\n            "visual_spec": {"asset_type":"diagram | map | chart | graph | shape | flowchart | illustration | table | number_line", "title":"string", "prompt":"string", "caption":"string", "labels":["string"], "x_labels":["string"], "values":[number], "table_headers":["string"], "table_rows":[["string or number"]], "map_regions":["string"]} or null
\n    }\n  ]\n}\nFor every question that does not explicitly require a visual, use null for visual_spec. Keep every field concise, do not repeat the instructions, and do not add commentary outside the JSON object. The word json is intentionally included to enable structured JSON output.`;
}

export function extractJsonFromContent(content: string): Record<string, unknown> | null {
  // Strategy 1: Try direct parse of the full content
  try {
    const direct = JSON.parse(content);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
  } catch {}

  // Strategy 2: Strip markdown code fences and try again
  const fenced = content
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();
  try {
    const fencedParsed = JSON.parse(fenced);
    if (fencedParsed && typeof fencedParsed === 'object' && !Array.isArray(fencedParsed)) return fencedParsed;
  } catch {}

  // Strategy 3: Find the first { and last } and parse that substring
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const substring = content.slice(firstBrace, lastBrace + 1);
    try {
      const extracted = JSON.parse(substring);
      if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) return extracted;
    } catch {}

    // Strategy 4: Try fixing common JSON issues — escaped newlines in strings
    let fixed = substring
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    try {
      const fixedParsed = JSON.parse(fixed);
      if (fixedParsed && typeof fixedParsed === 'object' && !Array.isArray(fixedParsed)) return fixedParsed;
    } catch {}
  }

  // Strategy 5: Try to find JSON arrays (in case response is just the questions array)
  const firstBracket = content.indexOf('[');
  const lastBracket = content.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const arrayStr = content.slice(firstBracket, lastBracket + 1);
    try {
      const arr = JSON.parse(arrayStr);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
        return { questions: arr, title: 'Generated Exam', instructions: [] };
      }
    } catch {}
  }

  return null;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const result = extractJsonFromContent(content);
  if (result) return result;
  throw new DeepSeekResponseError('The AI response could not be parsed as the requested structured JSON. Please try again.');
}

export async function generateExamWithDeepSeek(request: ExamGenerationRequest, knowledgeContext = ''): Promise<ExamPaper> {
  // Prefer the explicitly configured DeepSeek credential in production. The platform
  // may also expose an OpenAI-compatible proxy key, but that proxy catalog does not
  // contain DeepSeek model IDs and can return an empty 200 response for them.
  const deepSeekKey = process.env.DEEPSEEK_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const useDeepSeek = Boolean(deepSeekKey);
  const apiKey = useDeepSeek ? deepSeekKey : openAiKey;
  if (!apiKey) {
    throw new DeepSeekConfigurationError('The exam-generation service is not configured. Add OPENAI_API_KEY or DEEPSEEK_API_KEY to the server environment.');
  }

  // Compute endpoint at call time (not module load) to ensure env vars are available.
  const endpoint = useDeepSeek
    ? `${(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`
    : `${(process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;

  // Keep the proven production default unless an administrator explicitly
  // chooses another model. This avoids breaking existing deployments whose key
  // is enabled for DeepSeek's compatibility alias but not a newly released V4 id.
  const configuredModel = process.env.AI_EXAM_MODEL || process.env.DEEPSEEK_MODEL || '';
  const modelName = useDeepSeek ? (configuredModel || 'deepseek-chat') : (configuredModel || 'gpt-5-mini');
  const fallbackModel = useDeepSeek
    ? (process.env.AI_EXAM_FALLBACK_MODEL || (modelName === 'deepseek-chat' ? 'deepseek-v4-pro' : 'deepseek-chat'))
    : modelName;

  console.log('[exam-gen] endpoint:', endpoint);
  console.log('[exam-gen] model:', modelName);
  console.log('[exam-gen] key type:', apiKey.startsWith('eyJ') ? 'jwt' : apiKey.startsWith('sk-') ? 'sk-key' : `other(${apiKey.length}chars)`);

  const prompt = buildExamPrompt(request, knowledgeContext);
  let parsed: Record<string, unknown> | null = null;
  let lastFailure = '';
  const attemptPlans = [
    { model: modelName, maxTokens: outputTokenBudget(request), useJsonMode: true },
    { model: modelName, maxTokens: outputTokenBudget(request, true), useJsonMode: false },
    { model: fallbackModel, maxTokens: outputTokenBudget(request, true), useJsonMode: false },
  ];

  for (let attempt = 0; attempt < attemptPlans.length && !parsed; attempt += 1) {
    const plan = attemptPlans[attempt];
    const retryInstruction = attempt === 0
      ? ''
      : attempt === 1
        ? '\n\nRECOVERY REQUIREMENT: The previous provider response was unusable. Return a complete, concise JSON object now. Do not omit questions, do not return an empty message, do not use markdown fences, and keep every field concise enough to fit the requested paper.'
        : '\n\nFINAL RECOVERY REQUIREMENT: Produce the complete paper in the exact JSON shape now. Prioritise all required questions, marks, answers, and marking guidance. Use short sentences, empty strings for optional metadata when necessary, and visual_spec null unless the stem explicitly requires a visual. Return JSON only.';
    const requestPayload: Record<string, unknown> = {
      model: plan.model,
      messages: [
        { role: 'system', content: 'You are a strict JSON API. Return ONLY a JSON object with no markdown, no code fences, no explanation text, no preamble. The response must be parseable JSON.' },
        { role: 'user', content: `${prompt}${retryInstruction}` },
      ],
      temperature: attempt === 0 ? 0.7 : 0.35,
      max_tokens: plan.maxTokens,
      stream: false,
    };
    // DeepSeek's JSON mode is useful for the first attempt. The recovery paths
    // intentionally omit it so a transient empty structured response can recover.
    if (plan.useJsonMode) requestPayload.response_format = { type: 'json_object' };
    const body = JSON.stringify(requestPayload);
    console.log('[exam-gen] attempt:', attempt + 1, 'model:', plan.model, 'request body length:', body.length, 'max_tokens:', plan.maxTokens);

    const timeoutMs = attempt === 0 ? 45000 : 35000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: controller.signal,
      });
      const rawText = await response.text().catch(() => '');
      console.log('[exam-gen] attempt:', attempt + 1, 'status:', response.status, 'response length:', rawText.length);
      if (!rawText.trim()) {
        throw new DeepSeekResponseError(`The AI service returned an empty response on attempt ${attempt + 1} (status ${response.status}).`);
      }

      let payload: DeepSeekResponse;
      try {
        payload = JSON.parse(rawText) as DeepSeekResponse;
      } catch {
        throw new DeepSeekResponseError(`The AI service returned an invalid response (status ${response.status}).`);
      }
      if (!response.ok) {
        const providerMessage = payload.error?.message || `The AI service returned status ${response.status}.`;
        throw new DeepSeekResponseError(providerMessage);
      }

      const content = readMessageContent(payload);
      console.log('[exam-gen] attempt:', attempt + 1, 'content preview:', content.slice(0, 200));
      if (!content) throw new DeepSeekResponseError(`The AI service returned an empty response on attempt ${attempt + 1}.`);
      const candidate = parseJsonObject(content);
      const candidateQuestions = Array.isArray(candidate.questions)
        ? candidate.questions.map((entry) => normalizeQuestion(entry, request.questionTypes[0] || 'multiple_choice', fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
        : [];
      if (!candidateQuestions.length) throw new DeepSeekResponseError('The AI service did not provide any valid questions.');
      if (candidateQuestions.some((question) => !hasCompleteTableVisual(question))) {
        throw new DeepSeekResponseError('The AI response included an incomplete table visual. Retry with table_headers and every table_rows cell required by the question.');
      }
      if (candidateQuestions.some((question) => question.visual_spec && !hasUsableVisualSpec(question))) {
        throw new DeepSeekResponseError('The AI response included an incomplete visual specification. Retry with readable labels or complete data for every required diagram, map, graph, chart, flowchart, table, or number line.');
      }
      parsed = candidate;
    } catch (error) {
      lastFailure = error instanceof Error && error.name === 'AbortError'
        ? `The AI service timed out after ${timeoutMs / 1000} seconds.`
        : error instanceof Error ? error.message : 'Unknown provider failure.';
      console.error('[exam-gen] attempt failed:', attempt + 1, plan.model, lastFailure.slice(0, 300));
      if (error instanceof DeepSeekConfigurationError) throw error;
      if (attempt < attemptPlans.length - 1) {
        await waitBeforeRetry(attempt);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!parsed) {
    const detail = lastFailure ? ` Last provider detail: ${lastFailure.slice(0, 260)}` : '';
    throw new DeepSeekResponseError(`The AI service did not return a usable exam response after three attempts. Please retry; your selected blueprint and curriculum choices were not lost.${detail}`);
  }
  const fallbackType = request.questionTypes[0] || 'multiple_choice';
  const normalizedQuestions = Array.isArray(parsed.questions)
    ? parsed.questions.map((entry) => normalizeQuestion(entry, fallbackType, fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
    : [];
  const blueprintAlignedQuestions = reconcileQuestionMarks(request, normalizedQuestions);

  if (!blueprintAlignedQuestions.length) {
    throw new DeepSeekResponseError('The AI service did not provide any valid questions. Please try again with a narrower curriculum selection.');
  }

  const targetQuestionLimit = Math.min(60, Math.max(3, Math.ceil(request.totalMarks / 1)));
  const questions = blueprintAlignedQuestions.slice(0, targetQuestionLimit).map((question, index) => ({ ...question, question_number: index + 1 }));
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
