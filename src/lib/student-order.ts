export interface AdmissionNumberRecord {
  admission_number?: string | number | null;
}

/**
 * Sort learner records by admission number using numeric-aware comparison.
 * Empty admission numbers are placed after populated values.
 */
export function sortByAdmissionNumber<T extends AdmissionNumberRecord>(rows: T[]): T[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    const left = String(a.admission_number ?? '').trim();
    const right = String(b.admission_number ?? '').trim();
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return collator.compare(left, right);
  });
}
