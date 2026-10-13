As of **14 October 2026**, Grade 7 is part of Kenya’s three-year lower-secondary/middle-school CBE cycle (Grades 7–9). The governing distinction is: **KICD curriculum designs describe what is taught; KNEC circulars and portal tools describe how school-based assessment is administered.** KNEC’s published 2026 Grade 7 documents do **not** define national Paper 1/Paper 2 papers, paper codes, national mark totals, or national durations for Grade 7. They define school-based written tests and separate projects/performance tasks instead. [1] [2] [3]

## KICD curriculum content

The official KICD Grade Seven Designs page exposes design files for **Agriculture, Arabic, Creative Arts, CRE, English, French, German, HRE, Indigenous Language, Integrated Science, IRE, Kiswahili, Mandarin, Mathematics, Pre-Technical Studies, and Social Studies**. This is a curriculum-design catalogue, not a KNEC exam timetable or paper-format specification. [1]

The Grade 7 Social Studies design is a KICD curriculum document with strands on Social Studies, natural and built environments in Africa, people and population, resources/economic activities, political development/governance, and a Community Service Learning project. It includes map-related learning outcomes and activities, such as locating densely/sparsely populated areas on a map of Africa, drawing maps of Africa and East Africa, and locating selected African communities. These are **curriculum learning activities and rubric indicators**, not evidence of a compulsory national Grade 7 map question or a prescribed map insert. [10] The KICD design also encourages varied assessment tools and provides rubrics linked to sub-strands. [10]

## KNEC Grade 7 assessment actually specified for 2026

The current KNEC written-test schedule lists these Grade 7/8 SBA learning areas: **Mathematics; English; Kiswahili; Kenyan Sign Language; Social Studies; CRE/IRE/HRE; Integrated Science; Agriculture; Creative Arts and Sports; and Pre-Technical Studies.** The 2026 circular gives portal access from **28 September 2026** and a last score-upload date of **23 October 2026**. It calls these **written tests** and does not number them Paper 1 or Paper 2. [2]

The current KNEC projects/performance circular lists Grade 7 projects/performance tasks only for **Agriculture, Creative Arts and Sports, and Integrated Science**. Tools were to be accessed from **4 May 2026** and scores uploaded by **31 July 2026**. The circular requires subject teachers to assess and score using the portal guidance, schools to upload all learner scores, and heads of institution to retain records and evidence. It calls these projects/performance tasks; it does not publish a timed practical-paper duration or a mark allocation. [3]

Therefore, for Grade 7 **Agriculture, Creative Arts and Sports, and Integrated Science**, the correct model is two different assessment modes—(a) a KNEC SBA written test in the September/October window and (b) a KNEC project/performance task in the May/July upload window—not a national Paper 1/Paper 2 examination. The other listed learning areas have the published 2026 written-test listing only; no project/performance component is stated in the 2026 Grade 7 project circular. [2] [3]

## Marks, durations, components, maps, and practicals

No public KNEC 2026 Grade 7/8 schedule or circular located for this audit states a Grade 7 written-test total, per-section marks, item counts, paper duration, paper code, or Paper 1/Paper 2 structure. The CBA portal’s tool, instructions, scoring guide, and rubric are the controlling artifacts, and the 2026 circular says those materials are accessed through the portal. Treat Grade 7 marks, timing, components, and scoring criteria as **portal-controlled/unknown until the actual Grade 7 tool is downloaded**. Do not substitute Grade 9 KJSEA metadata. [2] [3]

The published Grade 7 project circular does not call any Grade 7 component a national “practical paper.” It uses **projects and performance tasks**, with an access/upload window rather than minutes. A generator should therefore represent the May–July item as a windowed project/performance assessment, not as a timed Paper 2. [3]

There is no KNEC-published Grade 7 rule in the reviewed 2026 documents requiring a map in a national paper, requiring a particular map, or prescribing a map-based question number. Maps of Africa/East Africa belong in curriculum-aligned Social Studies learning tasks where the KICD design calls for them; they must not be exposed as a mandatory national paper fixture. [2] [3] [10]

## School-based assessment guidance

KNEC’s Competency Based Assessment Framework says assessment tools are aligned to KICD curriculum designs and may include observation schedules, checklists, rating scales, questionnaires, projects, journals, oral/aural tasks, learner profiles, anecdotal records, written tests, rubrics, and portfolios. Teachers select tools that gather evidence of expected learning outcomes and cross-curricular competencies. Written tests are only one tool in the CBA system. [5]

The 2026 KNEC instructions require schools to administer tools, score outcomes, upload scores on the CBA portal, retain records/evidence, and use the portal’s instructions and scoring guides. The project circular says materials should come from the immediate school environment or be improvised where possible. The 2024 Grade 7/8 circular also documents PDF and digital tool delivery, colour printing/loading for colour images, separate learner response materials, and retention of assessment evidence; use these as delivery conventions, not as a paper-structure mandate. [3] [4]

Assessment must support differentiated access. KNEC’s framework permits accessible formats, flexible timing, breaks, multiple sessions/days, assistive technology, interpreters, and performance responses where appropriate for learners with special needs. [5]

## Scope guardrails for the generator

