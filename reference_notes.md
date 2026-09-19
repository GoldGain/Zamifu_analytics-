# ExamWise reference audit — 2026-09-19

## Access
- Reference: https://www.examwise.co.ke/
- Authenticated teacher dashboard reached at `/app/question-predictor`.
- Dashboard shows `0/18 papers this month` before generation.

## Landing-page claims
- KICD Rationalized Curriculum Designs, Grade 7–9.
- Separate learner/student copy and teacher marking scheme PDFs.
- KJSEA-ready: Section A (20 MCQs) + Section B structured questions.

## Live generator UI
- School name input, Term 1/2/3, Academic Year 2025–2029.
- Grade Level: Grade 7, Grade 8, Grade 9.
- Learning areas: Mathematics, English, Kiswahili, Integrated Science, Integrated Science – Paper 2 (Dry Practical), Social Studies, Agriculture & Nutrition, Creative Arts & Sports, Pre-Technical Studies, CRE, IRE, HRE.
- Paper formats shown: `50 Marks` and `100 Marks (KJSEA)`.
- 50-mark helper text: `Section A (20 MCQs) + Section B (Structured Questions)`.
- Strand selector and optional free-text sub-strand/focus topic.
- Generate button and live paper preview panel.

## Important discrepancy
- The supplied implementation brief asks for a `30-mark Standard Assessment`, but the authenticated reference site currently exposes `50 Marks` as its standard option. Do not silently claim the reference uses 30 marks. Implement the user's requested 30-mark option in Zamifu while matching the common ExamWise layout and preserving an explicit, configurable 50-mark reference-compatible structure only if the existing product needs it.

## Evidence paths
- Initial landing screenshot: `/home/ubuntu/screenshots/examwise_co_ke_2026-09-19_12-29-55_4284.webp`
- Login screenshot: `/home/ubuntu/screenshots/examwise_co_ke_2026-09-19_12-30-04_8372.webp`
- Authenticated generator screenshot: `/home/ubuntu/screenshots/examwise_co_ke_2026-09-19_12-30-40_2117.webp`
- Generating preview screenshot: `/home/ubuntu/screenshots/examwise_co_ke_2026-09-19_12-30-53_4286.webp`

## Next capture
- Wait for first generation to complete; inspect preview, student-copy PDF control, marking-scheme PDF control, question numbering, mark labels, diagrams, and page/layout details.
- Generate a 100-mark KJSEA paper after first sample completes.

## Zamifu live pre-change audit
- Public landing page: https://zamifu.company/
- Login page: https://zamifu.company/auth/login
- Public landing page did not expose the Exam Generator; it is behind role-based portal access.
- Source audit found only `/teacher/exam-generator` before changes; no `/school-admin/exam-generator` route was present.
- Existing generator UI has total marks options including 30 and 100, but format presets are generic CBE/KPSEA/KJSEA/custom; KJSEA blueprint currently allocates case-study questions only and does not model 20 MCQs + structured 80 marks.
- Existing PDF renderer already supports student paper, marking scheme, answer key, A4 jsPDF, structured visual specs, and review/approval gating.


## Live Zamifu school-admin pre-change evidence
- Login succeeded with the provided school-admin test account and reached `https://zamifu.company/school-admin`.
- Authenticated school: KITHONI JUNIOR SCHOOL; dashboard identifies the role as school admin.
- Sidebar contained Dashboard, learners, grades, learning areas, assessments, and other admin tools, but no Exam Generator link.
- The source and live route audit both indicate that `/school-admin/exam-generator` is not currently exposed.


## Supabase curriculum audit
- Zamifu's active Supabase project is `naihzzlszvrkxrxogsuz` (CBC system); Kimatu projects were not touched.
- Grade-specific curriculum tables exist for Grades 7, 8, and 9 across the main Junior School subjects. The database contains subject, strand, sub-strand, topic, and learning-objective relationships.
- Approved `exam_knowledge_chunks` exist with source names such as `KICD Grade 7 Curriculum Design`, `KICD Grade 8 Curriculum Design`, and `KICD Grade 9 Curriculum Design`.
- The database contains duplicate legacy/generic rows alongside rows labelled `Official KICD ... revised-design strand`; current UI already prefers source-verified rows only when such descriptions exist.
- The database currently exposes `Religious Education` rather than separate CRE and IRE subject records; separate IRE support therefore requires verified source data or must remain explicitly unavailable rather than being invented.
- The database's Mathematics and Integrated Science tables provide grade-specific sub-strands, topics, and in some cases learning objectives, making them suitable for the generator's live curriculum context.


