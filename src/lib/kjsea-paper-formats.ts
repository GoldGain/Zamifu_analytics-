/**
 * Source-backed KJSEA paper metadata.
 *
 * This module stores format metadata, mark allocations, durations, and
 * prompt-safe conventions. It does not reproduce sample-paper question text.
 */
import type { Difficulty, ExamBlueprint, ExamBlueprintSection, PaperVariant, QuestionType } from './exam-schema.js';

const normalizeKey = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export type KJSEASubjectKey = 'english' | 'kiswahili' | 'mathematics' | 'integratedscience' | 'agriculture' | 'pretechnical' | 'socialstudies' | 'cre' | 'ire' | 'hre' | 'creativearts';
export type KJSEACardVariant = PaperVariant | 'both';
export interface KJSEAComponent { label: string; marks: number; detail: string; }
export interface KJSEAPaperSpec { subjectKey: KJSEASubjectKey; variant: 'paper1' | 'paper2' | 'single'; title: string; code: string; marks: number; duration_minutes: number; components: KJSEAComponent[]; format_notes: string[]; sources: string[]; }

const KNEC_TIMETABLE = 'https://www.knec.ac.ke/wp-content/uploads/2026/02/2026-KJSEA-TIMETABLE.pdf';
const KNEC_REGULATIONS = 'https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf';
const KNEC_SAMPLE_CIRCULAR = 'https://www.knec.ac.ke/wp-content/uploads/2025/06/CIRCULAR-ON-ACCESSING-KJSEA-SAMPLE-PAPER-8.pdf';
const SOURCES = [KNEC_TIMETABLE, KNEC_REGULATIONS, KNEC_SAMPLE_CIRCULAR];
const SAMPLE_SOURCE_URLS: Record<string, string[]> = {
  'english-paper1': ['https://drive.google.com/uc?export=download&id=18A4kOYH2pMdpCLwxbJEbbbCWjfE3fAlG', 'https://arena.co.ke/knec-grade-9-kjsea-examinable-papers-and-test-areas/', 'https://www.examwise.co.ke/'],
  'english-paper2': ['https://drive.google.com/uc?export=download&id=1BPagBkrGv7wysZFHsCpNx7ORkqFG088o', 'https://arena.co.ke/knec-official-grade-9-kjsea-assessment-papers-theory-and-practicals/', 'https://www.examwise.co.ke/'],
  'kiswahili-paper1': ['https://drive.google.com/uc?export=download&id=1_iELtrolxxt_86USJGxyNhsEUMR0Pipu', 'https://arena.co.ke/knec-official-grade-9-kjsea-assessment-papers-theory-and-practicals/', 'https://www.examwise.co.ke/'],
  'kiswahili-paper2': ['https://drive.google.com/uc?export=download&id=12gw3jPEtKYsIZhu85tzmwWiowqFmqP6T', 'https://www.notes.co.ke/notes/6326/kjsea-kiswahili-insha-na-utangulizi-wa-fasihi-sample-paper', 'https://www.examwise.co.ke/'],
  'integratedscience-paper1': ['https://drive.google.com/uc?export=download&id=1K3VzbT1Q4McYs5CfALO6E0ZcUGNakewh', 'https://arena.co.ke/knec-official-grade-9-kjsea-assessment-papers-theory-and-practicals/', 'https://www.examwise.co.ke/'],
  'integratedscience-paper2': ['https://drive.google.com/uc?export=download&id=1Yfe31QLKUj4jTQ5puUfg05H-iMgx76pf', 'https://www.easyelimu.com/exams/14-junior-secondary/34-grade-9-exams/41-2025-grade-9-exams/67-cbc-grade-9-exams-term-1-2025/361-set-3-grade-9-openers-exams-term-1-2025/3393-kjsea-grade-9-integrated-science-p2-openers-exams-term-1-2025-set-3', 'https://www.examwise.co.ke/app/question-predictor?grade=9&subject=integrated-science-paper2'],
  'socialstudies-single': ['https://drive.google.com/uc?export=download&id=1y9hFtjMlDqCIdkFVN9jJ4sBq02woLEMg', 'https://arena.co.ke/knec-official-grade-9-kjsea-assessment-papers-theory-and-practicals/'],
};
const SAMPLE_STYLE_GUIDANCE: Record<string, string> = {
  'english-paper1': 'Follow the 2026 KNEC component totals. The continuous Q1–50 objective flow, passage-group ranges, A–D options and one-mark items are January 2025 sample-style defaults, not additional 2026 rules. Use prose stimuli and no open sub-parts.',
  'english-paper2': 'Follow the 2026 components in order: Q1 composition, then oral literature, novella/short story, play and poetry. Q1–Q5 numbering and one task per component are historical sample-style defaults, not a 2026 question-count mandate. Use literary extracts, speaker labels and stage directions where relevant; use parenthetical mark notation and lettered sub-parts.',
  'kiswahili-paper1': 'Follow the 2026 components exactly: Ufahamu wa Kusoma (four passages, 20 marks), Kusikiliza na Kuzungumza (5 marks), and Sarufi (25 marks). The Q1–Q50 continuous objective sequence is a January 2025 sample-style default, not a 2026 item-count rule. Do not treat cloze as a separate 10-mark component; cloze may appear within Sarufi when appropriate. Include a data-table stimulus only when an item calls for it.',
  'kiswahili-paper2': 'Follow the 2026 components: Insha (15 marks), then Fasihi Simulizi, Novela, Tamthilia and Ushairi (10/10/10/5). Q1–Q5 numbering, five tasks, and the 300–350-word Insha are historical sample-style defaults, not 2026 mandates. Use Kiswahili alama notation and explicit sub-parts whose marks sum to the parent total.',
  'integratedscience-paper1': 'Follow the 2026 section totals: Section A has 30 MCQs/30 marks and Section B has 40 marks of structured and essay work. The ten-question Q31–Q40 pattern and its variable marks are from the January 2025 sample, a historical style default rather than a 2026 requirement. Use A–D options, lettered sub-parts, and readable tables/diagrams only when they support the selected Grade 9 science context.',
  'integratedscience-paper2': 'Follow the 2026 written practical-skills format: three questions in Chemistry, Biology and Physics, 30 marks total and 60 minutes. The regulations do not specify an internal mark split; this generator uses 10 marks per question only as a provisional balanced allocation, not a KNEC mandate. Never copy the older January 2025 two-question/90-minute format. Use apparatus, observations, measurements, safety and conclusions.',
  'socialstudies-single': 'Follow the 2026 totals: Section A has 20 MCQs/20 marks and Section B has 80 marks of structured and essay questions. The 14-question Q21–Q34 variable-mark pattern is a January 2025 sample-style default, not a 2026 mandate. Include at least one complete map-based question; Q21 is a sample-style placement, not a current KNEC numbering rule. If another map is useful, Q34 is also a historical sample position.',
};
const SUBJECT_ALIASES: Record<KJSEASubjectKey, string[]> = {
  english: ['english'], kiswahili: ['kiswahili'], mathematics: ['mathematics', 'maths', 'math'],
  integratedscience: ['integrated science', 'integratedscience', 'science'], agriculture: ['agriculture', 'agriculture and nutrition'],
  pretechnical: ['pre-technical studies', 'pre technical studies', 'pretechnical'], socialstudies: ['social studies', 'socialstudies'],
  cre: ['cre', 'christian religious education'], ire: ['ire', 'islamic religious education'], hre: ['hre', 'hindu religious education'], creativearts: ['creative arts', 'creative arts and sports', 'creativearts'],
};
export function kjseaSubjectKey(subject: unknown): KJSEASubjectKey | null {
  const key = normalizeKey(subject);
  const candidates = Object.keys(SUBJECT_ALIASES) as KJSEASubjectKey[];
  return candidates.find((candidate) => SUBJECT_ALIASES[candidate].some((alias) => normalizeKey(alias) === key))
    || candidates.find((candidate) => SUBJECT_ALIASES[candidate].some((alias) => normalizeKey(alias).length >= 5 && key.includes(normalizeKey(alias))))
    || null;
}
export const TWO_PAPER_SUBJECTS: KJSEASubjectKey[] = ['english', 'kiswahili', 'integratedscience', 'agriculture', 'pretechnical', 'creativearts'];
export function subjectHasTwoPapers(subject: unknown): boolean { const key = kjseaSubjectKey(subject); return Boolean(key && TWO_PAPER_SUBJECTS.includes(key)); }
const notes = (extra: string[] = []) => [...extra, 'Use original questions and answers; do not reproduce any source-paper wording.'];
const makeSpec = (subjectKey: KJSEASubjectKey, variant: 'paper1' | 'paper2' | 'single', title: string, code: string, marks: number, duration_minutes: number, components: KJSEAComponent[], extra: string[] = []): KJSEAPaperSpec => ({ subjectKey, variant, title, code, marks, duration_minutes, components, format_notes: notes(extra), sources: [...SOURCES, ...(SAMPLE_SOURCE_URLS[`${subjectKey}-${variant}`] || [])] });

