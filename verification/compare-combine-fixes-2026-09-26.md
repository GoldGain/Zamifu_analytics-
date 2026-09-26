# Compare/Combine Exams fixes — 2026-09-26

## Release

- Repository: `GoldGain/Zamifu_analytics-`
- Branch: `fix/compare-combine-all-seven-2026-09-26`
- Commits: `571c630` — `Fix Compare/Combine Exams reports and means`; `29da26e` — `Tighten Combine Exams database typing`
- Production deployment: `https://zamifu.company`
- Final Vercel deployment: `zamifu-89c7nn420-goldgain-3350s-projects.vercel.app`
- Production alias was explicitly repointed to the final local prebuilt deployment.

## Implemented

1. **Shared Class Summary formula**
   - Added `src/lib/assessmentAnalytics.ts`.
   - Class Summary and Compare Exams now use the same learner summary builder.
   - Totals are sums of learner learning-area percentages; overall means are means of learner totals; Junior School denominator remains the canonical nine areas even when the visible catalog contains the optional CRE/IRE pair.
2. **Compare Exams sections**
   - Sections 3, 4, 7, and 8 now use the shared learner/subject/stream mean path.
   - Section 5 is seeded from configured class subjects plus both exams, so all ten Grade 9 areas render even when one side has no row.
   - Section 6 includes Exam 1/Exam 2 totals, total CBE points, grades, mark deviation, and point deviation with signed color rules.
   - Section 7 includes mean grade per stream and each stream mean is calculated from the same learner totals as Class Summary.
   - Section 10 uses the same union of learning areas and grade-band filtering.
3. **Combine Exams**
   - Removed the Preview action and preview-only UI.
   - Save builds the union of learner + learning-area rows across all selected source exams using weighted percentages, so a learner/area present in either source is retained.
   - Save navigates directly to the Results / Download Results route.
4. **Class Summary — All Streams deviation**
   - Resolves the previous non-combined assessment in the same term and class/grade scope.
   - Populates learner deviation as current total minus previous total.
   - Labels the table header with the exact previous assessment name and leaves `—` when no previous assessment exists.

## Validation

- `npm run build`: passed locally.
- Targeted deterministic checks: passed (`test-table-render.ts`, `test-report-card-layout.ts`, `test-mark-reconciliation.ts`).
- Synthetic shared-summary regression: passed — two learners, nine areas, total mean `441`, denominator `900`, learner averages `54` and `44`.
- Vercel build: Ready; the Vercel build completed despite existing unrelated TypeScript diagnostics in `api/generate-exam.ts` and `api/run-trial-expiry-notifications.ts`.
- Live HTTP checks: `https://zamifu.company` and `/auth/login` returned HTTP 200.
- Live production bundle markers confirmed:
  - `Available source exams` present.
  - `Combine assessments once` present.
  - `Save combined exam` present.
  - `Deviation (vs ` present.
  - `Preview combined` absent.

## Live test-account limitation

The supplied `mgandi912@gmail.com` credential was entered on the production login form, but the live site returned **“Invalid email or password.”** Because authentication could not be completed, the authenticated Grade 9 PDF generation and UI cross-check could not be honestly marked complete. No password reset or account mutation was performed.

The live Supabase data inspection still confirmed the target tenant and reference values:

- School: `KENYA NAVY JUNIOR SCHOOL`
- Grade 9 streams: A, B, C
- Grade 9 source exams: `GRADE 9 EXAM 1`, `GRADE 9 EXAM 2`
- Visible learning areas: Agriculture, C.R.E, Creative Arts, English, I.R.E, Integrated Science, Kiswahili, Mathematics, Pre-Technical Studies, Social Studies
- Exam 1 learner-total means from the Class Summary formula: Stream A `485.3585`, Stream B `456.4038`, Stream C `502.2364`, all-stream mean `481.7500` marks out of `900`.

## Merge status

The fix branch is pushed to GitHub. `main` was not merged because the required authenticated live-account verification could not be completed with the supplied credential.
