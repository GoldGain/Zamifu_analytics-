# Kenyan CBE Grade 6 curriculum and assessment-format audit

**As-of date: 14 October 2026.** This audit separates **KICD curriculum content** from **KNEC national assessment format**. It does not reuse Grade 9 KJSEA metadata as a Grade 6 proxy, and it does not establish national formats for Grades 7, 8, or 10.

## 1. Curriculum scope versus the national paper

KICD’s official Grade 6 design index lists these curriculum-design categories: **Agriculture, Arabic, Creative Arts, CRE, English, French, German, HRE, Indigenous Language, IRE, Kiswahili, Mandarin, Mathematics, Science & Technology, and Social Studies** [1]. This is a curriculum-design/index list, including language and religious-education options; it is not itself a national paper-entry list.

KNEC’s current KPSEA regulations list the national assessment subjects as English, Kiswahili, Kenyan Sign Language, Mathematics, Science & Technology, Social Studies, Agriculture & Nutrition, Creative Arts, and Religious Education (CRE, IRE, or HRE) [2]. KNEC groups those into **six national papers**: English Language; Mathematics; Kiswahili Lugha; KSL for candidates with hearing impairment; Integrated Science (Science & Technology plus Agriculture & Nutrition); and Creative Arts & Social Studies (Creative Arts, Social Studies, and the registered Religious Education option) [2]. Therefore, Zamifu should maintain two distinct concepts:

- **Curriculum subject/design:** the KICD learning area or option from which content is selected.
- **KPSEA paper group:** the KNEC paper in which one or more curriculum subjects are assessed.

The 2025 KNEC user guide says KPSEA covers work from Grades 4, 5, and 6, is administered at the end of Grade 6, and uses multiple-choice questions with personalised OMR forms for the age-based pathway [4].

## 2. Official KPSEA format (current regulations and 2026 timetable)

KNEC’s current regulations prescribe **one paper per paper group**. They do not prescribe a Paper 1/Paper 2 split for Grade 6. The 2026 timetable schedules the regular papers on 26–28 October 2026 [3].

- **English Language:** one paper; **30 multiple-choice questions**; **1 hour** for regular candidates. The regulations state 1 hour 20 minutes for candidates with hearing impairment and Braille; the 2026 timetable gives 1 hour for large print, 1 hour 20 minutes for hearing impaired, and 1 hour 20 minutes for Braille [2] [3].
- **Mathematics:** one paper; **30 multiple-choice questions**; **1 hour 20 minutes** regular; Braille **1 hour 50 minutes**. The 2026 timetable gives the same duration for large print [2] [3].
- **Kiswahili Lugha:** one paper; **30 multiple-choice questions**; **1 hour** regular; Braille **1 hour 20 minutes**. The 2026 timetable gives 1 hour for large print [2] [3].
- **Kenyan Sign Language:** one paper; **30 multiple-choice questions**; **1 hour**. The timetable places it in the Kiswahili session for the relevant candidates [2] [3].
- **Integrated Science:** one paper; **50 multiple-choice questions**, explicitly split into **25 Science & Technology and 25 Agriculture & Nutrition**; **1 hour 40 minutes** regular; Braille **2 hours 10 minutes**. The 2026 timetable gives 1 hour 40 minutes for large print [2] [3].
- **Creative Arts & Social Studies:** one paper; **50 multiple-choice questions** in three parts; **1 hour 40 minutes** regular; Braille **2 hours 10 minutes**. Part I, Creative Arts, has **30 questions**; Part II, Social Studies, has **10 questions**; Part III is Religious Education, with separate CRE, IRE, and HRE sections of **10 questions each**. A candidate answers only the registered Religious Education option [2]. The 2026 timetable gives 1 hour 40 minutes for large print [3].

**Marks caveat:** the current regulations explicitly state question counts and durations, but do **not** separately state a paper mark total or a per-item mark value. A generator may store the official `item_count` (30 or 50) and, only if its product schema requires it, expose a clearly labelled **derived one-point-per-MCQ score** as provisional. Do not present “30 marks,” “50 marks,” or any strand-level mark split as an explicit KNEC rule until the current question-paper/marking guidance confirms it. The 2023 KNEC report corroborates the 30-item English and Kiswahili design and describes KPSEA as MCQ-based, but it also does not establish a different mark allocation [7].

## 3. Projects, practicals, and school-based assessment

The KNEC user guide distinguishes School Based Assessment (SBA) from the Grade 6 national summative assessment. KNEC develops SBA tools and uploads them to the CBA portal; a school may administer them on paper or through e-assessment, teachers score and upload results, evidence is maintained in assessment records, and results are reported through the School Year Report. The guide states that all learners undertake SBA at each grade and that SBAs contribute to reporting on KPSEA/KJSEA [4].

The CBA framework supports varied classroom evidence: observation schedules, checklists, rating scales, questionnaires, projects, journals, oral and aural tasks, learner profiles, anecdotal records, written tests, rubrics, and portfolios [5]. It describes projects as time-bounded activities with a stated purpose and objectives, but it does not create a national Grade 6 paper duration or mark allocation for a Zamifu school test [5].

The official 2026 project/practical schedule found on KNEC’s site is explicitly for **Grade 4 and Grade 5**. It gives access on **2 March 2026** and a last score-upload date of **29 May 2026** for Science & Technology, Creative Arts & Sports, and Agriculture [6]. It does **not** publish a Grade 6 project/practical window. The official 2026 KPSEA timetable contains only the six written MCQ paper groups on 26–28 October 2026 [3]. The safe national default is therefore:

