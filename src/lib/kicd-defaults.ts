/**
 * KICD Junior School defaults.
 *
 * Weekly lesson counts come from each KICD curriculum design's own lesson
 * allocation table; exam paper durations come from the KNEC KJSEA timetable.
 * They live in `curriculum_lesson_defaults` and `exam_paper_defaults` and are
 * used ONLY to pre-fill the numbers a school admin would otherwise type.
 * Every value stays editable and nothing here changes how a timetable or an
 * exam paper is actually built.
 */

export interface LessonDefault {
  subject_name: string;
  grade_number: number | null;
  lessons_per_week: number;
}

export interface PaperDefault {
  subject_name: string;
  grade_number: number | null;
  paper_type: string;
  duration_minutes: number | null;
  total_marks: number | null;
}

/** Minimal structural type so this module works with either supabase client. */
interface SupabaseLike {
  from: (table: string) => any;
}

const normalizeName = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Schools name learning areas freely, so map the common spellings onto the
 * canonical KICD names used by `curriculum_lesson_defaults`.
 */
const SUBJECT_ALIASES: Record<string, string> = {
  english: 'english',
  mathematics: 'mathematics',
  maths: 'mathematics',
  kiswahili: 'kiswahili',
  ksl: 'kiswahili',
  'kenya sign language': 'kiswahili',
  'kiswahili kenya sign language': 'kiswahili',
  'integrated science': 'integrated science',
  science: 'integrated science',
  'social studies': 'social studies',
  'pre technical studies': 'pre technical studies',
  'pretechnical studies': 'pre technical studies',
  'agriculture and nutrition': 'agriculture and nutrition',
  agriculture: 'agriculture and nutrition',
  'creative arts and sports': 'creative arts and sports',
  'creative arts': 'creative arts and sports',
  'religious education': 'religious education',
  'religious studies': 'religious education',
  cre: 'christian religious education',
  'christian religious education': 'christian religious education',
  ire: 'islamic religious education',
  'islamic religious education': 'islamic religious education',
  hre: 'hindu religious education',
  'hindu religious education': 'hindu religious education',
};

const CANONICAL_SUBJECT_NAMES = Array.from(new Set(Object.values(SUBJECT_ALIASES)));

/**
 * Resolve a school's spelling of a learning area to the canonical KICD name.
 * Exact aliases win; otherwise fall back to a loose token match so partial
 * spellings such as "Pre-Technical" or "Kiswahili/KSL" still resolve.
 */
export const canonicalSubjectName = (value: unknown): string => {
  const normalized = normalizeName(value);
  if (!normalized) return '';
  const aliased = SUBJECT_ALIASES[normalized];
  if (aliased) return aliased;
  const loose = CANONICAL_SUBJECT_NAMES.find(
    (candidate) => candidate === normalized || candidate.startsWith(`${normalized} `) || normalized.startsWith(`${candidate} `),
  );
  return loose ?? normalized;
};

export const gradeNumberOf = (grade: unknown): number | null => {
  if (typeof grade === 'number' && Number.isFinite(grade)) return grade;
  const match = String(grade ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

async function safeSelect(client: SupabaseLike, table: string, columns: string): Promise<any[]> {
  try {
    const { data, error } = await client.from(table).select(columns);
    if (error) return [];
    return (data || []) as any[];
  } catch {
    // A missing table or a blocked read must never block the timetable or exam flow.
    return [];
  }
}

export const fetchLessonDefaults = async (client: SupabaseLike): Promise<LessonDefault[]> =>
  (await safeSelect(client, 'curriculum_lesson_defaults', 'subject_name, grade_number, lessons_per_week')) as LessonDefault[];

export const fetchPaperDefaults = async (client: SupabaseLike): Promise<PaperDefault[]> =>
  (await safeSelect(client, 'exam_paper_defaults', 'subject_name, grade_number, paper_type, duration_minutes, total_marks')) as PaperDefault[];

export const defaultLessonsPerWeek = (
  defaults: LessonDefault[],
  subjectName: unknown,
  grade: unknown,
): number | null => {
  const wanted = canonicalSubjectName(subjectName);
  if (!wanted) return null;
  const matches = defaults.filter((row) => canonicalSubjectName(row.subject_name) === wanted);
  if (matches.length === 0) return null;
  const gradeNumber = gradeNumberOf(grade);
  const row =
    (gradeNumber !== null ? matches.find((r) => Number(r.grade_number) === gradeNumber) : undefined) ?? matches[0];
  const value = Number(row?.lessons_per_week);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** Paper types to try, in order, for a given UI paper variant. */
export const paperTypeCandidates = (paperType: unknown): string[] => {
  const raw = String(paperType ?? '').trim().toLowerCase();
  if (raw === 'paper 1' || raw === 'paper1') return ['Paper 1', 'Standard'];
  if (raw === 'paper 2' || raw === 'paper2') return ['Paper 2', 'Standard'];
  return ['Standard', 'Paper 1', 'Paper 2'];
};

const findPaperRow = (
  defaults: PaperDefault[],
  subjectName: unknown,
  grade: unknown,
  paperType: unknown,
): PaperDefault | null => {
  const wantedSubject = canonicalSubjectName(subjectName);
  if (!wantedSubject) return null;
  const gradeNumber = gradeNumberOf(grade);
  for (const candidate of paperTypeCandidates(paperType)) {
    const wantedPaper = candidate.toLowerCase();
    const matches = defaults.filter(
      (row) =>
        canonicalSubjectName(row.subject_name) === wantedSubject &&
        String(row.paper_type ?? '').trim().toLowerCase() === wantedPaper,
    );
    if (matches.length === 0) continue;
    return (
      (gradeNumber !== null ? matches.find((r) => Number(r.grade_number) === gradeNumber) : undefined) ?? matches[0]
    );
  }
  return null;
};

export const defaultExamDuration = (
  defaults: PaperDefault[],
  subjectName: unknown,
  grade: unknown,
  paperType: unknown,
): number | null => {
  const row = findPaperRow(defaults, subjectName, grade, paperType);
  const minutes = Number(row?.duration_minutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
};

export const defaultExamMarks = (
  defaults: PaperDefault[],
  subjectName: unknown,
  grade: unknown,
  paperType: unknown,
): number | null => {
  const row = findPaperRow(defaults, subjectName, grade, paperType);
  const marks = Number(row?.total_marks);
  return Number.isFinite(marks) && marks > 0 ? marks : null;
};
