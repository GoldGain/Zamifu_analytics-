# Junior School KICD curriculum replacement — live audit and evidence

**Verification date:** 2026-09-29
**Database:** Supabase `CBC system` (project ref `naihzzlszvrkxrxogsuz`)
**Code branch:** `chore/kicd-curriculum-rebuild`
**Hierarchy rule:** strand → sub-strand only; topics are not a separate tier because they duplicate sub-strands.

## Outcome

The active Grade 7–9 catalogs now comprise the ten official learning areas in all three grades. Live SQL returned **30 catalogs and 758 active sub-strand rows**; an exact comparison against the normalized, source-backed catalog found **zero mismatches** in strand names, sub-strand names, parentage, or order. There are **171 strands**. The seeded names include source numbering. No topic rows were inserted, and the legacy topic/progress/scheme/lesson history was retained rather than deleted.

## Backups and preservation

All six dated backup tables were verified against their corresponding live table counts at backup time:

| Backup table | Rows |
|---|---:|
| `zamifu_backup_20260929_curriculum_grades` | 12 |
| `zamifu_backup_20260929_curriculum_subjects` | 79 |
| `zamifu_backup_20260929_curriculum_strands` | 376 |
| `zamifu_backup_20260929_curriculum_sub_strands` | 1,633 |
| `zamifu_backup_20260929_curriculum_topics` | 1,387 |
| `zamifu_backup_20260929_curriculum_sources` | 6 |

Backup confirmation: these are full table copies, not exports limited to Grade 7–9. The original curriculum rows remain stored but are inactive; cascade-sensitive history was preserved. Before cutover, there were 1,387 topic rows, 72 progress rows, 8 schemes and 4 lesson plans; existing progress, schemes and lesson plans were linked to the new direct sub-strand field. The final live query confirmed the topic count was unchanged.

## Before/after audit — all 30 subject-grade combinations

“Exact match?” compares the pre-cutover active strand labels, in order and including numbering, to the verified KICD strand labels. Old catalogs were not physically deleted; they were deactivated after the new catalog was staged and validated.

