import { normalizePaperVariant, paperVariantLabel, supportsTwoPapers } from './exam-construction.js';
import { getKjseaPaperSpec } from './kjsea-paper-formats.js';

export const CBC_QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice', defaultMarks: 1 },
  { value: 'multiple_response', label: 'Multiple Response', defaultMarks: 2 },
  { value: 'modified_true_false', label: 'Modified True / False', defaultMarks: 1 },
  { value: 'completion', label: 'Completion', defaultMarks: 2 },
  { value: 'matching', label: 'Matching', defaultMarks: 4 },
  { value: 'short_answer', label: 'Short Answer', defaultMarks: 3 },
  { value: 'numeric_response', label: 'Numeric Response', defaultMarks: 3 },
  { value: 'case_study', label: 'Case Study', defaultMarks: 6 },
  { value: 'essay', label: 'Extended Response', defaultMarks: 8 },
] as const;

export type QuestionType = (typeof CBC_QUESTION_TYPES)[number]['value'];
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type ExamFormat = 'standard30' | 'cbe' | 'kpsea' | 'kjsea' | 'custom';
export type PaperVariant = 'single' | 'paper1' | 'paper2';
export type AssessmentLevel = 'pre_primary' | 'lower_primary' | 'upper_primary' | 'junior_secondary' | 'senior_secondary';

export interface ExamBlueprintSection {
  id: string;
  title?: string;
  question_type: QuestionType;
  count: number;
  marks_per_question: number;
  difficulty: Difficulty;
  strand?: string;
  sub_strand?: string;
  topic?: string;
  competency?: string;
}

export interface ExamBlueprint {
  sections: ExamBlueprintSection[];
  total_marks: number;
  estimated_minutes?: number;
  paper_variant?: PaperVariant;
}

export interface GeneratedExamSubPart {
  label: string;
  prompt: string;
  marks: number;
  correct_answer?: string;
  marking_scheme?: string;
}

export interface GeneratedExamQuestion {
  id?: string;
  question_number?: number;
  question_type: QuestionType;
  question_text: string;
  options?: string[];
  correct_answer: string;
  marking_scheme: string;
  marks: number;
  sub_parts?: GeneratedExamSubPart[];
  difficulty: Exclude<Difficulty, 'mixed'>;
  strand?: string;
  sub_strand?: string;
  topic?: string;
  learning_outcome?: string;
  competency?: string;
  cognitive_level?: string;
  image_url?: string | null;
  source_website?: string | null;
  visual_spec?: Record<string, unknown> | null;
  review_status?: 'draft' | 'approved' | 'flagged';
}

export interface ExamPaper {
  id?: string;
  title: string;
  school_name?: string;
  grade_level: string;
  subject: string;
  term?: string;
  year: number;
  duration_minutes: number;
  total_marks: number;
  instructions: string[];
  questions: GeneratedExamQuestion[];
  marking_scheme?: string;
  format: ExamFormat;
  paper_variant?: PaperVariant;
  generated_at?: string;
  status?: 'draft' | 'reviewed' | 'approved' | 'archived';
  version_number?: number;
  blueprint?: ExamBlueprint;
  validation_results?: Array<{ code: string; severity: 'critical' | 'warning' | 'info'; message: string; questionIndex?: number }>;
}

export interface CurriculumScopeNode {
  strand: string;
  subStrands: string[];
  topics: string[];
}

export interface ExamGenerationRequest {
  title?: string;
  gradeLevel: string;
  subject: string;
  strands: string[];
  subStrands: string[];
  topics: string[];
  curriculumScope?: CurriculumScopeNode[];
  questionTypes: QuestionType[];
  totalMarks: number;
  durationMinutes: number;
  difficulty: Difficulty;
  includeImages: boolean;
  includeMarkingScheme: boolean;
  format: ExamFormat;
  term?: string;
  schoolName?: string;
  level?: AssessmentLevel;
  curriculumVersion?: string;
  learningOutcomes?: string[];
  competencies?: string[];
  blueprint?: ExamBlueprint;
  paperVariant?: PaperVariant;
  preset?: string;
  variationKey?: string;
  avoidQuestionStems?: string[];
}

