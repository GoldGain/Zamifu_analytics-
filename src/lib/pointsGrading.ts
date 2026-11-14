/**
 * Points-only assessment support (school_exams.result_input_type = 'points').
 *
 * A points-only row stores the CBC performance point itself:
 *   cbc_points = 8, cbc_sublevel = 'EE1', cbc_grade = 'EE',
 * while marks, out_of, percentage and converted_marks are intentionally NULL.
 *
 * Every surface that grades or ranks a points-only row must read that point.
 * Treating such a row as a percentage makes 8 points read as 8% -> BE2.
 *
 * Marks-based rows are never touched here: they keep using
 * calculateGradeForClass() on their real percentage.
 */
import {
  calculateGradeForClass,
  getSchoolLevelBand,
  is844Curriculum,
  type CompetencyGrade,
  type DisplayGrade,
} from './grading';
import { CBC_LEVELS, levelForPoints } from './result-input';

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function subLevelPoints(value: unknown): number | null {
  const subLevel = String(value ?? '').trim().toUpperCase();
  if (!subLevel) return null;
  return CBC_LEVELS.find((level) => level.grade === subLevel)?.points ?? null;
}

/** True when a result row was recorded as a CBC point (1-8) instead of marks. */
export function isPointsOnlyResult(result: any): boolean {
  if (!result) return false;
  const explicit = String(
    result?.school_exams?.result_input_type
    ?? result?.exams?.result_input_type
    ?? result?.result_input_type
    ?? '',
  ).trim().toLowerCase();
  if (explicit === 'points') return true;
  if (explicit === 'marks') return false;

  const hasMarks =
    numeric(result?.percentage) !== null
    || numeric(result?.converted_marks) !== null
    || numeric(result?.marks) !== null;
  if (hasMarks) return false;

  const points = numeric(result?.cbc_points);
  if (points !== null && points >= 1 && points <= 8) return true;
  return subLevelPoints(result?.cbc_sublevel) !== null;
}

/** The recorded CBC point (1-8) for a row, or null when it is a marks row. */
export function pointsOfResult(result: any): number | null {
  const points = numeric(result?.cbc_points);
  if (points !== null && points >= 1 && points <= 8) return Math.round(points);
  return subLevelPoints(result?.cbc_sublevel);
}

/** Clamp any value onto the 1-8 CBC point scale. */
export function clampPoints(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(8, Math.round(parsed)));
}

/** Grade straight from a point: 8 = EE1 … 1 = BE2. No percentage is derived. */
export function gradeFromPoints(points: number, classData?: any): DisplayGrade {
  const band = getSchoolLevelBand(classData);
  if (is844Curriculum(classData) || band === 'primary') {
    return calculateGradeForClass(Number(points) || 0, classData);
  }
  const level = levelForPoints(clampPoints(points))!;
  return {
    subLevel: level.grade,
    grade: level.grade.replace(/[0-9]+$/, '') as CompetencyGrade['grade'],
    points: level.points,
    descriptor: level.descriptor,
    band,
  } as CompetencyGrade;
}

/** Display label for a point value (EE1 … BE2, or the 8-4-4/primary label). */
export function gradeLabelFromPoints(points: number, classData?: any): string {
  const grade = gradeFromPoints(points, classData);
  return 'subLevel' in grade ? grade.subLevel : grade.grade;
}

/** Grade for a learner's mean point (7.6 -> EE1, 7.4 -> EE2). */
export function gradeFromMeanPoints(mean: number, classData?: any): DisplayGrade {
  return gradeFromPoints(clampPoints(mean), classData);
}
