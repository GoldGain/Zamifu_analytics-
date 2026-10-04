/**
 * Shared per-learner aggregation for ranking.
 *
 * WHY THIS EXISTS
 * ---------------
 * Ranking is only consistent if every page agrees on the TOTALS it ranks.
 * Two different aggregations were in use:
 *
 *   A. Class Summary / All-Streams / Compare Exams (assessmentAnalytics)
 *      — deduplicate by learning area: when a term holds several assessments
 *        (e.g. EXAM1, EXAM2 and the EXAM1+EXAM2 combined rows) only the first
 *        row per learning area contributes, so a learner's total is the sum of
 *        their learning-area scores.
 *
 *   B. Student Portal / Report Cards
 *      — summed EVERY result row, so the combined rows plus both single exams
 *        were added together and the learner's total was inflated. That is why
 *        the same learner could show position 39 in one place and 48 in another.
 *
 * This module implements aggregation A once, and every ranking surface — the
 * class summary, the all-streams summary, compare exams, the student portal,
 * the student report card, the parent report card, the class-teacher dashboard
 * and the stream dashboard — builds its totals from it. Ranking then applies
 * the shared rule in `ranking.ts`.
 */

import {
  calculateCompetencyGrade,
  gradePointsForClass,
  getCanonicalLearningAreas,
  getRequiredLearningAreas,
  getSchoolLevelBand,
  is844Curriculum,
  type SchoolLevelBand,
} from '@/lib/grading';
import { normalizeLearningAreaName } from '@/lib/learningAreas';

/** One learner's aggregated totals for a class, term and assessment filter. */
export interface LearnerTotals {
  studentId: string;
  classId: string;
  student: any;
  /** Learning area name -> percentage, first recorded row per area wins. */
  subjects: Record<string, number>;
  /** Sum of the learning-area percentages. Primary ranking metric. */
  totalMarks: number;
  /** Sum of active grading-scale points across counted learning areas. Tie-breaker. */
  totalPoints: number;
  /** Number of learning areas counted. */
  count: number;
  /** totalMarks / required learning areas. */
  avgPct: number;
  gender: string | null;
  examName: string;
}

/** Percentage of a single result row, tolerant of a missing `percentage`. */
export function rowPercentage(result: any): number {
  const explicit = result?.percentage;
  if (explicit !== null && explicit !== undefined && String(explicit).trim() !== '') {
    const value = Number(explicit);
    if (Number.isFinite(value)) return value;
  }
  const outOf = Number(result?.out_of);
  if (Number.isFinite(outOf) && outOf > 0) {
    return (Number(result?.marks || 0) / outOf) * 100;
  }
  const marks = Number(result?.marks);
  return Number.isFinite(marks) ? marks : 0;
}

/** Points for one learning-area percentage, using the class's active scale. */
function rowPoints(result: any, percentage: number, band: SchoolLevelBand, classObj: any): number {
  if (band === 'primary') return 0;
  // Historical 8-4-4 rows may contain the old 8-point CBE value in cbc_points;
  // recalculate them from the class so Forms 3/4 consistently use 12..1.
  if (is844Curriculum(classObj)) {
    return gradePointsForClass(percentage, classObj);
  }
  const stored = Number(result?.cbc_points);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return calculateCompetencyGrade(percentage, band).points || 0;
}

/**
 * Aggregate raw result rows into one entry per learner.
 *
 * Rows are deduplicated per learning area so a term that stores single exams
 * AND a combined exam does not double-count a learner's marks.
 */
export function aggregateLearnerTotals(rawResults: any[], classObj: any): LearnerTotals[] {
  const band: SchoolLevelBand = getSchoolLevelBand(classObj);
  const studentMap: Record<string, LearnerTotals> = {};
  // The raw row currently winning each learning area, so the choice can be
  // decided by recency rather than by whatever order PostgREST returned.
  const winner: Record<string, Record<string, { createdAt: number; index: number; row: any }>> = {};

  (rawResults || []).forEach((result: any, index: number) => {
    const studentId = result?.student_id;
    if (!studentId) return;
    if (!studentMap[studentId]) {
      studentMap[studentId] = {
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
      };
      winner[studentId] = {};
    }
    const entry = studentMap[studentId];
    const percentage = rowPercentage(result);
    const areaKey = normalizeLearningAreaName(result.subjects?.name || 'Unknown');
    const createdAt = Date.parse(String(result.created_at || '')) || 0;
    if (result.school_exams?.name || result.exams?.name) {
      entry.examName = result.school_exams?.name || result.exams?.name;
    }
    // A term can hold several rows for the same learning area (Exam 1, Exam 2
    // and their combined row). Counting more than one would inflate the
    // learner's total, and picking "the first row the API happened to return"
    // makes the total depend on request ordering — which is how the same
    // learner ended up with different positions on different pages. The most
    // recently recorded row wins deterministically, so every page derives the
    // same total. The newest row per learning area is the school's latest word
    // on that learning area (a later exam, or the combined result).
    const previous = winner[studentId][areaKey];
    if (previous && (previous.createdAt > createdAt
      || (previous.createdAt === createdAt && previous.index <= index))) {
      return;
    }
    if (previous) {
      // Replace the row that previously won this learning area.
      entry.totalMarks -= entry.subjects[areaKey];
      entry.totalPoints -= rowPoints(previous.row, entry.subjects[areaKey], band, classObj);
    } else {
      entry.count += 1;
    }
    winner[studentId][areaKey] = { createdAt, index, row: result };
    entry.subjects[areaKey] = percentage;
    entry.totalMarks += percentage;
    entry.totalPoints += rowPoints(result, percentage, band, classObj);
  });

  const observedAreaCount = new Set(
    (rawResults || []).map((result: any) => normalizeLearningAreaName(result.subjects?.name || 'Unknown')),
  ).size;
  const configuredAreaCount = getCanonicalLearningAreas(classObj).length || observedAreaCount;
  const requiredAreas = getRequiredLearningAreas(classObj, configuredAreaCount);

  return Object.values(studentMap).map((entry) => ({
    ...entry,
    avgPct: requiredAreas
      ? entry.totalMarks / requiredAreas
      : entry.count > 0 ? entry.totalMarks / entry.count : 0,
    gender: entry.gender || entry.student?.gender || null,
  }));
}
