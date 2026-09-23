# Timetable CSP Rebuild Report

## Executive summary

The school-admin timetable generation path has been rebuilt around an exact constraint-satisfaction solver. The previous bounded fast path and embedded legacy perfect-grid helpers have been removed from the production generation page. Generation now either produces a complete timetable satisfying the configured hard rules or stops before persistence with named, actionable diagnostics.

## Implemented behavior

The solver constructs all lesson units for every class in a level and searches them as one constraint system. It models configured doubles as atomic consecutive units, maintains exact weekly subject counts, enforces available weekdays, prevents same-subject repeats on one day, prevents teacher/class collisions, and retains cross-level teacher reservations while the selected levels are processed. Candidate ordering is class-aware and repeated units use canonical predecessor ordering to avoid factorial duplicate branches.

The solver performs preflight checks before search. These checks cover missing classes or slots, invalid counts, exact level totals, effective cell capacity, subject and double windows, CAS double placement, available-day capacity, IRE/CRE pairing prerequisites, and same-class teacher-day capacity. When a configuration is impossible, the generation page displays the named class, subjects, required subject-days, and the exact reason no timetable can satisfy the hard rules. No partial grid is saved.

The independent validator now covers complete cells, exact counts, teacher collisions, same-subject daily duplication, legal consecutive doubles, one double per subject per week, strict subject windows, CAS double timing, Maths-to-Integrated-Science adjacency, IRE/CRE same-slot pairing, and filler/study entries.

## Live demo-data finding

The active demo-school rows were loaded read-only through the configured Supabase integration. The Junior assignments in the target schools contain mathematically impossible same-class teacher allocations. For example, the same teacher is assigned to Agriculture and Integrated Science, or Mathematics and Pre-Technical Studies, with combined required subject-days greater than the five available weekdays. Under the requested rule that a teacher cannot teach two subjects in the same slot, those assignments necessarily overlap on at least one weekday and cannot be scheduled. The application now reports this before search instead of waiting through a long search or saving a broken timetable.

This is a data/configuration blocker, not a solver timeout. The administrator must assign separate teachers or reduce/rebalance the affected weekly subject allocations before a complete grid can exist.

## Validation evidence

| Check | Result |
|---|---|
| Vite production build | Passed |
| Exact CSP solver fixture | Passed; 40 entries, exact cell coverage |
| CAS double fixture | Passed; double starts at Lesson 3 or later |
| Live-shaped impossible-data fixture | Passed; named teacher-day diagnostics returned before search |
| Independent hard-rule validator | Passed |
| Timetable slot invariants | Passed for all configured levels |
| Allocation fallback regression | Passed |
| Git whitespace check | Passed |

The repository-wide TypeScript project check still reports unrelated pre-existing errors in other dashboard pages. The Vite production build completes successfully and the changed timetable modules are included in the bundle.

## Source and review

The implementation is committed as `49277e3` on branch `rebuild-timetable-solver-20260923-223215`. GitHub PR [#9](https://github.com/GoldGain/Zamifu_analytics-/pull/9) contains the source changes and regression coverage.

## Deployment status

The branch is pushed and the PR is open. No Vercel project, deployment token, or repository deployment workflow is visible in the current session, so an actual production deployment could not be triggered from this environment. Once the repository is connected to its Vercel project or a deployment credential is enabled, the pushed branch can be deployed using the existing `vercel.json` configuration (`dist` output and SPA rewrite).
