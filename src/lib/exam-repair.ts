/**
 * Repair pass for AI-generated exam papers.
 *
 * A single malformed question used to fail the whole paper. The validation rules
 * themselves stay exactly as they were; this module changes what happens when
 * they fire. A question whose curriculum tags fall outside the teacher's
 * selection is sent back to the model, and a visual whose specification is
 * incomplete is either completed or dropped from that one question.
 *
 * Fixed-blueprint papers retain every required slot. Missing or invalid slots
 * must be recovered with their exact marks/types, or the entire paper fails;
 * they cannot be silently dropped or have their marks forged.
 */
import type { ExamGenerationRequest, GeneratedExamQuestion } from './exam-schema.js';
import {
  validateGeneratedExam,
  type ExamValidationIssue,
  type ExamValidationSummary,
} from './exam-validation.js';
import { DETERMINISTIC_SCIENCE_VISUAL_RULES,DETERMINISTIC_MATH_VISUAL_RULES, withRenderedExamVisual } from './exam-visuals.js';
import {
  isSocialStudiesSubject,
  questionLacksAnswer,
} from './exam-construction.js';
import {
  bindQuestionToSlot,
  getExamBlueprintSlots,
  hasFixedBlueprint,
  questionMatchesBlueprintSlot,
  type ExamBlueprintSlot,
} from './exam-generation-contract.js';
import { EAST_AFRICA_FEATURES } from './exam-map-data.js';
import { REQUIRED_MAP_MISSING } from './exam-validation.js';

/** How many times one question may be sent back for a scope/content rewrite. */
export const MAX_SCOPE_REPAIR_ATTEMPTS = 3;
/** How many times one visual may be sent back before it is dropped. */
export const MAX_VISUAL_REPAIR_ATTEMPTS = 2;
/** Base delay before retrying a failed/incomplete visual specification. */
export const VISUAL_REPAIR_BACKOFF_BASE_MS = 500;
/** Share of questions that may be dropped before a flexible paper is a genuine failure. */
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

/** Problems confined to a visual before a non-visual replacement is attempted. */
export const VISUAL_ISSUE_CODES: ReadonlySet<string> = new Set([
  'VISUAL_REFERENCE_MISSING',
  'VISUAL_SPEC_INCOMPLETE',
  'TABLE_DATA_INCOMPLETE',
  'VISUAL_NOT_RENDERED',
  'VISUAL_METADATA_MISSING',
]);

export interface ExamRepairAction {
  kind: 'question_rewritten' | 'visual_repaired' | 'visual_dropped' | 'question_dropped' | 'map_fallback';
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
  deadlineAt?: number;
}

/** Legacy helper retained for callers that explicitly remove an optional visual. */
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

function waitBeforeVisualRetry(attempt: number): Promise<void> {
  const delay = Math.min(4000, VISUAL_REPAIR_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
  return new Promise((resolve) => setTimeout(resolve, delay));
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

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runner = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    try {
      await runner();
    } catch (error) {
      // One adapter failure must not abort the other bounded workers. The
      // unresolved slot is reported honestly by Phase C instead.
      console.warn('[exam-repair] bounded worker failed:', error instanceof Error ? error.message.slice(0, 180) : 'unknown failure');
    }
  }));
}

async function rewriteBeforeDeadline(
  operation: () => Promise<GeneratedExamQuestion | null>,
  deadlineAt: number,
): Promise<GeneratedExamQuestion | null> {
  if(Date.now()>=deadlineAt)return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),Math.max(1,deadlineAt-Date.now()));})]);
  } catch (error) {
    console.warn('[exam-repair] adapter error:', error instanceof Error ? error.message.slice(0, 180) : 'unknown failure');
    return null;
  } finally {
    if(timer)clearTimeout(timer);
  }
}

