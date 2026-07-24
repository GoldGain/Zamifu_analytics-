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
  image_url?: string | null;
  source_website?: string | null;
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
}

export interface ExamGenerationRequest {
  title?: string;
  gradeLevel: string;
  subject: string;
  strands: string[];
  subStrands: string[];
  topics: string[];
  questionTypes: QuestionType[];
  totalMarks: number;
  durationMinutes: number;
  difficulty: Difficulty;
  includeImages: boolean;
  includeMarkingScheme: boolean;
  format: ExamFormat;
  term?: string;
  schoolName?: string;
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
  return errors;
}

export function allocateQuestionBlueprint(request: ExamGenerationRequest): Array<{ type: QuestionType; count: number; marks: number }> {
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