- No separate Grade 6 KPSEA practical paper.
- No separate Grade 6 KPSEA project paper.
- No national Grade 6 project window, project duration, or project mark allocation should be invented from the Grade 4–5 schedule.
- Schools may still run classroom/SBA projects or practical tasks under KNEC guidance and their school calendar; those must be labelled **school-based**, not KPSEA.

The 2023 KPSEA report likewise describes classroom assessment from Grade 4, KNEC-standardised SBA at Grades 4 and 5, and Grade 6 KPSEA as the end-of-upper-primary summative assessment [7].

## 4. Maps and Social Studies stimuli

The current KPSEA regulations do **not** require a map, identify a map type, prescribe a map count, or reserve a map question number. The Social Studies component is only 10 MCQs inside the combined Creative Arts & Social Studies paper [2]. The 2023 report recommends that teachers use diagrams to illustrate relief features, but that is a teaching/remediation recommendation, not a national paper-format mandate [7].

Implementation should therefore treat maps as **curriculum-aligned optional stimuli**, not as a fixed Grade 6 national-paper component. When a generated Social Studies item genuinely tests spatial understanding, use an original, legible sketch/map with a meaningful title and only the legend, direction, scale, labels, or other conventions needed by that item. Do not carry over the Grade 9 KJSEA source’s “complete map question” or fixed map position into Grade 6.

## 5. Concrete implementation recommendations

1. Add a Grade 6 `KPSEA` format family with exactly six **single-paper** variants: English, Mathematics, Kiswahili, KSL, Integrated Science, and Creative Arts & Social Studies. Reject `paper1`/`paper2` for KPSEA.
2. Store `item_count`, `duration_regular_minutes`, accessibility durations, and component metadata separately from `marks`. For current official evidence, use 30 or 50 objective items; keep paper marks nullable or explicitly derived/provisional.
3. Model Integrated Science as a national paper group containing Science & Technology plus Agriculture & Nutrition, with a 25/25 item split. Model Creative Arts & Social Studies as a national group containing Creative Arts (30), Social Studies (10), and one registered Religious Education section (10).
4. Include `registered_religious_education` validation (`CRE`, `IRE`, or `HRE`) and generate only that candidate’s 10-question section. Do not treat CRE, IRE, and HRE as three simultaneously answered national sections.
5. Keep curriculum content selectors sourced from the KICD Grade 6 design list and keep paper-format selectors sourced from KNEC. Do not infer content coverage or paper marks from the existing Grade 9 `kjsea-paper-formats.ts` file.
6. Add explicit assessment modes such as `classroom`, `sba`, and `kpsea`. School-created written tests, projects, practicals, rubrics, and portfolios should carry local marks/durations and a “not a KNEC national paper” label.
7. Do not copy the 2026 Grade 4–5 project dates into Grade 6. Represent the Grade 6 national practical/project window as **not applicable/not published** unless a later KNEC circular supplies one.
8. Make map stimuli optional and item-driven. Do not require a map in every Social Studies paper, do not fix map numbering, and do not impose KJSEA map conventions.
9. Keep Grade 7/8/9/10 format families isolated. In particular, do not apply KJSEA or legacy KCSE Paper 1/Paper 2 assumptions to Grade 6 or to the first senior CBE cohort; a Grade 10 national split should remain an unresolved separate metadata question until a specific official KNEC senior-school instrument is verified.

## Material unknowns and safeguards

- **Paper marks:** official current KPSEA regulations provide item counts and durations, not an explicit marks-per-item rule or total paper marks. Treat any 30/50 maximum as derived until a current KNEC paper/rubric confirms it.
- **Grade 6 SBA dates:** the 2025 user guide requires SBA at each grade, but the retrieved 2026 practical/project schedule covers Grades 4 and 5 only. Exact 2026 Grade 6 SBA tool dates, if any, are not established by the sources above.
- **KICD content granularity:** the official KICD page identifies the Grade 6 design documents and subject options; this audit does not claim an exhaustive strand/sub-strand inventory. Use the embedded KICD design document for subject content rather than inferring it from KNEC paper groupings.
- **Other grades:** Grade 7/8/9/10 national formats are intentionally not generalized here. The supplied KJSEA source is Grade 9 metadata and is not evidence for Grade 6.

## References

[1]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/ "KICD Grade Six Designs"

[2]: https://www.knec.ac.ke/wp-content/uploads/2026/08/kpsea_regulations_2024.pdf "KNEC KPSEA Regulations"

[3]: https://www.knec.ac.ke/wp-content/uploads/2026/02/2026-KPSEA-TIMETABLE.pdf "2026 KPSEA Timetable, Instructions & Guidelines"

[4]: https://www.knec.ac.ke/wp-content/uploads/2026/02/KPSEA-KJSEA-USER-GUIDE-1.pdf "KNEC User Guide for Management and Administration of KPSEA and KJSEA, 2025 Edition"

[5]: https://www.knec.ac.ke/wp-content/uploads/2021/06/CBA-Age-Based-Regular-Framework.pdf "KNEC Competency Based Assessment Framework for the Age-Based Regular Pathway"

[6]: https://www.knec.ac.ke/wp-content/uploads/2026/02/SBA-Assessment-Schedule-2026-Grade-4-5-and-SNE-SBA-Practicals-and-projects.pdf "Guidelines and Schedule for the 2026 Grade 4 and 5 Projects and Practical Assessments"

[7]: https://nac.knec.ac.ke/wp-content/uploads/2024/03/KIPSEA-Report-2023.pdf "KNEC Kenya Primary School Education Assessment National Report 2023"
