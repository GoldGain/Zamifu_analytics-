import {
  makeExamTitle,
  type ExamGenerationRequest,
  type ExamPaper,
  type GeneratedExamQuestion,
  type GeneratedExamSubPart,
  type QuestionType,
} from './exam-schema.js';
import { DETERMINISTIC_SCIENCE_VISUAL_RULES, hasCompleteTableVisual, hasUsableVisualSpec } from './exam-visuals.js';
import {
  answerCompletenessLaw,
  buildCoveragePlanFromRequest,
  coverageInstruction,
  kjseaFormatLaw,
  mapWorkLaw,
  mathNotationLaw,
  normalizeMathNotation,
  paperVariantLaw,
} from './exam-construction.js';
import { kjseaFormatInstruction } from './kjsea-paper-formats.js';
import {
  blueprintSlotKey,
  bindQuestionToSlot,
  describeBlueprintSlot,
  expectedExamMarks,
  getExamBlueprintSlots,
  hasFixedBlueprint,
  questionBlueprintId,
  questionBlueprintItemIndex,
  questionBlueprintNumber,
  questionMatchesBlueprintSlot,
  type ExamBlueprintSlot,
} from './exam-generation-contract.js';
import { questionLacksAnswer } from './exam-construction.js';

interface DeepSeekChoice {
  message?: { content?: unknown; reasoning_content?: string | null };
  text?: unknown;
  finish_reason?: string | null;
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

function normalizeSubParts(value: unknown): GeneratedExamSubPart[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    // Keep complete extracts and practical instructions; do not cut at an
    // arbitrary character boundary. The generous bound only protects storage.
    const prompt = toSafeString(item.prompt).slice(0, 6000);
    const marksValue = Number(item.marks);
    if (!prompt || !Number.isFinite(marksValue) || marksValue < 1 || marksValue > 30) return [];
    return [{
      label: toSafeString(item.label, `(${String.fromCharCode(97 + index)})`).slice(0, 12),
      prompt,
      marks: Math.round(marksValue),
      correct_answer: toSafeString(item.correct_answer).slice(0, 5000),
      marking_scheme: toSafeString(item.marking_scheme, toSafeString(item.correct_answer)).slice(0, 6000),
    }];
  });
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
  const normalized: GeneratedExamQuestion & Record<string, unknown> = {
    question_type: normalizeQuestionType(item.question_type, fallbackType),
    // Passages, extracts, and practical instructions must not be silently cut
    // at the former 1,800-character boundary.
    question_text: normalizeMathNotation(questionText),
    options: toSafeArray(item.options).slice(0, 8),
    correct_answer: toSafeString(item.correct_answer, 'Teacher to assess according to the marking guidance.').slice(0, 5000),
    marking_scheme: toSafeString(item.marking_scheme, toSafeString(item.correct_answer, 'Teacher to assess according to the marking guidance.')).slice(0, 6000),
    marks,
    sub_parts: normalizeSubParts(item.sub_parts),
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
  const sectionId = toSafeString(item.blueprint_section_id || item.section_id);
  const sectionTitle = toSafeString(item.blueprint_section_title || item.component_title);
  const itemIndex = Number(item.blueprint_item_index);
  const questionNumber = Number(item.blueprint_question_number);
  if (sectionId) normalized.blueprint_section_id = sectionId;
  if (sectionTitle) normalized.blueprint_section_title = sectionTitle;
  if (Number.isInteger(itemIndex) && itemIndex >= 0) normalized.blueprint_item_index = itemIndex;
  if (Number.isInteger(questionNumber) && questionNumber > 0) normalized.blueprint_question_number = questionNumber;
  return normalized;
}

export function fallbackDifficulty(request: ExamGenerationRequest): 'easy' | 'medium' | 'hard' {
  return request.difficulty === 'mixed' ? 'medium' : request.difficulty;
}

