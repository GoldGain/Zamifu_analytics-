export const SENIOR_PATHWAYS = [
  'STEM',
  'Social Sciences',
  'Arts and Sports Science',
] as const;

export type SeniorPathway = (typeof SENIOR_PATHWAYS)[number];

/**
 * These are the same official CBC pathways and tracks shown by Pathway Finder.
 * Keep enrollment forms and CSV imports on this one source of truth.
 */
export const SENIOR_PATHWAY_TRACKS: Record<SeniorPathway, readonly string[]> = {
  STEM: ['Pure Sciences', 'Applied Sciences', 'Technical Studies', 'Career & Technology Studies'],
  'Social Sciences': ['Humanities & Business Studies', 'Languages & Literature'],
  'Arts and Sports Science': ['Arts', 'Sports Science'],
};

export function normalizeSeniorPathway(value?: string | null): SeniorPathway | null {
  const candidate = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (candidate === 'stem') return 'STEM';
  if (candidate === 'social sciences' || candidate === 'social science') return 'Social Sciences';
  if (candidate === 'arts and sports science' || candidate === 'arts & sports science' || candidate === 'arts and sports') {
    return 'Arts and Sports Science';
  }
  return null;
}

export function tracksForSeniorPathway(pathway?: string | null): readonly string[] {
  const normalized = normalizeSeniorPathway(pathway);
  return normalized ? SENIOR_PATHWAY_TRACKS[normalized] : [];
}

export function isSeniorCbeClass(classData?: { curriculum?: string | null; grade_level?: number | string | null; level?: number | string | null; name?: string | null }): boolean {
  const curriculum = String(classData?.curriculum || '').trim().toUpperCase();
  if (curriculum === '844') return false;
  const name = String(classData?.name || '').toLowerCase();
  if (/\bform\s*[34]\b/.test(name) && !curriculum) return false;
  const rawLevel = classData?.grade_level ?? classData?.level;
  const level = typeof rawLevel === 'number' ? rawLevel : Number.parseInt(String(rawLevel ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(level) ? level >= 10 && level <= 12 : /\bgrade\s*1[0-2]\b|senior/.test(name);
}

export function isGradeTenClass(classData?: Parameters<typeof isSeniorCbeClass>[0]): boolean {
  if (!isSeniorCbeClass(classData)) return false;
  const rawLevel = classData?.grade_level ?? classData?.level;
  const level = typeof rawLevel === 'number' ? rawLevel : Number.parseInt(String(rawLevel ?? '').replace(/[^0-9-]/g, ''), 10);
  return level === 10 || /\bgrade\s*10\b/.test(String(classData?.name || ''));
}

export function displaySeniorLearningAreaName(name?: string | null): string {
  const trimmed = String(name || '').trim();
  if (/^mathematics\s*a$/i.test(trimmed)) return 'Core Mathematics';
  if (/^mathematics\s*b$/i.test(trimmed)) return 'Essential Mathematics';
  return trimmed;
}
