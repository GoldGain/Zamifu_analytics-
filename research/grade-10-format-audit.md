# Grade 10 CBE format audit for Zamifu Exam Generator

**Cut-off:** 14 October 2026. **Scope:** Kenyan regular Grade 10 (the first senior-school CBE cohort), using only KICD curriculum sources and KNEC assessment guidance. This audit is about national evidence, not a proposal to reproduce KNEC assessment content.

## Bottom line

As of the cut-off, the official KNEC Grade 10 documents reviewed do **not** define a national Grade 10 examination with KCSE-style Paper 1/Paper 2 codes, fixed marks, fixed durations, or a public national timetable. They define **Grade 10 School Based Assessment (SBA)** tools: projects/practicals in term 2 and written tests in term 3. KNEC uploads the tools to the CBA Portal; principals download them; subject teachers administer, score, retain evidence, and upload learner scores. [3] [4]

Therefore Zamifu must not infer Grade 10 Paper 1/Paper 2 from legacy KCSE, KJSEA, or the existing Grade 9 metadata. The correct Grade 10 default is **no national paper split** and **no national mark/duration blueprint unless the school supplies an assessment tool or an official KNEC portal document that states one**.

The KNEC project/practical document states that Grade 10 SBA scores account for **15% of the learner's overall score at the end of Grade 12**. That is a weighting statement, not a Grade 10 question-paper mark allocation. [3]

## Authority boundary: curriculum versus assessment

KICD is the curriculum authority. Its Grade Ten index exposes curriculum-design families for **Applied Sciences, Arts & Sports, Foreign Languages, Humanities, Languages, Pure Sciences, Religious Education, and Technical Studies**. The index is a design catalogue; it does not publish a national Grade 10 paper skeleton or a Paper 1/Paper 2 rule. [1] KICD's Basic Education Curriculum Framework places senior school at Grades 10–12. [2]

KNEC is the assessment authority. The 2026 Grade 10 documents use the terms **SBA**, **written tests**, **projects**, and **practicals**, and route tools and score uploads through the CBA Portal. KNEC's public PDFs provide administration windows and governance, but not a public subject-by-subject national paper blueprint for Grade 10. [3] [4]

Keep these data types separate in the generator:

- **KICD curriculum metadata:** pathway/category, subject title, strands, learning outcomes, content and suggested learning experiences from the linked Grade 10 design.
- **KNEC assessment metadata:** SBA component type, official access/upload window, school administration workflow, scoring guide/rubric availability, and any marks or duration explicitly present in the released tool.
- **School assessment metadata:** the school's own test length, marks, sections, and coverage, clearly labelled as school-created rather than national KNEC format.

## Grade 10 subject inventory evidenced in 2026 KNEC documents

The 2026 written-test schedule groups the following Grade 10 SBA written-test tools. It lists **STEM:** Core Mathematics, Essential Mathematics, Chemistry, Physics, Biology, Computer Studies, Home Science, Agriculture, and Electricity. It lists **Social Sciences:** CRE, HRE, IRE, Business Studies, History & Citizenship, and Geography. It lists **Arts & Sports:** Sports & Recreation and Music & Dance. [4]

The 2026 projects/practicals schedule covers a broader set of Grade 10 and vocational-level tools. Its Grade 10-relevant groups include STEM subjects such as Core Mathematics, Biology, Physics, Chemistry, General Science, Computer Science, Home Science, Agriculture, Aviation, Building Construction, Electricity, Metalwork, Power Mechanics, Woodwork, Media Technology, and Marine & Fisheries Technology; Social Sciences/languages including English, Literature in English, Kiswahili, KSL, Sign Language, Arabic, French, German, Chinese Mandarin, Indigenous Language, and Community Service Learning; and Arts & Sports subjects including Music & Dance, Theatre & Film, Sports & Recreation, Fine Arts, and PE. The same PDF separately lists **vocational-level** categories; those must not be silently treated as ordinary Grade 10 academic subjects. [3]