export function outputTokenBudget(request: ExamGenerationRequest, compact = false): number {
  const largeKjseaPaper = request.format === 'kjsea' && request.totalMarks >= 50;
  const scaled = request.totalMarks * (compact ? 110 : 160);
  const maximum = compact ? (largeKjseaPaper ? 16000 : 10000) : (largeKjseaPaper ? 20000 : 14000);
  const minimum = compact ? (largeKjseaPaper ? 10000 : 5500) : (largeKjseaPaper ? 12000 : 7000);
  return Math.min(maximum, Math.max(minimum, scaled));
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
  // A fixed official blueprint is a content contract, not a display hint. Do
  // not change a provider's marks to make a wrong component appear compliant;
  // the focused recovery path must replace the mismatched slot instead.
  if (request.blueprint?.sections.length) return questions;
  const aligned = alignQuestionsToBlueprint(request, questions);
  if (!aligned.length || request.totalMarks <= 0) return aligned;
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
  let imageDirection = request.includeImages
    ? 'Visual questions are enabled. Include at least one question with a complete structured visual_spec object, but add visual_spec ONLY when the question stem or its sub-parts explicitly require the learner to study, interpret, label, compare, or use a diagram, map, graph, chart, table, flowchart, illustration, picture, image, or number line. For simple recall, multiple-choice, completion, or short-answer questions that do not explicitly require a visual, set visual_spec to null. Never add a generic placeholder visual merely because visuals are enabled. Do not invent an image URL. Prefer precise printable diagrams and deterministic vector map specifications. For every map visual, provide base_map, map_regions, labels, legend, scale_text, and compass. For every table visual, provide table_headers with at least two headers and table_rows containing every complete learner-facing row and cell, including all numeric values needed to answer the question; never provide x_labels alone or leave required cells for the renderer to guess. If a visual_spec is present, do not repeat the same Markdown table or bracketed diagram placeholder in question_text; write a concise instruction such as “Study the visual below” and put all labels, readings, units, and values in the structured visual_spec. For measurement diagrams, include precise labels and readings such as graduated scales, water levels, units, and objects; never return a generic decorative rectangle/circle/triangle placeholder.'
    : 'Do not require any images, but preserve a visual_spec only when the question stem explicitly requires a visual to answer the question. If a visual_spec is present, do not repeat its table or bracketed diagram placeholder in question_text.';
  const outcomes = request.learningOutcomes?.length ? request.learningOutcomes.join('; ') : 'Not separately constrained.';
  if(request.includeImages)imageDirection+=DETERMINISTIC_SCIENCE_VISUAL_RULES;
  const competencies = request.competencies?.length ? request.competencies.join('; ') : 'Use suitable CBC core competencies.';
  const formatDirection = request.format === 'standard30'
    ? 'STANDARD 30-MARK REQUIREMENTS: Produce exactly 10 Section A multiple-choice questions worth 1 mark each, followed by exactly 4 Section B structured questions worth 5 marks each. The structured questions may use lettered sub-parts when useful, and every main question must total its blueprint marks.'
    : request.format === 'kpsea'
    ? 'KPSEA-STYLE REQUIREMENTS: Prefer a clean objective assessment structure. When the blueprint uses multiple_choice, each such item must have exactly four plausible options labelled A, B, C and D, one correct answer, and concise age-appropriate wording. Include answer-sheet guidance in the instructions. Use visual stimuli only when they are genuinely required by the question.'
    : request.format === 'kjsea'
      ? kjseaFormatInstruction(request.subject, request.paperVariant || 'single')
      : 'Use a clear school-based CBC assessment structure with labelled sections and marks.';
  const blueprintSlots = getExamBlueprintSlots(request);
  const blueprintText = JSON.stringify(blueprintSlots.map((slot) => ({
    question_number: slot.questionNumber,
    blueprint_section_id: slot.id,
    component_title: slot.title,
    question_type: slot.questionType,
    marks: slot.marks,
    difficulty: slot.difficulty,
    strand: slot.strand || '',
    sub_strand: slot.subStrand || '',
    topic: slot.topic || '',
    competency: slot.competency || '',
  })));
  const coverageText = coverageInstruction(buildCoveragePlanFromRequest(request));
  const notationLaw = mathNotationLaw();
  const answerLaw = answerCompletenessLaw();
  const variantLaw = paperVariantLaw(request);
  const kjseaLaw = request.format === 'kjsea'
    ? kjseaFormatInstruction(request.subject, request.paperVariant || 'single')
    : kjseaFormatLaw(request);
  const mapLaw = mapWorkLaw(request);

  return `You are a senior Kenyan CBE/CBC assessment specialist. Create an original, age-appropriate, classroom-ready assessment. Do not reproduce copyrighted questions, proprietary marking schemes, or web text. Align questions to the stated grade, subject, strand, sub-strand, and topics. Use inclusive language, realistic Kenyan classroom contexts where suitable, clear command words, and internally consistent marks.\n\nOriginality and variation requirements:\n- ${variationInstruction}\n- Change the contexts, names, numbers, data, command words, cognitive demand, and question order where appropriate. Do not copy or lightly paraphrase any avoided stem.\n- Avoid repeated stock openings and avoid using the same examples across questions unless the blueprint deliberately requests a shared case study.\n\nStrict curriculum ancestry law:\n- Treat the curriculum as a hierarchy: strand -> child sub-strand -> child topic.\n- Every question must use a strand from the selected strand set, a sub-strand that belongs to that strand, and a topic that belongs to that sub-strand.\n- If selected topics are provided, every question topic must be one of those selected topics. Never attach a correct-looking label from a different strand or sub-strand.\n- Curriculum scope map: ${curriculumScope}\n\nAvoided question stems from recent papers:\n${avoidedStems}\n\nAssessment context:\n- Grade: ${request.gradeLevel}\n- Subject: ${request.subject}\n- Strand(s): ${selectedStrands}\n- Sub-strand(s): ${selectedSubStrands}\n- Topic(s): ${selectedTopics}\n- Format: ${request.format.toUpperCase()}\n- Format guidance: ${formatDirection}\n- Difficulty: ${request.difficulty}\n- Total marks target: ${request.totalMarks}\n- Duration: ${request.durationMinutes} minutes\n- Required question blueprint: ${blueprintText}\n- Full-paper contract: return exactly ${blueprintSlots.length} questions in the exact blueprint order and exactly ${expectedExamMarks(request)} total marks. Do not return a partial paper, a shortened paper, or extra questions.\n- Component binding contract: copy each slot's exact blueprint_section_id into blueprint_section_id, its component_title into blueprint_section_title, its question number into blueprint_question_number, and its zero-based item position within that section into blueprint_item_index. Never move a question to another component to hide a count or marks mismatch.\n- Every question must use the exact question_type and marks for its slot. A fixed official component is not satisfied by a differently typed question with a relabelled title.\n- Learning outcomes: ${outcomes}\n- Competencies: ${competencies}\n- ${imageDirection}\n\nCoverage requirement: ${coverageText}\n\nExam construction laws:\n- ${notationLaw}\n- ${answerLaw}\n- ${variantLaw}\n- ${kjseaLaw}\n- ${mapLaw}\n\nVetted internal curriculum context (use only as high-level guidance; do not quote it verbatim):\n${knowledgeContext || 'No additional knowledge records were supplied. Use established CBE assessment practice and the selected curriculum context.'}\n\nReturn json only. Use exactly this object shape:\n{\n  "title": "string",\n  "instructions": ["string"],\n  "questions": [\n    {\n      "question_type": "multiple_choice | multiple_response | modified_true_false | completion | matching | short_answer | numeric_response | case_study | essay",\n      "blueprint_section_id": "exact id from the required question blueprint",\n      "blueprint_section_title": "exact component title from the required question blueprint",\n      "blueprint_item_index": 0,\n      "blueprint_question_number": 1,\n      "question_text": "string",\n      "options": ["string"],\n      "correct_answer": "string",\n      "marking_scheme": "string",\n      "marks": 1,\n      "sub_parts": [{"label":"(a)","prompt":"string","marks":1,"correct_answer":"string","marking_scheme":"string"}],\n      "difficulty": "easy | medium | hard",\n      "strand": "string",\n      "sub_strand": "string",\n      "topic": "string",\n      "learning_outcome": "string or empty",\n      "competency": "string or empty",\n      "cognitive_level": "remember | understand | apply | analyse | evaluate | create",\n            "visual_spec": {"asset_type":"diagram | map | chart | graph | shape | flowchart | illustration | table | number_line", "title":"string", "prompt":"string", "caption":"string", "labels":["string"], "x_labels":["string"], "values":[number], "legend":["string"], "table_headers":["string"], "table_rows":[["string or number"]], "base_map":"kenya | east_africa | africa", "map_regions":["string"], "scale_text":"string", "compass":"North"} or null
\n    }\n  ]\n}\nFor every question that does not explicitly require a visual, use null for visual_spec. Keep every field concise, do not repeat the instructions, and do not add commentary outside the JSON object. The word json is intentionally included to enable structured JSON output.`;
}

