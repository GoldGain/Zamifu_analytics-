/**
 * Paginated Supabase reads.
 *
 * WHY THIS EXISTS
 * ---------------
 * PostgREST is configured with `max_rows = 1000` on this project. A plain
 * `.select()` therefore returns AT MOST 1000 rows and silently drops the rest —
 * no error, no warning. A single Grade 9 term at a mid-sized school already
 * exceeds that (3 streams x 10 learning areas x 3 assessments x ~50 learners),
 * so every ranking that read results in one shot was computed from a truncated
 * slice of the class. That is one of the reasons the same learner could show a
 * different position on different pages.
 *
 * Any read that can exceed 1000 rows MUST page through with `.range()`.
 *
 * USAGE
 * -----
 *   const rows = await fetchAllRows((from, to) =>
 *     supabaseUntyped
 *       .from('results')
 *       .select('student_id, marks, out_of, cbc_points')
 *       .eq('class_id', classId)
 *       .range(from, to),
 *   );
 *
 * The builder is called repeatedly with successive windows; every call must
 * return the same ordering-independent result set (add `.order(...)` when the
 * caller needs a stable order, since PostgREST paging without an order is not
 * guaranteed to be stable across requests).
 */

/** Rows fetched per request. Matches the project's PostgREST `max_rows`. */
export const DEFAULT_PAGE_SIZE = 1000;

/** Safety valve so a runaway loop cannot exhaust memory or the request budget. */
export const DEFAULT_MAX_ROWS = 100000;

type PageResult<T> = { data: T[] | null; error: { message?: string } | null };

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
  maxRows: number = DEFAULT_MAX_ROWS,
): Promise<T[]> {
  const size = Math.max(1, Math.floor(pageSize));
  const cap = Math.max(size, Math.floor(maxRows));
  const rows: T[] = [];
  for (let from = 0; from < cap; from += size) {
    const to = Math.min(from + size - 1, cap - 1);
    const { data, error } = await build(from, to);
    if (error) throw new Error(error.message || 'Paginated query failed');
    const page = (data || []) as T[];
    rows.push(...page);
    // A short page means the server has no more rows to give.
    if (page.length < size) break;
  }
  return rows;
}

/**
 * Same as {@link fetchAllRows} but never throws: returns the rows collected so
 * far and the error message, for call sites that prefer to degrade gracefully
 * (they usually show a toast instead of blanking the page).
 */
export async function fetchAllRowsSafe<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
  maxRows: number = DEFAULT_MAX_ROWS,
): Promise<{ rows: T[]; error: string | null }> {
  try {
    return { rows: await fetchAllRows(build, pageSize, maxRows), error: null };
  } catch (err: any) {
    return { rows: [], error: err?.message || 'Paginated query failed' };
  }
}
