export interface MeanResultRow {
  percentage?: number | string | null;
  markCode?: string | null;
  mark_code?: string | null;
  marks?: number | string | null;
}

/** Rows with X/Y are status codes, not zero scores, and must not enter a mean. */
export function getNumericMeanRows<T extends MeanResultRow>(rows: readonly T[]): T[] {
  return rows.filter((row) => {
    const codes = [row.markCode, row.mark_code, row.marks]
      .map((value) => String(value ?? '').trim().toUpperCase());
    if (codes.includes('X') || codes.includes('Y')) return false;

    const percentage = row.percentage;
    if (percentage === null || percentage === undefined || String(percentage).trim() === '') return false;
    return Number.isFinite(Number(percentage));
  });
}

/** Mean percentage rounded to 2 decimals; null means no numeric results exist. */
export function calculateNumericMeanPercentage(rows: readonly MeanResultRow[]): number | null {
  const numericRows = getNumericMeanRows(rows);
  if (numericRows.length === 0) return null;

  const total = numericRows.reduce((sum, row) => sum + Number(row.percentage), 0);
  return Math.round((total / numericRows.length) * 100) / 100;
}
