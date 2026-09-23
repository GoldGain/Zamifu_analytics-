# Curriculum Audit: CBC Junior Secondary Social Studies (Grades 7–9)

**Audit identifier:** `curriculum-audit-social-studies`  
**Repository:** `/home/ubuntu/Zamifu_analytics-`  
**Audit scope:** exactly one Kenyan CBC Junior Secondary learning area—**Social Studies**—covering the current Grade 7, Grade 8, and Grade 9 strands, sub-strands, and available assessment/paper-format evidence.

## Executive finding

The current KICD Junior School Social Studies designs contain **five strands in each of Grades 7, 8, and 9**. The strand titles and sub-strands are grade-specific; they must not be merged into one cross-grade taxonomy. The KICD files currently embedded on the official KICD grade pages identify Grade 7 as first published in 2022 and revised in 2024, Grade 8 as first published in 2023 and revised in 2024, and Grade 9 as first published in 2024.[1] [2] [3]

The repository is **not yet a reliable controlled curriculum master** for this learning area. Grade 7 and Grade 8 have additive migration files, but several names differ from the current design. There is no dedicated Grade 9 Social Studies hierarchy migration. Instead, an older generic knowledge-chunk migration labels invented or broad topics such as “History,” “Geography,” and “Civics” as if they were current KICD Grade 9 strands. Those rows should not be used for curriculum navigation or question coverage until replaced or quarantined.

For the national Grade 9 summative assessment, KNEC’s current regulations specify **one Social Studies paper, code 907**, with **two sections** and **100 marks**: Section A has 20 multiple-choice questions worth 20 marks, and Section B has structured and essay questions worth 80 marks. The stated duration is **1 hour 30 minutes**.[4] The 2025 and 2026 KJSEA timetables independently place 907 Social Studies in one 90-minute sitting, with no 907/2 paper.[5] [6] There is no evidence in these sources of a Social Studies practical paper. The KNEC Grade 7–8 circular is a separate school-based-assessment source: it places Grade 7 Social Studies among written tests and Grade 8 Social Studies among subjects with project, practical, and performance tasks. It should not be conflated with the Grade 9 KJSEA paper format.[7]

## Verified curriculum hierarchy

The arrays below preserve the current design labels as closely as possible. Capitalization and punctuation are normalized only where the source text is visibly split by a table or line wrap. The KICD page and embedded Drive file are the primary source for each grade. The accessible summary-table transcription was cross-checked against the curriculum-design copies listed in the References section.

### Grade 7

| Strand | Sub-strands |
|---|---|
| **1.0 Social Studies and Personal Development** | Self-Exploration; Social Entrepreneurial Opportunities |
| **2.0 People and Relationships** | Human Origin; Early Civilisation; Slavery and Servitude; Developments in Medium of Trade; Diversity and Interpersonal Relationships; Peaceful Coexistence |
| **3.0 Community Service-Learning** | Community Service-Learning Project |
| **4.0 Natural and Historic Built Environments in Africa** | Historical Information; Historical Development of Agriculture; Maps and Map Work; Earth and the Solar System; Weather; Fieldwork |
| **5.0 Political Development and Governance** | Political Development in Africa; The Constitution of Kenya; Human Rights; African Diasporas; Citizenship |

The official KICD Grade 7 file is the 69-page “Junior School Curriculum Design: Social Studies Grade 7,” first published in 2022 and revised in 2024.[1] The accessible Grade 7 design copy exposes the complete summary table and confirms the five-strand hierarchy above.[8]

### Grade 8

| Strand | Sub-strands |
|---|---|
| **1.0 Social Studies and Personal Management** | Self-Improvement; Self-Esteem Assessment |
| **2.0 Community Service Learning** | Community Service-Learning Project |
| **3.0 People and Relationships** | Scientific Theory about Human Origin; Early Civilisations; Trans Saharan Slave Trade; Population Growth in Africa; Diversity and Interpersonal Skills; Peaceful Conflict Resolutions |
| **4.0 Natural and Historic Built Environments** | Map Reading and Interpretation; Weather and Climate; Vegetation in Africa; Historical Sites and Monuments in Africa |
| **5.0 Political Developments and Governance** | The Constitution of Kenya; Human Rights; Citizenship |

The official KICD Grade 8 file is the 69-page “Junior School Curriculum Design: Social Studies Grade 8,” first published in 2023 and revised in 2024.[2] Its official KICD page and Drive preview confirm the file identity and table-of-contents structure.[2] The accessible curriculum-design copy provides the full summary table, including the three political sub-strands and the “in Africa” qualifiers in the natural-environment sub-strands.[9]

