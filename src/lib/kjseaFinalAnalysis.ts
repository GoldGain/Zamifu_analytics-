import { calculateCompetencyGrade } from '@/lib/grading';
import { normalizeLearningAreaName } from '@/lib/learningAreas';
import { resultPercentage, sortLearningAreas } from '@/lib/assessmentAnalytics';
import { excludedResultCode, isExcludedResult } from '@/lib/learnerTotals';

type KjseaStudent = {
  id?: string; admission_number?: string | null;
  first_name?: string | null; last_name?: string | null;
};

type KjseaResultRow = {
  student_id?: string | null; class_id?: string | null;
  students?: KjseaStudent | null; subjects?: { name?: string | null } | null;
  cbc_points?: number | string | null; cbc_sublevel?: string | null; cbc_grade?: string | null;
  marks?: number | string | null; percentage?: number | string | null; out_of?: number | string | null;
  mark_code?: string | null; grade_844?: string | null;
};

export type KjseaFinalSummary = {
  studentId: string;
  classId: string;
  student: KjseaStudent;
  subjects: Record<string, number>;
  subjectGrades: Record<string, string>;
  totalPoints: number;
  meanPoints: number;
  count: number;
  position: number;
};

export function kjseaPointsForResult(result: KjseaResultRow): { points: number; grade: string } | null {
  if (isExcludedResult(result)) return null;
  const recorded = Number(result?.cbc_points);
  if (Number.isInteger(recorded) && recorded >= 1 && recorded <= 8) {
    return { points: recorded, grade: String(result?.cbc_sublevel || result?.cbc_grade || '').trim() || `Points ${recorded}` };
  }
  const percentage = resultPercentage(result);
  if (!Number.isFinite(percentage)) return null;
  const grade = calculateCompetencyGrade(percentage, 'junior');
  return { points: grade.points, grade: grade.subLevel };
}

/** Dedicated Grade 9 KJSEA final-results aggregation. No marks or percentages
 * enter the returned display model, and ordinary grading modes are untouched. */
export function buildKjseaFinalSummaries(rawResults: KjseaResultRow[]): KjseaFinalSummary[] {
  const learners = new Map<string, KjseaFinalSummary & { seen: Set<string> }>();
  for (const row of rawResults || []) {
    if (!row?.student_id || isExcludedResult(row)) continue;
    const scored = kjseaPointsForResult(row);
    const subject = normalizeLearningAreaName(row?.subjects?.name || '');
    if (!scored || !subject || subject === 'Unknown') continue;
    const student = row.students || {};
    const key = String(row.student_id);
    const entry = learners.get(key) || {
      studentId: key, classId: String(row.class_id || ''), student,
      subjects: {}, subjectGrades: {}, totalPoints: 0, meanPoints: 0,
      count: 0, position: 0, seen: new Set<string>(),
    };
    // One final value per learning area. Results are loaded in created/id order;
    // a later correction replaces rather than double-counts the earlier row.
    entry.subjects[subject] = scored.points;
    entry.subjectGrades[subject] = scored.grade;
    entry.student = student;
    entry.classId = String(row.class_id || entry.classId);
    entry.seen.add(subject);
    learners.set(key, entry);
  }
  const summaries = Array.from(learners.values()).map((entry) => {
    const values = Object.values(entry.subjects);
    return {
      studentId: entry.studentId, classId: entry.classId, student: entry.student,
      subjects: entry.subjects, subjectGrades: entry.subjectGrades,
      totalPoints: values.reduce((sum, value) => sum + value, 0),
      meanPoints: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      count: values.length, position: 0,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints || b.meanPoints - a.meanPoints
    || `${a.student?.first_name || ''} ${a.student?.last_name || ''}`.localeCompare(`${b.student?.first_name || ''} ${b.student?.last_name || ''}`));
  return summaries.map((entry) => ({ ...entry, position: 1 + summaries.filter((other) => other.totalPoints > entry.totalPoints).length }));
}

export function kjseaLearningAreas(summaries: KjseaFinalSummary[]): string[] {
  return sortLearningAreas(Array.from(new Set(summaries.flatMap((summary) => Object.keys(summary.subjects)))));
}

export function kjseaResultDisplay(result: KjseaResultRow): { points: string; grade: string } {
  if (isExcludedResult(result)) return { points: '—', grade: excludedResultCode(result) || 'Excluded' };
  const scored = kjseaPointsForResult(result);
  return scored ? { points: String(scored.points), grade: scored.grade } : { points: '—', grade: '—' };
}