## Stage-one production verification
- Commit `bb60f74` deployed to Vercel production as `READY` for `zamifu.company`.
- The live authenticated sidebar now contains `Exam Generator` at `/school-admin/exam-generator`, confirming the new school-admin route and menu entry are deployed.
- Initial route load showed the authenticated shell and a loading spinner while Grade 7–9 curriculum data was being fetched; a second page read is needed before generation controls can be evaluated.
- Live Grade 7 selector shows only Grade 7, Grade 8, and Grade 9.
- Live Grade 7 subject selector shows the nine verified junior learning areas: Agriculture and Nutrition, Creative Arts and Sports, English, Integrated Science, Kiswahili, Mathematics, Pre-Technical Studies, Religious Education, and Social Studies.
- Selecting Mathematics reached the curriculum-loading state successfully; the next live read will verify strand rows and format controls.
- Live Grade 7 Mathematics loads source-filtered strands: Numbers, Algebra, Measurements, Geometry, and Data Handling and Probability; sub-strands remain available through the dependency chain.
- Live Standard preset displays `10 MCQs (1 mark each) + 4 structured questions (5 marks each)` and starts at 30 marks / 45 minutes.
- Switching live format to `KJSEA-style · 100 marks` changes the description to `20 MCQs (1 mark each) + 8 structured questions (10 marks each)` and the controls show 100 marks / 150 minutes.


## Final live generation smoke test
- Final production commit `cf6ee10` responds through the new deployment and custom domain.
- Authenticated Grade 7 Mathematics form loaded the verified strand tree and Standard 30 blueprint.
- The live `Generate assessment paper` control was successfully activated; the UI now shows `Generating secure assessment…`. The generated paper result is pending the next live page read.
- Supabase reported the failed job’s exact cause: `exam_papers_format_check` allowed only `cbe`, `kpsea`, `kjsea`, and `custom`.
- Applied migration `allow_standard30_exam_paper_format`, expanding the check constraint additively to include `standard30`.
- Retried the same live Standard 30 request; the UI again shows `Generating secure assessment…`.
- The retried live job completed `ready` with result paper `9db021c0-4c7e-4dd6-a95a-eb838f6ca29b` and format `standard30`.
- Live preview shows `Grade 7 Mathematics Assessment - Fractions and Data Handling`, 14 questions, 30 marks, 45 minutes, `0 critical`, `0 warnings`, and `Ready for review`.
- The live preview exposes Student paper PDF, Marking scheme PDF, Compact answer key PDF, Combined export, Export, and Approve paper controls. No approval action was taken.
- The first KJSEA run with a narrow selected scope failed the strict validation gate because three generated sub-strands fell outside the selected scope; no invalid paper was saved.
- Selecting all available topics still left the selected-strand/sub-strand dependency narrower than the provider’s output, so the next smoke test will use the supported all-curriculum mode (clear curriculum scope) rather than weakening provenance validation.
- The clean all-curriculum KJSEA smoke test was successfully started with no selected strands, sub-strands, or topics; the interface shows `Generating secure assessment…`.


## Final KJSEA production verification
The KJSEA sub-part schema fix was committed as `b6e3f18` and deployed to Vercel production with `READY` state. The live Grade 7 Mathematics all-curriculum smoke test then completed successfully: Supabase job `89f04667-9af9-4401-a300-cd4a477cfa04` is `ready`, result paper `0db3bcdb-1c29-49e1-a5a7-462dc7342cfd`, format `kjsea`, requested duration `150` minutes. The live preview shows `Kenya Junior School Education Assessment (KJSEA) - Grade 7 Mathematics`, 28 questions, 100 marks, 150 minutes, `0 critical`, `0 warnings`, and `Ready for review`. Saved HTML inspection confirms lettered structured sub-parts with explicit marks, including `(a)`, `(b)`, `(c)`, and `(d)`.

## Curriculum research completion
The subject-by-subject research workflow completed without worker failures. The reports preserve official KICD catalogue links, grade-specific findings where retrievable, and explicit caveats where the authoritative PDF could not be opened; unverified arrays were intentionally left empty rather than inferred. These reports are documentation only and are not silently injected into the production curriculum tables.