The source table prints “Trans Saharan Slave Trade” without a hyphen and “Peaceful Conflict Resolutions” in the plural. Those labels are retained here because a curriculum master should not silently rewrite source labels.

### Grade 9

| Strand | Sub-strands |
|---|---|
| **1.0 Social Studies and Career Development** | Pathway Choices; Pre-career Support Systems |
| **2.0 Community Service-Learning** | Community Service-Learning Project |
| **3.0 People and Relationships** | Socio-economic Practices of Early Humans; Indigenous Knowledge Systems in African Societies; Poverty Reduction; Population Structure; Peaceful Conflict Resolution; Healthy Relationships |
| **4.0 Natural and Historic Built Environments** | Topographical Maps; Internal Land Forming Processes; Multipurpose River Projects in Africa; Management and Conservation of the Environment; World Heritage Sites in Africa |
| **5.0 Political Developments and Governance** | The Constitution of Kenya; Civic Engagement in Governance; Kenya’s Bill of Rights; Cultural Globalisation |

The official KICD Grade 9 file is the 73-page “Junior School Curriculum Design: Social Studies Grade 9,” first published in 2024.[3] The KICD Grade 9 page embeds the official Drive file and identifies the document title. The full summary table was cross-checked in the accessible Grade 9 curriculum-design copy and an independent indexed transcription.[10] [11]

The Grade 9 list should be treated as **high confidence for names and ordering**, but the audit retains a provenance caveat: the official Drive preview exposed the file identity and opening pages reliably, while the environment did not return the complete summary-table transcript from that primary preview. The summary is nevertheless consistent across the two accessible design transcriptions and the KICD-embedded file identity. The earlier research note’s warning that Strand 5 might be missing from the design is outdated; the current Grade 9 summary and detailed section both include Strand 5.

## Comparison with the existing research note

`research/kicd-social-studies.md` was useful as a discovery note, but it should not be treated as the controlled answer without correction.

First, it described the Grade 7 direct WordPress PDF as blocked and relied on a secondary cross-check. The official KICD page now exposes a primary Google Drive preview for the Grade 7 design, so the audit can cite the primary file directly.[1] Second, the note reported Grade 7’s fifth sub-strand as “Citizenship and Globalisation.” The current revised Grade 7 summary lists **Citizenship** only; “Globalisation” is not a Grade 7 sub-strand in that table.[8] Third, the note’s Grade 7 list used shortened or paraphrased labels in places. The controlled import should use **Historical Development of Agriculture**, **Political Development in Africa**, and **Community Service-Learning Project**, not the shorter legacy forms.

The Grade 8 section of the note is broadly aligned with the accessible design copy, but it should preserve the source’s distinctions: **Early Civilisations**, **Trans Saharan Slave Trade**, **Vegetation in Africa**, **Historical Sites and Monuments in Africa**, and **Peaceful Conflict Resolutions**. The Grade 9 section is materially aligned with the current accessible summary, but its uncertainty statement should now distinguish a primary-file access limitation from a substantive uncertainty about Strand 5.

## Comparison with current code and data

### Grade 7 migration

The file `supabase/migrations/20260822_seed_verified_kicd_grade7_social_studies.sql` is directionally correct in its five-strand structure, but it contains controlled-data mismatches:

* It stores **Entrepreneurial Opportunities in Social Studies** instead of the current summary label **Social Entrepreneurial Opportunities**.
* It stores **Project** instead of **Community Service-Learning Project**.
* It stores **Agriculture** instead of **Historical Development of Agriculture**.
* It stores **Political Development in Africa up to 1900** instead of **Political Development in Africa**.
* It stores **Citizenship** correctly, but the old research note—not this migration—incorrectly added “and Globalisation” in its narrative list.

The migration’s source comment identifies the KICD index but does not persist the official Drive URL or design revision in the curriculum hierarchy rows. Add a source/version record before calling these rows source-verified.

### Grade 8 migration

The file `supabase/migrations/20260822_seed_verified_kicd_grade8_social_studies.sql` also has the correct broad five-strand shape, but it is not an exact current hierarchy:

