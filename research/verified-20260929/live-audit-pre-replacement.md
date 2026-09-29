# Zamifu live curriculum audit before replacement

**Target:** Supabase project `CBC system` (`naihzzlszvrkxrxogsuz`). The app repository is on feature branch `chore/kicd-curriculum-rebuild`; production `main` has not been changed.

## Verified backups

All six dated backup tables exist, and their counts match the live tables at the point of backup:

- `zamifu_backup_20260929_curriculum_grades`: 12
- `zamifu_backup_20260929_curriculum_subjects`: 79
- `zamifu_backup_20260929_curriculum_strands`: 376
- `zamifu_backup_20260929_curriculum_sub_strands`: 1,633
- `zamifu_backup_20260929_curriculum_topics`: 1,387
- `zamifu_backup_20260929_curriculum_sources`: 6

## Current Grade 7–9 catalog problems

The live CBE grade catalogue has 11 subject labels in each of Grades 7, 8 and 9, including a generic `Religious Education` row in addition to the official separate CRE and IRE learning areas. Grade 8 CRE and IRE and Grade 9’s subject rows include empty/incomplete hierarchies. Across Grade 7–9, existing strand counts vary widely and conflict with the independently transcribed KICD summary tables. The exact before/after counts are recorded in the final audit report.

The intended active learning areas are exactly: Agriculture and Nutrition, Creative Arts and Sports, Christian Religious Education, English, Integrated Science, Islamic Religious Education, Kiswahili, Mathematics, Pre-Technical Studies, and Social Studies. The generic `Religious Education` row is not part of the active set.

## References that must remain intact

The live database has 1,387 `curriculum_topics` rows, all linked to sub-strands; 72 progress rows, all with direct sub-strand links; 8 schemes, all linked; 4 lesson plans, all linked; and 0 curriculum resources/questions. The child foreign keys from `curriculum_topics` to `curriculum_sub_strands` and then from legacy topic IDs to progress/scheme/lesson records use cascading deletes. Therefore, deleting/recreating old hierarchy rows would destroy user history. Existing exam question/paper records use text/JSON snapshots and do not have curriculum-row foreign keys.

Decision: retain the legacy curriculum rows, topics, and user history; add explicit `is_current` flags and source provenance; mark Grade 7–9 legacy rows inactive; insert the source-verified catalog as active; and update the app queries to show only active strand → sub-strand rows. No topic records will be added to the corrected catalog or rendered in the site.

## External evidence already saved

- Full normalized 10-area catalog: [`kicd-junior-curriculum-g7-g9.json`](./kicd-junior-curriculum-g7-g9.json)
- Official current Kiswahili previews and extracted summary rows: [`07-kiswahili-result.json`](./07-kiswahili-result.json)
- Per-subject source notes and original workflow output: [`workflow-results-raw.txt`](./workflow-results-raw.txt)
- Detailed Agriculture note from the shared research workspace: `/home/ubuntu/zamifu-work/research/verified-20260929/00-agriculture-and-nutrition-progress.md`