| Subject | Grade | Before: active strands (count and names) | Before sub-strands | KICD: active strands (count and names) | KICD sub-strands | Exact match? |
|---|---:|---|---:|---|---:|---|
| Agriculture and Nutrition | 7 | 8 — Agricultural Economics and Extension; Animal Production; Conservation of Resources; Crop Production; Hygiene; Nutrition and Food Science; Production Processes; Techniques | 33 | 4 — 1.0 Conservation of Resources; 2.0 Food Production Processes; 3.0 Hygiene Practises; 4.0 Production Techniques | 14 | No |
| Agriculture and Nutrition | 8 | 8 — Agricultural Economics and Extension; Animal Production; Conservation of Resources; Crop Production; Food Production Processes; Hygiene Practices; Nutrition and Food Science; Production Techniques | 31 | 4 — 1.0 Conservation of Resources; 2.0 Food Production Processes; 3.0 Hygiene Practices; 4.0 Production Techniques | 12 | No |
| Agriculture and Nutrition | 9 | 4 — Agricultural Economics and Extension; Animal Production; Crop Production; Nutrition and Food Science | 19 | 4 — 1.0 Conservation of Resources; 2.0 Food Production Processes; 3.0 Hygiene Practises; 4.0 Production Techniques | 10 | No |
| Creative Arts and Sports | 7 | 6 — Appreciation in Creative Arts and Sports; Creating and Performing in Creative Arts and Sports; Foundations of Creative Arts and Sports; Performing Arts; Sports and Physical Education; Visual Arts | 28 | 3 — 1.0 Foundations of Creative Arts and Sports; 2.0 Creating and Performing in Creative Arts and Sports; 3.0 Appreciation in Creative Arts and Sports | 12 | No |
| Creative Arts and Sports | 8 | 6 — Appreciation in Creative Arts and Sports; Creating and Performing in Creative Arts and Sports; Foundations of Creative Arts and Sports; Performing Arts; Sports and Physical Education; Visual Arts | 31 | 3 — 1.0 Foundations of Creative Arts and Sports; 2.0 Creating and Performing in Creative Arts and Sports; 3.0 Appreciation in Creative Arts and Sports | 12 | No |
| Creative Arts and Sports | 9 | 3 — Performing Arts; Sports and Physical Education; Visual Arts | 15 | 3 — 1.0 Foundations of Creative Arts and Sports; 2.0 Creating and Performing in Creative Arts and Sports; 3.0 Appreciation in Creative Arts and Sports | 15 | No |
| Christian Religious Education | 7 | 6 — Christian Living Today; Creation; Early Life of Jesus Christ; Introduction to Christian Religious Education; The Bible; The Church | 18 | 6 — 1.0 Overview of Christian Religious Education; 2.0 Creation; 3.0 The Bible; 4.0 The Early Life of Jesus Christ; 5.0 The church in Action; 6.0 Christian Living Today | 19 | No |
| Christian Religious Education | 8 | 0 — None (empty hierarchy) | 0 | 6 — 1.0 Creation; 2.0 The Bible; 3.0 The Life and Ministry of Jesus; 4.0 Teachings of Jesus Christ; 5.0 The Church; 6.0 Christian Living Today | 18 | No |
| Christian Religious Education | 9 | 5 — Christian Living Today; Creation; The Bible; The Church; The Life and Ministry of Jesus Christ | 16 | 5 — 1.0 Creation; 2.0 The Bible; 3.0 The Life and Ministry of Jesus Christ; 4.0 The Church; 5.0 Christian Living Today | 14 | No |
| English | 7 | 6 — Grammar; Grammar in Use; Listening and Speaking; Literature; Reading; Writing | 91 | 15 — THEME 1.0: PERSONAL RESPONSIBILITY; THEME 2.0: SCIENCE AND HEALTH EDUCATION; THEME 3.0: HYGIENE; THEME 4.0: LEADERSHIP; THEME 5.0: FAMILY; THEME 6.0: DRUG AND SUBSTANCE ABUSE; THEME 7.0: NATURAL RESOURCES – FORESTS; THEME 8.0: TRAVEL; THEME 9.0: HEROES AND HEROINES - KENYA; THEME 10.0: MUSIC; THEME 11.0: PROFESSIONS; THEME 12.0: TRADITIONAL FASHION; THEME 13.0: LAND TRAVEL; THEME 14.0: SPORTS - OUTDOOR GAMES; THEME 15.0: TOURIST ATTRACTION SITES - KENYA | 75 | No |
| English | 8 | 6 — Grammar; Grammar in Use; Listening and Speaking; Literature; Reading; Writing | 86 | 15 — THEME 1: HUMAN RIGHTS; THEME 2: SCIENTIFIC INNOVATIONS; THEME 3: POLLUTION; THEME 4: CONSUMER ROLES AND RESPONSIBILITES; THEME 5: RELATIONSHIPS: PEERS; THEME 6: REHABILITATION; THEME 7: NATURAL RESOURCES: WILDLIFE; THEME 8: TOURISM: DOMESTIC; THEME 9: HEROES AND HEROINES: AFRICA; THEME 10: ART; THEME 11: CHOOSING A CAREER; THEME 12: MODERN FASHION; THEME 13: CONSUMER PROTECTION; THEME 14: SPORTS: OLYMPICS; THEME 15: TOURIST ATTRACTION SITES: AFRICA | 75 | No |
| English | 9 | 5 — Grammar in Use; Language Use; Listening and Speaking; Reading; Writing | 17 | 15 — THEME 1.0: CITIZENSHIP; THEME 2.0: SCIENCE: FICTION; THEME 3.0: ENVIRONMENTAL CONSERVATION; THEME 4.0: CONSUMER PROTECTION: CONSUMER LAWS AND POLICIES; THEME 5.0 RELATIONSHIPS: COMMUNITY; THEME 6.0: LEISURE TIME; THEME 7.0: NATURAL RESOURCES: MARINE LIFE; THEME 8.0: TOURISM: INTERNATIONAL; THEME 9.0: HEROES AND HEROINES: WORLD; THEME 10.0: SOCIAL AND MASS MEDIA; THEME 11.0: INCOME GENERATING ACTIVITIES; THEME 12.0: PERSONAL GROOMING; THEME 13.0: SEA TRAVEL; THEME 14.0: SPORTS – WORLD CUP (FOOTBALL); THEME 15.0: TOURIST ATTRACTION SITES- WORLD | 75 | No |
| Integrated Science | 7 | 11 — Earth and Space; Force and Energy; Force, Energy and Motion; Living Things and Environment; Living Things and the Environment; Living Things and Their Environment; Matter and Its Properties; Matter and Materials; Mixtures, Elements and Compounds; Scientific Investigation; Technology and Innovation | 37 | 4 — 1.0 Scientific Investigation; 2.0 Mixtures, Elements and Compounds; 3.0 Living things and the Environment; 4.0 Force and Energy | 9 | No |
| Integrated Science | 8 | 10 — Earth and Space; Force and Energy; Force, Energy and Motion; Living Things and Environment; Living Things and the Environment; Living Things and their Environment; Matter and Materials; Mixtures, Elements and Compounds; Scientific Investigation; Technology and Innovation | 36 | 3 — 1.0 Mixtures, Elements and Compounds; 2.0 Living Things and the Environment; 3.0 Force and Energy | 8 | No |
| Integrated Science | 9 | 6 — Earth and Space; Force, Energy and Motion; Living Things and Environment; Matter and Materials; Scientific Investigation; Technology and Innovation | 24 | 3 — 1.0 Mixtures, Elements, and Compounds; 2.0 Living Things and their Environment; 3.0 Force and Energy | 9 | No |
| Islamic Religious Education | 7 | 7 — Akhlaq; Devotional Acts; Hadith; Islamic Heritage and Civilisation; Muamalat; Pillars of Iman; Qur’an | 16 | 7 — 1.0 Qur’an; 2.0 Hadith; 3.0 Pillars of Iman; 4.0 Devotional Acts; 5.0 Akhlaq (Moral Teachings); 6.0 Muamalat (Social Relations); 7.0 Islamic Heritage and Civilisation | 16 | No |
| Islamic Religious Education | 8 | 0 — None (empty hierarchy) | 0 | 7 — 1.0 Qur’an; 2.0 Hadith; 3.0 Pillars of Iman; 4.0 Devotional Acts; 5.0 Akhlaq (Moral Teachings); 6.0 Muamalat (Social Relations); 7.0 Islamic Heritage and Civilisation | 17 | No |
| Islamic Religious Education | 9 | 7 — Akhlaq (Moral Values); Devotional Acts; Hadith; Islamic Heritage and Civilisation; Muamalat (Social Relations); Pillars of Iman; Qur’an | 20 | 7 — 1.0 Qur’an; 2.0 Hadith; 3.0 Pillars of Iman; 4.0 Devotional Acts; 5.0 Akhlaq (Moral Teachings); 6.0 Muamalat (Social Relations); 7.0 Islamic Heritage and Civilisation | 20 | No |
| Kiswahili | 7 | 5 — Kuandika; Kusikiliza na Kuzungumza; Kusoma; Sarufi; Sarufi na Matumizi ya Lugha | 43 | 4 — Kusikiliza na Kuzungumza; Kusoma; Kuandika; Sarufi | 60 | No |
| Kiswahili | 8 | 5 — Kuandika; Kusikiliza na Kuzungumza; Kusoma; Sarufi; Sarufi na Matumizi ya Lugha | 57 | 4 — Kusikiliza na Kuzungumza; Kusoma; Kuandika; Sarufi | 60 | No |
| Kiswahili | 9 | 4 — Kuandika; Kusikiliza na Kuzungumza; Kusoma; Sarufi na Matumizi ya Lugha | 16 | 4 — Kusikiliza na Kuzungumza; Kusoma; Kuandika; Sarufi | 60 | No |
| Mathematics | 7 | 6 — Algebra; Data Handling and Probability; Geometry; Measurements; Numbers; Statistics and Probability | 45 | 5 — 1.0 Numbers; 2.0 Algebra; 3.0 Measurements; 4.0 Geometry; 5.0 Data Handling and Probability | 18 | No |
| Mathematics | 8 | 6 — Algebra; Data Handling and Probability; Geometry; Measurements; Numbers; Statistics and Probability | 42 | 5 — 1.0 Numbers; 2.0 Algebra; 3.0 Measurements; 4.0 Geometry; 5.0 Data Handling and Probability | 16 | No |
| Mathematics | 9 | 6 — Algebra; Geometry; Measurements; Numbers; Statistics and Probability; Trigonometry | 25 | 5 — 1.0 Numbers; 2.0 Algebra; 3.0 Measurements; 4.0 Geometry; 5.0 Data Handling and Probability | 19 | No |
| Pre-Technical Studies | 7 | 9 — Communication in Pre-Technical Studies; Electricity and Electronics; Entrepreneurship; Foundations of Pre-Technical Studies; Materials and Tools; Materials for Production; Structures and Mechanisms; Technical Drawing and Design; Tools and Production | 32 | 5 — 1.0 Foundations of Pre -Technical Studies; 2.0 Communication in Pre-Technical Studies; 3.0 Materials for Production; 4.0 Tools and Production; 5.0 Entrepreneurship | 14 | No |
| Pre-Technical Studies | 8 | 9 — Communication in Pre-Technical Studies; Electricity and Electronics; Entrepreneurship; Foundations of Pre-Technical Studies; Materials and Tools; Materials for Production; Structures and Mechanisms; Technical Drawing and Design; Tools and Production | 32 | 5 — 1.0 Foundations of Pre-Technical studies; 2.0 Communication; 3.0 Materials for production; 4.0 Tools and Production; 5.0 Entrepreneurship | 14 | No |
| Pre-Technical Studies | 9 | 4 — Electricity and Electronics; Materials and Tools; Structures and Mechanisms; Technical Drawing and Design | 18 | 5 — 1.0 Foundations of Pre-Technical Studies; 2.0 Communication in Pre-Technical Studies; 3.0 Materials for Production; 4.0. Tools and Production; 5.0 Entrepreneurship | 13 | No |
| Social Studies | 7 | 8 — Community Service-Learning; History and Government; Natural and Historic Built Environments; People and Relationships; Political and Economic Systems; Political Development and Governance; Social Relationships and Cultural Diversity; Social Studies and Personal Development | 37 | 5 — 1.0 Social Studies Personal Development; 2.0 People and Relationships; 3.0 Community Service-Learning; 4.0 Natural and Historic Built Environments; 5.0 Political Development and Governance | 20 | No |
| Social Studies | 8 | 7 — Community Service Learning; Natural and Historic Built Environments; People and Relationships; Political and Economic Systems; Political Developments and Governance; Social Relationships and Cultural Diversity; Social Studies and Personal Management | 33 | 5 — 1.0 Social Studies and Personal Management; 2.0 Community Service Learning; 3.0 People and Relationships; 4.0 Natural and Historic Built Environments; 5.0 Political Developments and Governance | 16 | No |
| Social Studies | 9 | 3 — Natural and Historic Built Environments; Political and Economic Systems; Social Relationships and Cultural Diversity | 15 | 5 — 1.0 Social Studies and Career Development; 2.0 Community Service-Learning; 3.0 People and Relationships; 4.0 Natural and Historic Built Environments; 5.0 Political Developments and Governance | 18 | No |

