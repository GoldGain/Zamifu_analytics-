/**
 * Repair pass for AI-generated exam papers.
 *
 * A single malformed question used to fail the whole paper. The validation rules
 * themselves stay exactly as they were; this module changes what happens when
 * they fire. A question whose curriculum tags fall outside the teacher's
 * selection is sent back to the model, and a visual whose specification is
 * incomplete is either completed or dropped from that one question.
 *
 * Nothing here can make an unusable paper look valid: questions that cannot be
 * repaired are removed, and a paper is still rejected when too much of it is
 * unrecoverable.
 */
import type { ExamGenerationRequest, GeneratedExamQuestion } from './exam-schema.js';
import {
  validateGeneratedExam,
  type ExamValidationIssue,
  type ExamValidationSummary,
} from './exam-validation.js';

/** How many times one question may be sent back for a scope/content rewrite. */
export const MAX_SCOPE_REPAIR_ATTEMPTS = 3;
/** How many times one visual may be sent back before it is dropped. */
export const MAX_VISUAL_REPAIR_ATTEMPTS = 2;
/** Share of questions that may be dropped before the paper is a genuine failure. */
export const MAX_UNREPAIRABLE_RATIO = 0.3;

/** Curriculum-ancestry problems: the question is out of the teacher's scope. */
export const SCOPE_ISSUE_CODES: ReadonlySet<string> = new Set([
  'SUB_STRAND_OUT_OF_SCOPE',
  'STRAND_OUT_OF_SCOPE',
  'TOPIC_OUT_OF_SCOPE',
  'CURRICULUM_ANCESTRY_MISMATCH',
  'TOPIC_ANCESTRY_MISMATCH',
  'MISSING_CURRICULUM_TAG',
]);

/** Problems confined to the visual, which never require dropping the question. */
export const VISUAL_ISSUE_CODES: ReadonlySet<string> = new Set([
  'VISUAL_SPEC_INCOMPLETE',
  'TABLE_DATA_INCOMPLETE',
  'VISUAL_NOT_RENDERED',
  'VISUAL_METADATA_MISSING',
]);

/**
 * Counted globally rather than against one question, so they are tolerated when
 * the repair pass itself changed the question count.
 */
const COUNT_TOLERATED_CODES: ReadonlySet<string> = new Set([
  'QUESTION_COUNT_MISMATCH',
  'TOTAL_MARKS_MISMATCH',
]);

export interface ExamRepairAction {
  kind: 'question_rewritten' | 'visual_repaired' | 'visual_dropped' | 'question_dropped';
  /** 1-based position of the question at the time the action was taken. */
  questionNumber: number;
  detail: string;
  codes: string[];
}

export interface ExamRepairArgs {
  request: ExamGenerationRequest;
  question: GeneratedExamQuestion;
  issues: ExamValidationIssue[];
  /** 1-based attempt number for this question or visual. */
  attempt: number;
}

/**
 * Provider bridge. The caller decides which model to ask; this module decides
 * when to ask, how often, and what to do when the answer is still no good.
 */
export interface ExamRepairAdapter {
  rewriteQuestion: (args: ExamRepairArgs) => Promise<GeneratedExamQuestion | null>;
  rewriteVisual: (args: ExamRepairArgs) => Promise<GeneratedExamQuestion | null>;
}

export interface ExamRepairReport {
  status: 'clean' | 'repaired' | 'failed';
  questions: GeneratedExamQuestion[];
  validation: ExamValidationSummary;
  actions: ExamRepairAction[];
  originalCount: number;
  retainedCount: number;
  rewrittenQuestions: number;
  repairedVisuals: number;
  droppedVisuals: number;
  droppedQuestions: number;
  /** True when questions were dropped, so the paper no longer matches its blueprint. */
  blueprintReconciled: boolean;
  /** Non-blocking sentence for the teacher. */
  teacherMessage: string;
  /** Set only when the paper genuinely cannot be saved. */
  failureMessage?: string;
}

export interface ExamRepairOptions {
  previousStems?: string[];
  maxUnrepairableRatio?: number;
}

/** Remove a visual but keep the question itself. */
export function dropQuestionVisual(question: GeneratedExamQuestion): GeneratedExamQuestion {
  return { ...question, image_url: null, visual_spec: null };
}

