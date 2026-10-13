# Exam Generator — Grades 6–10

- [ ] Align grade/format selection: Grade 6 KPSEA practice; Grade 9 KJSEA current source-backed paper structures; Grades 7, 8 and 10 school-based CBE assessments unless a verified national format applies. Do not label local defaults as KICD/KNEC mandates.
- [ ] Correct multi-paper subjects: each Paper 1/Paper 2 must have its own proper components, exact marks, duration/project window, instructions and marking scheme; generation and repair must preserve component identity.
- [ ] Student space: no generic calculation/working blocks on theory papers; provide working space for mathematics and actual calculation tasks/sub-parts only.
- [ ] Full paper reliability: never save a shortened or incorrectly marked paper as successful; recover missing/broken question slots, bound retry/concurrency, preserve selected approved curriculum and clear failure reporting.
- [ ] Visual integrity: every referenced diagram/table/map appears, required Social Studies map component is retained, map includes frame/title/scale/key/north arrow, labels remain print-readable; no decorative placeholders.
- [ ] Source evidence: verify current official curriculum coverage for Grades 6–10 and use approved curriculum-tree context for each level.
- [ ] Push every verified correction to the existing GitHub main branch and deploy to the existing zamifu.company Vercel project.
- [ ] Validate regression matrix across grade/subject/variant combinations and live Demo School generation; export student/marking PDFs and 300-DPI visual evidence for final successful examples. Report failures honestly and retain draft status for professional review.

## Work ownership

Parent: API, grade-format policy, schema, UI integration, production validation and delivery.
PDF spacing agent: exam-generator.ts and focused PDF/space tests.
Completeness agent: deepseek-api.ts, exam-repair.ts, exam-validation.ts and reliability tests.
Official evidence workflow: one source audit per Grade 6, 7, 8, 9 and 10.