The supplied `src/lib/kjsea-paper-formats.ts` is explicitly Grade 9 KJSEA metadata. Its Paper 1/Paper 2 structures, marks, durations, map convention, and project windows must not be reused for Grade 7. Current KNEC KJSEA Regulations are a Grade 9 instrument: they define 12 Grade 9 subjects and 19 Grade 9 papers, including subject-specific papers, marks, durations, practical-skills writing, and projects. Those rules are not Grade 7 rules. [6]

Grade 10 is also not a legacy KCSE paper-format continuation. KNEC’s 2026 senior-school rollout says Grade 10 SBA consists of projects, practicals, and written tests; the Grade 10 written-test circular likewise provides a portal schedule without a KCSE-style national Paper 1/Paper 2 blueprint. The rollout says the senior-school summative assessment is piloted in 2027 when the pioneer cohort reaches Grade 11, with Grade 10 SBA 15%, Grade 11 SBA 15%, and Grade 12 summative assessment 70%. Do not impose KCSE formats on Grade 10 or infer them for Grade 7. [7] [8] [9]

## Material unknowns

- The public 2026 Grade 7 circulars do not disclose written-test marks, durations, question counts, section/component splits, paper codes, or rubrics.
- The public project circular does not disclose Grade 7 project marks, criterion weights, or a fixed task duration; only portal access and score-upload dates are published.
- The reviewed public material does not state whether every Grade 7 school offers every KICD-listed optional language/design, or which optional areas receive a 2026 KNEC portal tool.
- The live CBA portal tool and scoring guide are required to finalize per-subject marks, timings, response modes, and project criteria; they were not accessed for this audit.
- No current official Grade 7 national map requirement was found. Curriculum map activities are not a national paper specification.

## Concrete implementation recommendations

1. Add a separate `grade7` SBA registry. Do not route Grade 7 through `getKjseaPaperSpec`, `subjectHasTwoPapers`, or the KJSEA blueprint builder.
2. Model `assessment_mode` as `written_test` or `project_performance`, with `paper_variant: none` for Grade 7 unless a future official KNEC tool explicitly supplies a paper variant.
3. Seed the 2026 operational windows as metadata: written-test portal window **2026-09-28 to 2026-10-23**; project/performance portal access **2026-05-04**, score-upload deadline **2026-07-31**. Store access and upload deadlines separately from learner task duration.
4. Include project/performance mode for Agriculture, Creative Arts and Sports, and Integrated Science; include written-test mode for the ten learning-area entries in the September 2026 circular. Keep the KICD design catalogue separate from the KNEC 2026 tool catalogue.
5. Leave marks, durations, item counts, components, rubrics, and paper codes nullable/portal-sourced. Block generation of a claimed official format until the actual portal tool or a new KNEC circular supplies the value.
6. For Social Studies, allow curriculum-aligned map stimuli (especially Africa/East Africa) only when the selected KICD learning outcome calls for them. Do not force a map question, map number, or national map insert.
7. Store evidence requirements and delivery options: teacher scoring guide/rubric, school upload, retained records/evidence, PDF/digital delivery, colour-image handling, local/improvised materials, and differentiated-access accommodations.

## References

[1]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/ "KICD Grade Seven Designs"
[2]: https://www.knec.ac.ke/wp-content/uploads/2026/08/Guidelines-and-schedule-of-Sep-2026-Grade-3-4-578-SBA.pdf "KNEC Guidelines and Schedule for the 2026 Grade 3, 4, 5, 7 and 8 SBA Written Tests and Performance Tasks"
[3]: https://www.knec.ac.ke/wp-content/uploads/2026/04/Guidelines-and-schedule-for-Grades-378-and-SNE-Projects.pdf "KNEC Guidelines and Schedule for 2026 Grades 3, 7, 8 and Stage-Based Projects and Performance Tasks"
[4]: https://www.knec.ac.ke/wp-content/uploads/2024/03/Grade-7-and-8-SBAs.pdf "KNEC Administration of the Year 2024 Grade 7, Grade 8 and Prevocational Level School Based Assessment"
[5]: https://www.knec.ac.ke/wp-content/uploads/2021/06/CBA-Age-Based-Regular-Framework.pdf "KNEC Competency Based Assessment Framework"
[6]: https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf "KNEC KJSEA Regulations"
[7]: https://www.knec.ac.ke/wp-content/uploads/2026/08/Guidelines-and-Schedule-for-Grade-10-Written-tests-2026.pdf "KNEC Guidelines and Schedule for the 2026 Grade 10 SBA Written Tests"
[8]: https://www.knec.ac.ke/wp-content/uploads/2026/05/ROLL-OUT-OF-COMPETECNCY-BASED-ASSESSMENTS-IN-SENIOR-SCHOOL.pdf "KNEC Roll-Out of Competency Based Assessments in Senior School"
[9]: https://www.knec.ac.ke/wp-content/uploads/2026/06/Schedule-Instructions-for-2026-Grade-10-Vocational-SBAs.pdf "KNEC Schedule and Instructions for 2026 Grade 10 and Vocational SBA Projects and Practicals"
[10]: https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-SOCIAL-STUDIES-2024-TEACHER.CO_.KE_.pdf "Grade 7 Social Studies Curriculum Design copy of the KICD design (secondary access copy)"