/** Critical issues attached to one question position in the current paper. */
function issuesForPosition(
  request: ExamGenerationRequest,
  questions: GeneratedExamQuestion[],
  index: number,
  options: ExamRepairOptions,
): ExamValidationIssue[] {
  const summary = validateGeneratedExam(request, questions, { previousStems: options.previousStems });
  return summary.issues.filter((issue) => issue.severity === 'critical' && issue.questionIndex === index);
}

function uniqueCodes(issues: ExamValidationIssue[]): string[] {
  return Array.from(new Set(issues.map((issue) => issue.code)));
}

function codesText(codes: string[]): string {
  return codes.slice(0, 3).join(', ');
}

function isVisualOnly(issues: ExamValidationIssue[]): boolean {
  return issues.length > 0 && issues.every((issue) => VISUAL_ISSUE_CODES.has(issue.code));
}

function markingSchemePresent(questions: GeneratedExamQuestion[]): boolean {
  return questions.some((question) => {
    if (typeof question.marking_scheme === 'string' && question.marking_scheme.trim()) return true;
    return (question.sub_parts || []).some((part) => Boolean(
      (typeof part.marking_scheme === 'string' && part.marking_scheme.trim())
      || (typeof part.correct_answer === 'string' && part.correct_answer.trim()),
    ));
  });
}

function buildTeacherMessage(report: {
  retainedCount: number;
  rewrittenQuestions: number;
  repairedVisuals: number;
  droppedVisuals: number;
  droppedQuestions: number;
}): string {
  const changed = report.rewrittenQuestions + report.repairedVisuals
    + report.droppedVisuals + report.droppedQuestions;
  if (!changed) return 'Paper ready to review.';

  const parts: string[] = [`Generated ${report.retainedCount} question${report.retainedCount === 1 ? '' : 's'}.`];
  if (report.rewrittenQuestions) {
    parts.push(`${report.rewrittenQuestions} question${report.rewrittenQuestions === 1 ? '' : 's'} needed rewriting.`);
  }
  if (report.repairedVisuals) {
    parts.push(`${report.repairedVisuals} visual${report.repairedVisuals === 1 ? '' : 's'} repaired.`);
  }
  if (report.droppedVisuals) {
    parts.push(`${report.droppedVisuals} visual${report.droppedVisuals === 1 ? '' : 's'} dropped.`);
  }
  if (report.droppedQuestions) {
    parts.push(`${report.droppedQuestions} question${report.droppedQuestions === 1 ? '' : 's'} removed.`);
  }
  parts.push('Paper ready to review.');
  return parts.join(' ');
}

/**
 * Repair a generated paper and report what happened.
 *
 * Order matters: question-level problems are fixed first, because rewriting a
 * question also rewrites whatever visual belongs to it. Only then are visuals
 * considered on their own, so a repaired question is not given a second look.
 */
