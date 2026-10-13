import assert from 'node:assert/strict';
import { makeBalancedBlueprint, type ExamGenerationRequest, type GeneratedExamQuestion } from '../src/lib/exam-schema.ts';
import { getExamBlueprintSlots } from '../src/lib/exam-generation-contract.ts';
import { repairGeneratedExam, type ExamRepairAdapter } from '../src/lib/exam-repair.ts';
import { REQUIRED_MAP_MISSING } from '../src/lib/exam-validation.ts';

const baseRequest: ExamGenerationRequest = {
  title: 'Completeness contract test', gradeLevel: 'Grade 9', subject: 'Integrated Science',
  strands: ['Scientific Investigation'], subStrands: ['Practical skills'], topics: ['Observations'],
  questionTypes: ['case_study'], totalMarks: 15, durationMinutes: 60, difficulty: 'medium',
  includeImages: false, includeMarkingScheme: true, format: 'cbe',
};

function question(type: GeneratedExamQuestion['question_type'], marks: number, number: number, text = `Complete task ${number}.`): GeneratedExamQuestion {
  return {
    question_type: type, question_text: text, correct_answer: `Expected answer ${number}`,
    marking_scheme: `Award the marks for Expected answer ${number}.`, marks, difficulty: 'medium',
    strand: 'Scientific Investigation', sub_strand: 'Practical skills', topic: 'Observations',
    blueprint_question_number: number, blueprint_item_index: number - 1,
  } as GeneratedExamQuestion;
}

function adapterFor(request: ExamGenerationRequest, calls: { count: number }, mode: 'recover' | 'partial' | 'throw'): ExamRepairAdapter {
  return {
    rewriteQuestion: async ({ question: current, attempt }) => {
      calls.count += 1;
      if (mode === 'throw') throw new Error('mock adapter outage');
      const slots = getExamBlueprintSlots(request);
      const index = Number((current as GeneratedExamQuestion & { blueprint_question_number?: number }).blueprint_question_number) || 1;
      const slot = slots[index - 1];
      if (!slot) return null;
      if (mode === 'partial' && attempt < 2) return null;
      const replacement = question(slot.questionType, slot.marks, slot.questionNumber, `Repaired exact task ${slot.questionNumber}.`);
      delete (replacement as GeneratedExamQuestion & { blueprint_question_number?: number }).blueprint_question_number;
      delete (replacement as GeneratedExamQuestion & { blueprint_item_index?: number }).blueprint_item_index;
      return replacement;
    },
    rewriteVisual: async () => null,
  };
}

const practicalRequest: ExamGenerationRequest = {
  ...baseRequest, totalMarks: 30,
  blueprint: { sections: [{ id: 'practical', title: 'Three practical questions', question_type: 'case_study', count: 3, marks_per_question: 10, difficulty: 'medium' }], total_marks: 30 },
};
const practicalCalls = { count: 0 };
const practical = await repairGeneratedExam(practicalRequest, [question('case_study', 10, 1), question('case_study', 10, 2)], adapterFor(practicalRequest, practicalCalls, 'recover'));
assert.equal(practical.status, 'repaired');
assert.equal(practical.questions.length, 3, 'a shortened three-question practical paper must recover its missing slot');
assert.equal(practical.questions.reduce((sum, item) => sum + item.marks, 0), 30);
assert.deepEqual(practical.questions.map((item) => item.question_type), ['case_study', 'case_study', 'case_study']);
assert.ok(practicalCalls.count > 0);