export function extractJsonFromContent(content: string): Record<string, unknown> | null {
  // Strategy 1: Try direct parse of the full content
  try {
    const direct = JSON.parse(content);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
  } catch { /* Try fenced JSON next. */ }

  // Strategy 2: Strip markdown code fences and try again
  const fenced = content
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();
  try {
    const fencedParsed = JSON.parse(fenced);
    if (fencedParsed && typeof fencedParsed === 'object' && !Array.isArray(fencedParsed)) return fencedParsed;
  } catch { /* Try a bounded object substring next. */ }

  // Strategy 3: Find the first { and last } and parse that substring
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const substring = content.slice(firstBrace, lastBrace + 1);
    try {
      const extracted = JSON.parse(substring);
      if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) return extracted;
    } catch { /* Try escaped control characters next. */ }

    // Strategy 4: Try fixing common JSON issues — escaped newlines in strings
    const fixed = substring
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    try {
      const fixedParsed = JSON.parse(fixed);
      if (fixedParsed && typeof fixedParsed === 'object' && !Array.isArray(fixedParsed)) return fixedParsed;
    } catch { /* Try a questions-only array next. */ }
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
    } catch { /* No usable structured response was returned. */ }
  }

  return null;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const result = extractJsonFromContent(content);
  if (result) return result;
  throw new DeepSeekResponseError('The AI response could not be parsed as the requested structured JSON. Please try again.');
}