function mapScopeSelected(request: ExamGenerationRequest): boolean {
  const selected = [
    ...request.strands,
    ...request.subStrands,
    ...request.topics,
    ...(request.curriculumScope || []).flatMap((node) => [node.strand, ...node.subStrands, ...node.topics]),
  ].join(' ');
  return /\bmap(?:s| work| skills?)?\b|topograph|neighbou?r(?:ing)? countries|countries of east africa|east african countries/i.test(selected);
}

const EAST_AFRICA_NEIGHBOURS = ['Kenya', 'Uganda', 'Tanzania', 'South Sudan', 'Ethiopia', 'Somalia']
  .filter((name) => EAST_AFRICA_FEATURES.some((feature) => feature.name.toLowerCase() === name.toLowerCase()));

function normalizedAnswer(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/^(?:[a-h][.)]|\([a-h]\))\s*/i, '').trim();
}

function strictSlotQuestionUsable(question: GeneratedExamQuestion | undefined, slot: ExamBlueprintSlot): boolean {
  if (!question || !questionMatchesBlueprintSlot(question, slot) || questionLacksAnswer(question)) return false;
  if(question.sub_parts?.length&&(question.sub_parts.reduce((sum,part)=>sum+part.marks,0)!==slot.marks||question.sub_parts.some(part=>!part.prompt?.trim()||part.marks<1)))return false;
  if (question.question_type !== 'multiple_choice') return true;
  const options = question.options || [];
  if (options.length !== 4 || new Set(options.map(normalizedAnswer)).size !== 4) return false;
  const answer = normalizedAnswer(question.correct_answer);
  return options.some((option, index) => normalizedAnswer(option) === answer || answer === String.fromCharCode(97 + index));
}

function mapSlotForIndex(request: ExamGenerationRequest, index: number): ExamBlueprintSlot | null {
  const slots = getExamBlueprintSlots(request);
  if (slots[index]) return slots[index];
  const current = slots.find((slot) => /map|topograph/i.test(`${slot.id} ${slot.title}`));
  if (current) return current;
  return null;
}

function mapTargetIndex(request: ExamGenerationRequest, questions: GeneratedExamQuestion[]): number | undefined {
  const slots = getExamBlueprintSlots(request);
  const explicit = slots.findIndex((slot) => /map|topograph/i.test(`${slot.id} ${slot.title}`));
  if (explicit >= 0) return explicit;
  const structured = slots.findIndex((slot) => slot.questionType !== 'multiple_choice');
  if (structured >= 0 && questions[structured]) return structured;
  const fallback = questions.findIndex((question) => question.question_type !== 'multiple_choice');
  return fallback >= 0 ? fallback : undefined;
}

