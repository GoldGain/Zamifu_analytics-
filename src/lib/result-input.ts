/**
 * KJSEA / CBC result input: schools may enter raw marks (0-100) or CBC points (1-8).
 * One module owns the mapping and validation so every screen agrees.
 */

export type ResultInputType = 'marks' | 'points';

export interface CbcLevel {
  points: number;
  grade: string;
  descriptor: string;
}

/** KNEC CBC performance levels: 8 (highest) down to 1. */
export const CBC_LEVELS: CbcLevel[] = [
  { points: 8, grade: 'EE1', descriptor: 'Exceeding Expectation' },
  { points: 7, grade: 'EE2', descriptor: 'Exceeding Expectation' },
  { points: 6, grade: 'ME1', descriptor: 'Meeting Expectation' },
  { points: 5, grade: 'ME2', descriptor: 'Meeting Expectation' },
  { points: 4, grade: 'AE1', descriptor: 'Approaching Expectation' },
  { points: 3, grade: 'AE2', descriptor: 'Approaching Expectation' },
  { points: 2, grade: 'BE1', descriptor: 'Below Expectation' },
  { points: 1, grade: 'BE2', descriptor: 'Below Expectation' },
];

export function levelForPoints(points: number): CbcLevel | null {
  return CBC_LEVELS.find((level) => level.points === points) ?? null;
}

/** Mark bands used when a school enters marks but reports points. */
export function pointsForPercentage(percentage: number): number {
  const p = Math.max(0, Math.min(100, percentage));
  if (p >= 80) return 8;
  if (p >= 70) return 7;
  if (p >= 60) return 6;
  if (p >= 50) return 5;
  if (p >= 40) return 4;
  if (p >= 30) return 3;
  if (p >= 20) return 2;
  return 1;
}

export function pointsForMarks(marks: number, outOf = 100): number {
  const safeOutOf = outOf > 0 ? outOf : 100;
  return pointsForPercentage((Number(marks) / safeOutOf) * 100);
}

export interface EntryResult {
  ok: boolean;
  error?: string;
  points?: number;
  marks?: number;
  grade?: string;
  descriptor?: string;
}

/**
 * Validates one entry against the assessment's input type.
 * points mode  -> 1..8 only, marks are derived for ranking tie-breaks.
 * marks mode   -> 0..outOf only, points are derived for ranking.
 */
export function validateEntry(
  raw: string | number | null | undefined,
  inputType: ResultInputType,
  outOf = 100,
): EntryResult {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, error: 'No value entered.' };

  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: `${text} is not a number.` };

  if (inputType === 'points') {
    if (!Number.isInteger(value)) return { ok: false, error: 'Points must be a whole number from 1 to 8.' };
    if (value < 1 || value > 8) return { ok: false, error: `Points must be between 1 and 8 (got ${value}).` };
    const level = levelForPoints(value);
    return {
      ok: true,
      points: value,
      marks: Math.round((value / 8) * 100),
      grade: level?.grade,
      descriptor: level?.descriptor,
    };
  }

  const safeOutOf = outOf > 0 ? outOf : 100;
  if (value < 0) return { ok: false, error: 'Marks cannot be negative.' };
  if (value > safeOutOf) return { ok: false, error: `Marks cannot exceed ${safeOutOf} (got ${value}).` };
  const points = pointsForMarks(value, safeOutOf);
  const level = levelForPoints(points);
  return {
    ok: true,
    points,
    marks: value,
    grade: level?.grade,
    descriptor: level?.descriptor,
  };
}

/** Points-mode papers have no meaningful "total marks", so summaries hide it. */
export function showsMarksColumn(inputType: ResultInputType | null | undefined): boolean {
  return inputType !== 'points';
}

/** CSV template head for the chosen mode. */
export function uploadColumns(inputType: ResultInputType): string[] {
  return inputType === 'points'
    ? ['Admission Number', 'Learner Name', 'Points (1-8)']
    : ['Admission Number', 'Learner Name', 'Marks'];
}

export function rankingTotal(entry: {
  totalPoints?: number | null;
  totalMarks?: number | null;
}, inputType: ResultInputType): number {
  return inputType === 'points'
    ? Number(entry.totalPoints ?? 0)
    : Number(entry.totalMarks ?? 0);
}
