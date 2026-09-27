import {
  calculateCompetencyGrade,
  getCanonicalLearningAreas,
  getRequiredLearningAreas,
  getSchoolLevelBand,
  type SchoolLevelBand,
} from '@/lib/grading';
import { normalizeLearningAreaName } from '@/lib/learningAreas';
import { rankByUnifiedRule } from '@/lib/ranking';
import { aggregateLearnerTotals } from '@/lib/learnerTotals';

export type AssessmentLearnerSummary = {
  studentId: string;
  classId: string;
  student: any;
  subjects: Record<string, number>;
  totalPct: number;
  /** Total marks across learning areas — the primary metric for ranking. */
  totalMarks?: number;
  count: number;
  avgPct: number;
  totalPoints: number;
  gender: string | null;
  examName: string;
  position: number;
};

export const LEARNING_AREA_ORDER = [
  'English',
  'Kiswahili',
  'Mathematics',
  'Integrated Science',
  'Pre-Technical Studies',
  'Agriculture',
  'Social Studies',
  'CRE',
  'IRE',
  'HRE',
  'Creative Arts',
  'Creative Arts and Sports',
];

export function resultPercentage(result: any): number {
  const value = result?.percentage ?? (
    Number(result?.out_of) > 0
      ? Number(result?.marks || 0) / Number(result.out_of) * 100
      : 0
  );
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function hasRecordedMarks(result: any): boolean {
  return [
    result?.marks,
    result?.percentage,
    result?.converted_marks,
    result?.grade_844,
    result?.cbc_grade,
    result?.cbc_sublevel,
  ].some((value) => value !== null && value !== undefined && String(value).trim() !== '');
}

export function sortLearningAreas(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const indexA = LEARNING_AREA_ORDER.findIndex((item) => item.toLowerCase() === a.toLowerCase());
    const indexB = LEARNING_AREA_ORDER.findIndex((item) => item.toLowerCase() === b.toLowerCase());
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function learningAreaNames(rawResults: any[], additionalNames: string[] = []): string[] {
  const names = new Set<string>();
  [...rawResults, ...additionalNames.map((name) => ({ subjects: { name } }))].forEach((result) => {
    if (!hasRecordedMarks(result) && !result?.subjects?.name) return;
    const name = normalizeLearningAreaName(result?.subjects?.name || '');
    if (name && name !== 'Unknown') names.add(name);
  });
  return sortLearningAreas(Array.from(names));
}

export function requiredLearningAreaCount(classObj: any, rawResults: any[], additionalNames: string[] = []): number {
  const observedAreaCount = learningAreaNames(rawResults).length;
  const configuredAreaCount = getCanonicalLearningAreas(classObj).length || observedAreaCount || additionalNames.length;
  return getRequiredLearningAreas(classObj, configuredAreaCount) ?? configuredAreaCount;
}

export function buildAssessmentLearnerSummaries(rawResults: any[], classObj: any): AssessmentLearnerSummary[] {
  const band: SchoolLevelBand = getSchoolLevelBand(classObj);
  // Shared aggregation (also used by the student/parent portals and report
  // cards) so every surface ranks the same totals, then the shared rule orders
  // them: total marks first, then the level-specific tie-breaker.
  const summaries = aggregateLearnerTotals(rawResults, classObj).map((entry) => ({
    ...entry,
    // Kept for existing consumers that read totalPct.
    totalPct: entry.totalMarks,
  }));
  return rankByUnifiedRule(summaries, band) as AssessmentLearnerSummary[];
}
