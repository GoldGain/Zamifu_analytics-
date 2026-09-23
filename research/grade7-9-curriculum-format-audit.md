# Grade 7–9 Curriculum and Paper-Format Audit

## Scope

The audit covered Mathematics, English, Kiswahili, Integrated Science, Agriculture, Social Studies, Creative Arts and Sports, Pre-Technical Studies, and Religious Education (CRE/IRE). Grade 7–9 curriculum hierarchies were compared against the revised 2024 KICD curriculum-design catalogue and the KNEC 2026 KJSEA regulations/timetable.

## Implemented corrections

The generator now treats Mathematics as one 903 paper: 20 objective marks plus 80 structured/essay marks, 100 marks in 120 minutes, with no Paper 2 exposed. English and Kiswahili retain their separate 50-mark Paper 1 and Paper 2 structures. Integrated Science Paper 2 now follows the current 905/2 baseline of 30 marks in 60 minutes with three written practical-skills tasks; the older 2025 two-task/90-minute sample is retained only as historical evidence. Agriculture 906/2, Creative Arts and Sports 911/1, and Pre-Technical Studies 912/2 are represented as project windows rather than invented minute-based examinations. Creative Arts and Sports now uses the current 911 code rather than 910.

The generic prompt law no longer forces every structured parent question to be worth ten marks. Subject-specific mark allocations now govern the paper, and exact-mark regression coverage protects the Mathematics, Integrated Science, and project-paper behavior. Subject-key normalization was also hardened so Creative Arts and Sports cannot be misclassified as CRE.

The repository includes a versioned Grade 9 hierarchy migration for the verified current Mathematics, English, Integrated Science, Social Studies, Pre-Technical Studies, CRE, and IRE structures. The application already prefers curriculum rows explicitly marked as official/source-verified, preserving older rows that may be referenced by lesson plans or school content without showing them as the current selector hierarchy.

## Evidence and caveats

KICD landing pages expose revised curriculum designs through Google Drive previews, and some files were not downloadable in the sandbox. Exact inventories are therefore recorded with source URLs and explicit caveats in the subject reports. The Grade 9 English summary was additionally checked from a current curriculum PDF. Agriculture, Creative Arts and Sports, and Grade 9 Kiswahili require one more source-document extraction pass for the complete sub-strand inventory before those rows should be promoted as source-verified; no unverified rows were silently relabelled as current.

## Primary sources

- [KICD Grade 7 curriculum designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/)
- [KICD Grade 8 curriculum designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/)
- [KICD Grade 9 curriculum designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/)
- [KNEC KJSEA Regulations](https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf)
- [KNEC 2026 KJSEA Timetable](https://www.knec.ac.ke/wp-content/uploads/2026/02/2026-KJSEA-TIMETABLE.pdf)

## Subject reports

- [Mathematics audit](./curriculum-audit-mathematics.md)
- [Social Studies audit](./curriculum-audit-social-studies.md)
- [Pre-Technical Studies audit](./curriculum-audit-pre-technical.md)
- [Religious Education audit](./curriculum-audit-religious-education.md)
