# Kenyan CBC Junior Secondary Mathematics Curriculum Audit

**Audit scope:** Exactly one learning area—**Mathematics**—for Grades 7, 8 and 9, plus the current KJSEA assessment/paper format used for Mathematics (903).

**Audit retrieval date:** 23 September 2026.

## Executive conclusion

The current KICD-linked Junior Secondary Mathematics designs use the same five broad strands in Grades 7–9: **Numbers; Algebra; Measurements; Geometry; and Data Handling and Probability**. The sub-strands are grade-specific and progressively change; they must not be populated by copying a generic Junior School subject pack across grades.

The official KNEC KJSEA regulations specify that Mathematics (903) is **one paper**, not Paper 1/Paper 2. It has **two sections and 100 marks**: Section A contains **20 multiple-choice questions worth 20 marks**, and Section B contains **structured and essay questions worth 80 marks**. The stated duration is **2 hours**. The regulations do not specify a separate Mathematics practical paper or practical component. The 2025 KNEC timetable independently confirms 903 Mathematics as a two-hour paper. The word “essay” in the official Section B description should not be silently reduced to “numeric response” in an implementation.

The existing `research/kicd-mathematics.md` was conservative about inaccessible KICD PDFs, but it is now incomplete/outdated: it leaves Grade 9 empty, describes Grade 8 Geometry imprecisely, and does not capture the exact revised Grade 8 and Grade 9 headings verified in the accessible 2024 design copies. The current code has the correct high-level one-paper/100-mark/two-hour direction, but its detailed Mathematics allocation (Numbers 40, Algebra 15, Measurement 30, Geometry 10, Data 5; Q21–40; each Section B item treated as five marks) is **not established by the KNEC regulations, timetable, or circular inspected in this audit** and should be treated as an unverified sample-derived assumption until the official Mathematics sample paper and rubric are retrieved.

## Source and verification method

The KICD Grade Seven, Grade Eight and Grade Nine landing pages were inspected directly. Their machine-readable HTML exposes Mathematics as an item and embeds an official Google Drive preview for each grade. The current embedded links are recorded below. Direct Drive downloads were blocked by Google Drive permissions in this environment, so the strand/sub-strand transcription was cross-checked against accessible 2024 design PDFs hosted by Kenyan education-resource sites. Those mirror PDFs identify the Government of Kenya/KICD design and contain the same design-style front matter, but the mirrors are not treated as substitutes for the official KICD host. This distinction matters for production ingestion: retain the KICD-linked file as the primary provenance and re-check it when the Drive permission or KICD download route is available.

For assessment format, two independent KNEC primary sources were used: the KJSEA Regulations PDF and the revised 2025 KJSEA timetable. The KNEC circular was used to confirm that KNEC made sample papers/rubrics available through the Grade 9 portal and that the 2025 OMR convention requires candidates to shade responses; it does not alter the Mathematics paper count or mark structure.

## Grade 7 verified strand and sub-strand inventory

The accessible Grade 7 Mathematics design copy has five strands and the following exact curriculum headings. “Data Handling and Probability” is the strand name, but the design exposes only **Data Handling** as its Grade 7 sub-strand; Probability is not added to Grade 7 by inference.

| Strand | Sub-strands |
|---|---|
| **Numbers** | Whole Numbers; Factors; Fractions; Decimals; Squares and Square Roots |
| **Algebra** | Algebraic Expressions; Linear Equations; Linear Inequalities |
| **Measurements** | Pythagorean Relationship; Length; Area; Volume and Capacity; Time, Distance and Speed; Temperature; Money |
| **Geometry** | Angles; Geometrical Constructions |
| **Data Handling and Probability** | Data Handling |