function candidateQuestionUsable(question: GeneratedExamQuestion | undefined, slot: ExamBlueprintSlot): boolean {
  if (!question || !questionMatchesBlueprintSlot(question, slot) || questionLacksAnswer(question)) return false;
  if (question.question_type !== 'multiple_choice') return true;
  const options = question.options || [];
  if (options.length !== 4 || new Set(options.map((option) => option.trim().toLowerCase())).size !== 4) return false;
  const answer = question.correct_answer.trim().toLowerCase().replace(/^(?:[a-h][.)]|\([a-h]\))\s*/i, '').trim();
  return options.some((option, index) => answer === option.trim().toLowerCase() || answer === String.fromCharCode(97 + index));
}

function missingBlueprintSlots(request: ExamGenerationRequest, questions: Array<GeneratedExamQuestion | undefined>): ExamBlueprintSlot[] {
  const slots = getExamBlueprintSlots(request);
  return slots.filter((slot, index) => !candidateQuestionUsable(questions[index], slot));
}

/**
 * Place provider items by their complete slot identity first. A section id is
 * intentionally not sufficient because a section commonly contains 20–50
 * repeated MCQ slots. Unannotated provider output remains positional for
 * backwards compatibility, but an explicitly indexed item is never reused.
 */
function alignQuestionsToSlots(slots: ExamBlueprintSlot[], candidates: GeneratedExamQuestion[]): Array<GeneratedExamQuestion | undefined> {
  const byKey = new Map<string, GeneratedExamQuestion[]>();
  const byNumber = new Map<number, GeneratedExamQuestion[]>();
  const used = new Set<GeneratedExamQuestion>();
  const push = <K,>(map: Map<K, GeneratedExamQuestion[]>, key: K, question: GeneratedExamQuestion) => {
    const existing = map.get(key) || [];
    existing.push(question);
    map.set(key, existing);
  };
  candidates.forEach((question) => {
    const id = questionBlueprintId(question);
    const itemIndex = questionBlueprintItemIndex(question);
    const questionNumber = questionBlueprintNumber(question);
    if (id && itemIndex !== null) push(byKey, `${id}:${itemIndex}`, question);
    if (questionNumber !== null) push(byNumber, questionNumber, question);
  });
  const result: Array<GeneratedExamQuestion | undefined> = [];
  let positionalCursor = 0;
  const nextUnused = (pool: GeneratedExamQuestion[] | undefined): GeneratedExamQuestion | undefined => {
    const question = pool?.find((candidate) => !used.has(candidate));
    if (question) used.add(question);
    return question;
  };
  for (const slot of slots) {
    let question = nextUnused(byKey.get(blueprintSlotKey(slot)));
    if (!question) question = nextUnused(byNumber.get(slot.questionNumber));
    if (!question) {
      while (positionalCursor < candidates.length) {
        const candidate = candidates[positionalCursor++];
        if (used.has(candidate)) continue;
        const id = questionBlueprintId(candidate);
        const itemIndex = questionBlueprintItemIndex(candidate);
        const questionNumber = questionBlueprintNumber(candidate);
        // A provider that declared an incompatible identity must not be moved
        // into another slot just to make the paper appear complete.
        if (id || itemIndex !== null || questionNumber !== null) continue;
        used.add(candidate);
        question = candidate;
        break;
      }
    }
    result.push(question);
  }
  return result;
}

