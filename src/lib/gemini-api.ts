import {
  buildExamPrompt,
  extractJsonFromContent,
  fallbackDifficulty,
  normalizeQuestion,
  outputTokenBudget,
  reconcileQuestionMarks,
} from './deepseek-api.js';
import { hasCompleteTableVisual, hasUsableVisualSpec } from './exam-visuals.js';
import { makeExamTitle, type ExamGenerationRequest, type ExamPaper, type GeneratedExamQuestion } from './exam-schema.js';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

export class GeminiConfigurationError extends Error {}
export class GeminiResponseError extends Error {}

function readGeminiText(payload: GeminiResponse): string {
  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim() || '';
}

function waitBeforeRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
}

function toSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function toSafeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function buildPaper(request: ExamGenerationRequest, parsed: Record<string, unknown>): ExamPaper {
  const fallbackType = request.questionTypes[0] || 'multiple_choice';
  const normalized = Array.isArray(parsed.questions)
    ? parsed.questions.map((entry) => normalizeQuestion(entry, fallbackType, fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
    : [];
  const blueprintAlignedQuestions = reconcileQuestionMarks(request, normalized);
  if (!blueprintAlignedQuestions.length) {
    throw new GeminiResponseError('Gemini did not provide any valid questions. Please try again with a narrower curriculum selection.');
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

function recoveryInstruction(attempt: number): string {
  if (attempt === 0) return '';
  if (attempt === 1) {
    return '\n\nRECOVERY REQUIREMENT: The previous response was unusable. Return a complete, concise JSON object now. Do not omit questions, do not return markdown, do not add commentary, and keep every field concise enough to fit the requested paper. If any table visual is required, include table_headers and complete table_rows with every learner-facing cell and numeric value. Do not repeat a visual table or bracketed diagram placeholder in question_text; use precise structured labels and values for the visual.';
  }
  return '\n\nFINAL RECOVERY REQUIREMENT: Produce the complete paper in the exact JSON shape now. Prioritise all required questions, marks, answers, and marking guidance. Use short sentences, empty strings for optional metadata when necessary, and visual_spec null unless the stem explicitly requires a visual. Any table visual must include table_headers and complete table_rows; do not use x_labels alone. Do not repeat a visual table or bracketed diagram placeholder in question_text. Measurement diagrams must show precise readings, units, graduations, water levels, and objects rather than generic shapes. Return JSON only.';
}

export async function generateExamWithGemini(request: ExamGenerationRequest, knowledgeContext = ''): Promise<ExamPaper> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigurationError('Gemini is not configured. Add GEMINI_API_KEY to the server environment.');
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  const endpoint = `${(process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')}/models/${encodeURIComponent(model)}:generateContent`;
  const prompt = buildExamPrompt(request, knowledgeContext);
  let parsed: Record<string, unknown> | null = null;
  let lastFailure = '';

  for (let attempt = 0; attempt < 3 && !parsed; attempt += 1) {
    const requestPayload = {
      systemInstruction: {
        parts: [{ text: 'You are a strict JSON API. Return ONLY a JSON object with no markdown, no code fences, no explanation text, no preamble. The response must be parseable JSON.' }],
      },
      contents: [{ role: 'user', parts: [{ text: `${prompt}${recoveryInstruction(attempt)}` }] }],
      generationConfig: {
        temperature: attempt === 0 ? 0.65 : 0.3,
        maxOutputTokens: outputTokenBudget(request, attempt > 0),
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: attempt === 0 ? 'medium' : 'low' },
      },
    };
    const timeoutMs = attempt === 0 ? 60000 : 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      const rawText = await response.text().catch(() => '');
      if (!rawText.trim()) throw new GeminiResponseError(`Gemini returned an empty response on attempt ${attempt + 1} (status ${response.status}).`);
      let payload: GeminiResponse;
      try {
        payload = JSON.parse(rawText) as GeminiResponse;
      } catch {
        throw new GeminiResponseError(`Gemini returned an invalid response (status ${response.status}).`);
      }
      if (!response.ok) {
        const providerMessage = payload.error?.message || payload.promptFeedback?.blockReason || `Gemini returned status ${response.status}.`;
        throw new GeminiResponseError(providerMessage);
      }
      const content = readGeminiText(payload);
      if (!content) throw new GeminiResponseError(`Gemini returned no text content on attempt ${attempt + 1}.`);
      const candidate = extractJsonFromContent(content);
      if (!candidate) throw new GeminiResponseError('Gemini returned content that could not be parsed as the requested structured JSON.');
      const candidateQuestions = Array.isArray(candidate.questions)
        ? candidate.questions.map((entry) => normalizeQuestion(entry, request.questionTypes[0] || 'multiple_choice', fallbackDifficulty(request))).filter((entry): entry is GeneratedExamQuestion => Boolean(entry))
        : [];
      if (!candidateQuestions.length) throw new GeminiResponseError('Gemini did not provide any valid questions.');
      if (candidateQuestions.some((question) => !hasCompleteTableVisual(question))) {
        throw new GeminiResponseError('Gemini returned an incomplete table visual. Retry with table_headers and every table_rows cell required by the question.');
      }
      if (candidateQuestions.some((question) => question.visual_spec && !hasUsableVisualSpec(question))) {
        throw new GeminiResponseError('Gemini returned an incomplete visual specification. Retry with readable labels or complete data for every required diagram, map, graph, chart, flowchart, table, or number line.');
      }
      parsed = candidate;
    } catch (error) {
      lastFailure = error instanceof Error && error.name === 'AbortError'
        ? `Gemini timed out after ${timeoutMs / 1000} seconds.`
        : error instanceof Error ? error.message : 'Unknown Gemini failure.';
      console.error('[exam-gen] Gemini attempt failed:', attempt + 1, lastFailure.slice(0, 300));
      if (attempt < 2) await waitBeforeRetry(attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!parsed) {
    const detail = lastFailure ? ` Last provider detail: ${lastFailure.slice(0, 260)}` : '';
    throw new GeminiResponseError(`Gemini did not return a usable exam response after three attempts. Please retry; your selected blueprint and curriculum choices were not lost.${detail}`);
  }
  return buildPaper(request, parsed);
}
