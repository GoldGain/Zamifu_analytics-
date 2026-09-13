export function normalizeLearningAreaName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Unknown';
  const upper = trimmed.toUpperCase().replace(/[.\s]/g, '');
  // Religious education is taught as a single optional learning area, but schools
  // name it differently (CRE, IRE, HRE or the long-form variants). Keep the
  // specific religious label so CRE and IRE are displayed distinctly instead of
  // being collapsed into a generic "Religious Education" that hid them.
  if (upper === 'CRE' || upper.includes('CHRISTIAN')) return 'CRE';
  if (upper === 'IRE' || upper.includes('ISLAMIC')) return 'IRE';
  if (upper === 'HRE' || upper.includes('HINDU')) return 'HRE';
  if (upper.includes('RELIGIOUS')) return 'Religious Education';
  return trimmed;
}

export function isReligiousLearningArea(name: string): boolean {
  const u = (name || '').toUpperCase().replace(/[.\s]/g, '');
  return u === 'CRE' || u === 'IRE' || u === 'HRE' || u.includes('CHRISTIAN') || u.includes('ISLAMIC') || u.includes('HINDU') || u.includes('RELIGIOUS');
}
export function normalizeLearningAreas(names: string[]): string[] {
  const out: string[] = []; const seen = new Set<string>();
  names.forEach((n) => { const c = normalizeLearningAreaName(n); if (!seen.has(c)) { seen.add(c); out.push(c); } });
  return out;
}