* It stores **Service-Learning Project** instead of **Community Service-Learning Project**.
* It stores **Scientific Theory about Human Origin** correctly, but uses **Early Civilisations in Asia and Europe** rather than the summary label **Early Civilisations**.
* It stores **Trans-Saharan Slave Trade** with a hyphen rather than the source’s “Trans Saharan Slave Trade.”
* It stores **Diversity** and **Interpersonal Skills** as two sub-strands, but the current summary table presents **Diversity and Interpersonal Skills** as one sub-strand.
* It stores **Map Reading and Interpretation** and **Weather and Climate** correctly, but shortens **Vegetation in Africa** to **Vegetation** and **Historical Sites and Monuments in Africa** to **Historical Sites and Monuments**.
* It adds **Governance** and **Rights** as separate political sub-strands. The current summary lists **The Constitution of Kenya**, **Human Rights**, and **Citizenship**. “Governance” and “Rights” are not separate Grade 8 summary labels.

The additive `NOT EXISTS` strategy means legacy or incorrect rows will remain after a corrective migration unless the application filters by a versioned source or the old rows are explicitly deprecated.

### Grade 9 data

There is no dedicated `20260822_seed_verified_kicd_grade9_social_studies.sql` hierarchy migration. The older `supabase/migrations/20260725_populate_curriculum_data.sql` instead inserts eight generic `exam_knowledge_chunks` rows for Grade 9 Social Studies under broad labels such as **History**, **Geography**, **Civics**, and **Community Service Learning**. Examples include “Global Geography,” “Sustainable Development,” “International Organisations,” “Citizenship and National Identity,” and “Technology and Governance.” These are not the current Grade 9 KICD strand/sub-strand hierarchy listed above. Their `source_name` says “KICD Grade 9 Curriculum Design,” but the rows do not reproduce the current controlled labels and should be regarded as stale or unverified content summaries, not authoritative curriculum structure.

The application’s curriculum navigator and exam coverage logic read strand and sub-strand names from database rows. If these rows are available to question generation, the system can produce coverage claims against a hierarchy that is not the current KICD design.

### Current paper-format implementation

`src/lib/kjsea-paper-formats.ts` correctly routes Social Studies to a single paper with code **907**, 100 marks, 90 minutes, Section A with 20 multiple-choice items, and Section B with 80 marks. It also excludes Social Studies from `TWO_PAPER_SUBJECTS`, which is correct for the KJSEA format documented by KNEC.[4]

However, the implementation has several limitations:

1. The blueprint represents Section B as **16 `case_study` items at 5 marks each**. KNEC specifies “structured and essay questions” and the total of 80 marks, but the regulation does not establish a universal 16-by-5 allocation. The code must not present that internal generation blueprint as an official KNEC question count.
2. The code’s Social Studies format note says Questions 21–23 require actual maps. That may be a useful local generation rule, but it is not established by the KJSEA regulations cited in the module. Keep it clearly marked as an application constraint or sample-paper observation, not as a KNEC regulation.
3. `ExamGenerator.tsx` defaults to a legacy **30-mark, 45-minute Standard Assessment**. A user must explicitly select **KJSEA format** to receive the source-backed Social Studies 907 defaults. The UI should make the grade and assessment regime explicit so a Grade 7/8 SBA is not mistaken for a Grade 9 KJSEA paper.
4. The database table `exam_papers` stores one JSON question collection, one duration, and one total mark value. This is adequate for Social Studies’ single-paper KJSEA structure but does not model SBA task types, project evidence, performance rubrics, or a paper/section provenance record.
5. `exam_paper_defaults` contains a Grade 9 Social Studies “Standard” row with 90 minutes and a null total-mark value. The KJSEA module supplies the 100 marks in code, but the defaults table itself does not preserve the known KNEC mark total or the 907 paper code. Source URL, revision date, paper code, and evidence type should be stored with the default.
6. The curriculum-source schema exists, but the reviewed Social Studies hierarchy migrations do not appear to register one versioned `curriculum_sources` record per grade and design revision. Without that linkage, a future design update cannot be safely distinguished from the current 2024 revisions.

## Assessment and paper-format findings

The authoritative KNEC regulation is specific for Social Studies: **one paper only**. It is not Paper 1/Paper 2, and it is not a practical paper. The paper has two sections: **Section A, 20 multiple-choice questions worth 20 marks; Section B, structured and essay questions worth 80 marks**. The total is **100 marks**, and the standard duration is **1 hour 30 minutes**.[4]

The 2025 KJSEA timetable independently schedules **907 Social Studies** as one 90-minute sitting, and the 2026 timetable does the same.[5] [6] The timetable lists a separate Braille duration of two hours; that accessibility variant should not replace the standard-paper duration in the ordinary paper default.

