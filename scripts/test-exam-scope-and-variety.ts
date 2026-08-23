import assert from 'node:assert/strict';
import { buildExamPrompt } from '../src/lib/deepseek-api.ts';
import { makeBalancedBlueprint, type ExamGenerationRequest, type GeneratedExamQuestion } from '../src/lib/exam-schema.ts';
import { validateGeneratedExam } from '../src/lib/exam-validation.ts';

const request: ExamGenerationRequest = {
  gradeLevel: 'Grade 7',
  subject: 'Integrated Science',
  strands: ['Matter and Materials'],
  subStrands: ['States of Matter'],
  topics: ['Solids, liquids and gases'],
  curriculumScope: [{
    strand: 'Matter and Materials',
    subStrands: ['States of Matter'],
    topics: ['Solids, liquids and gases'],
  }],
  questionTypes: ['multiple_choice'],
  totalMarks: 1,
  durationMinutes: 10,
  difficulty: 'mixed',
  includeImages: false,
  includeMarkingScheme: true,
  format: 'cbe',
  blueprint: makeBalancedBlueprint(['multiple_choice'], 1, 'mixed'),
  variationKey: 'variation-a',
  avoidQuestionStems: ['Which state of matter has a fixed shape?'],
};

const validQuestion: GeneratedExamQuestion = {
  question_type: 'multiple_choice',
  question_text: 'A learner pours water into a beaker. Which statement best describes the water?',
  options: ['It has a fixed shape.', 'It takes the shape of the container.', 'It cannot flow.', 'It has no volume.'],
  correct_answer: 'It takes the shape of the container.',
  marking_scheme: 'Award 1 mark for the correct option.',
  marks: 1,
  difficulty: 'medium',
  strand: 'Matter and Materials',
  sub_strand: 'States of Matter',
  topic: 'Solids, liquids and gases',
};

const valid = validateGeneratedExam(request, [validQuestion]);
assert.equal(valid.passed, true, `valid scoped question should pass: ${JSON.stringify(valid.issues)}`);

const outOfScope = validateGeneratedExam(request, [{
  ...validQuestion,
  question_text: 'How do cells exchange materials with their surroundings?',
  strand: 'Living Things and Environment',
  sub_strand: 'Cell Structure and Functions',
  topic: 'Functions of cell parts',
}]);
assert.equal(outOfScope.passed, false);
assert.ok(outOfScope.issues.some((issue) => issue.code === 'STRAND_OUT_OF_SCOPE'));
assert.ok(outOfScope.issues.some((issue) => issue.code === 'SUB_STRAND_OUT_OF_SCOPE'));
assert.ok(outOfScope.issues.some((issue) => issue.code === 'TOPIC_OUT_OF_SCOPE'));

const duplicate = validateGeneratedExam(request, [validQuestion], { previousStems: [validQuestion.question_text] });
assert.equal(duplicate.passed, false);
assert.ok(duplicate.issues.some((issue) => issue.code === 'DUPLICATE_EXISTING_STEM'));

const promptA = buildExamPrompt(request, 'Matter and Materials: States of Matter: solids, liquids and gases.');
const promptB = buildExamPrompt({ ...request, variationKey: 'variation-b' }, 'Matter and Materials: States of Matter: solids, liquids and gases.');
assert.notEqual(promptA, promptB);
assert.match(promptA, /Strict curriculum ancestry law/);
assert.match(promptA, /Generation variation key: variation-a/);
assert.match(promptA, /Which state of matter has a fixed shape/);
assert.match(promptA, /Matter and Materials -> States of Matter -> Solids, liquids and gases/);

console.log('PASS: curriculum ancestry, cross-paper duplicate, and variation safeguards behave as expected.');