The Grade 7 primary index is [KICD Grade Seven Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/), whose Mathematics iframe points to the official Drive preview [Grade 7 Mathematics design](https://drive.google.com/file/d/12Vb6W1_Vzn9BEH2MsM2WmUwWL5OKoucK/preview). The accessible cross-check copy used for exact heading transcription is [Grade 7 Mathematics Curriculum Designs 2024](https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-MATHEMATICS-2024-TEACHER.CO_.KE_.pdf).

## Grade 8 verified strand and sub-strand inventory

The revised Grade 8 design has the same five strands but the following exact sub-strands. In particular, the design labels Geometry 4.1 as **Geometrical Constructions**, not simply “Angles”; it then uses Coordinates and Graphs, Scale Drawing and Common Solids. Measurements has Circles, Area and Money.

| Strand | Sub-strands |
|---|---|
| **Numbers** | Integers; Fractions; Decimals; Squares and Square Roots; Rates, Ratio, Proportion and Percentages |
| **Algebra** | Algebraic Expressions; Linear Equations |
| **Measurements** | Circles; Area; Money |
| **Geometry** | Geometrical Constructions; Coordinates and Graphs; Scale Drawing; Common Solids |
| **Data Handling and Probability** | Data Presentation and Interpretation; Probability |

The Grade 8 primary index is [KICD Grade Eight Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/), whose Mathematics iframe points to the official Drive preview [Grade 8 Mathematics design](https://drive.google.com/file/d/1ttNvzuQbHUnABVcP-TAoix8-TVmehYph/preview). The accessible cross-check copy used for exact heading transcription is [Grade 8 Mathematics Curriculum Designs 2024](https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-8-CURRICULUM-DESIGNS-MATHEMATICS2024-TEACHER.CO_.KE_.pdf).

## Grade 9 verified strand and sub-strand inventory

The Grade 9 design summary table provides five strands and twelve sub-strands. These are materially different from the generic/representative Grade 9 data currently present in parts of the repository; the official-linked design does **not** support adding advanced statistics, normal distribution, regression, differentiation, or “rates of change” headings to this audit inventory.

| Strand | Sub-strands |
|---|---|
| **Numbers** | Integers; Cubes and Cube Roots; Indices and Logarithms; Compound Proportions and Rates of Work |
| **Algebra** | Matrices; Equation of a Straight Line; Linear Inequalities |
| **Measurements** | Area; Volume of Solids; Mass, Volume, Weight, and Density; Time, Distance, and Speed; Money; Approximations and Errors |
| **Geometry** | Coordinates and Graphs; Scale Drawing; Similarity and Enlargement; Trigonometry |
| **Data Handling and Probability** | Data Interpretation (Grouped Data); Probability |

The Grade 9 primary index is [KICD Grade Nine Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/), whose Mathematics iframe points to the official Drive preview [Grade 9 Mathematics design](https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview). The accessible cross-check copy used for exact heading transcription is [Mathematics Grade 9 July 2024 revised design](https://www.teacherspalace.co.ke/uploads/documents/mathematics-grade-9-july-2024-revised-unlocked-min-2024-12-02-wfeyWLXyFY.pdf).

## Current KJSEA Mathematics paper format

### Primary official evidence

The [KNEC KJSEA Regulations](https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf), Table 1, describes Mathematics code **903** as:

- **Administered in one paper** consisting of two sections;
- **Total: 100 marks**;
- **Section A:** 20 multiple-choice questions, 20 marks;
- **Section B:** structured questions and essay questions, 80 marks;
- **Duration:** 2 hours.

The [revised 2025 KJSEA timetable](https://www.knec.ac.ke/wp-content/uploads/2025/06/2025-KJSEA-TIMETABLE-Revised-1.pdf) independently lists **903 Mathematics, 8:30–10:30, 2 hours**. It separately lists Mathematics Braille at 2 hours 30 minutes; that is an accessibility-format duration and should not replace the standard sighted-candidate duration.

The [KNEC sample-paper/rubric/OMR circular](https://www.knec.ac.ke/wp-content/uploads/2025/06/CIRCULAR-ON-ACCESSING-KJSEA-SAMPLE-PAPER-8.pdf) says that KJSEA samples, rubrics and OMR materials were made available through the Grade 9 portal and that the reviewed 2025 OMR requires candidates to shade responses. This supports an answer-sheet/shading workflow for objective responses, but it does not establish additional Mathematics sections or a practical paper.

### Findings by requested dimension

| Dimension | Verified finding | Evidence status |
|---|---|---|
| Paper count | **One paper only: 903**. There is no official Mathematics Paper 1/Paper 2 split in the current KNEC regulation. | Direct KNEC regulation; independently consistent with timetable. |
| Sections | **Two sections**. Section A is objective; Section B is constructed response. | Direct KNEC regulation. |
| Objective component | **20 MCQs, 20 marks**. | Direct KNEC regulation. |
| Structured component | Section B includes **structured questions**, within the aggregate 80 marks. | Direct KNEC regulation. |
| Essay component | Section B also includes **essay questions**, within the aggregate 80 marks. | Direct KNEC regulation. |
| Practical component | **No separate Mathematics practical component or practical paper is specified**. | Direct KNEC regulation; no practical Mathematics paper appears in the timetable. Do not infer practical marks from Agriculture, Integrated Science or Pre-Technical formats. |
| Marks | **100 total: 20 + 80**. | Direct KNEC regulation. |
| Duration | **2 hours** for standard 903 Mathematics; Braille timetable variant is 2 h 30 min. | KNEC regulation and 2025 timetable. |
| OMR | KNEC circular states that the reviewed 2025 OMR requires shading responses. This applies to objective-answer administration; Section B remains written response. | Direct KNEC circular. |
| Strand-level mark split | **Not specified in the inspected primary sources.** | Uncertain; do not present a generated split as official. |
| Question numbering / per-question marks | **Not established by the inspected primary sources.** | Uncertain until the official Mathematics sample paper and rubric are retrieved from the KNEC Grade 9 portal. |

## Repository and implementation inspection

### Existing research note

`research/kicd-mathematics.md` correctly recognized that the earlier KICD PDF endpoints were inaccessible and avoided inventing Grade 9 content. That note is no longer sufficient for the current audit because it leaves Grade 9 arrays empty, uses a less precise Grade 8 Geometry list, and does not record the current KICD iframe/Drive identifiers. Its Grade 7 list is broadly aligned with the accessible revised design, but the evidence statement should be updated from “KICD PDF returned 404” to the more precise status: **official KICD index and official-linked Drive preview identified; direct Drive download permission blocked; headings cross-checked against a Government-of-Kenya/KICD-labelled mirror copy**.

### Current paper-format code

`src/lib/kjsea-paper-formats.ts` has several correct high-level choices:

1. Mathematics is excluded from `TWO_PAPER_SUBJECTS`, so the subject is modeled as a single paper.
2. The Mathematics primary spec is code `903`, 100 marks, 120 minutes.
3. The generated blueprint starts with 20 one-mark multiple-choice questions and models an 80-mark Section B.
4. A dummy zero-mark `paper2` entry exists only to fit the shared type shape; it is not evidence that 903/2 exists.

However, the implementation has material evidence risks:

- The code hard-codes a granular allocation of **Numbers 40, Algebra and inequalities 15, Measurement 30, Geometry and construction 10, Data handling and probability 5**, with Section B question ranges Q21–Q40. The inspected KNEC regulations and timetable only establish Section A 20 marks and Section B 80 marks; they do not establish that strand split, those question numbers, or a five-mark ceiling per Section B question. This must be labeled as an unverified sample-derived blueprint or removed until the official Mathematics sample/rubric is available.
- `paperSections` treats every Section B item as `numeric_response`, while the official format explicitly includes **essay questions**. A numeric-response-only generator cannot faithfully represent the full official Section B type.
- `getKjseaPaperSpec(subject, 'paper1')` returns `null` for Mathematics because Mathematics is a one-paper subject represented by the `single` variant. This is internally consistent with the one-paper model but can break callers that mechanically request `paper1`; callers should use `single` for Mathematics or receive an explicit one-paper alias.
- The generic format instruction says the Paper 2 skeleton contains “project/practical/structured tasks.” That generic text is not appropriate for Mathematics and should not be shown for 903; Mathematics should explicitly say “one paper; Section A objective; Section B structured and essay.”
- The code’s `PAPER_DATA.mathematics.paper2` uses `903/2`, “Not applicable,” and zero marks. This may be useful as a type sentinel, but it must never appear in user-facing options, validation, URLs, or generated headers.
- The code has no verified Mathematics-specific sample-paper source URL in `SAMPLE_SOURCE_URLS`; the official KNEC circular says samples are accessed through the authenticated Grade 9 portal. Until that sample is retrieved, only the regulation-level format should be considered authoritative.

### Current curriculum data risks

`src/lib/kicd-knowledge.ts` contains a representative, non-grade-specific Mathematics pack with a combined **“Geometry and Measurement”** strand and broad sub-strands such as “Fractions, Decimals and Percentages.” That is not an adequate Grade 7/8/9 source of truth because the current designs separate Measurements and Geometry and use grade-specific names.

`supabase/migrations/20260725_populate_curriculum_data.sql` contains Grade 9 Mathematics descriptions such as “Rates of Change,” “Statistical Analysis,” “Advanced Probability,” and “Data Analysis.” Those descriptions do not match the current Grade 9 design summary transcribed above. They should be quarantined, corrected, or marked unapproved rather than exposed as verified KICD curriculum metadata.

The repository’s older Grade 7–8 seed migration appears to contain verified lower-grade Mathematics data, but it does not supply the audited Grade 7–9 hierarchy needed here. Do not infer Junior Secondary sub-strands from those primary-grade records.

## Implementation risks and recommended controls

1. **Provenance risk:** Mirror PDFs are useful for transcription but are not the official host. Store the KICD index URL, official Drive preview URL, mirror URL, retrieval date and verification status for every grade.
2. **Grade mixing risk:** Keep Grade 7, Grade 8 and Grade 9 curriculum nodes separate. Do not use a single representative Mathematics pack for all Junior Secondary grades.
3. **Name-normalization risk:** Preserve exact labels, including “Equation of a Straight Line,” “Mass, Volume, Weight, and Density,” “Data Interpretation (Grouped Data),” and “Rates, Ratio, Proportion and Percentages.”
4. **Unsupported assessment blueprint risk:** Treat the official 20/80 split as verified, but treat any strand-level weighting, Q21–40 mapping, and per-item marks as unverified until the official Mathematics sample and rubric are retrieved.
5. **Response-type risk:** Ensure Section B can generate both structured mathematical work and essay-style/explanatory responses where required; do not force every item into `numeric_response`.
6. **False Paper 2 risk:** Hide `903/2` from all user-facing selectors and reject it in paper-generation requests. Mathematics should be represented as one paper, code 903.
7. **Accessibility risk:** Keep standard 903 duration at 120 minutes and model the Braille duration separately at 150 minutes; do not overwrite the standard format.
8. **Stale-data risk:** Remove or quarantine unverified Grade 9 descriptions in the Supabase migration and replace them with the exact five-strand/twelve-sub-strand hierarchy above.
9. **Evidence-refresh risk:** Re-run the audit when the KICD Drive permissions or KNEC Grade 9 portal sample access changes. Record the official Mathematics sample-paper URL and rubric once accessible.
10. **OMR boundary risk:** Apply the KNEC shading convention only to Section A objective answers. Do not use OMR assumptions for Section B written responses.

## Exact source URLs

### Curriculum

- https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
- https://drive.google.com/file/d/12Vb6W1_Vzn9BEH2MsM2WmUwWL5OKoucK/preview
- https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-MATHEMATICS-2024-TEACHER.CO_.KE_.pdf
- https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
- https://drive.google.com/file/d/1ttNvzuQbHUnABVcP-TAoix8-TVmehYph/preview
- https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-8-CURRICULUM-DESIGNS-MATHEMATICS2024-TEACHER.CO_.KE_.pdf
- https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/
- https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview
- https://www.teacherspalace.co.ke/uploads/documents/mathematics-grade-9-july-2024-revised-unlocked-min-2024-12-02-wfeyWLXyFY.pdf

### Assessment and paper format

- https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf
- https://www.knec.ac.ke/wp-content/uploads/2025/06/2025-KJSEA-TIMETABLE-Revised-1.pdf
- https://www.knec.ac.ke/wp-content/uploads/2025/06/CIRCULAR-ON-ACCESSING-KJSEA-SAMPLE-PAPER-8.pdf

## Audit status

**Status: completed with explicit source-access caveats.** Grade 7, Grade 8 and Grade 9 strand/sub-strand arrays are populated from the current KICD-linked design set as cross-checked against accessible design copies. The KJSEA Mathematics one-paper format is confirmed by two independent KNEC primary documents. The exact official Mathematics sample-paper question numbering, strand weighting and rubric details remain **unverified** because KNEC directs access through the authenticated Grade 9 portal and no public Mathematics sample file was retrieved in this audit.

## Repository path

`/home/ubuntu/Zamifu_analytics-/research/curriculum-audit-mathematics.md`

---

*This report audits Mathematics only. It does not make findings about any other CBC learning area.*
