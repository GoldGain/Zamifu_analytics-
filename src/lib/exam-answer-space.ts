import type {
  GeneratedExamQuestion,
  GeneratedExamSubPart,
  QuestionType,
} from './exam-schema.js';

export type CalculationSpaceReason =
  | 'mathematics-structured'
  | 'explicit-calculation'
  | 'map-scale-calculation'
  | 'graphical-task'
  | 'none';

export interface CalculationSpaceDecision {
  requiresCalculationSpace: boolean;
  lineCount: number;
  reason: CalculationSpaceReason;
}

export interface QuestionAnswerSpacePlan {
  question: CalculationSpaceDecision;
  subParts: Array<CalculationSpaceDecision & { label: string }>;
}

const OBJECTIVE_TYPES = new Set<QuestionType>([
  'multiple_choice',
  'multiple_response',
  'modified_true_false',
  'matching',
]);

// A Mathematics short-answer item is the structured part of the audited
// junior-school paper. Numeric response and case-study questions are likewise
// method-bearing by design. Completion only receives space when its wording
// actually asks the learner to calculate.
const MATHEMATICS_STRUCTURED_TYPES = new Set<QuestionType>([
  'short_answer',
  'numeric_response',
  'case_study',
]);

const CALCULATION_VERB = /\b(?:calculate|calculation|compute|work\s+out|solve|evaluate|convert|measure|estimate|determine|derive|simplify|factor(?:ise|ize)|expand|find)\b/i;
const CALCULATION_CONCEPT = /\b(?:area|perimeter|volume|surface\s+area|distance|speed|velocity|time|mass|density|temperature|average|mean|median|mode|range|ratio|rate|percentage|percent|fraction|probability|frequency|profit|loss|interest|cost|total|difference|sum|product|quotient|scale|gradient|slope|equation|value\s+of|length|capacity|conversion)\b/i;
const NUMERIC_EVIDENCE = /(?:\d+(?:\.\d+)?|\b(?:cm|mm|m|km|g|kg|ml|l|°c|%|shillings?|kes)\b|[+×÷=])/i;
const THEORY_RESPONSE_CUE = /\b(?:state|name|list|identify|label|define|describe|explain|outline|mention|give\s+(?:one|two|an?)|write|classify|match|draw|sketch|translate|read|quote|discuss|compare)\b/i;
const MAP_SCALE_CUE = /\b(?:scale|map\s+distance|ground\s+distance|actual\s+distance|distance\s+on\s+(?:the\s+)?map)\b/i;
const MAP_SCALE_ACTION = /\b(?:calculate|work\s+out|measure|find|determine|convert|distance\s+between|actual\s+distance|ground\s+distance)\b/i;
const GRAPHICAL_TASK = /\b(?:draw|sketch|plot|construct|complete|trace)\b[^.!?\n]{0,100}\b(?:graph|diagram|shape|figure|chart|number\s+line|axes|angle|polygon)\b|\b(?:graph|diagram|shape|figure|chart|number\s+line|axes|angle|polygon)\b[^.!?\n]{0,100}\b(?:draw|sketch|plot|construct|complete|trace)\b/i;

function noCalculationSpace(): CalculationSpaceDecision {
  return { requiresCalculationSpace: false, lineCount: 0, reason: 'none' };
}

function calculationSpace(marks: number, reason: Exclude<CalculationSpaceReason, 'none'>): CalculationSpaceDecision {
  // Two lines prevent a one-mark calculation from collapsing into the stem;
  // larger-mark method questions get room without creating a generic ruled page.
  const lineCount = Math.max(2, Math.min(8, Math.ceil(Math.max(1, marks) * 1.25)));
  return { requiresCalculationSpace: true, lineCount, reason };
}

