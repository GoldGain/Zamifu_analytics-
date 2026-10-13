import assert from 'node:assert/strict';
import {
  candidateCalculationInstruction,
  getQuestionAnswerSpacePlan,
  hasCalculationQuestions,
  sanitizeCandidateInstruction,
} from '../src/lib/exam-answer-space.js';
import { getPrintedCandidateInstructions } from '../src/lib/exam-generator.js';
import type { ExamPaper, GeneratedExamQuestion } from '../src/lib/exam-schema.js';

function question(overrides: Partial<GeneratedExamQuestion>): GeneratedExamQuestion {
  return {
    question_type: 'short_answer',
    question_text: 'Answer the question.',
    correct_answer: 'A correct response.',
    marking_scheme: 'Award marks for a correct response.',
    marks: 3,
    difficulty: 'medium',
    ...overrides,
  };
}

const mathematics = question({
  question_type: 'short_answer',
  question_text: 'Calculate the area of a rectangle measuring 8 cm by 5 cm.',
  marks: 4,
});
const mathematicsPlan = getQuestionAnswerSpacePlan('Mathematics', mathematics);
assert.equal(mathematicsPlan.question.requiresCalculationSpace, true);
assert.equal(mathematicsPlan.question.reason, 'mathematics-structured');
assert.ok(mathematicsPlan.question.lineCount >= 2);
for (const subject of ['Core Mathematics', 'Essential Mathematics']) {
  const plan = getQuestionAnswerSpacePlan(subject, mathematics);
  assert.equal(plan.question.requiresCalculationSpace, true, `${subject} must use Mathematics spacing rules`);
  assert.equal(plan.question.reason, 'mathematics-structured');
}

const mathematicsMultipleChoice = question({
  question_type: 'multiple_choice',
  question_text: 'Calculate 12 × 4 and choose the correct answer.',
  options: ['36', '48', '52', '64'],
  marks: 1,
});
assert.equal(getQuestionAnswerSpacePlan('Mathematics', mathematicsMultipleChoice).question.requiresCalculationSpace, false, 'objective Mathematics items should not reserve paper working space');

for (const subject of ['English', 'Kiswahili', 'CRE', 'History']) {
  const theory = question({
    question_type: 'short_answer',
    question_text: 'Explain one way this idea affects the community.',
    marks: 3,
  });
  assert.equal(
    getQuestionAnswerSpacePlan(subject, theory).question.requiresCalculationSpace,
    false,
    `${subject} theory question must not receive generic calculation space`,
  );
}

const scienceCalculation = question({
  question_type: 'case_study',
  question_text: 'Calculate the speed of a cyclist who travels 120 m in 20 s.',
  marks: 4,
});
const sciencePlan = getQuestionAnswerSpacePlan('Integrated Science', scienceCalculation);
assert.equal(sciencePlan.question.requiresCalculationSpace, true);
assert.equal(sciencePlan.question.reason, 'explicit-calculation');

const mapLabeling = question({
  question_type: 'short_answer',
  question_text: 'Study the map and label Kenya, Uganda and Tanzania.',
  visual_spec: { asset_type: 'map', scale_text: '≈ 200 km' },
  marks: 3,
});
assert.equal(getQuestionAnswerSpacePlan('Social Studies', mapLabeling).question.requiresCalculationSpace, false, 'map labeling is not a scale calculation');
assert.equal(getQuestionAnswerSpacePlan('Social Studies', question({question_text:'State the scale shown on the map: 1 cm represents 50 km.', visual_spec:{asset_type:'map'}})).question.requiresCalculationSpace,false);
assert.equal(getQuestionAnswerSpacePlan('History', question({question_text:'Explain the difference between population totals in 2020 and 2021.'})).question.requiresCalculationSpace,false);

const mapScaleCalculation = question({
  question_type: 'short_answer',
  question_text: 'Use the scale 1 cm represents 50 km to calculate the ground distance between the two towns.',
  visual_spec: { asset_type: 'map', scale_text: '≈ 200 km' },
  marks: 4,
});
const mapPlan = getQuestionAnswerSpacePlan('Social Studies', mapScaleCalculation);
assert.equal(mapPlan.question.requiresCalculationSpace, true);
assert.equal(mapPlan.question.reason, 'map-scale-calculation');

const drawingTask = question({
  question_type: 'short_answer',
  question_text: 'Draw and label a bar graph using the data in the table.',
  marks: 4,
});
const drawingPlan = getQuestionAnswerSpacePlan('Integrated Science', drawingTask);
assert.equal(drawingPlan.question.requiresCalculationSpace, true, 'an explicit graph task needs response space');
assert.equal(drawingPlan.question.reason, 'graphical-task');
assert.equal(hasCalculationQuestions('Integrated Science', [drawingTask]), false, 'a graph task is not a calculation instruction');

const mixedScience = question({
  question_type: 'case_study',
  question_text: 'Use the investigation results to answer the parts below.',
  marks: 6,
  sub_parts: [
    { label: '(a)', prompt: 'Calculate the density of the sample from its mass and volume.', marks: 3 },
    { label: '(b)', prompt: 'State one safety precaution used in the investigation.', marks: 1 },
  ],
});
const mixedPlan = getQuestionAnswerSpacePlan('Integrated Science', mixedScience);
assert.equal(mixedPlan.question.requiresCalculationSpace, false);
assert.equal(mixedPlan.subParts[0]?.requiresCalculationSpace, true);
assert.equal(mixedPlan.subParts[0]?.reason, 'explicit-calculation');
assert.equal(mixedPlan.subParts[1]?.requiresCalculationSpace, false);

assert.equal(hasCalculationQuestions('English', [question({ question_text: 'Describe two features of the setting.' })]), false);
assert.equal(hasCalculationQuestions('Integrated Science', [scienceCalculation]), true);
assert.doesNotMatch(
  candidateCalculationInstruction('English', [question({ question_text: 'Explain the writer’s message.' })]),
  /working|calculation/i,
);
assert.match(candidateCalculationInstruction('Integrated Science', [scienceCalculation]), /calculation/i);
assert.equal(
  sanitizeCandidateInstruction('Show all working and give clear labelled responses.', 'English', [question({ question_text: 'Explain the writer’s message.' })]),
  '',
);
assert.match(
  sanitizeCandidateInstruction('Show all working for calculations.', 'Integrated Science', [scienceCalculation]),
  /show calculation steps only/i,
);

function paperForInstructions(subject: string, questions: GeneratedExamQuestion[], instructions: string[] = []): ExamPaper {
  return {
    title: `${subject} spacing instruction test`,
    grade_level: 'Grade 10',
    subject,
    year: 2026,
    duration_minutes: 60,
    total_marks: questions.reduce((sum, item) => sum + item.marks, 0),
    instructions,
    questions,
    format: 'kjsea',
  };
}

const theoryInstructions = getPrintedCandidateInstructions(paperForInstructions('English', [question({ question_text: 'Explain the writer’s message.' })], ['Show all working.']));
assert.doesNotMatch(theoryInstructions.join(' '), /show all working|working space|calculation space/i, 'theory cover instructions must not demand generic working');
const calculationInstructions = getPrintedCandidateInstructions(paperForInstructions('Integrated Science', [scienceCalculation], ['Show all working for calculations.']));
assert.match(calculationInstructions.join(' '), /calculation steps only for questions that require a calculation/i);

console.log('PASS: answer-space policy distinguishes Mathematics, real calculations, theory-only papers, mixed subparts, and map scale tasks.');