const PAPER_DATA: Record<KJSEASubjectKey, { paper1: KJSEAPaperSpec; paper2: KJSEAPaperSpec }> = {
  english: { paper1: makeSpec('english', 'paper1', 'Paper 1 · English (Reading Comprehension, Oral Skills and Grammar)', '901/1', 50, 100, [{ label: 'Reading comprehension (four passages)', marks: 20, detail: '2026 KNEC component; item ranges are not prescribed' }, { label: 'Listening and speaking', marks: 5, detail: '2026 KNEC component' }, { label: 'Cloze test', marks: 10, detail: '2026 KNEC component' }, { label: 'Grammar and language use', marks: 15, detail: '2026 KNEC component' }], ['The January 2025 sample shows 50 continuous compulsory multiple-choice questions numbered 1–50 with A–D options. These item-count, numbering and option details are historical style evidence, not additional 2026 KNEC requirements; the 2026 component totals govern.']), paper2: makeSpec('english', 'paper2', 'Paper 2 · English (Composition and Literary Analysis)', '901/2', 50, 105, [{ label: 'Section A · Composition', marks: 15, detail: 'One composition task' }, { label: 'Section B · Oral literature', marks: 10, detail: 'Literary component' }, { label: 'Section B · Novella/short story', marks: 10, detail: 'Literary component' }, { label: 'Section B · Play', marks: 10, detail: 'Literary component' }, { label: 'Section B · Poetry', marks: 5, detail: 'Literary component' }], ['Five compulsory tasks numbered 1–5. Sub-parts use (a), (b), (c) and nested Roman items. Marks use parenthetical notation such as (15 MARKS).']) },
  kiswahili: { paper1: makeSpec('kiswahili', 'paper1', 'Karatasi ya Kwanza · Kiswahili Lugha', '902/1', 50, 100, [{ label: 'Ufahamu wa Kusoma (four passages)', marks: 20, detail: '2026 KNEC component' }, { label: 'Kusikiliza na Kuzungumza', marks: 5, detail: '2026 KNEC component' }, { label: 'Sarufi', marks: 25, detail: '2026 KNEC component; cloze may be included within this component' }], ['The 2026 allocation is 20 marks for Ufahamu wa Kusoma, 5 for Kusikiliza na Kuzungumza, and 25 for Sarufi. The January 2025 Q1–Q50 sequence and A–D options are historical style defaults; the official 2026 rule does not prescribe those exact item ranges. Cloze must not be a separate 10-mark component.']), paper2: makeSpec('kiswahili', 'paper2', 'Karatasi ya Pili · Kiswahili (Insha na Utangulizi wa Fasihi)', '902/2', 50, 105, [{ label: 'Sehemu A · Insha', marks: 15, detail: 'Composition' }, { label: 'Sehemu B · Fasihi Simulizi', marks: 10, detail: 'Literature component' }, { label: 'Sehemu B · Novela', marks: 10, detail: 'Literature component' }, { label: 'Sehemu B · Tamthilia', marks: 10, detail: 'Literature component' }, { label: 'Sehemu B · Ushairi', marks: 5, detail: 'Literature component' }], ['The 2026 KNEC component marks are 15/10/10/10/5. Five tasks, Q1–Q5 numbering, and the 300–350-word Insha are January 2025 sample-style defaults, not additional 2026 mandates. Use Kiswahili parenthetical mark notation such as (alama 2).']) },
  mathematics: { paper1: makeSpec('mathematics', 'single', 'Mathematics', '903', 100, 120, [{ label: 'Section A · Multiple choice', marks: 20, detail: 'Twenty MCQs' }, { label: 'Section B · Structured and essay questions', marks: 80, detail: 'Structured and essay questions; exact question count and strand allocation must follow the current official sample/rubric' }], ['One paper only. Section A has 20 MCQs worth 20 marks; Section B carries 80 marks. Do not invent a strand-level marks split or expose Paper 2.']), paper2: makeSpec('mathematics', 'paper2', 'Not applicable', '903', 0, 0, []) },
  integratedscience: { paper1: makeSpec('integratedscience', 'paper1', 'Paper 1 · Integrated Science (Theory)', '905/1', 70, 100, [{ label: 'Section A · Multiple choice', marks: 30, detail: 'Thirty multiple-choice questions' }, { label: 'Section B · Structured and essay questions', marks: 40, detail: 'Written structured/essay science tasks; 2026 regulations do not specify an internal item split' }], ['Section A uses a separate answer sheet; Section B is answered in the paper.']), paper2: makeSpec('integratedscience', 'paper2', 'Paper 2 · Integrated Science (Written practical skills)', '905/2', 30, 60, [{ label: 'Written practical skills · three questions', marks: 30, detail: 'Three questions assessing practical skills across Chemistry, Biology and Physics; the 2026 regulations do not state an internal mark split' }], ['Current KNEC regulations and the 2026 timetable set Paper 2 at 60 minutes. The regulations require three questions but do not allocate their individual marks; the blueprint uses 10 marks each only as a provisional balanced default. Older 2025 sample papers show a two-task, 90-minute version; preserve that as historical evidence only, not the current default.']) },
  agriculture: { paper1: makeSpec('agriculture', 'paper1', 'Paper 1 · Agriculture Theory', '906/1', 70, 100, [{ label: 'Section A · Multiple choice', marks: 30, detail: 'Thirty MCQs' }, { label: 'Section B · Structured and essay questions', marks: 40, detail: 'Structured and essay questions' }]), paper2: makeSpec('agriculture', 'paper2', 'Paper 2 · Agriculture Practical Project', '906/2', 30, 0, [{ label: 'Practical/project assessment', marks: 30, detail: 'Practical/project work completed within the KJSEA project window' }], ['The current timetable states the project as a period rather than a timed duration; do not render 150 minutes.']) },
  pretechnical: { paper1: makeSpec('pretechnical', 'paper1', 'Paper 1 · Pre-Technical Studies', '912/1', 80, 100, [{ label: 'Section A · Multiple choice', marks: 30, detail: 'Thirty MCQs' }, { label: 'Section B · Structured and essay questions', marks: 50, detail: 'Structured and essay questions' }]), paper2: makeSpec('pretechnical', 'paper2', 'Paper 2 · Pre-Technical Project', '912/2', 40, 0, [{ label: 'Project', marks: 40, detail: 'One-month project window' }], ['Project duration is one month; represented as a project window, not minutes.']) },
  creativearts: { paper1: makeSpec('creativearts', 'paper1', 'Paper 1 · Creative Arts & Sports Integrated Project', '911/1', 100, 0, [{ label: 'Integrated project', marks: 100, detail: 'Performing Arts, Visual Arts and Sports project completed over three months' }], ['Project duration is three months; represented as a project window, not minutes.']), paper2: makeSpec('creativearts', 'paper2', 'Paper 2 · Creative Arts & Sports', '911/2', 100, 100, [{ label: 'Section A · Multiple choice', marks: 40, detail: 'Forty MCQs' }, { label: 'Section B · Structured', marks: 60, detail: 'Structured questions' }]) },
  socialstudies: { paper1: makeSpec('socialstudies', 'single', 'Social Studies', '907', 100, 90, [{ label: 'Section A · Multiple choice', marks: 20, detail: '20 marks; 20 multiple-choice questions' }, { label: 'Section B · Structured and essay questions', marks: 80, detail: '80 marks; the 2026 regulations do not prescribe the parent-question count or individual mark split' }], ['The 14-question Q21–Q34 variable-mark blueprint is a January 2025 sample-style default, not a 2026 mandate. Include at least one actual map-based question; Q21 is a sample-style placement, not a 2026 numbering rule.']), paper2: makeSpec('socialstudies', 'paper2', 'Not applicable', '907/2', 0, 0, []) },
  cre: { paper1: makeSpec('cre', 'single', 'Christian Religious Education', '908', 100, 90, [{ label: 'Section A · Multiple choice', marks: 20, detail: 'Twenty MCQs' }, { label: 'Section B · Structured', marks: 80, detail: 'Structured questions' }]), paper2: makeSpec('cre', 'paper2', 'Not applicable', '908/2', 0, 0, []) },
  ire: { paper1: makeSpec('ire', 'single', 'Islamic Religious Education', '909', 100, 90, [{ label: 'Section A · Multiple choice', marks: 20, detail: 'Twenty MCQs' }, { label: 'Section B · Structured', marks: 80, detail: 'Structured questions' }]), paper2: makeSpec('ire', 'paper2', 'Not applicable', '909/2', 0, 0, []) },
  hre: { paper1: makeSpec('hre', 'single', 'Hindu Religious Education', '910', 100, 90, [{ label: 'Section A · Multiple choice', marks: 20, detail: 'Twenty MCQs' }, { label: 'Section B · Structured', marks: 80, detail: 'Structured questions' }]), paper2: makeSpec('hre', 'paper2', 'Not applicable', '910/2', 0, 0, []) },
};

