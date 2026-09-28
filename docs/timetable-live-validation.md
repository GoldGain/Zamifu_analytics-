# Live timetable validation evidence

- Schools tested: **14** (non-mutating harness; no timetable rows written)
- Priority school `kipkiruiphalec84@gmail.com`: **Kipsolu Junior School**
- Harness path: `scripts/timetable-live-harness.ts` → `solveTimetableCsp` → rule audit

| School | Strict run | Continue-data-warnings run | Findings |
|---|---:|---:|---|
| Kapsamoch comprehensive school | BLOCKED | BLOCKED | Grade 4 lessons total 34 but this level expects 30 (4 more), so its week cannot be filled exactly.; Grade 5 lessons total 34 but this level expects 30 (4 more), so its week cannot be filled exactly.; Grade 7 lessons total 41 but this level expects 40 (1 more), so its week cannot be filled exactly. |
| Chepseon zionist and Junior School | BLOCKED | BLOCKED | Grade 4 lessons total 34 but this level expects 30 (4 more), so its week cannot be filled exactly.; Grade 5 lessons total 34 but this level expects 30 (4 more), so its week cannot be filled exactly. |
| Theophillus Academy | PASS | PASS | CSP and rule audit clean |
| OAKLANDS COMPREHENSIVE SCHOOL | PASS | BLOCKED | Grade 8 lessons total 38 but this level expects 40 (2 fewer). A valid timetable may not be possible for this class.; Grade 7 lessons total 38 but this level expects 40 (2 fewer). A valid timetable may not be possible for this class.; Grade 8 lessons total 38 but this level expects 40 (2 fewer), so its week cannot be filled exactly.; Grade 7 lessons total 38 but this level expects 40 (2 fewer), so its week cannot be filled exactly. |
| KITHONI JUNIOR SCHOOL | BLOCKED | BLOCKED | Grade 6 has no active teacher assignments, so it has no lessons to schedule.; Grade 5 has no active teacher assignments, so it has no lessons to schedule.; Grade 5 lessons total 5 but this level expects 30 (25 fewer). A valid timetable may not be possible for this class.; Grade 5 lessons total 5 but this level expects 30 (25 fewer), so its week cannot be filled exactly. |
| KENYA NAVY JUNIOR SCHOOL | BLOCKED | BLOCKED | Grade 6 lessons total 40 but this level expects 30 (10 more), so its week cannot be filled exactly.; Grade 6 lessons total 37 but this level expects 30 (7 more), so its week cannot be filled exactly.; Grade 8 has no active teacher assignments, so it has no lessons to schedule.; Grade 9 lessons total 41 but this level expects 40 (1 more), so its week cannot be filled exactly.; Grade 9 lessons total 44 but this level expects 40 (4 more), so its week cannot be filled exactly. |
| Tuiyobei Junior School | PASS | PASS | CSP and rule audit clean |
| TAKITECH JUNIOR SCHOOL | PASS | PASS | CSP and rule audit clean |
| kasinga high school | PASS | BLOCKED | Grade 8 lessons total 44 but this level expects 40 (4 more), so its week cannot be filled exactly. |
| ST MARY'S IKONDOKHERA JUNIOR SCHOOL | BLOCKED | BLOCKED | Grade 7 lessons total 42 but this level expects 40 (2 more), so its week cannot be filled exactly.; Grade 8 lessons total 42 but this level expects 40 (2 more), so its week cannot be filled exactly. |
| Kipsolu Junior School | PASS | PASS | CSP and rule audit clean |
| Kaplelach North Comprehensive | BLOCKED | BLOCKED | Grade 7 lessons total 39 but this level expects 40 (1 fewer). A valid timetable may not be possible for this class.; Grade 9 lessons total 39 but this level expects 40 (1 fewer). A valid timetable may not be possible for this class.; Grade 7 lessons total 39 but this level expects 40 (1 fewer), so its week cannot be filled exactly.; Grade 9 lessons total 39 but this level expects 40 (1 fewer), so its week cannot be filled exactly. |
| Luther | BLOCKED | BLOCKED | Grade 8 has no active teacher assignments, so it has no lessons to schedule.; Grade 7 has no active teacher assignments, so it has no lessons to schedule. |
| AIC MUTULANI JUNIOR SCHOOL | PASS | PASS | CSP and rule audit clean |

## Interpretation

- **PASS** means every configured level in the harness completed with CSP output and no audit violations/warnings.
- **BLOCKED** means the solver stopped before saving because the live school data is incomplete or mathematically incompatible with its saved timetable clock (for example missing assignments or weekly totals above capacity).
- Under continuation mode, short weekly totals are allowed as explicit data warnings; over-capacity totals and missing assignments remain blocked because producing a timetable would violate exact-count or assignment rules.
- The priority school Kipsolu Junior School passed in both runs.

## Vercel mapping evidence

- Vercel CLI resolved production to project **`zamifu-analytics`**, project ID `prj_nQCW94U36pxzAeXEOwOC2pzawhXH`, with `zamifu.company` as its production URL.
- The unrelated project **`zamifu`** has a different project ID and `zamifu.vercel.app` URL.
- The configured Vercel MCP connector returned 404/empty results for both the team ID and team slug, so deployment should use the verified project ID/local `.vercel/project.json` mapping until that connector credential is refreshed.
