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
export type ExamFormat = 'cbe' | 'kpsea' | 'kjsea' | 'custom';
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
  return `${request.subject} ${request.gradeLevel} Assessment${term}`;
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
    const fullQuestions = Math.floor(safeTotal / 10);
    const remainder = safeTotal % 10;
    const sections: ExamBlueprintSection[] = [];
    if (fullQuestions > 0) {
      sections.push({
        id: 'kjsea-structured-main',
        title: 'Structured and practical questions',
        question_type: 'case_study',
        count: fullQuestions,
        marks_per_question: 10,
        difficulty,
      });
    }
    if (remainder > 0) {
      sections.push({
        id: 'kjsea-structured-remainder',
        title: 'Structured question',
        question_type: 'case_study',
        count: 1,
        marks_per_question: remainder,
        difficulty,
      });
    }
    return { sections, total_marks: safeTotal };
  }
  return undefined;
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