function section(id: string, title: string, question_type: QuestionType, count: number, marks_per_question: number, difficulty: Difficulty): ExamBlueprintSection { return { id, title, question_type, count, marks_per_question, difficulty }; }
function paperSections(subjectKey: KJSEASubjectKey, variant: 'paper1' | 'paper2', difficulty: Difficulty): ExamBlueprintSection[] {
  if (subjectKey === 'mathematics') return variant === 'paper2' ? [] : [section('kjsea-mathematics-mcq', 'Section A: Multiple Choice Questions', 'multiple_choice', 20, 1, difficulty), section('kjsea-mathematics-section-b', 'Section B: Structured and essay questions', 'short_answer', 16, 5, difficulty)];
  if (subjectKey === 'socialstudies') {
    if (variant === 'paper2') return [];
    // The 2026 rules specify Section B's aggregate 80 marks but no parent-item split.
    // This variable allocation is the January 2025 sample-style default, not a 2026 mandate.
    const sectionBMarks = [10, 5, 6, 5, 2, 3, 5, 5, 10, 4, 4, 10, 3, 8];
    return [
      section('kjsea-socialstudies-mcq', 'Section A: Multiple Choice Questions', 'multiple_choice', 20, 1, difficulty),
      ...sectionBMarks.map((marks, index) => {
        const questionNumber = index + 21;
        const mapTask = questionNumber === 21;
        const essayTask = questionNumber === 32;
        const label = mapTask ? 'Map-based structured question'
          : essayTask ? 'Essay question'
          : 'Structured question';
        return section(
          `kjsea-socialstudies-q${questionNumber}`,
          `Section B: ${label} ${questionNumber}`,
          essayTask ? 'essay' : 'case_study',
          1,
          marks,
          difficulty,
        );
      }),
    ];
  }
  if (subjectKey === 'cre' || subjectKey === 'ire' || subjectKey === 'hre') return variant === 'paper2' ? [] : [section(`kjsea-${subjectKey}-mcq`, 'Section A: Multiple Choice Questions', 'multiple_choice', 20, 1, difficulty), section(`kjsea-${subjectKey}-structured`, 'Section B: Structured questions', 'case_study', 16, 5, difficulty)];
  if (subjectKey === 'kiswahili' && variant === 'paper1') return [section('kjsea-kiswahili-p1-reading', 'Ufahamu wa Kusoma · 20 marks · four passages', 'multiple_choice', 20, 1, difficulty), section('kjsea-kiswahili-p1-listening', 'Kusikiliza na Kuzungumza · 5 marks', 'multiple_choice', 5, 1, difficulty), section('kjsea-kiswahili-p1-sarufi', 'Sarufi · 25 marks (cloze may be included within this component)', 'multiple_choice', 25, 1, difficulty)];
  if (subjectKey === 'integratedscience' && variant === 'paper1') {
    // Format-only allocation from the repository-cited 2025 KNEC sample; 2026
    // regulations retain the 40-mark Section B total without specifying each item.
    const structuredMarks = [3, 3, 4, 6, 6, 5, 3, 2, 5, 3];
    return [
      section('kjsea-is-p1-mcq', 'Section A: Multiple Choice Questions · Q1–30', 'multiple_choice', 30, 1, difficulty),
      ...structuredMarks.map((marks, index) => section(
        `kjsea-is-p1-q${index + 31}`,
        `Section B: Structured question ${index + 31}`,
        'case_study',
        1,
        marks,
        difficulty,
      )),
    ];
  }
  if (subjectKey === 'integratedscience' && variant === 'paper2') return [section('kjsea-is-p2-q1', 'Question 1 · Chemistry practical skills', 'case_study', 1, 10, difficulty), section('kjsea-is-p2-q2', 'Question 2 · Biology practical skills', 'case_study', 1, 10, difficulty), section('kjsea-is-p2-q3', 'Question 3 · Physics practical skills', 'case_study', 1, 10, difficulty)];
  if ((subjectKey === 'agriculture' || subjectKey === 'pretechnical') && variant === 'paper1') return [section(`kjsea-${subjectKey}-p1-mcq`, 'Section A: Multiple Choice Questions', 'multiple_choice', 30, 1, difficulty), section(`kjsea-${subjectKey}-p1-structured`, 'Section B: Structured', 'case_study', subjectKey === 'agriculture' ? 8 : 10, 5, difficulty)];
  if (subjectKey === 'agriculture' && variant === 'paper2') return [section('kjsea-agriculture-p2-practical', 'Practical paper', 'case_study', 3, 10, difficulty)];
  if (subjectKey === 'pretechnical' && variant === 'paper2') return [section('kjsea-pretechnical-p2-project-a', 'Project assessment criterion A', 'case_study', 1, 20, difficulty), section('kjsea-pretechnical-p2-project-b', 'Project assessment criterion B', 'case_study', 1, 20, difficulty)];
  if (subjectKey === 'creativearts' && variant === 'paper1') return [section('kjsea-creativearts-p1-project-a', 'Integrated project criterion A', 'case_study', 1, 25, difficulty), section('kjsea-creativearts-p1-project-b', 'Integrated project criterion B', 'case_study', 1, 25, difficulty), section('kjsea-creativearts-p1-project-c', 'Integrated project criterion C', 'case_study', 1, 25, difficulty), section('kjsea-creativearts-p1-project-d', 'Integrated project criterion D', 'case_study', 1, 25, difficulty)];
  if (subjectKey === 'creativearts' && variant === 'paper2') return [section('kjsea-creativearts-p2-mcq', 'Section A: Multiple Choice Questions', 'multiple_choice', 40, 1, difficulty), section('kjsea-creativearts-p2-structured', 'Section B: Structured', 'case_study', 12, 5, difficulty)];
  if (variant === 'paper1') return [section(`kjsea-${subjectKey}-p1-comprehension`, 'Reading comprehension · Questions 1–20', 'multiple_choice', 20, 1, difficulty), section(`kjsea-${subjectKey}-p1-oral`, 'Listening and speaking · Questions 21–25', 'multiple_choice', 5, 1, difficulty), section(`kjsea-${subjectKey}-p1-cloze`, 'Cloze test · Questions 26–35', 'multiple_choice', 10, 1, difficulty), section(`kjsea-${subjectKey}-p1-grammar`, 'Grammar and language use · Questions 36–50', 'multiple_choice', 15, 1, difficulty)];
  return subjectKey === 'kiswahili'
    ? [section('kjsea-kiswahili-p2-insha', 'Sehemu A: Insha · Swali la 1', 'essay', 1, 15, difficulty), section('kjsea-kiswahili-p2-fasihi-simulizi', 'Sehemu B: Fasihi Simulizi · Swali la 2', 'case_study', 1, 10, difficulty), section('kjsea-kiswahili-p2-novela', 'Sehemu B: Novela · Swali la 3', 'case_study', 1, 10, difficulty), section('kjsea-kiswahili-p2-tamthilia', 'Sehemu B: Tamthilia · Swali la 4', 'case_study', 1, 10, difficulty), section('kjsea-kiswahili-p2-ushairi', 'Sehemu B: Ushairi · Swali la 5', 'case_study', 1, 5, difficulty)]
    : [section('kjsea-english-p2-composition', 'Section A: Composition · Question 1', 'essay', 1, 15, difficulty), section('kjsea-english-p2-oral', 'Section B: Oral literature · Question 2', 'case_study', 1, 10, difficulty), section('kjsea-english-p2-novella', 'Section B: Novella/short story · Question 3', 'case_study', 1, 10, difficulty), section('kjsea-english-p2-play', 'Section B: Play · Question 4', 'case_study', 1, 10, difficulty), section('kjsea-english-p2-poetry', 'Section B: Poetry · Question 5', 'case_study', 1, 5, difficulty)];
}
export function getKjseaPaperSpec(subject: unknown, variant: KJSEACardVariant = 'single'): KJSEAPaperSpec | null {
  const subjectKey = kjseaSubjectKey(subject); if (!subjectKey) return null;
  if (!subjectHasTwoPapers(subjectKey)) return variant === 'single' ? { ...PAPER_DATA[subjectKey].paper1, variant: 'single' } : null;
  if (variant === 'paper1' || variant === 'paper2') return PAPER_DATA[subjectKey][variant];
  const p1 = PAPER_DATA[subjectKey].paper1; const p2 = PAPER_DATA[subjectKey].paper2;
  return { subjectKey, variant: 'single', title: 'Whole subject · Paper 1 + Paper 2', code: `${p1.code} + ${p2.code}`, marks: p1.marks + p2.marks, duration_minutes: p1.duration_minutes + p2.duration_minutes, components: [{ label: p1.title, marks: p1.marks, detail: `${p1.duration_minutes} minutes` }, { label: p2.title, marks: p2.marks, detail: `${p2.duration_minutes} minutes` }], format_notes: [...p1.format_notes, ...p2.format_notes], sources: SOURCES };
}
export function makeKjseaBlueprint(subject: unknown, variant: PaperVariant = 'single', difficulty: Difficulty = 'mixed'): ExamBlueprint | undefined {
  const subjectKey = kjseaSubjectKey(subject); if (!subjectKey) return undefined;
  const sections = variant === 'single' && subjectHasTwoPapers(subjectKey) ? [...paperSections(subjectKey, 'paper1', difficulty), ...paperSections(subjectKey, 'paper2', difficulty)] : paperSections(subjectKey, variant === 'single' ? 'paper1' : variant, difficulty);
  return { sections, total_marks: sections.reduce((sum, item) => sum + item.count * item.marks_per_question, 0), estimated_minutes: getKjseaPaperSpec(subject, variant)?.duration_minutes, paper_variant: variant };
}
export function kjseaFormatInstruction(subject: unknown, variant: PaperVariant = 'single'): string {
  const resolved = getKjseaPaperSpec(subject, variant); if (!resolved) return '';
  const componentText = resolved.components.map((component) => `${component.label} (${component.marks} marks): ${component.detail}`).join('; ');
  const skeleton = variant === 'paper1' ? 'Paper 1 skeleton: candidate instructions -> Section A/objective items -> option labels A-D -> answer-sheet reminder.' : variant === 'paper2' ? 'Paper 2 skeleton: candidate instructions -> project/practical/structured tasks -> lettered sub-parts with marks -> marking-scheme headings.' : 'Whole-paper skeleton: formal header -> labelled sections -> numbered questions -> lettered sub-parts -> separate marking scheme.';
  const sampleGuidance = SAMPLE_STYLE_GUIDANCE[`${kjseaSubjectKey(subject)}-${variant}`] || '';
  return [`KJSEA paper format: ${resolved.title}, ${resolved.marks} marks, ${resolved.duration_minutes} minutes.`, `Required components: ${componentText}.`, 'Format-only skeleton (not source content): header, candidate instructions, labelled sections, numbered questions, lettered sub-parts, printed marks, and marking-scheme headings.', sampleGuidance, ...resolved.format_notes, 'Header must include school, grade, subject, paper code, date, duration and total marks.', skeleton, 'Generate original questions; do not reproduce any source paper question, answer, or marking-scheme text.'].join(' ');
}
export const KJSEA_FORMAT_SOURCES = SOURCES;
