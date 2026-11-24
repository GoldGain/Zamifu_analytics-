/**
 * PostgREST answers a single request with at most the project's max-rows limit
 * (1000 rows by default), and it does so silently: no error, no hint that the
 * rest of the table was left behind. A school timetable passes that limit as
 * soon as it has more than roughly twenty classes, and the rows that fell off
 * the end were rendered as empty cells — the grid looked full of holes even
 * though the generator had saved every period.
 *
 * This helper walks the table in pages so callers always receive the whole set.
 * `build` must apply a stable order (an `id` or `slot_order` column) or the
 * pages can overlap and skip rows.
 */
export type SupabasePageResult<T> = { data: T[] | null; error: unknown };

export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  const size = Math.max(1, pageSize);
  for (let from = 0; from < 2_000_000; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}
