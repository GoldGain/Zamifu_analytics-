import {
  calculateCompetencyGrade,
  getSchoolLevelBand,
  is844Curriculum,
  type SchoolLevelBand,
} from '@/lib/grading';
import { normalizeLearningAreaName } from '@/lib/learningAreas';
import { isGradeTenClass, normalizeSeniorPathway } from '@/lib/seniorPathways';

/** One learner's aggregated totals for a class, term and assessment filter. */
export interface LearnerTotals {
  studentId: string;
  classId: string;
  student: any;
  /** Counted learning-area percentages. Exempt/absent X rows stay in raw results, never here. */
  subjects: Record<string, number>;
  /** Sum of effective learning-area percentages used for means and default ranking. */
  totalMarks: number;
  /** Sum of the current 8-point scale used for CBE and seven-subject 8-4-4 rankings. */
  totalPoints: number;
  rankingTotalPoints?: number;
  rankingTotalMarks?: number;
  rankingSubjects?: string[];
  count: number;
  /** Mean of actual counted subject slots; paired alternatives consume one slot. */
  avgPct: number;
  gender: string | null;
  examName: string;
}

export interface SevenSubjectMetrics {
  subjects: string[];
  totalMarks: number;
  totalPoints: number;
}

/** A recorded X means absent/exempt and is deliberately excluded from every aggregate. */
export function isExcludedResult(result: any): boolean {
  const isX = (value: unknown) => String(value ?? '').trim().toUpperCase() === 'X';
  return isX(result?.mark_code) || isX(result?.marks) || isX(result?.percentage) || isX(result?.grade_844);
}

/** Percentage of a single result row, tolerant of a missing numeric percentage. */
export function rowPercentage(result: any): number {
  const explicit = result?.percentage;
  if (explicit !== null && explicit !== undefined && String(explicit).trim() !== '') {
    const value = Number(explicit);
    if (Number.isFinite(value)) return value;
  }
  const outOf = Number(result?.out_of);
  if (Number.isFinite(outOf) && outOf > 0) {
    const marks = Number(result?.marks);
    return Number.isFinite(marks) ? (marks / outOf) * 100 : 0;
  }
  const marks = Number(result?.marks);
  return Number.isFinite(marks) ? marks : 0;
}

/** All senior and 8-4-4 ranking points use the requested 8-point maximum. */
export function rankingPointsForPercentage(percentage: number): number {
  return calculateCompetencyGrade(percentage, 'senior').points;
}

const isMathematicsSubject = (name: string): boolean =>
  /^(?:mathematics|maths?)(?:\s+(?:alternative\s+)?[ab])?\b|^(?:core|essential)\s+mathematics\b/i.test(name.trim());

const isKnecLanguageSubject = (name: string): boolean =>
  /\benglish\b|\bkiswahili\b|\bkenya sign language\b|\bksl\b/i.test(name);

const compareBest = (subjects: Record<string, number>) => (a: string, b: string) =>
  rankingPointsForPercentage(subjects[b] || 0) - rankingPointsForPercentage(subjects[a] || 0)
  || (subjects[b] || 0) - (subjects[a] || 0)
  || a.localeCompare(b);

/**
 * Form 3/4 rank: Mathematics, the strongest language, then five best remaining
 * subjects. It always exposes an 8-points-per-subject total (maximum 56).
 */
export function calculateKnecSevenSubjectMetrics(subjects: Record<string, number>): SevenSubjectMetrics {
  const names = Object.keys(subjects);
  const best = compareBest(subjects);
  const maths = names.filter(isMathematicsSubject).sort(best);
  const languages = names.filter(isKnecLanguageSubject).sort(best);
  const otherSubjects = names
    .filter((name) => !isMathematicsSubject(name) && !isKnecLanguageSubject(name))
    .sort(best);
  const selected = [maths[0], languages[0], ...otherSubjects.slice(0, 5)].filter((name): name is string => Boolean(name));
  return {
    subjects: selected,
    totalMarks: selected.reduce((sum, name) => sum + (subjects[name] || 0), 0),
    totalPoints: selected.reduce((sum, name) => sum + rankingPointsForPercentage(subjects[name] || 0), 0),
  };
}

const isEnglish = (name: string) => /\benglish\b/i.test(name);
const isKiswahiliOrKsl = (name: string) => /\bkiswahili\b|\bkenya sign language\b|\bksl\b/i.test(name);
const isCsl = (name: string) => /\bcommunity service learning\b|\bcsl\b/i.test(name);
const isCoreMath = (name: string) => /\bcore mathematics\b|\bmathematics\s*a\b/i.test(name);
const isEssentialMath = (name: string) => /\bessential mathematics\b|\bmathematics\s*b\b/i.test(name);

const pathwayElectivePatterns: Record<string, RegExp> = {
  STEM: /biology|chemistry|physics|computer|agriculture|home science|general science|technical|technology|engineering|aviation|electricity|construction|woodwork|metalwork|power mechanics|drawing and design|marine|health|gis/i,
  'Social Sciences': /business|history|geography|economics|law|hospitality|tourism|literature|fasihi|french|german|arabic|language|journalism|citizenship/i,
  'Arts and Sports Science': /art|music|dance|theatre|performing|visual|sports|physical education|creative media|film/i,
};

/**
 * Grade 10 rank: English, Kiswahili/KSL, pathway-appropriate Mathematics, CSL,
 * and the learner's best three recorded pathway electives.  Subject assignments
 * normally ensure only pathway electives are present; the explicit pathway map
 * protects the rank when an unrelated result is also present.
 */