**Totals for the 30 official combinations:** pre-cutover active legacy strands **176**; pre-cutover sub-strands **913**; post-cutover KICD strands **171**; post-cutover sub-strands **758**. Exact pre-cutover strand-list matches: **0/30**. The generic legacy “Religious Education” entry was an extra non-official label present for grades 7–9 and is no longer active; the official CRE and IRE rows remain distinct.

## Five random strand checks against current KICD PDF previews

The names and numbering below were searched in the publicly viewable, current KICD-linked Google Drive preview text. “Page” is the physical PDF page in the viewer.

| Sample | KICD document title | Page | Database strand | Result |
|---|---|---:|---|---|
| Grade 8 Integrated Science | `Integrated Science Grade 8 - July 2024.pdf` | 12 | `2.0 Living Things and the Environment` | Match |
| Grade 7 Christian Religious Education | `CRE Grade 7 - Revised.pdf` | 12 | `1.0 Overview of Christian Religious Education` | Match |
| Grade 7 Agriculture and Nutrition | `Agriculture Grade7 1.8.2024 -Proofread.pdf` | 6 | `2.0 Food Production Processes` | Match |
| Grade 7 Islamic Religious Education | `Islamic Religious Education Grade 7 - July 2024.pdf` | 34 | `5.0 Akhlaq (Moral Teachings)` | Match |
| Grade 8 Pre-Technical Studies | `Pre-Technical Studies Grade 8 - July 2024 - Revised.pdf` | 6 | `3.0 Materials for production` | Match |

