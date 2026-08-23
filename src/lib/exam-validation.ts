import type { ExamBlueprint, ExamGenerationRequest, GeneratedExamQuestion } from './exam-schema';
import { hasCompleteTableVisual } from './exam-visuals.js';

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

function normalizeCurriculumLabel(value: unknown): string {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

export interface ExamValidationOptions {
  previousStems?: string[];
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

export function validateGeneratedExam(
  request: ExamGenerationRequest,
  questions: GeneratedExamQuestion[],
  options: ExamValidationOptions = {},
): ExamValidationSummary {
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
  const previousStems = new Set((options.previousStems || []).map(normalizeStem).filter(Boolean));
  const curriculumSelected = Boolean(request.strands.length || request.subStrands.length || request.topics.length);
  const scopeNodes = request.curriculumScope?.length
    ? request.curriculumScope
    : request.strands.map((strand) => ({ strand, subStrands: [], topics: [] }));
  const scopeByStrand = new Map<string, { subStrands: Set<string>; topics: Set<string> }>();
  scopeNodes.forEach((node) => {
    const strandKey = normalizeCurriculumLabel(node.strand);
    if (!strandKey) return;
    const current = scopeByStrand.get(strandKey) || { subStrands: new Set<string>(), topics: new Set<string>() };
    node.subStrands.forEach((value) => { const key = normalizeCurriculumLabel(value); if (key) current.subStrands.add(key); });
    node.topics.forEach((value) => { const key = normalizeCurriculumLabel(value); if (key) current.topics.add(key); });
    scopeByStrand.set(strandKey, current);
  });
  const selectedStrands = new Set(request.strands.map(normalizeCurriculumLabel).filter(Boolean));
  const selectedSubStrands = new Set(request.subStrands.map(normalizeCurriculumLabel).filter(Boolean));
  const selectedTopics = new Set(request.topics.map(normalizeCurriculumLabel).filter(Boolean));

  questions.forEach((question, index) => {
    const stem = normalizeStem(question.question_text);
    if (!stem) issues.push({ code: 'EMPTY_STEM', severity: 'critical', message: 'Question text is empty.', questionIndex: index });
    if (stem && seen.has(stem)) {
      issues.push({ code: 'DUPLICATE_STEM', severity: 'critical', message: `Question duplicates question ${Number(seen.get(stem)) + 1}.`, questionIndex: index });
    } else if (stem) {
      seen.set(stem, index);
      if (previousStems.has(stem)) {
        issues.push({ code: 'DUPLICATE_EXISTING_STEM', severity: 'critical', message: 'This question repeats a question from a recent paper in the same school, grade, and subject. Generate a fresh version.', questionIndex: index });
      }
    }
    if (!Number.isFinite(question.marks) || question.marks < 1 || question.marks > 30) {
      issues.push({ code: 'INVALID_MARKS', severity: 'critical', message: 'Question marks must be between 1 and 30.', questionIndex: index });
    }
    const strandKey = normalizeCurriculumLabel(question.strand);
    const subStrandKey = normalizeCurriculumLabel(question.sub_strand);
    const topicKey = normalizeCurriculumLabel(question.topic);
    if (!question.strand || !question.sub_strand) {
      issues.push({ code: 'MISSING_CURRICULUM_TAG', severity: curriculumSelected ? 'critical' : 'warning', message: curriculumSelected ? 'Every question must include a strand and sub-strand tag for the selected curriculum scope.' : 'Add a strand and sub-strand tag before approval.', questionIndex: index });
    }
    if (request.strands.length && (!strandKey || !selectedStrands.has(strandKey))) {
      issues.push({ code: 'STRAND_OUT_OF_SCOPE', severity: 'critical', message: `Question strand must be one of the selected strands: ${request.strands.join(', ')}.`, questionIndex: index });
    }
    const strandScope = strandKey ? scopeByStrand.get(strandKey) : undefined;
    if (request.curriculumScope?.length && strandKey && !strandScope) {
      issues.push({ code: 'CURRICULUM_ANCESTRY_MISMATCH', severity: 'critical', message: 'Question strand is not present in the selected curriculum ancestry.', questionIndex: index });
    }
    const allowedSubStrands = selectedSubStrands.size ? selectedSubStrands : (strandScope?.subStrands || new Set<string>());
    if (allowedSubStrands.size && (!subStrandKey || !allowedSubStrands.has(subStrandKey))) {
      issues.push({ code: 'SUB_STRAND_OUT_OF_SCOPE', severity: 'critical', message: 'Question sub-strand is outside the selected strand/sub-strand scope.', questionIndex: index });
    }
    if (request.topics.length && (!topicKey || !selectedTopics.has(topicKey))) {
      issues.push({ code: 'TOPIC_OUT_OF_SCOPE', severity: 'critical', message: `Question topic must be one of the selected topics: ${request.topics.join(', ')}.`, questionIndex: index });
    } else if (!request.topics.length && strandScope?.topics.size && topicKey && !strandScope.topics.has(topicKey)) {
      issues.push({ code: 'TOPIC_ANCESTRY_MISMATCH', severity: 'critical', message: 'Question topic is not present under the selected strand ancestry.', questionIndex: index });
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