const literaryRequest: ExamGenerationRequest = {
  ...baseRequest, subject: 'English', strands: ['Literary analysis'], subStrands: ['Literature'], topics: ['Prose and poetry'], totalMarks: 25,
  blueprint: { sections: [
    { id: 'composition', title: 'Composition', question_type: 'essay', count: 1, marks_per_question: 5, difficulty: 'medium' },
    { id: 'oral', title: 'Oral literature', question_type: 'case_study', count: 1, marks_per_question: 5, difficulty: 'medium' },
    { id: 'novella', title: 'Novella', question_type: 'case_study', count: 1, marks_per_question: 5, difficulty: 'medium' },
    { id: 'play', title: 'Play', question_type: 'case_study', count: 1, marks_per_question: 5, difficulty: 'medium' },
    { id: 'poetry', title: 'Poetry', question_type: 'case_study', count: 1, marks_per_question: 5, difficulty: 'medium' },
  ], total_marks: 25 },
};
const literarySlots = getExamBlueprintSlots(literaryRequest);
const literaryQuestions = literarySlots.map((slot) => ({
  ...question(slot.questionType, slot.marks, slot.questionNumber),
  strand: 'Literary analysis', sub_strand: 'Literature', topic: 'Prose and poetry',
  blueprint_section_id: slot.id, blueprint_item_index: slot.itemIndex, blueprint_question_number: slot.questionNumber,
}));
const literary = await repairGeneratedExam(literaryRequest, literaryQuestions, { rewriteQuestion: async () => null, rewriteVisual: async () => null });
assert.equal(literary.status, 'clean');
assert.equal(literary.questions.length, 5, 'five literary slots must remain five distinct slots');
assert.deepEqual(literary.questions.map((item) => item.question_type), ['essay', 'case_study', 'case_study', 'case_study', 'case_study']);
assert.deepEqual(literary.questions.map((item) => (item as GeneratedExamQuestion & { blueprint_question_number?: number }).blueprint_question_number), [1, 2, 3, 4, 5]);

const partialCalls = { count: 0 };
const partial = await repairGeneratedExam(practicalRequest, [question('case_study', 10, 1), { ...question('case_study', 10, 2), correct_answer: '', marking_scheme: '' }, question('case_study', 10, 3)], adapterFor(practicalRequest, partialCalls, 'partial'));
assert.equal(partial.status, 'repaired');
assert.equal(partial.questions.length, 3);
assert.ok(partial.questions.every((item) => item.correct_answer && item.marking_scheme));

const errorCalls = { count: 0 };
const failed = await repairGeneratedExam(practicalRequest, [question('case_study', 10, 1), question('case_study', 10, 2)], adapterFor(practicalRequest, errorCalls, 'throw'));
assert.equal(failed.status, 'failed', 'adapter failure must fail honestly rather than accept a shortened fixed paper');
assert.equal(failed.droppedQuestions, 0, 'fixed-paper recovery must not report a dropped slot as acceptable');
assert.equal(failed.questions.length, 2, 'the failed report preserves the received positions for diagnosis');
assert.match(failed.failureMessage || '', /fixed blueprint slots|not shortened/i);
assert.equal(errorCalls.count, 3, 'one missing slot receives only its bounded retry budget');

const mapRequest: ExamGenerationRequest = {
  ...baseRequest, subject: 'Social Studies', strands: ['Map Work'], subStrands: ['East Africa'], topics: ['East African neighbouring countries'], totalMarks: 5,
  blueprint: { sections: [{ id: 'map-task', title: 'Map-based neighbouring-countries task', question_type: 'case_study', count: 1, marks_per_question: 5, difficulty: 'medium' }], total_marks: 5 },
};
let mapAdapterCalls = 0;
const mapResult = await repairGeneratedExam(mapRequest, [{...question('case_study', 5, 1),strand:'Map Work',sub_strand:'East Africa',topic:'East African neighbouring countries'}], {
  rewriteQuestion: async () => { mapAdapterCalls += 1; return null; },
  rewriteVisual: async () => null,
});
assert.equal(mapResult.status, 'repaired');
assert.equal(mapAdapterCalls, 0, 'the deterministic required-map fallback must not ask for a non-visual rewrite');
assert.equal(mapResult.questions.length, 1);
assert.equal(mapResult.questions[0]?.visual_spec?.asset_type, 'map');
assert.ok(mapResult.questions[0]?.image_url, 'fallback map must be rendered by the supported vector-map renderer');
assert.ok(!mapResult.validation.issues.some((issue) => issue.code === REQUIRED_MAP_MISSING));
assert.equal(mapResult.questions[0]?.sub_parts?.reduce((sum, part) => sum + part.marks, 0), 5);
assert.match(mapResult.questions[0]?.correct_answer || '', /Uganda|Tanzania/);

let deadlineCalls=0;
const expired=await repairGeneratedExam(practicalRequest,[question('case_study',10,1)],{rewriteQuestion:async()=>{deadlineCalls++;return null;},rewriteVisual:async()=>null},{deadlineAt:Date.now()-1});
assert.equal(expired.status,'failed');
assert.equal(deadlineCalls,0,'expired shared deadlines must prevent new provider work');
console.log('PASS: fixed practical/literary counts, partial-answer repair, bounded adapter errors, and answerable East Africa map fallback preserve exact contracts.');