KNEC’s Grade 7–8 SBA circular is a different assessment regime. It says Grade 7 Social Studies is among the subjects administered as written tests. It places Grade 8 Social Studies among subjects with project, practical, and performance tasks. The circular explains that SBA tools may be provided in PDF or digital format and that performance-based tasks are scored using the supplied guidelines.[7] The circular does not establish a 907-style 100-mark, 90-minute national paper for Grade 7 or Grade 8. Therefore, the application should store Grade 7/8 SBA task metadata separately from Grade 9 KJSEA paper metadata.

## Implementation risks and recommended controls

1. **Incorrect hierarchy risk:** Replace or deprecate the mismatching Grade 7 and Grade 8 rows and add a Grade 9 source-verified hierarchy migration. Do not rely on additive inserts alone; preserve historical rows with a status/version field and expose only the current approved revision.
2. **Stale Grade 9 knowledge risk:** Quarantine the generic Grade 9 `exam_knowledge_chunks` until each row is mapped to a current KICD strand and sub-strand. Do not label broad synthetic summaries as KICD-verified without a source-page reference.
3. **Assessment-regime risk:** Separate Grade 7/8 SBA records from Grade 9 KJSEA records. A common “exam paper” object should not imply that all Junior Secondary grades use the 907 national paper.
4. **Paper-structure overfitting:** Keep the KNEC-level fact at one paper, two sections, 100 marks, and 90 minutes. Treat any generated count such as 16 five-mark Section B items as an internal blueprint, not an official paper specification.
5. **Source-provenance risk:** Store the KICD official page URL, official Drive file URL, grade, first-publication year, revision year, retrieval date, and a content hash or version identifier with each controlled hierarchy.
6. **Naming and matching risk:** The application uses normalized subject names and free-text strand/sub-strand fields. Exact source labels should be canonical, while aliases should be handled at the UI boundary rather than inserted as parallel curriculum rows.
7. **Legacy-format risk:** The generator’s 30-mark legacy format remains available and is the initial UI state. Add a visible label such as “Internal school assessment—not KJSEA 907” when that mode is selected.
8. **Map and visual evidence risk:** Social Studies includes map-related curriculum content, but the current schema should distinguish a question that merely mentions a map from one that actually attaches a usable map stimulus. This is an implementation requirement, not an extra KNEC paper component.

## References

[1]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/ "KICD Grade Seven Designs"

[2]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/ "KICD Grade Eight Designs"

[3]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ "KICD Grade Nine Designs"

[4]: https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf "KNEC KJSEA Regulations"

[5]: https://knec.ac.ke/wp-content/uploads/2025/06/2025-KJSEA-TIMETABLE-Revised-1.pdf "KNEC 2025 KJSEA Timetable and Instructions"

[6]: https://www.knec.ac.ke/wp-content/uploads/2026/02/2026-KJSEA-TIMETABLE.pdf "KNEC 2026 KJSEA Timetable and Instructions"

[7]: https://www.knec.ac.ke/wp-content/uploads/2024/03/Grade-7-and-8-SBAs.pdf "KNEC Administration of the Year 2024 Grade 7, Grade 8 and Prevocational Level School Based Assessment"

[8]: https://easylearn.co.ke/images/document/11752154/Social-Studies-Grade-7-Revised-1.pdf "Social Studies Grade 7 Revised 1 curriculum-design copy"

[9]: https://www.teacherspalace.co.ke/uploads/documents/social-studies-grade-8-revised-1-unlocked-2025-01-05-Up5cUrwpuP.pdf "Social Studies Grade 8 Revised 1 curriculum-design copy"

[10]: https://www.teacherspalace.co.ke/uploads/documents/social-studies-grade-9-revised-1-unlocked-2024-12-02-QzcK6QzeMT.pdf "Social Studies Grade 9 Revised 1 curriculum-design copy"

[11]: https://www.studocu.com/row/document/mount-kenya-university/information-technology/social-studies-grade-9-revised-1/115613564 "Indexed Grade 9 Social Studies revised-design transcription"

### Primary KICD Drive files embedded by the official KICD pages

* Grade 7: https://drive.google.com/file/d/1nr9z0Z11ue76h2odpYQJNeUU4jFJWbbB/preview
* Grade 8: https://drive.google.com/file/d/1yx30v28nVLKYSByRB9G2Omalh76-ZL6h/preview
* Grade 9: https://drive.google.com/file/d/1gMXIzQnV-F1a7n_dJ82QU2-BTtw3B-NW/preview

*Audit completed 2026-09-23.*