function buildEastAfricaMapFallback(
  request: ExamGenerationRequest,
  existing: GeneratedExamQuestion | undefined,
  slot: ExamBlueprintSlot,
): GeneratedExamQuestion | null {
  if (!mapScopeSelected(request)) return null;
  if (slot.questionType === 'multiple_choice' || slot.marks < 1 || slot.marks > 12) return null;
  const facts = [
    ['west', 'Uganda'],
    ['south', 'Tanzania'],
    ['north-west', 'South Sudan'],
    ['north', 'Ethiopia'],
    ['east', 'Somalia'],
  ].filter(([, country]) => EAST_AFRICA_NEIGHBOURS.includes(country));
  const partCount = Math.min(facts.length, Math.max(1, slot.marks));
  const baseMarks = Math.floor(slot.marks / partCount);
  const remainder = slot.marks % partCount;
  const subParts = facts.slice(0, partCount).map(([direction, country], index) => {
    const marks = baseMarks + (index < remainder ? 1 : 0);
    const label = `(${String.fromCharCode(97 + index)})`;
    const extraTask = marks >= 2 ? ' State its direction from Kenya using the north arrow.' : '';
    const boundaryTask = marks >= 3 ? ' State the map-key symbol that shows their shared country boundary.' : '';
    return {
      label,
      prompt: `Name the East African country immediately ${direction} of Kenya on the map.${extraTask}${boundaryTask}`,
      marks,
      correct_answer: `${country}${marks >= 2 ? `; ${direction}` : ''}${marks >= 3 ? '; the boundary line in the key' : ''}`,
      marking_scheme: `${country} (1 mark)${marks >= 2 ? `; direction ${direction} (1 mark)` : ''}${marks >= 3 ? '; identifies the boundary line in the key (1 mark)' : ''}.`,
    };
  });
  const answer = subParts.map((part) => part.correct_answer).join('; ');
  const marking = subParts.map((part) => `${part.label} ${part.marking_scheme}`).join(' ');
  const mapNode = request.curriculumScope?.find(node => /map|topograph/i.test([node.strand,...node.subStrands].join(' ')));
  const sourceStrand = slot.strand || mapNode?.strand || request.strands[0] || 'Map Work';
  const sourceSubStrand = slot.subStrand || mapNode?.subStrands.find(child => /map|topograph/i.test(child)) || request.subStrands[0] || 'Map work';
  const sourceTopic = slot.topic || request.topics[0] || 'East Africa neighbouring countries';
  const question: GeneratedExamQuestion = {
    ...(existing || {}),
    question_type: slot.questionType,
    question_text: 'Study the vector map of East Africa. Use the country boundaries, labels and north arrow to answer the sub-parts.',
    options: slot.questionType === 'multiple_response' ? undefined : existing?.options,
    correct_answer: answer,
    marking_scheme: marking,
    marks: slot.marks,
    sub_parts: subParts,
    difficulty: slot.difficulty === 'mixed' ? 'medium' : slot.difficulty,
    strand: sourceStrand,
    sub_strand: sourceSubStrand,
    topic: sourceTopic,
    visual_spec: {
      asset_type: 'map',
      title: 'East Africa: countries neighbouring Kenya',
      prompt: 'Study the vector map. Kenya and its neighbouring countries are labelled; use country positions and the north arrow only.',
      caption: 'East Africa country boundaries; not to scale.',
      map_regions: EAST_AFRICA_NEIGHBOURS,
      map_features: EAST_AFRICA_NEIGHBOURS,
      labels: EAST_AFRICA_NEIGHBOURS,
      legend: ['Hatch: focus', 'Line: boundary'],
      base_map: 'east_africa',
      scale_text: '≈ 500 km (indicative)',
      compass: 'North',
    },
  };
  return bindQuestionToSlot(withRenderedExamVisual(question), slot);
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
  const deadlineAt=options.deadlineAt??Date.now()+70000;
  const safelyRewrite=(operation:()=>Promise<GeneratedExamQuestion|null>)=>rewriteBeforeDeadline(operation,deadlineAt);
  const state = questions.slice();
  const recorded: Array<{ index: number; action: ExamRepairAction }> = [];
  const originalCount = state.length;

  const rewritten = new Set<number>();
  const visualRepaired = new Set<number>();
  const visualDropped = new Set<number>();
  const visualReplacementFailed = new Set<number>();

  // ---- Phase A: rewrite questions whose tags, answers, or structure are wrong.
  // Four concurrent workers keep large papers within the server deadline while
  // each question retains its own bounded retry budget.
  await runWithConcurrency(state.map((_, index) => index), 4, async (index) => {
    for (let attempt = 1; attempt <= MAX_SCOPE_REPAIR_ATTEMPTS; attempt += 1) {
      const issues = issuesForPosition(request, state, index, options);
      if (!issues.length) break;
      if (issues.some((issue) => issue.code === REQUIRED_MAP_MISSING)) break;
      // A visual-only problem is Phase B's job, not a reason to rewrite the question.
      if (isVisualOnly(issues)) break;
      const repaired = await safelyRewrite(() => adapter.rewriteQuestion({ request, question: state[index], issues, attempt }));
      // No usable answer this time: ask again, right up to the attempt limit.
      if (!repaired) continue;
      state[index] = repaired;
      if (!rewritten.has(index)) {
        rewritten.add(index);
        recorded.push({
          index,
          action: {
            kind: 'question_rewritten',
            questionNumber: index + 1,
            detail: `Rewrote question ${index + 1} to satisfy the selected curriculum scope.`,
            codes: uniqueCodes(issues),
          },
        });
      }
      if (!issuesForPosition(request, state, index, options).length) break;
    }
  });

  // ---- Phase B: complete each unusable visual, or replace/drop the question.
  await runWithConcurrency(state.map((_, index) => index), 4, async (index) => {
    for (let attempt = 1; attempt <= MAX_VISUAL_REPAIR_ATTEMPTS; attempt += 1) {
      const issues = issuesForPosition(request, state, index, options);
      if (!issues.length || !isVisualOnly(issues)) break;
      const repaired = await safelyRewrite(() => adapter.rewriteVisual({ request, question: state[index], issues, attempt }));
      if (!repaired) {
        if (attempt < MAX_VISUAL_REPAIR_ATTEMPTS) await waitBeforeVisualRetry(attempt);
        continue;
      }
      state[index] = repaired;
      if (!visualRepaired.has(index)) {
        visualRepaired.add(index);
        recorded.push({
          index,
          action: {
            kind: 'visual_repaired',
            questionNumber: index + 1,
            detail: `Completed the visual specification for question ${index + 1}.`,
            codes: uniqueCodes(issues),
          },
        });
      }
      const remainingAfterRepair = issuesForPosition(request, state, index, options);
      if (!remainingAfterRepair.length) break;
      if (attempt < MAX_VISUAL_REPAIR_ATTEMPTS && isVisualOnly(remainingAfterRepair)) {
        await waitBeforeVisualRetry(attempt);
      }
    }
    const remaining = issuesForPosition(request, state, index, options);
    if (remaining.length && isVisualOnly(remaining)) {
      const currentVisualType = String(state[index].visual_spec?.asset_type || '').toLowerCase();
      const mapCannotBeNonVisual = isSocialStudiesSubject(request.subject)
        && request.format === 'kjsea'
        && currentVisualType === 'map';
      if (mapCannotBeNonVisual) {
        visualReplacementFailed.add(index);
        return;
      }
      // A required visual cannot be stripped from a question that still asks
      // the learner to use it. Ask for a self-contained non-visual replacement;
      // if that fails, let Phase C drop the whole question.
      const replacementIssues: ExamValidationIssue[] = [
        ...remaining,
        { code: 'VISUAL_REPLACEMENT_REQUIRED', severity: 'critical', message: 'The required visual could not be rendered. Replace this with a self-contained question and set visual_spec to null.', questionIndex: index },
      ];
      let replaced = false;
      for (let attempt = 1; attempt <= MAX_SCOPE_REPAIR_ATTEMPTS; attempt += 1) {
        const replacement = await safelyRewrite(() => adapter.rewriteQuestion({ request, question: state[index], issues: replacementIssues, attempt }));
        if (!replacement || replacement.visual_spec || replacement.image_url) continue;
        state[index] = replacement;
        if (!issuesForPosition(request, state, index, options).length) {
          replaced = true;
          rewritten.add(index);
          recorded.push({
            index,
            action: {
              kind: 'question_rewritten',
              questionNumber: index + 1,
              detail: `Replaced question ${index + 1} with a self-contained non-visual question after its visual failed.`,
              codes: uniqueCodes(replacementIssues),
            },
          });
          break;
        }
      }
      if (!replaced) visualReplacementFailed.add(index);
    }
  });

  // ---- Phase C: repair required maps and recover every fixed slot. A fixed
  // blueprint is never shortened: if a slot cannot be recovered, return the
  // original positions and a failed report so the caller cannot save a false
  // paper with forged marks or silently shifted indexes.
  const fixedBlueprint = hasFixedBlueprint(request);
  const mapValidation = validateGeneratedExam(request, state, { previousStems: options.previousStems });
  const requiredMapIssue = mapValidation.issues.find((issue) => issue.code === REQUIRED_MAP_MISSING);
  if (requiredMapIssue && mapScopeSelected(request)) {
    const mapIndex = requiredMapIssue.questionIndex ?? mapTargetIndex(request, state);
    const mapSlot = mapIndex === undefined ? null : mapSlotForIndex(request, mapIndex);
    const fallback = mapIndex === undefined || !mapSlot ? null : buildEastAfricaMapFallback(request, state[mapIndex], mapSlot);
    if (fallback && strictSlotQuestionUsable(fallback, mapSlot)) {
      state[mapIndex] = fallback;
      recorded.push({
        index: mapIndex,
        action: {
          kind: 'map_fallback',
          questionNumber: mapIndex + 1,
          detail: 'Repaired the required map slot with an answerable East Africa neighbouring-countries task using supported vector country boundaries.',
          codes: [REQUIRED_MAP_MISSING],
        },
      });
      rewritten.add(mapIndex);
    }
  }

  if (fixedBlueprint) {
    const slots = getExamBlueprintSlots(request);
    const unresolved = slots.filter((slot,index)=>!strictSlotQuestionUsable(state[index],slot)||issuesForPosition(request,state,index,options).length>0);
    await runWithConcurrency(unresolved, 4, async (slot) => {
      const index = slot.questionNumber - 1;
      const current = state[index];
      let seed: GeneratedExamQuestion = bindQuestionToSlot({
        ...(current || {}),
        question_type: slot.questionType,
        question_text: current?.question_text || `Generate the complete question for ${slot.title}.`,
        correct_answer: current?.correct_answer || '',
        marking_scheme: current?.marking_scheme || '',
        marks: slot.marks,
        difficulty: slot.difficulty === 'mixed' ? 'medium' : slot.difficulty,
        strand: slot.strand || current?.strand || request.strands[0],
        sub_strand: slot.subStrand || current?.sub_strand || request.subStrands[0],
        topic: slot.topic || current?.topic || request.topics[0],
      }, slot);
      for (let attempt = 1; attempt <= MAX_SCOPE_REPAIR_ATTEMPTS; attempt += 1) {
        const existingIssues = state[index]
          ? issuesForPosition(request, state, index, options)
          : [];
        const issues: ExamValidationIssue[] = [
          ...existingIssues,
          { code: 'BLUEPRINT_SLOT_RECOVERY_REQUIRED', severity: 'critical', message: `Recover exact slot ${slot.questionNumber}: ${slot.questionType}, ${slot.marks} marks, ${slot.title}.`, questionIndex: index },
        ];
        const repaired = await safelyRewrite(() => adapter.rewriteQuestion({ request, question: seed, issues, attempt }));
        if (!repaired) continue;
        const bound = bindQuestionToSlot(repaired, slot);
        state[index] = bound;
        seed=bound;
        const remaining = issuesForPosition(request, state, index, options);
        if (strictSlotQuestionUsable(bound, slot) && !remaining.length) {
          rewritten.add(index);
          recorded.push({
            index,
            action: {
              kind: 'question_rewritten',
              questionNumber: index + 1,
              detail: `Recovered exact blueprint slot ${index + 1} without changing its type, marks or indexes.`,
              codes: uniqueCodes(issues),
            },
          });
          break;
        }
      }
    });

    const validation = validateGeneratedExam(request, state, { previousStems: options.previousStems });
    const complete = state.length === slots.length
      && slots.every((slot, index) => strictSlotQuestionUsable(state[index], slot))
      && validation.criticalCount === 0;
    const actions = recorded.map((entry) => entry.action);
    const rewrittenQuestions = Array.from(rewritten).length;
    const repairedVisuals = visualRepaired.size;
    const droppedVisuals = visualDropped.size;
    const failureMessage = complete
      ? undefined
      : 'We could not generate this paper because one or more fixed blueprint slots could not be recovered exactly. The paper was not shortened or saved.';
    const base = { retainedCount: state.length, rewrittenQuestions, repairedVisuals, droppedVisuals, droppedQuestions: 0 };
    return {
      status: failureMessage ? 'failed' : actions.length ? 'repaired' : 'clean',
      questions: state,
      validation,
      actions,
      originalCount,
      retainedCount: state.length,
      rewrittenQuestions,
      repairedVisuals,
      droppedVisuals,
      droppedQuestions: 0,
      blueprintReconciled: false,
      teacherMessage: failureMessage || buildTeacherMessage(base),
      failureMessage,
    };
  }

  const survivors: GeneratedExamQuestion[] = [];
  const survivorIndices = new Set<number>();
  for (let index = 0; index < state.length; index += 1) {
    if (visualReplacementFailed.has(index)) {
      const issues = issuesForPosition(request, state, index, options);
      recorded.push({
        index,
        action: {
          kind: 'question_dropped',
          questionNumber: index + 1,
          detail: `Removed question ${index + 1} because its required visual could not be repaired and no non-visual replacement was available.`,
          codes: uniqueCodes(issues.length ? issues : [{ code: 'VISUAL_REPLACEMENT_FAILED', severity: 'critical', message: 'Required visual replacement failed.', questionIndex: index }]),
        },
      });
      continue;
    }
    const issues = issuesForPosition(request, state, index, options);
    if (issues.length) {
      recorded.push({
        index,
        action: {
          kind: 'question_dropped',
          questionNumber: index + 1,
          detail: `Removed question ${index + 1} because it could not be repaired (${codesText(uniqueCodes(issues))}).`,
          codes: uniqueCodes(issues),
        },
      });
      continue;
    }
    survivors.push(state[index]);
    survivorIndices.add(index);
  }

  const actions = recorded
    .filter((entry) => entry.action.kind === 'question_dropped' || survivorIndices.has(entry.index))
    .map((entry) => entry.action);
  const droppedQuestions = originalCount - survivors.length;
  const rewrittenQuestions = Array.from(rewritten).filter((index) => survivorIndices.has(index)).length;
  const repairedVisuals = Array.from(visualRepaired).filter((index) => survivorIndices.has(index)).length;
  const droppedVisuals = Array.from(visualDropped).filter((index) => survivorIndices.has(index)).length;
  const validation = validateGeneratedExam(request, survivors, { previousStems: options.previousStems });
  const fatalIssues = validation.issues.filter((issue) => issue.severity === 'critical');
  const droppedRatio = originalCount ? droppedQuestions / originalCount : 1;
  const ratioLimit = options.maxUnrepairableRatio ?? MAX_UNREPAIRABLE_RATIO;
  const base = { retainedCount: survivors.length, rewrittenQuestions, repairedVisuals, droppedVisuals, droppedQuestions };

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

/** Human-readable description of what the teacher actually selected. */
export function describeRequestScope(request: ExamGenerationRequest): string {
  const lines: string[] = [
    `Subject: ${request.subject}; Grade: ${request.gradeLevel}; Format: ${request.format}; Difficulty: ${request.difficulty}.`,
  ];
  if (request.strands.length) lines.push(`Selected strands: ${request.strands.join('; ')}.`);
  if (request.subStrands.length) lines.push(`Selected sub-strands: ${request.subStrands.join('; ')}.`);
  if (request.topics.length) lines.push(`Selected topics: ${request.topics.join('; ')}.`);
  for (const node of request.curriculumScope || []) {
    lines.push(`"${node.strand}" owns sub-strands [${node.subStrands.join(', ') || 'any'}] and topics [${node.topics.join(', ') || 'any'}].`);
  }
  return lines.join('\n');
}

function issueList(issues: ExamValidationIssue[]): string {
  return issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n');
}

/**
 * Rewrite one question so it satisfies the teacher's selection. The expected
 * reply is a single question object in the same shape the paper already uses.
 */
export function buildQuestionRewritePrompt(
  request: ExamGenerationRequest,
  question: GeneratedExamQuestion,
  issues: ExamValidationIssue[],
  attempt: number,
): string {
  return `You are repairing one question from a Kenyan CBC/CBE assessment paper. Rewrite ONLY this question. Do not add commentary.

Why the current question was rejected (repair attempt ${attempt}):
${issueList(issues)}

Hard constraints for the replacement:
- Its strand, sub-strand and topic must come from this selection, and the topic must belong to the stated sub-strand:
${describeRequestScope(request)}
- Never reuse a strand, sub-strand, or topic that is not listed above.
- Keep the same question_type ("${question.question_type}") and exactly ${question.marks} mark(s).
- Keep it age-appropriate for ${request.gradeLevel} ${request.subject}, original, and self-contained.
- Provide a real correct_answer and marking_scheme; never write marking instructions instead of the actual answer.
${question.question_type === 'multiple_choice' ? '- Provide exactly four options and name the correct one.' : ''}
- Only include a visual_spec when the question genuinely requires one, and then give it complete labels or complete data.
${DETERMINISTIC_SCIENCE_VISUAL_RULES}${DETERMINISTIC_MATH_VISUAL_RULES}
${issues.some((issue) => issue.code === 'VISUAL_REPLACEMENT_REQUIRED') ? '- The previous required visual could not be rendered. This replacement MUST be answerable without a visual: set visual_spec to null and do not refer to a map, diagram, table, image, or anything shown below.' : question.visual_spec ? '- If you keep a visual, every label and value it needs must be present and readable.' : '- Set visual_spec to null.'}

The rejected question was:
${JSON.stringify({
    question_type: question.question_type,
    question_text: question.question_text,
    options: question.options || [],
    marks: question.marks,
    strand: question.strand,
    sub_strand: question.sub_strand,
    topic: question.topic,
    visual_spec: question.visual_spec || null,
  })}

Return json only, as {"question": { ...one question object... }} using these keys:
question_type, question_text, options, correct_answer, marking_scheme, marks, difficulty, strand, sub_strand, topic, learning_outcome, competency, cognitive_level, sub_parts, visual_spec.`;
}

/**
 * Rewrite only the visual specification of one question. The question text and
 * marks are kept, so the reply's visual_spec is all that is used.
 */
export function buildVisualRewritePrompt(
  request: ExamGenerationRequest,
  question: GeneratedExamQuestion,
  issues: ExamValidationIssue[],
  attempt: number,
): string {
  return `You are repairing the visual specification of one question in a Kenyan CBC/CBE assessment paper (repair attempt ${attempt}).

Why the current visual was rejected:
${issueList(issues)}

The question it belongs to:
${question.question_text}

Subject: ${request.subject}; Grade: ${request.gradeLevel}.

Rules for the repaired visual:
- Return a visually complete, printable specification that a learner can read and use to answer the question.
- asset_type must be one of: diagram, map, chart, graph, shape, flowchart, illustration, table, number_line.
- Give a clear title and caption.
${DETERMINISTIC_SCIENCE_VISUAL_RULES}${DETERMINISTIC_MATH_VISUAL_RULES}
- tables: supply table_headers with at least two headers AND table_rows containing every learner-facing cell and numeric value. Never rely on x_labels alone.
- graphs and charts: supply values (at least two numbers) AND matching x_labels (or labels) for every value.
- diagrams, shapes, number lines and flowcharts: supply at least two readable labels.
- maps: supply base_map as kenya, east_africa, or africa; at least two map_regions; readable labels; a two-entry legend; scale_text; and compass. The map will use embedded vector country boundaries, not a hand-drawn polygon or image URL.
- measurement diagrams must show real readings, graduations, units and objects, not a decorative placeholder.
- If the question genuinely does not need a visual, return visual_spec as null.

Return json only, as {"visual_spec": { ...the specification... }} or {"visual_spec": null}.`;
}
