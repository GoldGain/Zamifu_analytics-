import assert from 'node:assert/strict';
import { generateExamWithDeepSeek, rewriteQuestionWithDeepSeek } from '../src/lib/deepseek-api.ts';
import { makeFormatBlueprint } from '../src/lib/exam-schema.ts';
import { getKjseaPaperSpec, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats.ts';
import { validateGeneratedExam } from '../src/lib/exam-validation.ts';
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
  title: 'AI Generated Replacement Title',
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
  assert.equal(requestBodies[1]?.model, 'deepseek-chat', 'the default recovery must stay on the proven chat route');
  assert.equal(requestBodies[2]?.model, 'deepseek-chat', 'the default final recovery must not switch to a reasoning-only model');
  assert.ok(Number(requestBodies[2]?.max_tokens) > Number(requestBodies[1]?.max_tokens), 'the final recovery attempt should allow a larger complete-paper response');
  assert.deepEqual(requestBodies[0]?.response_format, { type: 'json_object' }, 'the first attempt should use DeepSeek JSON mode');
  assert.equal(paper.questions.length, 1, 'the recovered response should normalize one valid question');
  assert.equal(paper.title, request.title, 'the requester-supplied title must override the provider title');
  assert.equal(paper.questions[0]?.question_text, 'Which integer is greatest: -3, 0, or 2?');
  assert.deepEqual(paper.questions[0]?.options, ['-3', '0', '2', '-5']);
  console.log('PASS: exam generation retries empty/malformed responses and extracts structured content.');

  calls = 0;
  requestBodies.length = 0;
  const kjseaRequest: ExamGenerationRequest = {
    ...request,
    title: 'Grade 9 Integrated Science KJSEA Blueprint Test',
    gradeLevel: 'Grade 9',
    subject: 'Integrated Science',
    questionTypes: ['case_study'],
    totalMarks: 10,
    format: 'kjsea',
    blueprint: makeFormatBlueprint('kjsea', 10, 'mixed'),
  };
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    if (typeof init?.body === 'string') requestBodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      title: 'Structured recovery', instructions: ['Answer all questions.'], questions: [{
        question_type: 'case_study', question_text: 'Describe one safe measurement practice in the laboratory.',
        correct_answer: 'Read the scale at eye level and record the unit.',
        marking_scheme: 'Award marks for reading at eye level and recording the correct unit.', marks: 10,
        difficulty: 'medium', strand: 'Numbers', sub_strand: 'Integers', topic: 'Ordering integers',
      }],
    }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const kjseaPaper = await generateExamWithDeepSeek(kjseaRequest, 'Integrated Science: Scientific investigation and measurement.');
  assert.equal(kjseaPaper.questions.length, 1, 'the KJSEA blueprint should request one main structured question');
  assert.equal(kjseaPaper.questions[0]?.marks, 10, 'the KJSEA blueprint should preserve the provider slot mark value');
  assert.equal(kjseaPaper.total_marks, 10, 'the exact KJSEA paper should total exactly the requested marks');
  assert.equal(kjseaPaper.questions[0]?.question_type, 'case_study', 'a fixed structured slot must not accept an MCQ substitute');
  console.log('PASS: KJSEA fixed blueprint preserves exact structured type and marks without forging them.');

  function chunkResponse(init: RequestInit | undefined, strand: string, subStrand: string, topic: string): Response {
    const body = JSON.parse(String(init?.body || '{}')) as { messages?: Array<{ content?: string }> };
    const prompt = body.messages?.[1]?.content || '';
    const slots = Array.from(prompt.matchAll(/\n(\d+)\.\s+([^ |]+)\s+\|/g)).map((match) => ({ number: Number(match[1]), id: match[2] }));
    const questions = slots.map(({ number, id }) => ({
      question_type: 'multiple_choice',
      blueprint_section_id: id,
      blueprint_question_number: number,
      question_text: `Which statement best answers item ${number}?`,
      options: ['A', 'B', 'C', 'D'], correct_answer: 'A',
      marking_scheme: `Award 1 mark for selecting A for item ${number}.`, marks: 1,
      difficulty: 'medium', strand, sub_strand: subStrand, topic,
    }));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Chunked paper', instructions: ['Answer all questions.'], questions }) } }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }

  calls = 0;
  requestBodies.length = 0;
  globalThis.fetch = (async (input, init) => {
    calls += 1;
    assert.match(String(input), /exam-generator\.test/, 'chunk tests must use only the mocked endpoint');
    if (typeof init?.body === 'string') requestBodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return chunkResponse(init, 'Language', 'Grammar', 'Language use');
  }) as typeof fetch;
  const all50Request: ExamGenerationRequest = {
    ...request, title: 'English Paper 1 all-50 chunk test', subject: 'English', gradeLevel: 'Grade 9',
    strands: ['Language'], subStrands: ['Grammar'], topics: ['Language use'], questionTypes: ['multiple_choice'],
    totalMarks: 50, format: 'kjsea', paperVariant: 'paper1', includeImages: false,
    blueprint: makeKjseaBlueprint('English', 'paper1', 'medium'),
  };
  const all50Paper = await generateExamWithDeepSeek(all50Request, 'English: grammar and language use.');
  const all50Validation = validateGeneratedExam(all50Request, all50Paper.questions);
  assert.equal(all50Paper.questions.length, 50, 'chunked English Paper 1 must retain all 50 MCQ slots');
  assert.equal(all50Paper.total_marks, 50);
  assert.equal(all50Validation.passed, true, `all 50 MCQs should pass validation: ${JSON.stringify(all50Validation.issues)}`);
  assert.equal(new Set(all50Paper.questions.map((item) => item.question_text)).size, 50, 'each repeated-section slot must retain a unique item');
  assert.deepEqual(all50Paper.questions.map((item) => (item as GeneratedExamQuestion & { blueprint_question_number?: number }).blueprint_question_number), Array.from({ length: 50 }, (_, index) => index + 1));
  assert.equal(calls, 8, 'the four five-item reading chunks plus remaining components should be bounded into eight calls');
  console.log('PASS: mocked DeepSeek chunking keeps all 50 English MCQs, scope tags, marks and indexes without network access.');

  calls = 0;
  requestBodies.length = 0;
  globalThis.fetch = (async (input, init) => {
    calls += 1;
    assert.match(String(input), /exam-generator\.test/);
    if (typeof init?.body === 'string') requestBodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return chunkResponse(init, 'Numbers', 'Integers', 'Ordering integers');
  }) as typeof fetch;
  const cbe100Request: ExamGenerationRequest = {
    ...request, title: '100-question CBE chunk test', subject: 'Mathematics',
    strands: ['Numbers'], subStrands: ['Integers'], topics: ['Ordering integers'], questionTypes: ['multiple_choice'],
    totalMarks: 100, durationMinutes: 120, format: 'cbe', includeImages: false,
    blueprint: { sections: [{ id: 'cbe-mcq', title: 'CBE objective questions', question_type: 'multiple_choice', count: 100, marks_per_question: 1, difficulty: 'medium' }], total_marks: 100 },
  };
  const cbe100Paper = await generateExamWithDeepSeek(cbe100Request, 'Mathematics: numbers and integers.');
  const cbe100Validation = validateGeneratedExam(cbe100Request, cbe100Paper.questions);
  assert.equal(cbe100Paper.questions.length, 100, '100-question CBE must retain every repeated-section slot');
  assert.equal(cbe100Paper.total_marks, 100);
  assert.equal(cbe100Validation.passed, true, `100-question CBE should pass validation: ${JSON.stringify(cbe100Validation.issues)}`);
  assert.equal(new Set(cbe100Paper.questions.map((item) => item.question_text)).size, 100);
  assert.deepEqual(cbe100Paper.questions.map((item) => (item as GeneratedExamQuestion & { blueprint_question_number?: number }).blueprint_question_number), Array.from({ length: 100 }, (_, index) => index + 1));
  assert.equal(calls, 10, 'a 100-item section should use ten bounded ten-slot calls');
  console.log('PASS: mocked DeepSeek 100-question CBE chunking preserves all unique repeated-section slots.');

  const sciencePaper1 = makeKjseaBlueprint('Integrated Science', 'paper1', 'mixed');
  assert.ok(sciencePaper1, 'Integrated Science Paper 1 should have a KJSEA blueprint');
  assert.equal(sciencePaper1.total_marks, 70, 'the KJSEA Science Paper 1 blueprint should total 70 marks');
  assert.equal(sciencePaper1.sections[0]?.count, 30, 'Section A should contain exactly 30 MCQs');
  assert.equal(sciencePaper1.sections.slice(1).length, 10, 'Section B should contain ten parent questions, Q31–Q40');
  assert.deepEqual(
    sciencePaper1.sections.slice(1).map((section) => section.marks_per_question),
    [3, 3, 4, 6, 6, 5, 3, 2, 5, 3],
    "Section B should use the cited sample's variable mark allocation totaling 40",
  );
  assert.ok(sciencePaper1.sections.slice(1).every((section) => section.count === 1));
  console.log('PASS: Integrated Science Paper 1 blueprint matches 30 MCQs and the 2025 sample-style variable-mark default.');

  const auditedPapers: Array<[string, 'paper1' | 'paper2' | 'single', number, number]> = [
    ['English', 'paper1', 50, 100], ['English', 'paper2', 50, 105],
    ['Kiswahili', 'paper1', 50, 100], ['Kiswahili', 'paper2', 50, 105],
    ['Integrated Science', 'paper1', 70, 100], ['Integrated Science', 'paper2', 30, 60],
    ['Social Studies', 'single', 100, 90],
  ];
  for (const [subject, variant, marks, duration] of auditedPapers) {
    const spec = getKjseaPaperSpec(subject, variant);
    assert.ok(spec, `${subject} ${variant} must have a KJSEA paper specification`);
    assert.equal(spec.marks, marks, `${subject} ${variant} must retain the audited KNEC total`);
    assert.equal(spec.duration_minutes, duration, `${subject} ${variant} must retain the audited KNEC duration`);
  }
  const englishPaper2 = makeKjseaBlueprint('English', 'paper2', 'mixed');
  assert.deepEqual(englishPaper2?.sections.map((section) => section.marks_per_question), [15, 10, 10, 10, 5]);
  assert.match(englishPaper2?.sections[2]?.title || '', /Novella\/short story/);

  const kiswahiliPaper1 = makeKjseaBlueprint('Kiswahili', 'paper1', 'mixed');
  assert.equal(kiswahiliPaper1?.total_marks, 50);
  assert.deepEqual(kiswahiliPaper1?.sections.map((section) => section.count * section.marks_per_question), [20, 5, 25]);
  assert.match(kiswahiliPaper1?.sections[2]?.title || '', /Sarufi/);
  assert.doesNotMatch(kiswahiliPaper1?.sections.map((section) => section.title).join(' '), /separate cloze test/i);

  const sciencePaper2 = makeKjseaBlueprint('Integrated Science', 'paper2', 'mixed');
  assert.equal(sciencePaper2?.total_marks, 30);
  assert.deepEqual(sciencePaper2?.sections.map((section) => section.marks_per_question), [10, 10, 10]);
  const sciencePaper2Spec = getKjseaPaperSpec('Integrated Science', 'paper2');
  assert.ok(sciencePaper2Spec?.format_notes.some((note) => /provisional balanced default/i.test(note)));

  const socialStudiesBlueprint = makeKjseaBlueprint('Social Studies', 'single', 'mixed');
  assert.equal(socialStudiesBlueprint?.total_marks, 100);
  assert.equal(socialStudiesBlueprint?.sections[0]?.count, 20, 'Social Studies Section A should contain 20 MCQs');
  assert.deepEqual(
    socialStudiesBlueprint?.sections.slice(1).map((section) => section.marks_per_question),
    [10, 5, 6, 5, 2, 3, 5, 5, 10, 4, 4, 10, 3, 8],
    'Social Studies Section B should use the documented January 2025 sample-style default summing to 80',
  );
  assert.ok(socialStudiesBlueprint?.sections.some((section) => section.question_type === 'essay'));
  const socialStudiesSpec = getKjseaPaperSpec('Social Studies', 'single');
  assert.ok(socialStudiesSpec?.components.some((component) => /Structured and essay/i.test(component.label)));

  const socialValidationRequest: ExamGenerationRequest = {
    ...request, title: 'Grade 9 Social Studies KJSEA objective-count test', gradeLevel: 'Grade 9',
    subject: 'Social Studies', totalMarks: 100, durationMinutes: 90, format: 'kjsea',
    includeImages: false, blueprint: socialStudiesBlueprint,
  };
  const socialObjectiveQuestions = Array.from({ length: 20 }, (_, index) => ({
    question_number: index + 1, question_type: 'multiple_choice' as const,
    question_text: `Which statement best describes community practice ${index + 1}?`,
    options: ['A', 'B', 'C', 'D'], correct_answer: 'A',
    marking_scheme: `The correct answer is A because community practice ${index + 1} supports shared responsibility.`,
    marks: 1, difficulty: 'medium' as const, strand: '', sub_strand: '', topic: '',
    image_url: null, visual_spec: null,
  }));
  const socialValidation = validateGeneratedExam(socialValidationRequest, socialObjectiveQuestions);
  assert.equal(
    socialValidation.issues.some((issue) => issue.code === 'KJSEA_OBJECTIVE_LAYOUT'),
    false,
    'a correct 20-MCQ Social Studies Section A must not be checked against the 50-MCQ language-paper rule',
  );
  console.log('PASS: seven audited KJSEA totals, Kiswahili Sarufi allocation, Social Studies Section B default, and objective-count validation.');

  calls = 0;
  requestBodies.length = 0;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-pro';
  const originalFallbackModel = process.env.AI_EXAM_FALLBACK_MODEL;
  delete process.env.AI_EXAM_FALLBACK_MODEL;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    if (typeof init?.body === 'string') requestBodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        question_type: 'multiple_choice',
        question_text: 'Which integer is greatest: -3, 0, or 2?',
        options: ['-3', '0', '2', '-5'],
        correct_answer: '2',
        marking_scheme: 'Award 1 mark for selecting 2.',
        marks: 1,
        difficulty: 'medium',
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const repaired = await rewriteQuestionWithDeepSeek('Return one complete multiple-choice replacement question as JSON.');
    assert.equal(calls, 1, 'a repair should use one request to the selected alternate model');
    assert.equal(requestBodies[0]?.model, 'deepseek-chat', 'repairs should avoid the configured V4 Pro model that returned empty bodies');
    assert.equal(repaired?.question_type, 'multiple_choice');
    console.log('PASS: question repairs use the DeepSeek Chat fallback when V4 Pro is the configured primary.');
  } finally {
    if (originalFallbackModel === undefined) delete process.env.AI_EXAM_FALLBACK_MODEL;
    else process.env.AI_EXAM_FALLBACK_MODEL = originalFallbackModel;
    process.env.DEEPSEEK_MODEL = 'deepseek-chat';
  }
} finally {
  globalThis.fetch = originalFetch;
}
