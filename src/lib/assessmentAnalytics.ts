import {
  calculateCompetencyGrade,
  getCanonicalLearningAreas,
  getRequiredLearningAreas,
  getSchoolLevelBand,
  type SchoolLevelBand,
} from '@/lib/grading';
import { normalizeLearningAreaName } from '@/lib/learningAreas';

export type AssessmentLearnerSummary = {
  studentId: string;
  classId: string;
  student: any;
  subjects: Record<string, number>;
  totalPct: number;
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
  const studentMap: Record<string, any> = {};
  rawResults.forEach((result: any) => {
    const studentId = result.student_id;
    if (!studentId) return;
    if (!studentMap[studentId]) {
      studentMap[studentId] = {
        studentId,
        classId: result.class_id,
        student: result.students,
        subjects: {},
        totalPct: 0,
        count: 0,
        totalPoints: 0,
        gender: result.students?.gender || null,
        examName: result.school_exams?.name || result.exams?.name || '',
      };
    }
    const percentage = resultPercentage(result);
    const areaKey = normalizeLearningAreaName(result.subjects?.name || 'Unknown');
    const isNewArea = studentMap[studentId].subjects[areaKey] === undefined;
    studentMap[studentId].subjects[areaKey] = percentage;
    if (isNewArea) {
      studentMap[studentId].totalPct += percentage;
      studentMap[studentId].count += 1;
    }
    if (result.school_exams?.name || result.exams?.name) {
      studentMap[studentId].examName = result.school_exams?.name || result.exams?.name;
    }
  });

  const band: SchoolLevelBand = getSchoolLevelBand(classObj);
  Object.values(studentMap).forEach((summary: any) => {
    summary.totalPoints = Object.values(summary.subjects).reduce(
      (sum: number, percentage: any) => sum + (calculateCompetencyGrade(Number(percentage), band).points || 0),
      0,
    );
  });

  const observedAreaCount = learningAreaNames(rawResults).length;
  const canonicalAreaCount = getCanonicalLearningAreas(classObj).length;
  const configuredAreaCount = canonicalAreaCount || observedAreaCount;
  const requiredAreas = getRequiredLearningAreas(classObj, configuredAreaCount);

  return Object.values(studentMap)
    .map((summary: any) => ({
      ...summary,
      avgPct: requiredAreas
        ? summary.totalPct / requiredAreas
        : summary.count > 0 ? summary.totalPct / summary.count : 0,
      gender: summary.gender || summary.student?.gender || null,
    }))
    .sort((a: any, b: any) => (b.totalPoints - a.totalPoints) || (b.totalPct - a.totalPct))
    .map((summary: any, index) => ({ ...summary, position: index + 1 }));
}
