# Timetable solver rebuild — final state

## Goal (from the brief)
The generation flow must NEVER stop with "No valid timetable exists". Rule 14
(weekly lesson totals) is a WARNING, never a block: the admin must be able to
continue, and every other rule must still be enforced.

## What changed

### src/lib/timetable-csp-solver.ts (rewritten, 2545 lines)
- New engine: each class first picks a **week shape** (which weekdays each learning
  area appears on, which weekday carries its double) so every weekday is exactly
  full; then each **weekday is decided for the whole level at once**, with classes
  placed in shuffled order against the shared teacher map and full backtracking
  between classes. This is what lets a shared teacher's narrow window (Maths,
  lessons 1-4) be shared instead of being consumed by whichever class came first.
- `solveConstructive(attempts, limit, relaxedAttempts)` runs **strict attempts
  first**, so a complete grid is always preferred; relaxed attempts only run when a
  real shortfall exists.
- `allowIncompleteClasses` option: when the admin continues past the warning, a
  short class keeps the cells it has no lessons for EMPTY. It never drops a lesson
  (Rule 13 is never relaxed).
- `verify(allowBlanks)` only permits blanks for classes in `shortClassIndexes`.
- `needsConfirmation` + `shortClasses[]` in the result drive the UI prompt.
- Over-full classes (>week capacity) are a hard error `too-many-lessons` with the
  exact numbers and fix — no grid can contain them.
- Removed dead `clearClassWeek` and `repairCollisions`.

### src/lib/timetable-rule-audit.ts (new, 460 lines)
Independent 14-rule auditor used by the harness and tests. Added `allowBlankSlots`
and `skippedClasses` options.

### src/pages/dashboard/school-admin/TimetableGenerate.tsx
- `handleGenerateTimetable({ continuePastWarning })`.
- Before saving, if `needsConfirmation`, shows a panel listing each short class with
  its counts and offers **Continue and generate** / Cancel / Open Teacher Assignments.
- `assertTimetableRules({ requireComplete: !continuePastWarning })`.

### scripts/
- `timetable-live-harness.ts` — runs real school data through the solver.
- `sweep-all-schools.ts` — two-pass sweep (strict + relaxed) over every school.
- `test-timetable-continue-anyway.ts` — 20 assertions for the Rule 14 contract.
- `test-timetable-csp-solver.ts` — updated to the warn-and-continue contract.
- `teacher-feasibility.ts`, `audit-data.ts` — data-quality diagnostics.

## Final sweep result (all 76 schools)
- strict: 11/38 levels complete and valid
- relaxed: **28/38** levels produce a rule-valid timetable
- levels where even the relaxed run produced nothing: **0**
- 8 fully clean schools; 12 more valid after continuing past the warning
- Every remaining blocked case names the class, the numbers, and the fix.

## Tests
All 14 timetable test files pass; `vite build` succeeds; tsc shows no new errors
(the 62 pre-existing TimetableGenerate errors are unchanged from HEAD).