There is a source-label discrepancy worth preserving rather than hiding: the written-test PDF says **Computer Studies**, while the projects/practicals PDF says **Computer Science** and also has an **ICT (sample tool)** line. Keep display labels as published and use a reviewable alias map only after checking the learner's registered subject. [3] [4]

KNEC's Grade 10 registration instructions impose combination constraints that the generator should validate: General Science excludes Biology, Physics, and Chemistry; a learner chooses only one of CRE/IRE/HRE; KSL is only for deaf learners and excludes Kiswahili/Fasihi ya Kiswahili; hearing learners cannot take KSL but may take Sign Language skills; learners taking two or three pure sciences must take Core Mathematics rather than Essential Mathematics; and Applied Sciences/Technical & Engineering, Social Sciences, and Arts & Sports combinations have the Core-versus-Essential Mathematics choices stated in the circular. [5]

## Assessment windows and components actually published by KNEC

### Projects and practicals

The official project/practical instruction is a **window**, not a timed paper. KNEC says the projects and practicals are administered in **term 2**; tools are accessed from **2 July 2026** and scores are uploaded by **31 October 2026**. Principals download tools, teachers assess performance with the provided scoring guides/rubrics, and schools retain evidence. Electronic portfolios may contain videos, photographs, or recordings; materials should come from the immediate school environment or be improvised where possible. [3]

The same instruction says ICT and PE are assessed at school level, with sample SBA tools supplied for guidance. Fine Arts scores are uploaded at the end of each term. These are component/workflow rules, not a universal Paper 2 or a universal mark split. [3]

### Written tests

The official written-test instruction is also an SBA workflow, not a national exam timetable. KNEC says the tools are accessed through the CBA Portal from **5 October 2026**, and schools upload scores by **23 October 2026**. Principals download the tools; subject teachers administer and score them; the CBA Portal provides instructions and scoring guides; colour-image tools should be printed in colour or loaded on available digital devices; and principals retain records/evidence. [4]

The public written-test PDF does **not** state a common mark total, duration, section split, item count, Paper 1/Paper 2 code, or answer-sheet convention for any listed Grade 10 subject. Subject-level values may exist inside the protected/downloaded assessment tools or their scoring guides, but they were not exposed in the public guidance reviewed here. Zamifu should treat those values as **unknown**, not fill them with 100 marks/90 minutes, 50-mark papers, KCSE codes, or KJSEA structures.

### Maps and supplied materials

No reviewed 2026 Grade 10 KNEC public guidance mandates a map, a named map sheet, a map question, or a fixed map-materials list. The KICD Grade Ten index confirms the Humanities curriculum-design family but does not prescribe a paper-material rule. [1] [3] [4] A Geography generator may use map work when the applicable KICD Geography strand or the released school/KNEC assessment tool calls for it, but a default Grade 10 national map requirement should be **off**.

For contrast only, the 2026 KJSEA timetable tells candidates to alert the supervisor if a question indicates that a map or other material should have been provided. That is a Grade 9 examination-administration instruction, not evidence of a Grade 10 map mandate. [7]

## Grade 9 contrast: do not apply it to Grade 10

The current KNEC KJSEA Regulations explicitly define KJSEA as a junior-school assessment, list 12 Grade 9 subjects, and specify 19 papers. They give the detailed formats already represented in the declared input file: English and Kiswahili each have two 50-mark papers (100 and 105 minutes); Mathematics is one 100-mark, 120-minute paper; KSL has two papers of 60 and 40 marks, each 100 minutes; Integrated Science has a 70-mark, 100-minute Paper 1 and a 30-mark, 60-minute written practical-skills Paper 2; Agriculture has a 70-mark, 100-minute Paper 1 and a 30-mark practical Paper 2; Creative Arts & Sports has a 100-mark three-month project and a 100-mark, 100-minute written paper; Pre-technical Studies has an 80-mark, 100-minute Paper 1 and a 40-mark one-month project; and Social Studies, CRE, IRE, and HRE are single 100-mark papers of 90 minutes. [6] [7]

