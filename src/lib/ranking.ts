/**
 * Unified ranking rules for ZAMIFU ANALYTICS.
 *
 * Every position/rank shown anywhere in the system (Student Portal, Parent
 * Portal, Class Summary, All-Streams Summary, Report Cards, Compare Exams,
 * Top-10 lists, teacher upload previews, stream dashboards) must come from
 * this module so the same learner always shows the same rank.
 *
 * RULE — PRIMARY SORT: TOTAL MARKS (descending).
 *
 * TIE-BREAKER (Junior/Senior School — Grades 7-12, points exist):
 *   1. Higher TOTAL POINTS wins.
 *   2. If total marks AND total points are identical, the learners share the
 *      same rank and the following rank is skipped (1, 1, 3).
 *
 * TIE-BREAKER (Primary/Pre-Primary — no CBE points):
 *   1. Learners with identical total marks share the same rank and the next
 *      rank is skipped (1, 1, 3).
 */

export type RankingBand = 'primary' | 'junior' | 'senior';

/** A rankable entry: total marks are the primary metric. */
export interface RankableEntry {
  totalMarks?: number | null;
  totalPoints?: number | null;
  totalPct?: number | null;
  avgPct?: number | null;
  [key: string]: unknown;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Total marks used for ranking: marks first, then summed percentages. */
export function rankingMarks(entry: RankableEntry): number {
  if (entry?.totalMarks !== null && entry?.totalMarks !== undefined) return num(entry.totalMarks);
  if (entry?.totalPct !== null && entry?.totalPct !== undefined) return num(entry.totalPct);
  return 0;
}

/** Total CBE points used only as a Junior/Senior tie-breaker. */
export function rankingPoints(entry: RankableEntry): number {
  return num(entry?.totalPoints);
}

/** Stable fallback used only when marks, points and averages are identical. */
function rankingTiebreakLabel(entry: any): string {
  const student = entry?.student || {};
  return String(
    entry?.studentId
    || student?.id
    || `${student?.first_name || entry?.first_name || ''} ${student?.last_name || entry?.last_name || ''}`.trim()
    || entry?.admission_number
    || '',
  );
}

/**
 * Comparator implementing the unified rule. Junior/Senior compare total points
 * before declaring a tie; Primary declares a tie on equal marks.
 */
export function compareByUnifiedRanking(
  a: RankableEntry,
  b: RankableEntry,
  band: RankingBand | string | null | undefined = 'junior',
): number {
  const marksDiff = rankingMarks(b) - rankingMarks(a);
  if (marksDiff !== 0) return marksDiff;
  if (band === 'junior' || band === 'senior') {
    const pointsDiff = rankingPoints(b) - rankingPoints(a);
    if (pointsDiff !== 0) return pointsDiff;
  }
  const avgDiff = num(b?.avgPct ?? b?.totalPct) - num(a?.avgPct ?? a?.totalPct);
  if (avgDiff !== 0) return avgDiff;
  return rankingTiebreakLabel(a).localeCompare(rankingTiebreakLabel(b));
}

/**
 * Competition ranking (1, 2, 2, 4). Two learners are "tied" only when the
 * metrics that the rule considers are identical — total marks for Primary,
 * total marks AND total points for Junior/Senior.
 */
export function assignCompetitionRanks<T extends RankableEntry>(
  entries: T[],
  band: RankingBand | string | null | undefined = 'junior',
): (T & { position: number; rank: number })[] {
  const isJunior = band === 'junior' || band === 'senior';
  let previous: T | null = null;
  let previousRank = 0;

  return entries.map((entry, index) => {
    let rank = index + 1;
    if (previous) {
      const sameMarks = rankingMarks(previous) === rankingMarks(entry);
      const samePoints = rankingPoints(previous) === rankingPoints(entry);
      if (sameMarks && (!isJunior || samePoints)) rank = previousRank;
    }
    previous = entry;
    previousRank = rank;
    return { ...entry, position: rank, rank };
  });
}

/**
 * Sort with the unified rule and apply competition ranks in one call. This is
 * the single entry point every ranking site should use.
 */
export function rankByUnifiedRule<T extends RankableEntry>(
  entries: T[],
  band: RankingBand | string | null | undefined = 'junior',
): (T & { position: number; rank: number })[] {
  const sorted = [...entries].sort((a, b) => compareByUnifiedRanking(a, b, band));
  return assignCompetitionRanks(sorted, band);
}

/** Map of studentId -> rank for a set of entries. */
export function rankMapByUnifiedRule<T extends RankableEntry & { studentId?: string | null }>(
  entries: T[],
  band: RankingBand | string | null | undefined = 'junior',
): Map<string, number> {
  const map = new Map<string, number>();
  rankByUnifiedRule(entries, band).forEach((entry) => {
    if (entry.studentId) map.set(entry.studentId, entry.position);
  });
  return map;
}

/** Ordinal label helper shared by every position display. */
export function ordinalRank(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
