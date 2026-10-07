/**
 * Unified ranking rules for ZAMIFU ANALYTICS.
 *
 * Every position/rank shown anywhere in the system (Student Portal, Parent
 * Portal, Class Summary, All-Streams Summary, Report Cards, Compare Exams,
 * Top-10 lists, teacher upload previews, stream dashboards) must come from
 * this module so the same learner always shows the same rank.
 *
 * RULE — Junior/Senior: TOTAL POINTS first, TOTAL MARKS as tie-break.
 *
 * EXACT TIE (Junior/Senior): same total points AND total marks share the same
 *   rank, and the following rank is skipped (1, 1, 3).
 *
 * TIE-BREAKER (Primary/Pre-Primary — no CBE points):
 *   1. Learners with identical total marks share the same rank and the next
 *      rank is skipped (1, 1, 3).
 */

export type RankingBand = 'primary' | 'junior' | 'senior';

/** A rankable entry. Form 3/4 may provide KNEC seven-subject metrics. */
export interface RankableEntry {
  totalMarks?: number | null;
  totalPoints?: number | null;
  rankingTotalMarks?: number | null;
  rankingTotalPoints?: number | null;
  totalPct?: number | null;
  avgPct?: number | null;
  markCode?: string | null;
  [key: string]: unknown;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Total marks used for ranking; Form 3/4 may rank on its selected seven. */
export function rankingMarks(entry: RankableEntry): number {
  if (entry?.rankingTotalMarks !== null && entry?.rankingTotalMarks !== undefined) return num(entry.rankingTotalMarks);
  if (entry?.totalMarks !== null && entry?.totalMarks !== undefined) return num(entry.totalMarks);
  if (entry?.totalPct !== null && entry?.totalPct !== undefined) return num(entry.totalPct);
  return 0;
}

/** Total points used as the primary Junior/Senior ranking metric. */
export function rankingPoints(entry: RankableEntry): number {
  if (entry?.rankingTotalPoints !== null && entry?.rankingTotalPoints !== undefined) return num(entry.rankingTotalPoints);
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
 * Comparator implementing the unified rule. Junior/Senior compare points,
 * then marks; Primary compares marks only.
 */
export function compareByUnifiedRanking(
  a: RankableEntry,
  b: RankableEntry,
  band: RankingBand | string | null | undefined = 'junior',
): number {
  const aExceptional = ['X', 'Y'].includes(String(a?.markCode || '').toUpperCase());
  const bExceptional = ['X', 'Y'].includes(String(b?.markCode || '').toUpperCase());
  if (aExceptional !== bExceptional) return aExceptional ? 1 : -1;
  if (band === 'junior' || band === 'senior') {
    const pointsDiff = rankingPoints(b) - rankingPoints(a);
    if (pointsDiff !== 0) return pointsDiff;
  }
  const marksDiff = rankingMarks(b) - rankingMarks(a);
  if (marksDiff !== 0) return marksDiff;
  const avgDiff = num(b?.avgPct ?? b?.totalPct) - num(a?.avgPct ?? a?.totalPct);
  if (avgDiff !== 0) return avgDiff;
  // Final tie-break is by student id / name so the ORDER is deterministic even
  // though the ranks are equal. Without this the sort depends on the order the
  // rows arrived in, which is not stable across requests.
  return rankingTiebreakLabel(a).localeCompare(rankingTiebreakLabel(b))
    || rankingTiebreakLabel(a).length - rankingTiebreakLabel(b).length;
}

/**
 * Competition ranking (1, 2, 2, 4). Two learners are "tied" only when the
 * metrics that the rule considers are identical — total marks for Primary,
 * total points AND total marks for Junior/Senior.
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
      const samePoints = rankingPoints(previous) === rankingPoints(entry);
      const sameMarks = rankingMarks(previous) === rankingMarks(entry);
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