## Sources and extracted PDF evidence

The detailed research files include official KICD grade-design landing pages, grade-specific document/viewer URLs, secondary cross-checks where available, summary-table page references, local PDF filenames and evidence caveats. A readable source ledger and per-area hierarchy are included for every learning area:

- **Agriculture and Nutrition:** [`01-agriculture-and-nutrition.md`](./01-agriculture-and-nutrition.md) — High: current official KICD-linked Grade 7–9 design previews were inspected; the numbered summary hierarchies were transcribed from the public viewer text, with grade-specific independent mirror PDFs used as cross-checks.
- **Creative Arts and Sports:** [`02-creative-arts-and-sports.md`](./02-creative-arts-and-sports.md) — high: official KICD landing pages verified first, grade-specific KICD-labelled mirror PDFs extracted with pdftotext, and Grade 9 independently cross-checked against a second accessible KICD-labelled copy; official embedded Drive downloads were permission-restricted
- **Christian Religious Education:** [`03-christian-religious-education.md`](./03-christian-religious-education.md) — high
- **English:** [`04-english.md`](./04-english.md) — high: official KICD landing pages and embedded Drive previews identified; accessible KICD-labelled/education-resource mirror PDFs downloaded and text-extracted; independent Teacher.co.ke copies for Grades 7–8 and Arena copy for Grade 9 cross-checked
- **Integrated Science:** [`05-integrated-science.md`](./05-integrated-science.md) — high: official KICD landing pages and embedded previews verified, with direct pdftotext extraction from accessible KICD-labelled independent PDF mirrors
- **Islamic Religious Education:** [`06-islamic-religious-education.md`](./06-islamic-religious-education.md) — high: official KICD landing pages and embedded IRE links verified; exact hierarchy extracted from downloaded KICD-labelled Easylearn mirror PDFs with pdftotext and cross-checked against each PDF body tables
- **Kiswahili:** [`07-kiswahili.md`](./07-kiswahili.md) — high: current official KICD Google Drive previews; the KICD-revised October 2024 edition title, page count, and numbered summary table were extracted from the publicly rendered previews
- **Mathematics:** [`08-mathematics.md`](./08-mathematics.md) — high
- **Pre-Technical Studies:** [`09-pre-technical-studies.md`](./09-pre-technical-studies.md) — high: official KICD landing pages and embedded KICD viewers cross-checked against accessible education-resource mirror PDFs
- **Social Studies:** [`10-social-studies.md`](./10-social-studies.md) — high_with_first_party_download_limitation

