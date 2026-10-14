const STUDENTS_RELATION_PATTERN = /\bstudents(?:!(?:inner|left|full))?\s*\(/i;

/**
 * Ensure a PostgREST projection embeds `students` before code applies a
 * foreign-table filter to that relationship. Narrow result projections often
 * omit the relation, which causes PostgREST to reject `foreignTable: 'students'`.
 */
export function ensureActiveStudentEmbed(select: string): string {
  const projection = select.trim();
  if (!projection) {
    throw new Error('A PostgREST select projection is required.');
  }

  if (!STUDENTS_RELATION_PATTERN.test(projection)) {
    return `${projection}, students!inner(is_active)`;
  }

  return projection
    .replace(/\bstudents!(?:left|full)\s*\(/gi, 'students!inner(')
    .replace(/\bstudents\s*\(/gi, 'students!inner(is_active, ');
}
