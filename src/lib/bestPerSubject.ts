/**
 * bestPerSubject.ts
 * Helper to compute the best-performing learner per learning area from raw results.
 * Used across Teacher Dashboard, School Admin Results, Learner Report Card,
 * and Parent Child Report Card.
 */

import { calculateGradeForClass, getSchoolLevelBand, gradePointsForClass } from './grading';
import type { SchoolLevelBand } from './grading';

export interface BestInSubject {
  subjectName: string;
  studentId: string;
  studentName: string;
  percentage: number;
  gradeLabel: string;   // e.g. "EE1", "ME"
  points: number | null; // null for Primary
}

/**
 * Given an array of raw result rows (each with students, subjects, percentage/marks/out_of),
 * and optional classData for band detection, returns the best learner per learning area.
 *
 * @param rawResults  Array of result records from Supabase
 * @param classData   Optional class object with curriculum/grade_level/level/name
 */
export function computeBestPerSubject(
  rawResults: any[],
  classData?: { curriculum?: string | null; grade_level?: number | string | null; level?: number | string | null; name?: string | null }
): BestInSubject[] {
  const band: SchoolLevelBand = getSchoolLevelBand(classData);
  const isPrimary = band === 'primary';

  // Group results by subject
  const bySubject: Record<string, any[]> = {};
  for (const r of rawResults) {
    const subName: string = r.subjects?.name || r.subject_name || 'Unknown';
    if (!bySubject[subName]) bySubject[subName] = [];
    bySubject[subName].push(r);
  }

  const best: BestInSubject[] = [];

  for (const [subjectName, rows] of Object.entries(bySubject)) {
    let topRow: any = null;
    let topPct = -1;

    for (const r of rows) {
      const pct: number =
        r.percentage !== undefined && r.percentage !== null
          ? Number(r.percentage)
          : r.out_of > 0
          ? (Number(r.marks || 0) / Number(r.out_of)) * 100
          : 0;

      if (pct > topPct) {
        topPct = pct;
        topRow = r;
      }
    }

    if (!topRow) continue;

    const studentName =
      topRow.students
        ? `${topRow.students.first_name || ''} ${topRow.students.last_name || ''}`.trim()
        : topRow.student_name || 'Unknown';

    const g = calculateGradeForClass(topPct, classData);
    const gradeLabel = 'subLevel' in g ? g.subLevel : g.grade;
    const points = isPrimary ? null : gradePointsForClass(topPct, classData);

    best.push({
      subjectName,
      studentId: topRow.students?.id || topRow.student_id || '',
      studentName,
      percentage: Math.round(topPct),
      gradeLabel,
      points,
    });
  }

  // Sort alphabetically by subject name for consistent display
  best.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  return best;
}

/**
 * Returns the learning areas in which a specific learner is the best performer.
 *
 * @param studentId   The learner's ID to check
 * @param bestList    Output of computeBestPerSubject()
 */
export function getStudentBestSubjects(studentId: string, bestList: BestInSubject[]): BestInSubject[] {
  return bestList.filter(b => b.studentId === studentId);
}
