export function normalizeLearningAreaName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Unknown';
  const upper = trimmed.toUpperCase().replace(/[.\s]/g, '');
  if (upper === 'CRE' || upper === 'IRE' || upper === 'HRE') return 'Religious Education';
  if (upper.includes('CHRISTIAN') && upper.includes('RELIGIOUS')) return 'Religious Education';
  if (upper.includes('ISLAMIC') && upper.includes('RELIGIOUS')) return 'Religious Education';
  if (upper.includes('HINDU') && upper.includes('RELIGIOUS')) return 'Religious Education';
  if (upper.includes('RELIGIOUS')) return 'Religious Education';
  return trimmed;
}
export function normalizeLearningAreas(names: string[]): string[] {
  const out: string[] = []; const seen = new Set<string>();
  names.forEach((n) => { const c = normalizeLearningAreaName(n); if (!seen.has(c)) { seen.add(c); out.push(c); } });
  return out;
}
