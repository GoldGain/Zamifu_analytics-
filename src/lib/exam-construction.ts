/**
 * Shared exam-construction rules for the Zamifu exam generator.
 * Dependency-free (type-only imports) so the server route, AI prompt builders,
 * validator, PDF renderer and teacher UI can all use it.
 */
import type {
  CurriculumScopeNode, ExamBlueprint, ExamGenerationRequest,
  GeneratedExamQuestion, GeneratedExamSubPart,
} from './exam-schema.js';

export type PaperVariant = 'single' | 'paper1' | 'paper2';
const TWO_PAPER_SUBJECTS = ['english', 'kiswahili', 'integratedscience'];

export function normalizeKey(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
export function supportsTwoPapers(subject: string): boolean {
  return TWO_PAPER_SUBJECTS.includes(normalizeKey(subject));
}
export function normalizePaperVariant(value: unknown): PaperVariant {
  return value === 'paper1' || value === 'paper2' ? value : 'single';
}
export function paperVariantLabel(variant: PaperVariant): string {
  if (variant === 'paper1') return 'Paper 1';
  if (variant === 'paper2') return 'Paper 2';
  return 'Single paper';
}
function paperFocus(subject: string, variant: PaperVariant): string {
  const key = normalizeKey(subject);
  if (variant === 'single') return '';
  if (key === 'english') {
    return variant === 'paper1'
      ? 'Paper 1 tests functional language: grammar and language use, punctuation, vocabulary, comprehension of a prose passage, and short functional writing.'
      : 'Paper 2 tests literary and extended reading skills: comprehension and interpretation of longer passages, summary writing, and extended composition.';
  }
  if (key === 'kiswahili') {
    return variant === 'paper1'
      ? 'Karatasi 1 hupima lugha: sarufi, matumizi ya lugha, uakifishaji, msamiati, ufahamu na insha fupi.'
      : 'Karatasi 2 hupima fasihi na usomaji wa kina: ufahamu wa kifungu kirefu, ufupisho na insha ndefu.';
  }
  return variant === 'paper1'
    ? 'Integrated Science Paper 1 tests theory: concepts, explanations, definitions and structured theory questions.'
    : 'Integrated Science Paper 2 tests practical work: procedure, apparatus, observation tables, measurements and conclusions.';
}
export function paperVariantLaw(request: ExamGenerationRequest): string {
  const variant = normalizePaperVariant(request.paperVariant);
  if (variant === 'single' || !supportsTwoPapers(request.subject)) return '';
  return [
    `Paper type law: this paper is ${paperVariantLabel(variant)} only.`,
    paperFocus(request.subject, variant),
    'Do not include content belonging to the other paper. The paper must stand alone with its own instructions, sections, marks and marking scheme.',
  ].join(' ');
}
export function mathNotationLaw(): string {
  return [
    'Mathematical notation law: always print the multiplication sign as \u00d7 (U+00D7) - never a middle dot, bullet, asterisk or the letter x.',
    'Print division as \u00f7, not a forward slash, when both sides of the operator are numbers; keep a fraction such as 1/2 when the value is a fraction.',
    'Print powers with a superscript (x\u00b2, 10\u00b3) and roots with \u221a (for example \u221a49). Use correct unit symbols (cm\u00b2, m\u00b3, kg).',
  ].join(' ');
}
export function answerCompletenessLaw(): string {
  return [
    'Marking-scheme law: every question and every sub-part must carry the ACTUAL correct answer in "correct_answer" and a "marking_scheme" that states that answer and how its marks are awarded.',
    'A marking_scheme that only says "award 1 mark" or "teacher to assess" without giving the answer is invalid and will be rejected. For structured questions give the expected points, values or model response and acceptable alternatives.',
  ].join(' ');
}
export function isMathsLikeSubject(subject: string): boolean {
  const key = normalizeKey(subject);
  return key === 'mathematics' || key === 'maths' || key === 'math'
    || key.startsWith('integratedscience') || key.startsWith('pretechnical')
    || key === 'physics' || key === 'chemistry' || key === 'biology';
}
export function isSocialStudiesSubject(subject: string): boolean {
  const key = normalizeKey(subject);
  return key.startsWith('socialstudies') || key.startsWith('socialstudy') || key === 'geography' || key === 'history';
}
export function mapWorkLaw(request: ExamGenerationRequest): string {
  if (!isSocialStudiesSubject(request.subject)) return '';
  return [
    'Map work law: where the selected strand or topic covers map work, include at least one map-based question.',
    'Use the Kenya map for counties, physical features, climate or vegetation; the Africa map for countries, regions and physical features; the world map for continents, oceans and latitude.',
    'Describe each map with a visual_spec whose asset_type is "map", whose map_regions list the regions shown, and whose labels name every feature the learner must read. Maps must be readable in black and white.',
  ].join(' ');
}
export function kjseaFormatLaw(request: ExamGenerationRequest): string {
  if (request.format !== 'kjsea') return '';
  return [
    'KJSEA format law: Section A has exactly 20 multiple-choice questions worth 1 mark each (four options A-D, one correct answer); Section B has exactly 8 structured questions worth 10 marks each.',
    'Section B phrasing: open with an instruction, then use lettered sub-parts (a), (b), (c) and roman sub-items (i), (ii). Sub-part marks must total exactly 10 per main question. Use command words such as State, Name, Describe, Explain, Calculate, Give a reason, Outline, and use a table or labelled diagram when data must be recorded or interpreted.',
    'Illustration: "(a) Name two ... (2 marks) (b) Explain how ... (4 marks) (c) State two reasons ... (4 marks)". Keep the mark arithmetic visible in every sub-part.',
  ].join(' ');
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
};
export interface NotationOptions { division?: boolean; }

export function normalizeMathNotation(input: string, options: NotationOptions = {}): string {
  if (!input) return input;
  let text = String(input);
  text = text.replace(/[\u00b7\u2022\u2219\u22c5\u25cf\u2a2f]/g, '\u00d7');
  text = text.replace(/(\d)\s*\*\s*(\d)/g, '$1 \u00d7 $2');
  text = text.replace(/(\d)\s*[xX]\s*(\d)/g, '$1 \u00d7 $2');
  text = text.replace(/(\d)\s+\.\s+(\d)/g, '$1 \u00d7 $2');
  if (options.division) text = text.replace(/(\d)\s+\/\s+(\d)/g, '$1 \u00f7 $2');
  text = text.replace(/([0-9A-Za-z)\]])\s*\^\s*(-?\d{1,2})/g, (_m, base: string, power: string) =>
    base + power.split('').map((ch) => SUPERSCRIPT_DIGITS[ch] || ch).join(''));
  text = text.replace(/\b(cm|mm|km|kg|ml|m|g|L)([23])\b/g, (_m, unit: string, power: string) =>
    unit + (SUPERSCRIPT_DIGITS[power] || power));
  text = text.replace(/\bsqrt\s*\(?\s*([0-9.]+)\s*\)?/gi, '\u221a$1');
  text = text.replace(/\u221a\s*\(\s*([0-9.]+)\s*\)/g, '\u221a$1');
  return text.replace(/[ \t]{2,}/g, ' ').trim();
}
function normalizeSubPartNotation(part: GeneratedExamSubPart, options: NotationOptions): GeneratedExamSubPart {
  return {
    ...part,
    prompt: normalizeMathNotation(part.prompt, options),
    correct_answer: part.correct_answer ? normalizeMathNotation(part.correct_answer, options) : part.correct_answer,
    marking_scheme: part.marking_scheme ? normalizeMathNotation(part.marking_scheme, options) : part.marking_scheme,
  };
}
export function normalizeQuestionNotation(question: GeneratedExamQuestion, options: NotationOptions = {}): GeneratedExamQuestion {
  return {
    ...question,
    question_text: normalizeMathNotation(question.question_text, options),
    options: question.options?.map((option) => normalizeMathNotation(option, options)),
    correct_answer: normalizeMathNotation(question.correct_answer, options),
    marking_scheme: normalizeMathNotation(question.marking_scheme, options),
    sub_parts: question.sub_parts?.map((part) => normalizeSubPartNotation(part, options)),
  };
}

