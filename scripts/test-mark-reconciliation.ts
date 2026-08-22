import assert from 'node:assert/strict';
import { generateExamWithDeepSeek, reconcileQuestionMarks } from '../src/lib/deepseek-api.ts';
import { generateExamWithGemini } from '../src/lib/gemini-api.ts';
import { makeBalancedBlueprint, type ExamGenerationRequest, type GeneratedExamQuestion } from '../src/lib/exam-schema.ts';

const request: ExamGenerationRequest = {
  title: 'Grade 7 Integrated Science Mark Reconciliation Test',
  gradeLevel: 'Grade 7',
  subject: 'Integrated Science',
  strands: ['Matter and Materials'],
  subStrands: ['States of Matter'],
  topics: ['Solids, liquids and gases'],
  questionTypes: ['short_answer', 'essay'],
  totalMarks: 50,
  durationMinutes: 60,
  difficulty: 'mixed',
  includeImages: false,
  includeMarkingScheme: true,
  format: 'cbe',
};

const driftedQuestions: GeneratedExamQuestion[] = [
  { question_type: 'short_answer', question_text: 'State one property of a solid.', correct_answer: 'It has a fixed shape.', marking_scheme: 'Award 3 marks for a correct response.', marks: 3, difficulty: 'medium' },
  { question_type: 'essay', question_text: 'Explain the particle arrangement in a solid.', correct_answer: 'Particles are closely packed.', marking_scheme: 'Award marks for the explained points.', marks: 8, difficulty: 'medium' },
  { question_type: 'short_answer', question_text: 'State one property of a liquid.', correct_answer: 'It has a fixed volume.', marking_scheme: 'Award 3 marks for a correct response.', marks: 3, difficulty: 'medium' },
  { question_type: 'essay', question_text: 'Explain why a liquid takes the shape of its container.', correct_answer: 'Its particles can move past one another.', marking_scheme: 'Award marks for the explained points.', marks: 8, difficulty: 'medium' },
  { question_type: 'short_answer', question_text: 'State one property of a gas.', correct_answer: 'It has no fixed shape.', marking_scheme: 'Award 3 marks for a correct response.', marks: 3, difficulty: 'medium' },
  { question_type: 'essay', question_text: 'Explain how gas particles move.', correct_answer: 'They move freely in all directions.', marking_scheme: 'Award marks for the explained points.', marks: 8, difficulty: 'medium' },
  { question_type: 'short_answer', question_text: 'Name one change of state.', correct_answer: 'Melting.', marking_scheme: 'Award 3 marks for a correct response.', marks: 3, difficulty: 'medium' },
  { question_type: 'essay', question_text: 'Explain what happens during melting.', correct_answer: 'Particles gain energy.', marking_scheme: 'Award marks for the explained points.', marks: 8, difficulty: 'medium' },
  { question_type: 'short_answer', question_text: 'Name one example of evaporation.', correct_answer: 'Drying clothes.', marking_scheme: 'Award 3 marks for a correct response.', marks: 3, difficulty: 'medium' },
];

const reconciled = reconcileQuestionMarks(request, driftedQuestions);
assert.equal(reconciled.reduce((sum, question) => sum + question.marks, 0), 50);
assert.equal(reconciled[0]?.marks, 3);
assert.equal(reconciled.filter((question) => question.marks === 9).length, 3);
assert.ok(reconciled.filter((question) => question.marks === 9).every((question) => question.question_type === 'essay'));
console.log('PASS: the shared reconciler repairs a 47-mark provider draft to exactly 50 marks.');

const balancedBlueprint = makeBalancedBlueprint(request.questionTypes, request.totalMarks, request.difficulty);
assert.equal(balancedBlueprint.sections.reduce((sum, section) => sum + section.count * section.marks_per_question, 0), 50);
console.log('PASS: flexible CBE requests receive an exact-total internal blueprint.');

const providerContent = JSON.stringify({
  title: request.title,
  instructions: ['Answer all questions.'],
  questions: driftedQuestions,
});
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input) => {
  const url = String(input);
  if (url.includes('generativelanguage')) {
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: providerContent }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ choices: [{ message: { content: providerContent } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

try {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_MODEL = 'gemini-3.7-flash';
  process.env.GEMINI_BASE_URL = 'https://generativelanguage.test/v1beta';
  const geminiPaper = await generateExamWithGemini(request, 'Matter and Materials: States of Matter.');
  assert.equal(geminiPaper.total_marks, 50);
  assert.equal(geminiPaper.questions.reduce((sum, question) => sum + question.marks, 0), 50);
  console.log('PASS: Gemini finalization repairs a non-blueprint 47-mark response to 50.');

  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  process.env.DEEPSEEK_BASE_URL = 'https://exam-generator.test/v1';
  process.env.DEEPSEEK_MODEL = 'deepseek-chat';
  const deepseekPaper = await generateExamWithDeepSeek(request, 'Matter and Materials: States of Matter.');
  assert.equal(deepseekPaper.total_marks, 50);
  assert.equal(deepseekPaper.questions.reduce((sum, question) => sum + question.marks, 0), 50);
  console.log('PASS: DeepSeek finalization repairs a non-blueprint 47-mark response to 50.');
} finally {
  globalThis.fetch = originalFetch;
}
