export const PATHWAYS = ['STEM', 'Arts & Sports', 'Social Sciences'] as const;

export type PathwayName = (typeof PATHWAYS)[number];

/**
 * Canonical CBE pathway mapping. Matching is normalized below so both the
 * current names (for example, "Pre-Technical Studies") and legacy/short names
 * (for example, "Pre-Technical") resolve to the same pathway.
 */
const PATHWAY_SUBJECT_ALIASES: Record<PathwayName, string[]> = {
  STEM: [
    'mathematics',
    'integrated science',
    'science and technology',
    'pre-technical studies',
    'pre-technical',
    'agriculture and nutrition',
    'agriculture',
  ],
  'Arts & Sports': [
    'creative arts and sports',
    'creative arts',
    'physical and health education',
    'music',
    'art and craft',
  ],
  'Social Sciences': [
    'english',
    'kiswahili',
    'social studies',
    'religious education',
    'cre',
    'ire',
    'hre',
  ],
};

function normalizeSubjectName(subjectName: unknown): string {
  return String(subjectName || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getPathwayForSubject(subjectName: unknown): PathwayName | null {
  const normalized = normalizeSubjectName(subjectName);
  if (!normalized) return null;

  for (const pathway of PATHWAYS) {
    const alias = PATHWAY_SUBJECT_ALIASES[pathway].find((candidate) => {
      const normalizedCandidate = normalizeSubjectName(candidate);
      if (normalized.length <= 3 || normalizedCandidate.length <= 3) {
        return normalized === normalizedCandidate || normalized.split(' ').includes(normalizedCandidate);
      }
      return normalized === normalizedCandidate
        || normalized.includes(normalizedCandidate)
        || normalizedCandidate.includes(normalized);
    });
    if (alias) return pathway;
  }
  return null;
}

export interface PathwayPerformance {
  pathway: PathwayName;
  learningAreas: string[];
  score: number;
  outOf: number;
  percentage: number;
}

function resultSubjectName(result: any): string {
  return String(result?.subjects?.name || result?.subject?.name || result?.subject_name || result?.name || '').trim();
}

function resultMarkAndOutOf(result: any): { marks: number; outOf: number } | null {
  const rawMarks = Number(result?.marks);
  const rawOutOf = Number(result?.out_of);
  if (Number.isFinite(rawMarks) && Number.isFinite(rawOutOf) && rawOutOf > 0) {
    return { marks: rawMarks, outOf: rawOutOf };
  }

  const percentage = Number(result?.percentage);
  if (Number.isFinite(percentage)) {
    return { marks: percentage, outOf: 100 };
  }

  if (Number.isFinite(rawMarks)) {
    return { marks: rawMarks, outOf: 100 };
  }

  return null;
}

/**
 * Calculates each pathway from the learner's available marks, not from a
 * second percentage-only aggregation. The denominator is the sum of each
 * included result's actual out_of value.
 */
export function calculatePathwayPerformance(results: any[]): PathwayPerformance[] {
  const totals = new Map<PathwayName, { learningAreas: string[]; score: number; outOf: number }>(
    PATHWAYS.map((pathway) => [pathway, { learningAreas: [], score: 0, outOf: 0 }]),
  );

  for (const result of results || []) {
    const subjectName = resultSubjectName(result);
    const pathway = getPathwayForSubject(subjectName);
    const mark = resultMarkAndOutOf(result);
    if (!pathway || !mark) continue;

    const total = totals.get(pathway)!;
    total.learningAreas.push(subjectName);
    total.score += mark.marks;
    total.outOf += mark.outOf;
  }

  return PATHWAYS.map((pathway) => {
    const total = totals.get(pathway)!;
    return {
      pathway,
      learningAreas: total.learningAreas,
      score: total.score,
      outOf: total.outOf,
      percentage: total.outOf > 0 ? (total.score / total.outOf) * 100 : 0,
    };
  });
}

export function strongestPathway(performance: PathwayPerformance[]): PathwayPerformance | null {
  return [...performance]
    .filter((entry) => entry.outOf > 0)
    .sort((a, b) => b.percentage - a.percentage || b.outOf - a.outOf)[0] || null;
}

export function formatPathwayNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}
