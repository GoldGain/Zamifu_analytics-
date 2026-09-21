/**
 * Source-backed KJSEA paper metadata.
 *
 * This module intentionally stores only format metadata, mark allocations,
 * durations, and prompt-safe conventions. It does not reproduce any sample
 * paper question text or marking-scheme content.
 */
import type { Difficulty, ExamBlueprint, ExamBlueprintSection, PaperVariant, QuestionType } from './exam-schema.js';

const normalizeKey = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export type KJSEASubjectKey = 'english' | 'kiswahili' | 'integratedscience';
export type KJSEACardVariant = PaperVariant | 'both';

export interface KJSEAComponent {
  label: string;
  marks: number;
  detail: string;
}

export interface KJSEAPaperSpec {
  subjectKey: KJSEASubjectKey;
  variant: KJSEACardVariant;
  title: string;
  code: string;
  marks: number;
  duration_minutes: number;
  components: KJSEAComponent[];
  format_notes: string[];
  sources: string[];
}

const KNEC_TIMETABLE = 'https://www.knec.ac.ke/wp-content/uploads/2025/06/2025-KJSEA-TIMETABLE-Revised-1.pdf';
const KNEC_REGULATIONS = 'https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf';
const KNEC_SAMPLE_CIRCULAR = 'https://www.knec.ac.ke/wp-content/uploads/2025/06/CIRCULAR-ON-ACCESSING-KJSEA-SAMPLE-PAPER-8.pdf';

const SUBJECT_ALIASES: Record<KJSEASubjectKey, string[]> = {
  english: ['english'],
  kiswahili: ['kiswahili', 'ksl', 'kenya sign language'],
  integratedscience: ['integrated science', 'integratedscience', 'science'],
};

export function kjseaSubjectKey(subject: unknown): KJSEASubjectKey | null {
  const key = normalizeKey(String(subject || ''));
  return (Object.keys(SUBJECT_ALIASES) as KJSEASubjectKey[]).find((candidate) =>
    SUBJECT_ALIASES[candidate].some((alias) => normalizeKey(alias) === key || key.includes(normalizeKey(alias))),
  ) || null;
}