function subjectKey(subject: string): string {
  return String(subject || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isMathematicsSubject(subject: string): boolean {
  const key = subjectKey(subject);
  return /^(?:math|maths|mathematics)(?:\s|$)/.test(key)
    || /\b(?:core|essential)\s+(?:math|maths|mathematics)\b/.test(key)
    || key.includes(' mathematics');
}

function visualAssetType(question: Pick<GeneratedExamQuestion, 'visual_spec'>): string {
  return String(question.visual_spec?.asset_type || '').toLowerCase().trim();
}

function isMapScaleCalculation(text: string, question?: Pick<GeneratedExamQuestion, 'visual_spec'>): boolean {
  const value = String(text || '').trim();
  const mapLike = visualAssetType(question || {}) === 'map' || /\bmap\b/i.test(value);
  return mapLike && MAP_SCALE_CUE.test(value) && MAP_SCALE_ACTION.test(value);
}

/**
 * Detects an actual numerical task, not merely a question containing a number.
 * In particular, a map's labels or a printed scale bar alone is not enough:
 * only a task that asks the learner to use the scale receives working space.
 */
export function textRequiresCalculationSpace(
  text: string,
  subject = '',
  question?: Pick<GeneratedExamQuestion, 'visual_spec'>,
): boolean {
  const value = String(text || '').trim();
  if (!value) return false;
  if (isMapScaleCalculation(value, question)) return true;

  const hasCalculationVerb = CALCULATION_VERB.test(value);
  const hasCalculationConcept = CALCULATION_CONCEPT.test(value);
  const hasNumericEvidence = NUMERIC_EVIDENCE.test(value);
  if (THEORY_RESPONSE_CUE.test(value) && !hasCalculationVerb) return false;
  const explicitCalculationVerb=/\b(?:calculate|compute|work\s+out|solve|evaluate|convert|derive|simplify|factor(?:ise|ize)|expand)\b/i.test(value);
  if(hasCalculationVerb&&(hasCalculationConcept||(explicitCalculationVerb&&hasNumericEvidence)))return true;

  // Expressions such as "12 × 4" are calculations even when the prompt uses
  // a less predictable verb (for example, "What is 12 × 4?").
  if (hasNumericEvidence && /\b\d+(?:\.\d+)?\s*[+\-×÷*/=]\s*\d+(?:\.\d+)?\b/.test(value)) return true;

  // A non-mathematics numeric-response task only gets space when it contains
  // calculation evidence; this prevents population counts and dates from
  // turning theory questions into working areas.
  if (hasCalculationConcept && hasNumericEvidence && /\b(?:what|which|give|find|determine|state|record|how\s+(?:many|much|far|long))\b/i.test(value)) {
    return true;
  }

  // Mathematics word problems may imply division, subtraction or another
  // operation without the command "calculate", for example equal sharing.
  if(isMathematicsSubject(subject)&&/\b(?:what|how|find|determine)\b/i.test(value)&&(value.match(/\b\d+(?:[,.]\d+)*\b/g)||[]).length>=2)return true;
  return false;
}

function decisionForText(
  text: string,
  marks: number,
  subject: string,
  question?: Pick<GeneratedExamQuestion, 'visual_spec'>,
): CalculationSpaceDecision {
  if (isMapScaleCalculation(text, question)) return calculationSpace(marks, 'map-scale-calculation');
  if (GRAPHICAL_TASK.test(text)) return calculationSpace(marks, 'graphical-task');
  if (textRequiresCalculationSpace(text, subject, question)) return calculationSpace(marks, 'explicit-calculation');
  return noCalculationSpace();
}

function decisionForSubPart(
  subject: string,
  question: GeneratedExamQuestion,
  part: GeneratedExamSubPart,
): CalculationSpaceDecision {
  if (isMathematicsSubject(subject) && OBJECTIVE_TYPES.has(question.question_type)) {
    return noCalculationSpace();
  }
  const partDecision = decisionForText(part.prompt, part.marks, subject, question);
  if (partDecision.requiresCalculationSpace) return partDecision;

  // Numeric response is inherently method-bearing. For a structured
  // Mathematics question, preserve the same rule for a part that is not a
  // clearly theory-only instruction, while allowing "state/label/explain"
  // parts to remain concise answer handling rather than working space.
  if (isMathematicsSubject(subject) && question.question_type === 'numeric_response') {
    return calculationSpace(part.marks, 'mathematics-structured');
  }
  if (
    isMathematicsSubject(subject)
    && MATHEMATICS_STRUCTURED_TYPES.has(question.question_type)
    && !THEORY_RESPONSE_CUE.test(part.prompt)
    && (CALCULATION_CONCEPT.test(question.question_text) || question.question_type === 'case_study')
  ) {
    return calculationSpace(part.marks, 'mathematics-structured');
  }
  return noCalculationSpace();
}

export function getQuestionAnswerSpacePlan(
  subject: string,
  question: GeneratedExamQuestion,
): QuestionAnswerSpacePlan {
  const parts = Array.isArray(question.sub_parts) ? question.sub_parts : [];
  if (parts.length) {
    return {
      question: noCalculationSpace(),
      subParts: parts.map((part) => ({
        label: part.label,
        ...decisionForSubPart(subject, question, part),
      })),
    };
  }

  const mathStructured = isMathematicsSubject(subject)
    && MATHEMATICS_STRUCTURED_TYPES.has(question.question_type)
    && !OBJECTIVE_TYPES.has(question.question_type);
  const textDecision = decisionForText(question.question_text, question.marks, subject, question);
  const decision = textDecision.reason === 'graphical-task'
      ? textDecision
      : mathStructured
        ? calculationSpace(question.marks, 'mathematics-structured')
        : textDecision;
  return { question: decision, subParts: [] };
}

export const getAnswerSpacePlan = getQuestionAnswerSpacePlan;

export function questionNeedsCalculationSpace(subject: string, question: GeneratedExamQuestion): boolean {
  const plan = getQuestionAnswerSpacePlan(subject, question);
  return plan.question.requiresCalculationSpace || plan.subParts.some((part) => part.requiresCalculationSpace);
}

function decisionIsCalculation(decision: CalculationSpaceDecision): boolean {
  return decision.requiresCalculationSpace && decision.reason !== 'graphical-task';
}

export function hasCalculationQuestions(subject: string, questions: GeneratedExamQuestion[]): boolean {
  return questions.some((question) => {
    const plan = getQuestionAnswerSpacePlan(subject, question);
    return decisionIsCalculation(plan.question) || plan.subParts.some(decisionIsCalculation);
  });
}

export function candidateCalculationInstruction(subject: string, questions: GeneratedExamQuestion[]): string {
  if (!hasCalculationQuestions(subject, questions)) return 'Write clear responses to theory questions.';
  if (isMathematicsSubject(subject)) return 'Show your working for calculation questions and write final answers clearly.';
  return 'Show calculation steps only for questions that require a calculation; write clear final answers and theory responses.';
}

/**
 * Provider-supplied instructions are retained unless they would print a
 * blanket working-space instruction that conflicts with this per-question
 * policy. The caller can then add the format/subject-specific instruction.
 */
export function sanitizeCandidateInstruction(
  instruction: string,
  subject: string,
  questions: GeneratedExamQuestion[],
): string {
  const value = String(instruction || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const hasCalculation = hasCalculationQuestions(subject, questions);
  if(!hasCalculation&&/\bin\s+(?:the\s+)?spaces?\s+provided\b/i.test(value))return value.replace(/\bin\s+(?:the\s+)?spaces?\s+provided\b/gi,'in your answer booklet');
  const blanketWorking = /\b(?:show|give|include|write)\s+(?:all|your|the)\s+working\b|\bworking\s+space\b|\bcalculation\s+space\b/i;
  if (!hasCalculation && blanketWorking.test(value)) return '';
  if (hasCalculation && /\bshow\s+all\s+working\b/i.test(value)) {
    return value.replace(/\bshow\s+all\s+working\b/i, 'show calculation steps only for questions that require a calculation');
  }
  if (hasCalculation && /\bshow\s+your\s+working\b/i.test(value)) {
    return value.replace(/\bshow\s+your\s+working\b/i, 'show your working only for questions that require a calculation');
  }
  return value;
}