const ANSWER_BOILERPLATE = new RegExp(
  '\\b(?:award|awards|awarded|give|gives|given|credit|credits|accept|accepts|accepted|allow|allows|allowed|' +
  'deduct|reserve|mark|marks|marking|scheme|answer|answers|any|other|others|valid|correct|response|responses|' +
  'point|points|per|for|if|then|the|a|an|or|and|to|of|with|without|is|are|be|been|on|in|as|at|by|it|its|' +
  'this|that|these|those|learner|learners|candidate|candidates|teacher|teachers|assess|assessed|assessment)\\b', 'gi');

export function answerSubstance(text: string): number {
  return String(text ?? '').replace(ANSWER_BOILERPLATE, ' ').replace(/[^a-z0-9]/gi, '').length;
}
export function isInstructionOnlyAnswer(text: string): boolean {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return true;
  if (/^(?:n\/?a|none|nil|tbd|tba|-+|\u2014+|\?+)$/i.test(value)) return true;
  if (answerSubstance(value) >= 12) return false;
  return /\b(?:award|give|credit|accept|allow|mark|marks|assess)\b/i.test(value);
}
function answerCandidates(question: GeneratedExamQuestion): string[] {
  const values: string[] = [];
  if (question.correct_answer) values.push(question.correct_answer);
  if (question.marking_scheme) values.push(question.marking_scheme);
  for (const part of question.sub_parts || []) {
    if (part.correct_answer) values.push(part.correct_answer);
    if (part.marking_scheme) values.push(part.marking_scheme);
  }
  return values;
}
export function questionLacksAnswer(question: GeneratedExamQuestion): boolean {
  const candidates = answerCandidates(question).filter((value) => !isInstructionOnlyAnswer(value));
  if (!candidates.length) return true;
  if (question.sub_parts?.length) {
    const partsMissing = question.sub_parts.filter((part) =>
      !(part.correct_answer && !isInstructionOnlyAnswer(part.correct_answer))
      && !(part.marking_scheme && !isInstructionOnlyAnswer(part.marking_scheme)));
    if (partsMissing.length) return true;
  }
  if (question.question_type === 'multiple_choice' && question.options?.length) {
    if (!String(question.correct_answer || '').trim()) return true;
  }
  return false;
}
export function missingAnswerIndices(questions: GeneratedExamQuestion[]): number[] {
  const indices: number[] = [];
  questions.forEach((question, index) => { if (questionLacksAnswer(question)) indices.push(index); });
  return indices;
}
function repairSubParts(question: GeneratedExamQuestion): GeneratedExamQuestion {
  if (!question.sub_parts?.length) return question;
  const subParts = question.sub_parts.map((part) => {
    const answer = part.correct_answer && !isInstructionOnlyAnswer(part.correct_answer) ? part.correct_answer : '';
    const scheme = part.marking_scheme && !isInstructionOnlyAnswer(part.marking_scheme) ? part.marking_scheme : '';
    if (answer && scheme) return part;
    return {
      ...part,
      correct_answer: answer || scheme || part.correct_answer,
      marking_scheme: scheme || (answer ? `${answer} (${part.marks} mark${part.marks === 1 ? '' : 's'})` : part.marking_scheme),
    };
  });
  return { ...question, sub_parts: subParts };
}
export function repairQuestionAnswers(question: GeneratedExamQuestion): GeneratedExamQuestion {
  const resolved = repairSubParts(question);
  const hasAnswer = Boolean(resolved.correct_answer) && !isInstructionOnlyAnswer(resolved.correct_answer);
  const hasScheme = Boolean(resolved.marking_scheme) && !isInstructionOnlyAnswer(resolved.marking_scheme);
  if (hasAnswer && hasScheme) return resolved;
  const fallbackAnswer = hasAnswer ? resolved.correct_answer
    : (resolved.marking_scheme && !isInstructionOnlyAnswer(resolved.marking_scheme) ? resolved.marking_scheme : '');
  const fallbackScheme = hasScheme ? resolved.marking_scheme
    : (fallbackAnswer ? `${fallbackAnswer} (${resolved.marks} mark${resolved.marks === 1 ? '' : 's'})` : '');
  return {
    ...resolved,
    correct_answer: hasAnswer ? resolved.correct_answer : (fallbackAnswer || resolved.correct_answer),
    marking_scheme: hasScheme ? resolved.marking_scheme : (fallbackScheme || resolved.marking_scheme),
  };
}