export function buildBlueprintRecoveryPrompt(
  request: ExamGenerationRequest,
  slots: ExamBlueprintSlot[],
  existingCount: number,
): string {
  return `Return JSON only as {"questions":[...]} for the missing or invalid slots below. This is a focused recovery for a ${request.gradeLevel} ${request.subject} paper; do not rewrite or renumber the existing ${existingCount} valid questions. Generate exactly one question per listed slot, in the listed order.\n\nExact slots:\n${slots.map(describeBlueprintSlot).join('\n')}\n\nHard contract:\n- Copy blueprint_section_id, blueprint_section_title, blueprint_item_index, and blueprint_question_number exactly from each slot.\n- Use exactly the listed question_type and marks. Never substitute another component, type, or mark value.\n- Include a real correct_answer and a marking_scheme containing the answer, not marking instructions alone.\n- Multiple-choice slots must have exactly four distinct options and correct_answer must match exactly one option or its A-D letter.\n- Structured sub-part marks must sum to the parent marks.\n- Keep question text complete; do not shorten literary passages or practical instructions.\n- Use visual_spec null unless the question genuinely requires a visual; never fabricate a scientific diagram or image URL.\n- Use the selected curriculum hierarchy only: ${request.strands.join('; ')} / ${request.subStrands.join('; ') || 'selected child sub-strands'} / ${request.topics.join('; ') || 'selected child topics'}.`;
}

