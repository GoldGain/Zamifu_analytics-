import type { ExamBlueprint, ExamGenerationRequest, GeneratedExamQuestion } from './exam-schema';
import { hasCompleteTableVisual } from './exam-visuals';

export type ExamValidationSeverity = 'critical' | 'warning' | 'info';

export interface ExamValidationIssue {
  code: string;
  severity: ExamValidationSeverity;
  message: string;
  questionIndex?: number;
}

export interface ExamValidationSummary {
  issues: ExamValidationIssue[];
  criticalCount: number;
  warningCount: number;
  passed: boolean;
}

function normalizeStem(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function blueprintCount(blueprint?: ExamBlueprint): number | null {
  return blueprint?.sections?.length
    ? blueprint.sections.reduce((sum, section) => sum + section.count, 0)
    : null;
}

function blueprintMarks(blueprint?: ExamBlueprint): number | null {
  return blueprint?.sections?.length
    ? blueprint.sections.reduce((sum, section) => sum + section.count * section.marks_per_question, 0)
    : null;
}

export function validateGeneratedExam(request: ExamGenerationRequest, questions: GeneratedExamQuestion[]): ExamValidationSummary {
  const issues: ExamValidationIssue[] = [];
  const expectedCount = blueprintCount(request.blueprint);
  const expectedMarks = blueprintMarks(request.blueprint) ?? request.totalMarks;
  const actualMarks = questions.reduce((sum, question) => sum + question.marks, 0);

  if (!questions.length) {
    issues.push({ code: 'NO_QUESTIONS', severity: 'critical', message: 'The paper contains no valid questions.' });
  }
  if (expectedCount !== null && questions.length !== expectedCount) {
    issues.push({ code: 'QUESTION_COUNT_MISMATCH', severity: 'critical', message: `Blueprint requires ${expectedCount} questions but ${questions.length} were generated.` });
  }
  if (actualMarks !== expectedMarks) {
    issues.push({ code: 'TOTAL_MARKS_MISMATCH', severity: 'critical', message: `The generated questions total ${actualMarks} marks instead of ${expectedMarks}.` });
  }
  if (request.includeImages && questions.length > 0 && !questions.some((question) => question.visual_spec)) {
    issues.push({ code: 'VISUAL_REQUIRED', severity: 'critical', message: 'Visual questions are enabled, but the paper contains no structured visual specification.' });
  }

  const seen = new Map<string, number>();
  questions.forEach((question, index) => {
    const stem = normalizeStem(question.question_text);
    if (!stem) issues.push({ code: 'EMPTY_STEM', severity: 'critical', message: 'Question text is empty.', questionIndex: index });
    if (stem && seen.has(stem)) {
      issues.push({ code: 'DUPLICATE_STEM', severity: 'critical', message: `Question duplicates question ${Number(seen.get(stem)) + 1}.`, questionIndex: index });
    } else if (stem) seen.set(stem, index);
    if (!Number.isFinite(question.marks) || question.marks < 1 || question.marks > 30) {
      issues.push({ code: 'INVALID_MARKS', severity: 'critical', message: 'Question marks must be between 1 and 30.', questionIndex: index });
    }
    if (!question.strand || !question.sub_strand) {
      issues.push({ code: 'MISSING_CURRICULUM_TAG', severity: 'warning', message: 'Add a strand and sub-strand tag before approval.', questionIndex: index });
    }
    if (question.question_type === 'multiple_choice') {
      if (!question.options || question.options.length < 2) {
        issues.push({ code: 'MISSING_OPTIONS', severity: 'critical', message: 'Multiple-choice questions need at least two options.', questionIndex: index });
      }
      if (!question.correct_answer) {
        issues.push({ code: 'MISSING_CORRECT_ANSWER', severity: 'critical', message: 'Multiple-choice questions need an expected answer.', questionIndex: index });
      }
    }
    if (question.question_type === 'matching' && (!question.options || question.options.length < 2)) {
      issues.push({ code: 'MISSING_MATCHING_SET', severity: 'critical', message: 'Matching questions need a matching set.', questionIndex: index });
    }
    if (question.question_type === 'essay' && question.marks < 4) {
      issues.push({ code: 'ESSAY_MARKS_LOW', severity: 'warning', message: 'Extended-response questions normally need enough marks for a developed response.', questionIndex: index });
    }
    if (question.visual_spec && !question.image_url) {
      issues.push({ code: 'VISUAL_NOT_RENDERED', severity: 'critical', message: 'This question has a visual specification but no rendered visual asset.', questionIndex: index });
    }
    if (question.visual_spec && !hasCompleteTableVisual(question)) {
      issues.push({ code: 'TABLE_DATA_INCOMPLETE', severity: 'critical', message: 'This table visual is missing complete learner-facing rows or values.', questionIndex: index });
    }
    if (question.image_url && !question.visual_spec) {
      issues.push({ code: 'VISUAL_METADATA_MISSING', severity: 'warning', message: 'Add a caption, alt text, and visual type for this image.', questionIndex: index });
    }
  });

  if (request.durationMinutes > 0 && questions.length > request.durationMinutes * 2) {
    issues.push({ code: 'TIME_PRESSURE', severity: 'warning', message: 'The question count may be too high for the selected duration.' });
  }

  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  return { issues, criticalCount, warningCount, passed: criticalCount === 0 };
}