const PAPER_DATA: Record<KJSEASubjectKey, Record<'paper1' | 'paper2', KJSEAPaperSpec>> = {
  english: {
    paper1: {
      subjectKey: 'english', variant: 'paper1', title: 'Paper 1 · English Language', code: '901/1', marks: 50, duration_minutes: 100,
      components: [
        { label: 'Listening & speaking', marks: 5, detail: 'Oral or interaction situations' },
        { label: 'Cloze test', marks: 10, detail: 'Cloze and vocabulary/usage items' },
        { label: 'Reading comprehension', marks: 20, detail: 'Four reading passages' },
        { label: 'Grammar', marks: 15, detail: 'Grammar and sentence-completion items' },
      ],
      format_notes: ['50 compulsory multiple-choice questions with four options A–D and one selected response per item.', 'Use answer-sheet/OMR wording for administered papers; do not copy any sample-paper question text.'],
      sources: [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR],
    },
    paper2: {
      subjectKey: 'english', variant: 'paper2', title: 'Paper 2 · English Composition & Literary Analysis', code: '901/2', marks: 50, duration_minutes: 105,
      components: [
        { label: 'Composition', marks: 15, detail: 'One extended composition task' },
        { label: 'Oral literature', marks: 10, detail: 'Literary-analysis task' },
        { label: 'Novella / short story', marks: 10, detail: 'Excerpt-based literary analysis' },
        { label: 'Play', marks: 10, detail: 'Excerpt-based literary analysis' },
        { label: 'Poetry', marks: 5, detail: 'Poetry interpretation' },
      ],
      format_notes: ['Two sections: composition followed by structured literary-analysis tasks.', 'Use explicit printed marks and model answers; the composition and analysis content must be original.'],
      sources: [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR],
    },
  },
  kiswahili: {
    paper1: {
      subjectKey: 'kiswahili', variant: 'paper1', title: 'Paper 1 · Kiswahili Lugha', code: '902/1', marks: 50, duration_minutes: 100,
      components: [
        { label: 'Ufahamu wa kusoma', marks: 20, detail: 'Four reading-comprehension passages' },
        { label: 'Kusikiliza na kuzungumza', marks: 5, detail: 'Listening and speaking situations' },
        { label: 'Cloze test', marks: 10, detail: 'Cloze and vocabulary usage' },
        { label: 'Sarufi / language', marks: 15, detail: 'Grammar and language items' },
      ],
      format_notes: ['50 compulsory multiple-choice questions with four options A–D.', 'Use Kiswahili task labels such as ufahamu, kusikiliza na kuzungumza, sarufi, nahau, methali and ngeli where relevant.'],
      sources: [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR],
    },
    paper2: {
      subjectKey: 'kiswahili', variant: 'paper2', title: 'Paper 2 · Kiswahili Insha na Utangulizi wa Fasihi', code: '902/2', marks: 50, duration_minutes: 105,
      components: [
        { label: 'Insha', marks: 15, detail: 'Composition task, typically 300–350 words' },
        { label: 'Fasihi simulizi', marks: 10, detail: 'Oral literature' },
        { label: 'Novela', marks: 10, detail: 'Novel / short-story analysis' },
        { label: 'Tamthilia', marks: 10, detail: 'Play analysis' },
        { label: 'Ushairi', marks: 5, detail: 'Poetry interpretation' },
      ],
      format_notes: ['Two sections, A and B; all questions are compulsory and answers are written in Kiswahili.', 'Print mark values beside sub-parts and provide actual model answers in the marking scheme.'],
      sources: [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR],
    },
  },
  integratedscience: {
    paper1: {
      subjectKey: 'integratedscience', variant: 'paper1', title: 'Paper 1 · Integrated Science (Theory)', code: '905/1', marks: 70, duration_minutes: 100,
      components: [
        { label: 'Section A · Multiple choice', marks: 30, detail: '30 objective items' },
        { label: 'Section B · Structured and essay', marks: 40, detail: 'Short structured and essay work; original source-based tasks' },
      ],
      format_notes: ['30 multiple-choice questions worth 1 mark each, followed by 40 marks of structured/essay work.', 'Use Integrated Science (Theory), Section A, Section B, separate answer sheet, and spaces provided in this question paper as prompt-safe labels.'],
      sources: [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR],
    },
    paper2: {
      subjectKey: 'integratedscience', variant: 'paper2', title: 'Paper 2 · Integrated Science (Practical)', code: '905/2', marks: 30, duration_minutes: 60,
      components: [
        { label: 'Chemistry', marks: 10, detail: 'Practical skills and written observations' },
        { label: 'Biology', marks: 10, detail: 'Practical skills, recording and interpretation' },
        { label: 'Physics', marks: 10, detail: 'Measurement, apparatus and conclusions' },
      ],
      format_notes: ['Use the current KNEC timetable/regulations specification of 30 marks in 60 minutes.', 'The January 2025 familiarisation sample shows an earlier 90-minute presentation; retain the current 60-minute specification rather than merging the two versions.'],
      sources: [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR],
    },
  },
};

export function getKjseaPaperSpec(subject: unknown, variant: KJSEACardVariant = 'single'): KJSEAPaperSpec | null {
  const subjectKey = kjseaSubjectKey(subject);
  if (!subjectKey) return null;
  if (variant === 'paper1' || variant === 'paper2') return PAPER_DATA[subjectKey][variant];
  const paper1 = PAPER_DATA[subjectKey].paper1;
  const paper2 = PAPER_DATA[subjectKey].paper2;
  const combined = {
    subjectKey,
    variant,
    title: 'Whole subject · Paper 1 + Paper 2',
    code: `${paper1.code} + ${paper2.code}`,
    marks: paper1.marks + paper2.marks,
    duration_minutes: paper1.duration_minutes + paper2.duration_minutes,
    components: [
      { label: paper1.title, marks: paper1.marks, detail: `${paper1.duration_minutes} minutes` },
      { label: paper2.title, marks: paper2.marks, detail: `${paper2.duration_minutes} minutes` },
    ],
    format_notes: ['Whole-subject mode combines the two official papers; generating both separately is available for schools that need separate answer books.', ...paper1.format_notes, ...paper2.format_notes],
    sources: Array.from(new Set([...paper1.sources, ...paper2.sources])),
  } satisfies KJSEAPaperSpec;
  return combined;
}