async function requestFocusedBlueprintRecovery(
  endpoint: string,
  apiKey: string,
  model: string,
  request: ExamGenerationRequest,
  current: GeneratedExamQuestion[],
  knowledgeContext: string,
  deadlineAt: number,
): Promise<GeneratedExamQuestion[] | null> {
  const slots = getExamBlueprintSlots(request);
  const working: Array<GeneratedExamQuestion | undefined> = alignQuestionsToSlots(slots, current);
  for (let round = 1; round <= 2; round += 1) {
    if (Date.now() >= deadlineAt) return null;
    const missing = missingBlueprintSlots(request, working);
    if (!missing.length) return working.map((question, index) => bindQuestionToSlot(question!, slots[index]));
    const prompt = `${buildBlueprintRecoveryPrompt(request, missing, working.filter(Boolean).length)}\n\nVetted curriculum context:\n${knowledgeContext || 'Use the selected curriculum only.'}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(1,Math.min(45000,deadlineAt-Date.now())));
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a strict JSON API. Return only a parseable JSON object.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.25,
          max_tokens: Math.min(20000, Math.max(4000, missing.length * 420)),
          stream: false,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      const raw = await response.text().catch(() => '');
      if (!response.ok || !raw.trim()) continue;
      let payload: DeepSeekResponse;
      try { payload = JSON.parse(raw) as DeepSeekResponse; } catch { continue; }
      const recoveredObject = extractJsonFromContent(readMessageContent(payload));
      const recovered = Array.isArray(recoveredObject?.questions)
        ? recoveredObject.questions.map((entry) => normalizeQuestion(entry, missing[0]?.questionType || request.questionTypes[0] || 'multiple_choice', fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
        : [];
      if (!recovered.length) continue;
      const recoveredBySlot = alignQuestionsToSlots(missing, recovered);
      for (const [index, slot] of missing.entries()) {
        const candidate = recoveredBySlot[index];
        if (candidate && candidateQuestionUsable(candidate, slot)) {
          working[slot.questionNumber - 1] = bindQuestionToSlot(candidate, slot);
        }
      }
    } catch (error) {
      console.warn('[exam-gen] focused blueprint recovery failed:', error instanceof Error ? error.message.slice(0, 180) : 'unknown failure');
    } finally {
      clearTimeout(timeoutId);
    }
    if (round < 2) await waitBeforeRetry(round);
  }
  return missingBlueprintSlots(request, working).length ? null : working as GeneratedExamQuestion[];
}

function chunkBlueprintSlots(slots: ExamBlueprintSlot[]): ExamBlueprintSlot[][] {
  const chunks: ExamBlueprintSlot[][] = [];
  let cursor = 0;
  while (cursor < slots.length) {
    const sectionIndex = slots[cursor].sectionIndex;
    const sectionEnd = slots.slice(cursor).findIndex((slot) => slot.sectionIndex !== sectionIndex);
    const end = sectionEnd === -1 ? slots.length : cursor + sectionEnd;
    const sectionSlots = slots.slice(cursor, end);
    const passageSection = /reading comprehension|ufahamu wa kusoma|four passages/i.test(sectionSlots[0]?.title || '');
    if (passageSection) {
      for (let offset = 0; offset < sectionSlots.length; offset += 5) chunks.push(sectionSlots.slice(offset, offset + 5));
      cursor = end;
      continue;
    }
    if (sectionSlots.length > 10) {
      for (let offset = 0; offset < sectionSlots.length; offset += 10) chunks.push(sectionSlots.slice(offset, offset + 10));
      cursor = end;
      continue;
    }

    // Small adjacent component sections (for example Science Q31–Q40 or the
    // five English literary tasks) share a request up to ten slots. Never
    // split a section across this grouping, preserving every component id.
    let groupEnd = end;
    while (groupEnd < slots.length) {
      const nextSection = slots[groupEnd].sectionIndex;
      const nextRelativeEnd = slots.slice(groupEnd).findIndex((slot) => slot.sectionIndex !== nextSection);
      const nextEnd = nextRelativeEnd === -1 ? slots.length : groupEnd + nextRelativeEnd;
      if (nextEnd - cursor > 10) break;
      groupEnd = nextEnd;
    }
    chunks.push(slots.slice(cursor, groupEnd));
    cursor = groupEnd;
  }
  return chunks;
}

async function generateLargeBlueprintInChunks(
  request: ExamGenerationRequest,
  knowledgeContext: string,
  endpoint: string,
  apiKey: string,
  model: string,
  fallbackModel: string,
  deadlineAt: number,
): Promise<GeneratedExamQuestion[]> {
  const slots = getExamBlueprintSlots(request);
  const chunks = chunkBlueprintSlots(slots);
  const basePrompt = buildExamPrompt(request, knowledgeContext);
  const results: Array<GeneratedExamQuestion[] | null> = Array.from({ length: chunks.length }, () => null);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const chunkIndex = next++;
      if (chunkIndex >= chunks.length) return;
      const chunk = chunks[chunkIndex];
      const chunkContract = `\n\nFOCUSED COMPONENT CHUNK ${chunkIndex + 1}/${chunks.length}: Return exactly ${chunk.length} questions for these slots only, in this order. Do not return any other slot. Passage groups must remain complete within this chunk; use the original passage as the shared stimulus for its requested items. Do not attempt whole-paper strand coverage within this chunk; use only each slot's own component scope.\n${chunk.map(describeBlueprintSlot).join('\n')}`;
      const chunkPrompt = `${basePrompt}${chunkContract}`;
      let recovered: GeneratedExamQuestion[] | null = null;
      for (const chunkModel of [model, fallbackModel]) {
        for (let attempt = 1; attempt <= 2 && !recovered; attempt += 1) {
          if (Date.now() >= deadlineAt) break;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), Math.max(1,Math.min(45000,deadlineAt-Date.now())));
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: chunkModel,
                messages: [
                  { role: 'system', content: 'You are a strict JSON API. Return only a parseable JSON object.' },
                  { role: 'user', content: `${chunkPrompt}\n\nThis is chunk attempt ${attempt}; output all ${chunk.length} slots now.` },
                ],
                temperature: attempt === 1 ? 0.45 : 0.25,
                max_tokens: Math.min(12000, Math.max(4000, chunk.length * 520)),
                stream: false,
                response_format: { type: 'json_object' },
              }),
              signal: controller.signal,
            });
            const raw = await response.text().catch(() => '');
            if (!response.ok || !raw.trim()) continue;
            let payload: DeepSeekResponse;
            try { payload = JSON.parse(raw) as DeepSeekResponse; } catch { continue; }
            const object = extractJsonFromContent(readMessageContent(payload));
            const candidate = Array.isArray(object?.questions)
              ? object.questions.map((entry) => normalizeQuestion(entry, chunk[0].questionType, fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
              : [];
            if (candidate.length !== chunk.length) continue;
            const ordered: GeneratedExamQuestion[] = [];
            const aligned = alignQuestionsToSlots(chunk, candidate);
            for (const [index, slot] of chunk.entries()) {
              const question = aligned[index];
              if (!candidateQuestionUsable(question, slot)) {
                ordered.length = 0;
                break;
              }
              ordered.push(bindQuestionToSlot(question!, slot));
            }
            if (ordered.length === chunk.length) recovered = ordered;
          } catch (error) {
            console.warn(`[exam-gen] chunk ${chunkIndex + 1} failed:`, error instanceof Error ? error.message.slice(0, 160) : 'unknown failure');
          } finally {
            clearTimeout(timeoutId);
          }
        }
      }
      results[chunkIndex] = recovered;
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, () => worker()));
  if (results.some((result) => !result)) {
    throw new DeepSeekResponseError('The provider could not complete every bounded blueprint component chunk; no shortened paper was accepted.');
  }
  return results.flatMap((result) => result || []);
}

