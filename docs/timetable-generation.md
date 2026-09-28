# Timetable generation architecture

## Authoritative path

`src/lib/timetable-csp-solver.ts` is the only timetable lesson generator. The
school-admin Generate page builds the saved level clock, resolves activities,
then calls `solveTimetableCsp` once per selected level. It validates the returned
entries before replacing that level's `timetable_entries` rows.

- **Data warnings** (for example, a configured weekly total that differs from
the level clock) are surfaced as an explicit confirmation flow. The admin may
continue, and the warning is recorded in the UI report.
- **Solver errors** (constraint conflicts, impossible subject windows, failed
search, or an empty result) throw before any timetable rows are deleted or
inserted.

## Removed legacy paths

The old Supabase Edge Functions `generate-timetable`, `generate-timetable-v2`,
and `generate-timetable-v3` were confirmed absent from the deployed Supabase
function list and had no frontend or script callers. They implemented separate
greedy algorithms and are intentionally removed from source so they cannot be
redeployed accidentally. The unused `timetable-fast-solver.ts` was removed for
the same reason.

The old `timetable_generated` table remains as a historical/deprecated schema
from earlier migrations. No current application code reads or writes it; new
generation uses `timetable_entries` only.