export interface CoveragePlanEntry { strand: string; subStrands: string[]; questions: number; }
export interface CoveragePlanInput {
  strands?: string[];
  subStrands?: string[];
  curriculumScope?: CurriculumScopeNode[] | null;
  blueprint?: ExamBlueprint | null;
  totalMarks?: number;
}
export function questionCountFor(request: CoveragePlanInput): number {
  const sections = request.blueprint?.sections || [];
  if (sections.length) return sections.reduce((sum, section) => sum + section.count, 0);
  const marks = Number(request.totalMarks || 0);
  return marks > 0 ? Math.max(1, Math.round(marks / 5)) : 0;
}
export function subStrandsByStrand(request: CoveragePlanInput): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const push = (strand: string, values: string[]) => {
    const key = normalizeKey(strand);
    if (!key) return;
    map[key] = Array.from(new Set([...(map[key] || []), ...values.filter(Boolean)]));
  };
  for (const node of request.curriculumScope || []) push(node.strand, node.subStrands || []);
  if (!Object.keys(map).length && request.subStrands?.length) push('*', request.subStrands);
  return map;
}
export function buildCoveragePlanFromRequest(request: CoveragePlanInput): CoveragePlanEntry[] {
  const strands = Array.from(new Set((request.strands || []).map((s) => String(s || '').trim()).filter(Boolean)));
  const questionCount = questionCountFor(request);
  if (!strands.length || questionCount <= 0) return [];
  const byStrand = subStrandsByStrand(request);
  const fallback = request.subStrands || [];
  if (questionCount <= strands.length) {
    return strands.map((strand, index) => ({
      strand, subStrands: byStrand[normalizeKey(strand)] || fallback,
      questions: index < questionCount ? 1 : 0,
    }));
  }
  const base = Math.floor(questionCount / strands.length);
  const remainder = questionCount - base * strands.length;
  return strands.map((strand, index) => ({
    strand, subStrands: byStrand[normalizeKey(strand)] || fallback,
    questions: base + (index < remainder ? 1 : 0),
  }));
}
export function coverageInstruction(plan: CoveragePlanEntry[]): string {
  const active = plan.filter((entry) => entry.questions > 0);
  if (active.length < 2) {
    return active.length === 1
      ? `All questions must come from the strand "${active[0].strand}"${active[0].subStrands.length ? `, moving across its sub-strands (${active[0].subStrands.slice(0, 8).join(', ')})` : ''}.`
      : 'Use the selected curriculum scope.';
  }
  const lines = active.map((entry) => {
    const subStrands = entry.subStrands.length ? ` across ${entry.subStrands.slice(0, 6).join(', ')}` : '';
    return `${entry.questions} question${entry.questions === 1 ? '' : 's'} from "${entry.strand}"${subStrands}`;
  });
  const zero = plan.filter((entry) => entry.questions === 0).map((entry) => entry.strand);
  return [
    'Strand coverage requirement: distribute the questions across every selected strand as follows: ' + lines.join('; ') + '.',
    'Every listed strand must appear at least once, each sub-strand should carry at least one question where the question count allows, and questions from one strand must not crowd out another.',
    zero.length ? `These strands were selected but cannot be covered by the requested number of questions: ${zero.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
}
export function uncoveredStrands(plan: CoveragePlanEntry[], questions: GeneratedExamQuestion[]): string[] {
  const expected = plan.filter((entry) => entry.questions > 0);
  if (expected.length < 2) return [];
  const counts = new Map<string, number>();
  for (const question of questions) {
    const key = normalizeKey(question.strand);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return expected.filter((entry) => (counts.get(normalizeKey(entry.strand)) || 0) === 0).map((entry) => entry.strand);
}