export function calculateSeniorSevenSubjectMetrics(subjects: Record<string, number>, student?: any): SevenSubjectMetrics {
  const names = Object.keys(subjects);
  const best = compareBest(subjects);
  const pathway = normalizeSeniorPathway(student?.pathway);
  const mathematics = pathway === 'STEM'
    ? names.filter(isCoreMath)
    : pathway
      ? names.filter(isEssentialMath)
      : names.filter(isMathematicsSubject);
  const selectedCore = [
    names.filter(isEnglish).sort(best)[0],
    names.filter(isKiswahiliOrKsl).sort(best)[0],
    mathematics.sort(best)[0] || names.filter(isMathematicsSubject).sort(best)[0],
    names.filter(isCsl).sort(best)[0],
  ].filter((name): name is string => Boolean(name));
  const selectedSet = new Set(selectedCore);
  const remaining = names.filter((name) => !selectedSet.has(name));
  const pathwayCandidates = pathway
    ? remaining.filter((name) => pathwayElectivePatterns[pathway].test(name))
    : [];
  const electives = (pathwayCandidates.length >= 3 ? pathwayCandidates : remaining).sort(best).slice(0, 3);
  const selected = [...selectedCore, ...electives];
  return {
    subjects: selected,
    totalMarks: selected.reduce((sum, name) => sum + (subjects[name] || 0), 0),
    totalPoints: selected.reduce((sum, name) => sum + rankingPointsForPercentage(subjects[name] || 0), 0),
  };
}

export function usesSevenSubjectRanking(classObj: any): boolean {
  return is844Curriculum(classObj) || isGradeTenClass(classObj);
}

/** Paired alternatives contribute only their best recorded member to a mean. */
function optionalSlotGroup(name: string): string | null {
  const normalized = normalizeLearningAreaName(name).toLowerCase().replace(/\s+/g, ' ').trim();
  if (['cre', 'ire', 'hre', 'religious education'].includes(normalized)) return 'religious-education';
  if (['kiswahili', 'kenya sign language', 'ksl'].includes(normalized)) return 'kiswahili-ksl';
  if (['mathematics a', 'mathematics b', 'core mathematics', 'essential mathematics'].includes(normalized)) return 'mathematics-alternative';
  return null;
}

function effectiveMeanSubjects(subjects: Record<string, number>): string[] {
  const singleton: string[] = [];
  const alternatives = new Map<string, string[]>();
  Object.keys(subjects).forEach((name) => {
    const group = optionalSlotGroup(name);
    if (!group) singleton.push(name);
    else alternatives.set(group, [...(alternatives.get(group) || []), name]);
  });
  alternatives.forEach((names) => {
    names.sort(compareBest(subjects));
    if (names[0]) singleton.push(names[0]);
  });
  return singleton;
}

/**
 * Aggregate rows into one deterministic record per learner. The newest row per
 * learner/learning-area wins; an X row wins the display state but is excluded
 * from all rank and mean arithmetic.
 */
export function aggregateLearnerTotals(rawResults: any[], classObj: any): LearnerTotals[] {
  const band: SchoolLevelBand = getSchoolLevelBand(classObj);
  const entries = new Map<string, LearnerTotals>();
  const winners = new Map<string, Map<string, { createdAt: number; index: number; row: any }>>();

  (rawResults || []).forEach((result: any, index: number) => {
    const studentId = result?.student_id;
    if (!studentId) return;
    if (!entries.has(studentId)) {
      entries.set(studentId, {
        studentId,
        classId: result.class_id,
        student: result.students,
        subjects: {},
        totalMarks: 0,
        totalPoints: 0,
        count: 0,
        avgPct: 0,
        gender: result.students?.gender || null,
        examName: result.school_exams?.name || result.exams?.name || '',
      });
      winners.set(studentId, new Map());
    }
    const entry = entries.get(studentId)!;
    if (result.students) entry.student = result.students;
    if (result.school_exams?.name || result.exams?.name) entry.examName = result.school_exams?.name || result.exams?.name;
    const area = normalizeLearningAreaName(result.subjects?.name || 'Unknown');
    const createdAt = Date.parse(String(result.created_at || '')) || 0;
    const perLearner = winners.get(studentId)!;
    const previous = perLearner.get(area);
    if (previous && (previous.createdAt > createdAt || (previous.createdAt === createdAt && previous.index <= index))) return;
    perLearner.set(area, { createdAt, index, row: result });
  });

  return Array.from(entries.values()).map((entry) => {
    const rawSubjects: Record<string, number> = {};
    winners.get(entry.studentId)?.forEach((winner, area) => {
      if (!isExcludedResult(winner.row)) rawSubjects[area] = rowPercentage(winner.row);
    });
    const effectiveNames = effectiveMeanSubjects(rawSubjects);
    const totalMarks = effectiveNames.reduce((sum, name) => sum + (rawSubjects[name] || 0), 0);
    const totalPoints = effectiveNames.reduce((sum, name) => sum + (band === 'primary' ? 0 : rankingPointsForPercentage(rawSubjects[name] || 0)), 0);
    const sevenSubjectMetrics = is844Curriculum(classObj)
      ? calculateKnecSevenSubjectMetrics(rawSubjects)
      : isGradeTenClass(classObj)
        ? calculateSeniorSevenSubjectMetrics(rawSubjects, entry.student)
        : null;
    return {
      ...entry,
      subjects: rawSubjects,
      totalMarks,
      totalPoints,
      count: effectiveNames.length,
      avgPct: effectiveNames.length ? totalMarks / effectiveNames.length : 0,
      ...(sevenSubjectMetrics ? {
        rankingTotalMarks: sevenSubjectMetrics.totalMarks,
        rankingTotalPoints: sevenSubjectMetrics.totalPoints,
        rankingSubjects: sevenSubjectMetrics.subjects,
      } : {}),
      gender: entry.gender || entry.student?.gender || null,
    };
  });
}
