import assert from 'node:assert/strict';
import { generateExamWithDeepSeek } from '../src/lib/deepseek-api.ts';
import type { ExamGenerationRequest } from '../src/lib/exam-schema.ts';

process.env.DEEPSEEK_API_KEY = 'test-key';
process.env.DEEPSEEK_BASE_URL = 'https://exam-generator.test/v1';
process.env.DEEPSEEK_MODEL = 'deepseek-chat';

const request: ExamGenerationRequest = {
  title: 'Grade 7 Mathematics Reliability Test',
  gradeLevel: 'Grade 7',
  subject: 'Mathematics',
  strands: ['Numbers'],
  subStrands: ['Integers'],
  topics: ['Ordering integers'],
  questionTypes: ['multiple_choice'],
  totalMarks: 10,
  durationMinutes: 30,
  difficulty: 'medium',
  includeImages: false,
  includeMarkingScheme: true,
  format: 'cbe',
};

const validContent = JSON.stringify({
  title: 'Grade 7 Mathematics Reliability Test',
  instructions: ['Answer all questions.'],
  questions: [
    {
      question_type: 'multiple_choice',
      question_text: 'Which integer is greatest: -3, 0, or 2?',
      options: ['-3', '0', '2', '-5'],
      correct_answer: '2',
      marking_scheme: 'Award 1 mark for selecting 2.',
      marks: 1,
      difficulty: 'medium',
      strand: 'Numbers',
      sub_strand: 'Integers',
      topic: 'Ordering integers',
    },
  ],
});

const originalFetch = globalThis.fetch;
let calls = 0;
const requestBodies: Array<Record<string, unknown>> = [];
globalThis.fetch = (async (_input, init) => {
  calls += 1;
  if (typeof init?.body === 'string') requestBodies.push(JSON.parse(init.body) as Record<string, unknown>);
  if (calls === 1) return new Response('', { status: 200 });
  if (calls === 2) return new Response(JSON.stringify({ choices: [{ message: { content: '{not-valid-json' } }] }), { status: 200 });
  return new Response(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: validContent }] } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

try {
  const paper = await generateExamWithDeepSeek(request, 'Numbers: Integers: ordering integers and number lines.');
  assert.equal(calls, 3, 'the provider should be retried after empty and malformed responses');
  assert.equal(requestBodies[0]?.model, 'deepseek-chat', 'the proven DeepSeek compatibility alias should remain the first attempt');
  assert.equal(requestBodies[2]?.model, 'deepseek-v4-pro', 'the final recovery attempt should use the V4-Pro fallback');
  assert.deepEqual(requestBodies[0]?.response_format, { type: 'json_object' }, 'the first attempt should use DeepSeek JSON mode');
  assert.equal(paper.questions.length, 1, 'the recovered response should normalize one valid question');
  assert.equal(paper.questions[0]?.question_text, 'Which integer is greatest: -3, 0, or 2?');
  assert.deepEqual(paper.questions[0]?.options, ['-3', '0', '2', '-5']);
  console.log('PASS: exam generation retries empty/malformed responses and extracts structured content.');
} finally {
  globalThis.fetch = originalFetch;
}