export interface ExamGenerationResponse {
  paper: ExamPaper;
  sourceSummary?: string[];
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function makeExamTitle(request: ExamGenerationRequest): string {
  const suppliedTitle = cleanText(request.title || '');
  if (suppliedTitle) return suppliedTitle;
  const term = request.term ? ` — ${request.term}` : '';
  const variant = supportsTwoPapers(request.subject) ? normalizePaperVariant(request.paperVariant) : 'single';
  const variantLabel = variant === 'single' ? '' : ` \u2014 ${paperVariantLabel(variant)}`;
  return `${request.subject} ${request.gradeLevel} Assessment${variantLabel}${term}`;
}

export function questionTypeLabel(type: QuestionType): string {
  return CBC_QUESTION_TYPES.find((item) => item.value === type)?.label || type;
}

export function validateExamRequest(request: ExamGenerationRequest): string[] {
  const errors: string[] = [];
  if (!cleanText(request.gradeLevel)) errors.push('Select a grade level.');
  if (!cleanText(request.subject)) errors.push('Select a subject.');
  if (!request.questionTypes.length) errors.push('Select at least one question type.');
  if (request.totalMarks < 5 || request.totalMarks > 200) errors.push('Total marks must be between 5 and 200.');
  if (request.durationMinutes < 10 || request.durationMinutes > 240) errors.push('Duration must be between 10 and 240 minutes.');
  if (request.format === 'standard30' && request.totalMarks !== 30) errors.push('Standard Assessment papers must total exactly 30 marks.');
  if (request.format === 'kjsea') {
    const expectedMarks = getKjseaPaperSpec(request.subject, normalizePaperVariant(request.paperVariant))?.marks ?? 100;
    if (request.totalMarks !== expectedMarks) errors.push(`This KJSEA paper must total exactly ${expectedMarks} marks.`);
  }
  const variant = normalizePaperVariant(request.paperVariant);
  if (variant !== 'single' && !supportsTwoPapers(request.subject)) {
    errors.push('Paper 1 and Paper 2 apply only to English, Kiswahili and Integrated Science.');
  }
  if (request.blueprint) {
    if (!request.blueprint.sections.length) errors.push('Add at least one blueprint section.');
    const blueprintTotal = request.blueprint.sections.reduce((sum, section) => sum + section.count * section.marks_per_question, 0);
    if (blueprintTotal !== request.totalMarks) errors.push(`Blueprint marks (${blueprintTotal}) must equal the requested total (${request.totalMarks}).`);
    if (request.blueprint.sections.some((section) => section.count < 1 || section.marks_per_question < 1)) errors.push('Blueprint sections must have positive item counts and marks.');
  }
  return errors;
}

export function makeFormatBlueprint(format: ExamFormat, totalMarks: number, difficulty: Difficulty = 'mixed'): ExamBlueprint | undefined {
  const safeTotal = Math.max(1, Math.round(totalMarks));
  if (format === 'standard30') {
    return {
      sections: [
        {
          id: 'standard30-objective',
          title: 'Section A: Multiple Choice Questions',
          question_type: 'multiple_choice',
          count: 10,
          marks_per_question: 1,
          difficulty,
        },
        {
          id: 'standard30-structured',
          title: 'Section B: Structured Questions',
          question_type: 'short_answer',
          count: 4,
          marks_per_question: 5,
          difficulty,
        },
      ],
      total_marks: safeTotal,
    };
  }
  if (format === 'kpsea') {
    return {
      sections: [{
        id: 'kpsea-objective',
        title: 'Objective questions',
        question_type: 'multiple_choice',
        count: safeTotal,
        marks_per_question: 1,
        difficulty,
      }],
      total_marks: safeTotal,
    };
  }
  if (format === 'kjsea') {
    return {
      sections: [
        {
          id: 'kjsea-objective',
          title: 'Section A: Multiple Choice Questions',
          question_type: 'multiple_choice',
          count: 20,
          marks_per_question: 1,
          difficulty,
        },
        {
          id: 'kjsea-structured',
          title: 'Section B: Structured Questions',
          question_type: 'case_study',
          count: 8,
          marks_per_question: 10,
          difficulty,
        },
      ],
      total_marks: safeTotal,
    };
  }
  return undefined;
}

export function makePaperVariantBlueprint(
  blueprint: ExamBlueprint | undefined,
  variant: PaperVariant,
  format: ExamFormat,
): ExamBlueprint | undefined {
  const resolved = blueprint || makeFormatBlueprint(format, 0) || undefined;
  if (!resolved || variant === 'single') return blueprint;
  const prefix = paperVariantLabel(variant).toUpperCase();
  return {
    ...resolved,
    paper_variant: variant,
    sections: resolved.sections.map((section) => ({
      ...section,
      id: `${section.id}-${variant}`,
      title: `${prefix} \u00b7 ${section.title || section.question_type}`,
    })),
  };
}

export function makeBalancedBlueprint(questionTypes: QuestionType[], totalMarks: number, difficulty: Difficulty = 'mixed'): ExamBlueprint {
  const safeTotal = Math.max(1, Math.round(totalMarks));
  const selected = Array.from(new Set(questionTypes)).filter((type): type is QuestionType => CBC_QUESTION_TYPES.some((item) => item.value === type));
  const types = selected.length ? selected : ['multiple_choice' as QuestionType];
  const totalWeight = types.reduce((sum, type) => sum + (CBC_QUESTION_TYPES.find((item) => item.value === type)?.defaultMarks || 1), 0);
  const countPerType = Math.max(1, Math.round(safeTotal / Math.max(1, totalWeight)));
  const items = types.flatMap((type) => Array.from({ length: countPerType }, () => ({
    type,
    marks: CBC_QUESTION_TYPES.find((item) => item.value === type)?.defaultMarks || 1,
  })));
  let delta = safeTotal - items.reduce((sum, item) => sum + item.marks, 0);
  const adjustmentOrder = items.map((item, index) => index).sort((left, right) => items[right].marks - items[left].marks);
  while (delta !== 0) {
    let changed = false;
    for (const index of adjustmentOrder) {
      if (delta > 0 && items[index].marks < 30) {
        items[index].marks += 1;
        delta -= 1;
        changed = true;
      } else if (delta < 0 && items[index].marks > 1) {
        items[index].marks -= 1;
        delta += 1;
        changed = true;
      }
      if (delta === 0) break;
    }
    if (!changed) break;
  }
  if (delta !== 0) {
    throw new Error(`Could not allocate exactly ${safeTotal} marks across the selected question types.`);
  }

  const sections: ExamBlueprintSection[] = [];
  for (const item of items) {
    const previous = sections[sections.length - 1];
    if (previous && previous.question_type === item.type && previous.marks_per_question === item.marks) {
      previous.count += 1;
    } else {
      sections.push({
        id: `balanced-${sections.length + 1}`,
        title: questionTypeLabel(item.type),
        question_type: item.type,
        count: 1,
        marks_per_question: item.marks,
        difficulty,
      });
    }
  }
  return { sections, total_marks: safeTotal };
}

export function allocateQuestionBlueprint(request: ExamGenerationRequest): Array<{ type: QuestionType; count: number; marks: number }> {
  if (request.blueprint?.sections.length) {
    return request.blueprint.sections.map((section) => ({
      type: section.question_type,
      count: section.count,
      marks: section.count * section.marks_per_question,
    }));
  }
  const selected: QuestionType[] = request.questionTypes.length ? [...request.questionTypes] : ['multiple_choice'];
  const markWeights = selected.map((type) => CBC_QUESTION_TYPES.find((item) => item.value === type)?.defaultMarks || 1);
  const totalWeight = markWeights.reduce((sum, weight) => sum + weight, 0);
  let remainingMarks = request.totalMarks;
  return selected.map((type, index) => {
    const typicalMarks = Math.max(1, markWeights[index]);
    const marks = index === selected.length - 1
      ? remainingMarks
      : Math.max(typicalMarks, Math.round((request.totalMarks * typicalMarks) / totalWeight));
    remainingMarks -= marks;
    return { type, count: Math.max(1, Math.round(marks / typicalMarks)), marks };
  });
}