The original research workspace stores the downloaded PDFs and extracted text at `/home/ubuntu/zamifu-work/kicd-source-pdfs/`. Official KICD Drive previews were used directly for title/version and hierarchy verification when available. Where KICD blocked raw downloads, the reports say so and identify the KICD-labelled mirror copy used for extractable PDF text; mirror copies are not represented as direct KICD downloads.

## Exam-format regression checks

Executable assertions exercised the KJSEA paper specs and generated blueprint totals for all requested Grade 7 formats:

| Paper | Checked total | Result |
|---|---:|---|
| English Paper 1 | 50 | Pass — 20 + 5 + 10 + 15; MCQ order as required |
| English Paper 2 | 50 | Pass — Composition 15, Oral literature 10, Novella 10, Play 10, Poetry 5 |
| Kiswahili Karatasi 1 | 50 | Pass — spec, components and blueprint sum |
| Kiswahili Karatasi 2 | 50 | Pass — 15 + 10 + 10 + 10 + 5 |
| Mathematics | 100 | Pass — Section A 20 + Section B 80 |
| Integrated Science Paper 1 | 70 | Pass — 30 MCQ + 40 structured |
| Integrated Science Paper 2 | 30 | Pass — three practical-skill tasks |
| Social Studies | 100 | Pass — 20 MCQ + 80 structured; mapwork requirement present |
| CRE | 100 | Pass — spec and blueprint sum |
| IRE | 100 | Pass — spec and blueprint sum |
| Pre-Technical Paper 1 | 80 | Pass — 30 MCQ + 50 structured |
| Pre-Technical Project | 40 | Pass |
| Creative Arts Project | 100 | Pass |
| Creative Arts Paper 2 | 100 | Pass — 40 MCQ + 60 structured |

Also asserted English Paper 2 component order, combined Integrated Science total 100, and combined Pre-Technical total 120.

## Code validation status

- `pnpm exec tsc --noEmit` — pass.
- `pnpm build` — pass (Vite production bundle generated). Existing chunk-size and mixed static/dynamic import notices remain non-blocking.
- Targeted ESLint on the 10 modified TypeScript files — **no regression against `origin/main`**; the baseline contains existing lint errors in these files. This change set reports fewer errors than baseline (74 vs. 82), but lint is not globally clean.
- `git diff --check` — pass.

## Application behavior changes

- Teacher curriculum navigation and lesson plans now use only **strand → sub-strand**; there is no separate Topics tier or duplicated topic label.
- Junior School subject lists expose the ten official learning areas only.
- Grade 7–9 curriculum UI and exam requests use the active source-linked catalog; generation is fail-closed if selected strand/sub-strand pairs do not belong to that live catalog.
- Junior School generation prompts and validation prohibit third-tier topic labels and reject unselected or mis-parented sub-strands.
- Legacy topic IDs remain only as compatibility/history records; new curriculum data and UI do not create or display them.

## Remaining release evidence

- The production build and database/source verification are complete. Authenticated preview/live exam-generator smoke tests, screenshots, commit hash, and Vercel deployment URL will be appended after those steps complete.