Those are valid **KJSEA Grade 9** metadata only. They must not be copied into Grade 10, and the KJSEA project windows (including Grade 9's one-month Agriculture/Pre-Technical and three-month Creative Arts & Sports entries) must not be used as Grade 10 windows. [6] [7]

## Concrete implementation recommendations

1. Add a separate `grade10-cbe-sba` regime. Its default paper variant should be `single_sba_tool`, `project_practical_window`, or `school_assessment`, never `paper1`/`paper2`.
2. Store KNEC windows as dates and windows, not minutes: projects/practicals `2026-07-02` to `2026-10-31`; written-test tools `2026-10-05` to `2026-10-23`. Keep term labels (`term2`, `term3`) and the 15% end-of-Grade-12 weighting separately from marks. [3] [4]
3. Require an explicit source field on every Grade 10 marks/duration/component value. Accept a value only when it comes from the released KNEC tool/scoring guide or a school-authored blueprint; otherwise render **“not nationally specified”**.
4. Make subject eligibility/configuration registration-aware. Enforce the General Science/pure-science, one-religious-subject, KSL, and Mathematics-choice constraints from the KNEC circular. [5]
5. Keep a versioned KJSEA adapter for Grade 9. Do not let a generic “CBE” or “two papers” flag leak KJSEA data into Grade 10. [6] [7]
6. Add a `map_requirement` field with values such as `none_published`, `tool_required`, or `school_required`. Default Grade 10 to `none_published`; use `tool_required` only when the released assessment tool says so.
7. Label generated Grade 10 materials as **school practice/SBA preparation** unless the user has supplied the official KNEC tool and has authority to use it. Do not reproduce KNEC question wording, answers, or scoring text.
8. Preserve public-source unknowns in the UI and logs: no national Grade 10 Paper 1/Paper 2 split, no public common marks/durations, no public map mandate, and no public subject-level item blueprint were found in the reviewed documents as of the cut-off.

## Material unknowns

- KNEC's 2026 public guidance does not expose the mark totals, durations, section structures, item counts, or paper codes inside the downloadable Grade 10 SBA tools. Portal-accessible tools and scoring guides may resolve these values.
- The reviewed sources do not establish a national Grade 10 end-of-cycle examination format for Grades 11/12 or a future senior-school certificate. Do not project KCSE structures forward.
- The project/practical PDF combines Grade 10 and vocational-level listings; the registration record must determine whether a subject is a Grade 10 academic subject or vocational-level subject.
- The written-test PDF's Computer Studies label and the project/practical PDF's Computer Science/ICT labels need an official subject-code crosswalk before being collapsed into one generator key.
- No Grade 10 national map-material requirement was published in the reviewed public documents. Geography map work remains curriculum/content-driven or tool-driven.

## References

[1]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-ten/ "KICD Grade Ten curriculum-design index"

[2]: https://kicd.ac.ke/wp-content/uploads/2017/10/CURRICULUMFRAMEWORK.pdf "KICD Basic Education Curriculum Framework"

[3]: https://www.knec.ac.ke/wp-content/uploads/2026/06/Schedule-Instructions-for-2026-Grade-10-Vocational-SBAs.pdf "KNEC Schedule and Instructions for 2026 Grade 10 and Vocational SBA Projects and Practicals"

[4]: https://www.knec.ac.ke/wp-content/uploads/2026/08/Guidelines-and-Schedule-for-Grade-10-Written-tests-2026.pdf "KNEC Guidelines and Schedule for the 2026 Grade 10 SBA Written Tests"

[5]: https://www.knec.ac.ke/wp-content/uploads/2026/07/Instructions-on-registration-of-subjects-for-Grade-10-learners-2026.pdf "KNEC Instructions on Registration of Subjects for Grade 10 Learners 2026"

[6]: https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf "KNEC 2026 KJSEA Regulations"

[7]: https://www.knec.ac.ke/wp-content/uploads/2026/02/2026-KJSEA-TIMETABLE.pdf "KNEC Revised 2026 KJSEA Timetable and Instructions"