export async function generateExamWithDeepSeek(request: ExamGenerationRequest, knowledgeContext = '', deadlineAt = Date.now()+190000): Promise<ExamPaper> {
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
  let acceptedQuestions: GeneratedExamQuestion[] | null = null;
  let lastFailure = '';
  const standardTokenBudget = outputTokenBudget(request);
  const attemptPlans = [
    { model: modelName, maxTokens: standardTokenBudget, useJsonMode: true },
    { model: fallbackModel, maxTokens: standardTokenBudget, useJsonMode: false },
    { model: fallbackModel, maxTokens: Math.min(20000, standardTokenBudget + 8000), useJsonMode: false },
  ];

  // Large fixed papers routinely exceed a single provider response budget. Keep
  // every component and slot explicit, generate at most ten items per chunk,
  // and run no more than three provider calls concurrently.
  if (hasFixedBlueprint(request) && getExamBlueprintSlots(request).length > 24) {
    acceptedQuestions = await generateLargeBlueprintInChunks(
      request,
      knowledgeContext,
      endpoint,
      apiKey,
      modelName,
      fallbackModel,
      deadlineAt,
    );
    parsed = { title: makeExamTitle(request), instructions: ['Answer all questions.'] };
  }

  for (let attempt = 0; attempt < attemptPlans.length && !parsed; attempt += 1) {
    if (Date.now() >= deadlineAt) { lastFailure='The shared generation time budget was exhausted; no shortened paper was saved.'; break; }
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

    const timeoutMs = Math.max(1,Math.min(attempt === 0 ? 70000 : attempt === 1 ? 70000 : 90000,deadlineAt-Date.now()));
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
      console.log('[exam-gen] attempt:', attempt + 1, 'finish reason:', payload.choices?.[0]?.finish_reason || 'unknown');
      console.log('[exam-gen] attempt:', attempt + 1, 'content preview:', content.slice(0, 200));
      if (!content) throw new DeepSeekResponseError(`The AI service returned an empty response on attempt ${attempt + 1}.`);
      const candidate = parseJsonObject(content);
      const candidateQuestions = Array.isArray(candidate.questions)
        ? candidate.questions.map((entry) => normalizeQuestion(entry, request.questionTypes[0] || 'multiple_choice', fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
        : [];
      if (!candidateQuestions.length) throw new DeepSeekResponseError('The AI service did not provide any valid questions.');
      let completeQuestions = candidateQuestions;
      if (hasFixedBlueprint(request)) {
        const recovered = await requestFocusedBlueprintRecovery(endpoint, apiKey, plan.model, request, candidateQuestions, knowledgeContext,deadlineAt);
        if (!recovered) {
          throw new DeepSeekResponseError(`The AI service returned ${candidateQuestions.length} questions, but the fixed blueprint requires ${getExamBlueprintSlots(request).length}; focused recovery could not fill every slot.`);
        }
        completeQuestions = recovered;
      }
      // An incomplete visual no longer discards the whole paper: the repair pass
      // completes it or removes just that visual from that one question.
      const incompleteVisuals = candidateQuestions.filter(
        (question) => !hasCompleteTableVisual(question)
          || (question.visual_spec && !hasUsableVisualSpec(question)),
      ).length;
      if (incompleteVisuals) {
        console.warn(`[exam-gen] ${incompleteVisuals} question(s) returned an incomplete visual; the repair pass will handle them.`);
      }
      acceptedQuestions = completeQuestions;
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
  const normalizedQuestions = acceptedQuestions || (Array.isArray(parsed.questions)
    ? parsed.questions.map((entry) => normalizeQuestion(entry, fallbackType, fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
    : []);
  const blueprintAlignedQuestions = reconcileQuestionMarks(request, normalizedQuestions);

  if (!blueprintAlignedQuestions.length) {
    throw new DeepSeekResponseError('The AI service did not provide any valid questions. Please try again with a narrower curriculum selection.');
  }

  const questions = blueprintAlignedQuestions.map((question, index) => ({ ...question, question_number: index + 1 }));
  const computedMarks = questions.reduce((sum, question) => sum + question.marks, 0);

  return {
    // The title is an authoring choice made by the teacher/admin. The provider
    // may suggest one only when the requester left the field blank.
    title: makeExamTitle(request).slice(0, 255),
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

/** Shared so both providers read a single repaired question the same way. */
export function parseRepairedQuestion(
  request: ExamGenerationRequest,
  payload: unknown,
): GeneratedExamQuestion | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const candidate = 'question' in record ? record.question : record;
  return normalizeQuestion(candidate, request.questionTypes[0] || 'multiple_choice', fallbackDifficulty(request));
}

function repairEndpoint(useDeepSeek: boolean): string {
  return useDeepSeek
    ? `${(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`
    : `${(process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
}

function repairModel(useDeepSeek: boolean): string {
  const configured = process.env.AI_EXAM_MODEL || process.env.DEEPSEEK_MODEL || '';
  if (!useDeepSeek) return configured || 'gpt-5-mini';
  const primary = configured || 'deepseek-chat';
  if (primary === 'deepseek-v4-pro') {
    return process.env.AI_EXAM_FALLBACK_MODEL || 'deepseek-chat';
  }
  return primary;
}

/**
 * Ask the model to rewrite exactly one question (or one visual) from an explicit
 * instruction. Returns null on any provider problem: a repair that cannot be
 * attempted must degrade to a drop, never to a failed paper.
 */
export async function rewriteQuestionWithDeepSeek(prompt: string, deadlineAt = Date.now()+30000): Promise<Record<string, unknown> | null> {
  if(Date.now()>=deadlineAt)return null;
  const deepSeekKey = process.env.DEEPSEEK_API_KEY;
  const apiKey = deepSeekKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const useDeepSeek = Boolean(deepSeekKey);
  const model = repairModel(useDeepSeek);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1,Math.min(30000,deadlineAt-Date.now())));
  try {
    const response = await fetch(repairEndpoint(useDeepSeek), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a strict JSON API. Return ONLY a JSON object with no markdown, no code fences, no explanation text, no preamble.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1600,
        stream: false,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    const rawText = await response.text().catch(() => '');
    if (!rawText.trim()) {
      console.warn(`[exam-repair] ${model} returned an empty rewrite response (status ${response.status}).`);
      return null;
    }
    let payload: DeepSeekResponse;
    try {
      payload = JSON.parse(rawText) as DeepSeekResponse;
    } catch {
      console.warn(`[exam-repair] ${model} returned a non-JSON rewrite response.`);
      return null;
    }
    if (!response.ok) {
      console.warn(`[exam-repair] ${model} rejected the rewrite:`, payload.error?.message || response.status);
      return null;
    }
    const repaired = extractJsonFromContent(readMessageContent(payload));
    if (!repaired) console.warn(`[exam-repair] ${model} returned no parseable rewrite object.`);
    return repaired;
  } catch (error) {
    console.warn('[exam-repair] rewrite request failed:', error instanceof Error ? error.message.slice(0, 200) : 'unknown failure');
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