function section(
  id: string,
  title: string,
  question_type: QuestionType,
  count: number,
  marks_per_question: number,
  difficulty: Difficulty,
): ExamBlueprintSection {
  return { id, title, question_type, count, marks_per_question, difficulty };
}

function paperSections(subjectKey: KJSEASubjectKey, variant: 'paper1' | 'paper2', difficulty: Difficulty): ExamBlueprintSection[] {
  if (subjectKey === 'integratedscience' && variant === 'paper1') {
    return [
      section('kjsea-is-p1-mcq', 'Section A: Multiple Choice Questions', 'multiple_choice', 30, 1, difficulty),
      section('kjsea-is-p1-structured-1', 'Section B: Structured task 1', 'case_study', 1, 3, difficulty),
      section('kjsea-is-p1-structured-2', 'Section B: Structured task 2', 'case_study', 1, 13, difficulty),
      section('kjsea-is-p1-structured-3', 'Section B: Structured task 3', 'case_study', 1, 16, difficulty),
      section('kjsea-is-p1-structured-4', 'Section B: Structured task 4', 'case_study', 1, 8, difficulty),
    ];
  }
  if (subjectKey === 'integratedscience' && variant === 'paper2') {
    return [
      section('kjsea-is-p2-chemistry', 'Practical skills: Chemistry', 'case_study', 1, 10, difficulty),
      section('kjsea-is-p2-biology', 'Practical skills: Biology', 'case_study', 1, 10, difficulty),
      section('kjsea-is-p2-physics', 'Practical skills: Physics', 'case_study', 1, 10, difficulty),
    ];
  }
  if (variant === 'paper1') {
    return [section(`kjsea-${subjectKey}-p1-mcq`, 'Paper 1: Multiple Choice Questions', 'multiple_choice', 50, 1, difficulty)];
  }
  return [
    section(`kjsea-${subjectKey}-p2-composition`, subjectKey === 'kiswahili' ? 'Sehemu A: Insha' : 'Section A: Composition', 'essay', 1, 15, difficulty),
    section(`kjsea-${subjectKey}-p2-oral`, subjectKey === 'kiswahili' ? 'Sehemu B: Fasihi Simulizi' : 'Section B: Oral Literature', 'case_study', 1, 10, difficulty),
    section(`kjsea-${subjectKey}-p2-novella`, subjectKey === 'kiswahili' ? 'Sehemu B: Novela' : 'Section B: Novella / Short Story', 'case_study', 1, 10, difficulty),
    section(`kjsea-${subjectKey}-p2-play`, subjectKey === 'kiswahili' ? 'Sehemu B: Tamthilia' : 'Section B: Play', 'case_study', 1, 10, difficulty),
    section(`kjsea-${subjectKey}-p2-poetry`, subjectKey === 'kiswahili' ? 'Sehemu B: Ushairi' : 'Section B: Poetry', 'case_study', 1, 5, difficulty),
  ];
}

export function makeKjseaBlueprint(subject: unknown, variant: PaperVariant = 'single', difficulty: Difficulty = 'mixed'): ExamBlueprint | undefined {
  const subjectKey = kjseaSubjectKey(subject);
  if (!subjectKey) return undefined;
  const sections = variant === 'single'
    ? [...paperSections(subjectKey, 'paper1', difficulty), ...paperSections(subjectKey, 'paper2', difficulty)]
    : paperSections(subjectKey, variant, difficulty);
  const total_marks = sections.reduce((sum, item) => sum + item.count * item.marks_per_question, 0);
  const spec = getKjseaPaperSpec(subject, variant);
  return { sections, total_marks, estimated_minutes: spec?.duration_minutes, paper_variant: variant };
}

export function kjseaFormatInstruction(subject: unknown, variant: PaperVariant = 'single'): string {
  const spec = getKjseaPaperSpec(subject, variant);
  if (!spec) return '';
  const componentText = spec.components.map((component) => `${component.label} (${component.marks} marks): ${component.detail}`).join('; ');
  return [
    `KJSEA paper format: ${spec.title}, ${spec.marks} marks, ${spec.duration_minutes} minutes.`,
    `Required components: ${componentText}.`,
    ...spec.format_notes,
    'Use these as format metadata only. Generate original questions; do not reproduce any source paper question, answer, or marking scheme text.',
  ].join(' ');
}

export const KJSEA_FORMAT_SOURCES = [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR];
