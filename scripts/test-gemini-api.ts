import assert from 'node:assert/strict';
import { generateExamWithGemini } from '../src/lib/gemini-api.ts';
import { makeFormatBlueprint, type ExamGenerationRequest } from '../src/lib/exam-schema.ts';

process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-3.7-flash';
process.env.GEMINI_BASE_URL = 'https://generativelanguage.test/v1beta';

const request: ExamGenerationRequest = {
  title: 'Grade 9 Integrated Science Gemini KJSEA Test',
  gradeLevel: 'Grade 9',
  subject: 'Integrated Science',
  strands: ['Living Things and Their Environment'],
  subStrands: ['The Cell'],
  topics: ['Cell structure and functions'],
  questionTypes: ['case_study'],
  totalMarks: 20,
  durationMinutes: 30,
  difficulty: 'medium',
  includeImages: true,
  includeMarkingScheme: true,
  format: 'kjsea',
  term: 'Term 1',
  blueprint: makeFormatBlueprint('kjsea', 20),
};

const originalFetch = globalThis.fetch;
let requestUrl = '';
let requestBody: Record<string, unknown> | null = null;
let requestHeaders: Record<string, string> = {};
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  requestUrl = String(input);
  requestHeaders = Object.fromEntries(new Headers(init?.headers).entries());
  requestBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
  const content = {
    title: request.title,
    instructions: ['Answer all questions.'],
    questions: [
      { question_type: 'case_study', question_text: 'A learner investigates cells using a prepared slide.', options: [], correct_answer: 'See marking scheme.', marking_scheme: 'Award one mark for each valid point.', marks: 1, difficulty: 'medium', strand: 'The Cell', sub_strand: 'Cell structure', topic: 'Cells', learning_outcome: 'Describe cell parts.', competency: 'Critical thinking', cognitive_level: 'apply', visual_spec: { asset_type: 'diagram', title: 'Cell', prompt: 'A labelled cell diagram.', caption: 'School-owned schematic cell diagram.', labels: ['Cell wall'] } },
      { question_type: 'case_study', question_text: 'The learner records the observations in a table.', options: [], correct_answer: 'See marking scheme.', marking_scheme: 'Award one mark for each valid point.', marks: 1, difficulty: 'medium', strand: 'The Cell', sub_strand: 'Cell structure', topic: 'Cells', learning_outcome: 'Record observations.', competency: 'Communication', cognitive_level: 'apply', visual_spec: null },
    ],
  };
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

try {
  const paper = await generateExamWithGemini(request, 'Cells: structure and functions.');
  assert.equal(requestUrl, 'https://generativelanguage.test/v1beta/models/gemini-3.7-flash:generateContent');
  assert.equal(requestHeaders['x-goog-api-key'], 'test-gemini-key');
  assert.equal(requestHeaders.authorization, undefined);
  assert.equal((requestBody?.generationConfig as Record<string, unknown>)?.responseMimeType, 'application/json');
  assert.equal((requestBody?.generationConfig as Record<string, unknown>)?.maxOutputTokens, 7000);
  assert.equal(paper.questions.length, 2);
  assert.deepEqual(paper.questions.map((question) => question.marks), [10, 10]);
  assert.equal(paper.total_marks, 20);
  assert.equal(paper.questions[0]?.visual_spec?.asset_type, 'diagram');
  console.log('PASS: Gemini adapter uses the official JSON contract and reconciles exact KJSEA marks.');
} finally {
  globalThis.fetch = originalFetch;
}
