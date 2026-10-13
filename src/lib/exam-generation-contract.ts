import type {
  ExamBlueprintSection,
  ExamGenerationRequest,
  GeneratedExamQuestion,
  QuestionType,
} from './exam-schema.js';
import { allocateQuestionBlueprint } from './exam-schema.js';

/** One exact output position requested by a paper blueprint. */
export interface ExamBlueprintSlot {
  sectionIndex: number;
  itemIndex: number;
  questionNumber: number;
  id: string;
  title: string;
  questionType: QuestionType;
  marks: number;
  difficulty: ExamBlueprintSection['difficulty'];
  strand?: string;
  subStrand?: string;
  topic?: string;
  competency?: string;
}

/** Runtime-only binding fields accepted on generated questions without changing persistence schema. */
export interface BlueprintBoundQuestion {
  blueprint_section_id?: string;
  blueprint_section_title?: string;
  blueprint_item_index?: number;
  blueprint_question_number?: number;
}

export type BoundGeneratedExamQuestion = GeneratedExamQuestion & BlueprintBoundQuestion;

function slotFromSection(section: ExamBlueprintSection, sectionIndex: number, itemIndex: number, questionNumber: number): ExamBlueprintSlot {
  return {
    sectionIndex,
    itemIndex,
    questionNumber,
    id: section.id,
    title: section.title || section.question_type,
    questionType: section.question_type,
    marks: section.marks_per_question,
    difficulty: section.difficulty,
    strand: section.strand,
    subStrand: section.sub_strand,
    topic: section.topic,
    competency: section.competency,
  };
}

/** Expand grouped blueprint sections into the exact ordered question slots. */
export function getExamBlueprintSlots(request: ExamGenerationRequest): ExamBlueprintSlot[] {
  if (request.blueprint?.sections.length) {
    let questionNumber = 1;
    return request.blueprint.sections.flatMap((section, sectionIndex) => Array.from({ length: section.count }, (_, itemIndex) => {
      const slot = slotFromSection(section, sectionIndex, itemIndex, questionNumber);
      questionNumber += 1;
      return slot;
    }));
  }

  // Flexible requests normally receive a blueprint from the API route. Keep a
  // deterministic contract for direct provider callers and reliability tests too.
  let questionNumber = 1;
  return allocateQuestionBlueprint(request).flatMap((entry, sectionIndex) => Array.from({ length: entry.count }, (_, itemIndex) => ({
    sectionIndex,
    itemIndex,
    questionNumber: questionNumber++,
    id: `generated-${sectionIndex + 1}`,
    title: entry.type,
    questionType: entry.type,
    marks: Math.max(1, Math.round(entry.marks / Math.max(1, entry.count))),
    difficulty: request.difficulty === 'mixed' ? 'medium' : request.difficulty,
  })));
}

export function hasFixedBlueprint(request: ExamGenerationRequest): boolean {
  return Boolean(request.blueprint?.sections.length);
}

export function expectedExamQuestionCount(request: ExamGenerationRequest): number {
  return getExamBlueprintSlots(request).length;
}

/** Backwards-compatible descriptive alias for provider finalizers. */
export const expectedBlueprintQuestionCount = expectedExamQuestionCount;

export function expectedExamMarks(request: ExamGenerationRequest): number {
  if (request.blueprint?.sections.length) {
    return request.blueprint.sections.reduce((sum, section) => sum + section.count * section.marks_per_question, 0);
  }
  return Math.round(request.totalMarks);
}

function bindingOf(question: GeneratedExamQuestion): BlueprintBoundQuestion {
  return question as GeneratedExamQuestion & BlueprintBoundQuestion;
}

/** Return the explicit provider-declared section id, if one was supplied. */
export function questionBlueprintId(question: GeneratedExamQuestion): string {
  return String(bindingOf(question).blueprint_section_id || '').trim();
}

export function questionBlueprintItemIndex(question: GeneratedExamQuestion): number | null {
  const value = Number(bindingOf(question).blueprint_item_index);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function questionBlueprintNumber(question: GeneratedExamQuestion): number | null {
  const value = Number(bindingOf(question).blueprint_question_number);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** Stable identity for a slot even when several items share one section id. */
export function blueprintSlotKey(slot: ExamBlueprintSlot): string {
  return `${slot.id}:${slot.itemIndex}`;
}

/** Bind an otherwise unannotated question to its positional slot without changing content. */
export function bindQuestionToSlot(question: GeneratedExamQuestion, slot: ExamBlueprintSlot): BoundGeneratedExamQuestion {
  const binding = bindingOf(question);
  return {
    ...question,
    ...(binding.blueprint_section_id ? {} : { blueprint_section_id: slot.id }),
    ...(binding.blueprint_section_title ? {} : { blueprint_section_title: slot.title }),
    ...(Number.isFinite(binding.blueprint_item_index) ? {} : { blueprint_item_index: slot.itemIndex }),
    ...(Number.isFinite(binding.blueprint_question_number) ? {} : { blueprint_question_number: slot.questionNumber }),
  };
}

/** A provider question is in the correct exact component slot. */
export function questionMatchesBlueprintSlot(question: GeneratedExamQuestion | undefined, slot: ExamBlueprintSlot): boolean {
  if (!question) return false;
  const binding = bindingOf(question);
  const declaredId = String(binding.blueprint_section_id || '').trim();
  const declaredItemIndex = Number(binding.blueprint_item_index);
  const declaredNumber = Number(binding.blueprint_question_number);
  return question.question_type === slot.questionType
    && question.marks === slot.marks
    && (!declaredId || declaredId === slot.id)
    && (!Number.isFinite(declaredItemIndex) || declaredItemIndex === slot.itemIndex)
    && (!Number.isFinite(declaredNumber) || declaredNumber === slot.questionNumber);
}

/** Get a human-readable exact component description for prompts and errors. */
export function describeBlueprintSlot(slot: ExamBlueprintSlot): string {
  const scope = [slot.strand, slot.subStrand, slot.topic].filter(Boolean).join(' -> ');
  return `${slot.questionNumber}. ${slot.id} | ${slot.title} | ${slot.questionType} | ${slot.marks} mark${slot.marks === 1 ? '' : 's'}${scope ? ` | ${scope}` : ''}`;
}

/** Preserve provider bindings while assigning missing positional bindings to a complete paper. */
export function bindQuestionsToBlueprint(request: ExamGenerationRequest, questions: GeneratedExamQuestion[]): BoundGeneratedExamQuestion[] {
  const slots = getExamBlueprintSlots(request);
  return questions.map((question, index) => slots[index] ? bindQuestionToSlot(question, slots[index]) : question as BoundGeneratedExamQuestion);
}