export async function repairGeneratedExam(
  request: ExamGenerationRequest,
  questions: GeneratedExamQuestion[],
  adapter: ExamRepairAdapter,
  options: ExamRepairOptions = {},
): Promise<ExamRepairReport> {
  const state = questions.slice();
  const actions: ExamRepairAction[] = [];
  const originalCount = state.length;

  const rewriteCounts = new Array<number>(state.length).fill(0);
  const visualRepairCounts = new Array<number>(state.length).fill(0);
  const visualDropCounts = new Array<number>(state.length).fill(0);

  // ---- Phase A: rewrite questions whose tags, answers, or structure are wrong.
  for (let index = 0; index < state.length; index += 1) {
    for (let attempt = 1; attempt <= MAX_SCOPE_REPAIR_ATTEMPTS; attempt += 1) {
      const issues = issuesForPosition(request, state, index, options);
      if (!issues.length) break;
      // A visual-only problem is Phase B's job, not a reason to rewrite the question.
      if (isVisualOnly(issues)) break;
      const repaired = await adapter.rewriteQuestion({ request, question: state[index], issues, attempt });
      rewriteCounts[index] = attempt;
      if (!repaired) break;
      state[index] = repaired;
      actions.push({
        kind: 'question_rewritten',
        questionNumber: index + 1,
        detail: `Rewrote question ${index + 1} to satisfy the selected curriculum scope.`,
        codes: uniqueCodes(issues),
      });
      if (!issuesForPosition(request, state, index, options).length) break;
    }
  }

  // ---- Phase B: complete each unusable visual, or drop just that visual.
  for (let index = 0; index < state.length; index += 1) {
    for (let attempt = 1; attempt <= MAX_VISUAL_REPAIR_ATTEMPTS; attempt += 1) {
      const issues = issuesForPosition(request, state, index, options);
      if (!issues.length || !isVisualOnly(issues)) break;
      const repaired = await adapter.rewriteVisual({ request, question: state[index], issues, attempt });
      visualRepairCounts[index] = attempt;
      if (!repaired) break;
      state[index] = repaired;
      actions.push({
        kind: 'visual_repaired',
        questionNumber: index + 1,
        detail: `Completed the visual specification for question ${index + 1}.`,
        codes: uniqueCodes(issues),
      });
      if (!issuesForPosition(request, state, index, options).length) break;
    }
    const remaining = issuesForPosition(request, state, index, options);
    if (remaining.length && isVisualOnly(remaining)) {
      state[index] = dropQuestionVisual(state[index]);
      visualDropCounts[index] = 1;
      actions.push({
        kind: 'visual_dropped',
        questionNumber: index + 1,
        detail: `Removed the unusable visual from question ${index + 1}; the question itself was kept.`,
        codes: uniqueCodes(remaining),
      });
    }
  }

  // ---- Phase C: drop questions that are still broken after their retries.
  const survivors: GeneratedExamQuestion[] = [];
  let droppedQuestions = 0;
  for (let index = 0; index < state.length; index += 1) {
    const issues = issuesForPosition(request, state, index, options);
    if (issues.length) {
      droppedQuestions += 1;
      actions.push({
        kind: 'question_dropped',
        questionNumber: index + 1,
        detail: `Removed question ${index + 1} because it could not be repaired (${codesText(uniqueCodes(issues))}).`,
        codes: uniqueCodes(issues),
      });
      continue;
    }
    survivors.push(state[index]);
  }

  const validation = validateGeneratedExam(request, survivors, { previousStems: options.previousStems });
  const droppedVisuals = visualDropCounts.reduce((sum, value) => sum + value, 0);
  const rewrittenQuestions = rewriteCounts.reduce((sum, value) => sum + value, 0);
  const repairedVisuals = visualRepairCounts.reduce((sum, value) => sum + value, 0);

  // A paper whose count changed during repair cannot still match its blueprint.
  const toleratedCodes = new Set(COUNT_TOLERATED_CODES);
  if (droppedVisuals > 0) {
    // Dropping the last usable visual must not fail the paper either.
    toleratedCodes.add('VISUAL_REQUIRED');
  }
  const fatalIssues = validation.issues.filter(
    (issue) => issue.severity === 'critical' && !toleratedCodes.has(issue.code),
  );

  const droppedRatio = originalCount ? droppedQuestions / originalCount : 1;
  const ratioLimit = options.maxUnrepairableRatio ?? MAX_UNREPAIRABLE_RATIO;
  const base = {
    retainedCount: survivors.length,
    rewrittenQuestions,
    repairedVisuals,
    droppedVisuals,
    droppedQuestions,
  };

  let failureMessage: string | undefined;
  if (!survivors.length) {
    failureMessage = 'We could not generate this paper. Every question was unusable and could not be repaired. Please try again or adjust your strand selection.';
  } else if (!markingSchemePresent(survivors)) {
    failureMessage = 'We could not generate this paper because the marking scheme was missing. Please try again.';
  } else if (droppedRatio > ratioLimit) {
    failureMessage = `We could not generate this paper. Only ${survivors.length} of ${originalCount} questions were valid after repair. Please try again or adjust your strand selection.`;
  } else if (fatalIssues.length) {
    failureMessage = `We could not generate this paper. ${fatalIssues.slice(0, 2).map((issue) => issue.message).join(' ')}`;
  }

  const changed = actions.length > 0;
  return {
    status: failureMessage ? 'failed' : changed ? 'repaired' : 'clean',
    questions: survivors,
    validation,
    actions,
    originalCount,
    retainedCount: survivors.length,
    rewrittenQuestions,
    repairedVisuals,
    droppedVisuals,
    droppedQuestions,
    blueprintReconciled: droppedQuestions > 0,
    teacherMessage: failureMessage || buildTeacherMessage(base),
    failureMessage,
  };
}
