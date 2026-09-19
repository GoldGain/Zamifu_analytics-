# English for Kenyan Junior School Grades 7–9: KICD verification note

**Research scope.** This note covers one subject only: English in Kenyan Junior School Grades 7, 8 and 9. The Kenya Institute of Curriculum Development (KICD) grade-design pages are treated as the authoritative catalogue. The pages identify English as a Grade 7, Grade 8 and Grade 9 design and embed Google Drive previews for the corresponding design files. During this research session, the embedded Google Drive files returned an access restriction (“the owner hasn't given you permission to download this file”), so the PDFs could not be independently downloaded from the KICD-hosted file objects.

## Authoritative KICD sources

- [KICD Grade Seven Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/). The page lists **English** and embeds the English design at Google Drive file ID `1HAU_WMYmdmfWmr4kAvZxjcgG0lizPHZv`.
- [KICD Grade Eight Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/). The page lists **English** and embeds the English design at Google Drive file ID `1WmQXD4FTiFrInrCQMu1w-cjmPPaLEvw5`.
- [KICD Grade Nine Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/). The page lists **English** and embeds the English design at Google Drive file ID `1ehe01q4q8G-ft1PsA0r7skcz6grZfiNQ`.
- [KICD CBC Materials](https://kicd.ac.ke/cbc-materials/), the official catalogue context for curriculum designs.

## Secondary cross-check used cautiously

An accessible copy titled [English-Grade-7-REVISED-OCT.pdf](https://easylearn.co.ke/images/document/11752181/English-Grade-7-REVISED-OCT.pdf) contains KICD attribution and was used only to understand what the Grade 7 design appears to contain. It is **not** treated as a substitute for a directly accessible KICD PDF. Its table of contents labels the Grade 7 content by themes (for example, Personal Responsibility, Science and Health Education, Hygiene, Leadership, Family, Drug and Substance Abuse, Natural Resources–Forests, Travel, Heroes and Heroines–Kenya, Music, Professions, Traditional Fashion, Land Travel, Sports–Outdoor Games, and Tourist Attraction Sites–Kenya). Its detailed pages repeatedly show the learning-area strands **Listening, Reading, Grammar and Writing**, with numbered sub-strands. Because the official KICD file was inaccessible and the mirror’s extraction truncates several headings, these names are not promoted into the verified JSON arrays below.

## Verification outcome

No grade-specific strand/sub-strand array is populated. This is deliberate: the requested output must not invent or infer curriculum structure, and the directly linked KICD design PDFs were not downloadable for page-level verification. The KICD catalogue pages verify that English designs exist for each grade, but they do not expose the strand/sub-strand text in their HTML. The Grade 7 mirror provides useful cross-check evidence, but not sufficient direct-authority verification for a production curriculum data record; no equivalent accessible full-text Grade 8 or Grade 9 design was verified in this session.

## Implementation cautions

1. Treat the three KICD grade-design pages as the source of truth for the current file links; do not hard-code headings from commercial or teacher-resource mirrors without comparing every page against the official design.
2. Keep Grades 7, 8 and 9 as separate curriculum records. Do not assume that a Grade 7 strand or sub-strand continues unchanged into Grades 8 or 9.
3. Preserve the distinction between themes and strands. The accessible Grade 7 cross-check uses themes as large organizing contexts while its detailed tables use learning-area strands and sub-strands; these are not interchangeable fields.
4. Do not derive learning outcomes from search snippets, schemes of work, or textbook tables of contents. Outcomes should be transcribed from the official KICD design and retained verbatim, including numbering and punctuation.
5. When KICD restores access to the embedded files, capture the PDF URLs/IDs, revision date, page numbers, exact strand names, exact sub-strand names, and the grade-specific outcomes. Replace the empty arrays only after that page-level check.
6. Record the revision/version of each design: curriculum rationalisation or revision may change sequencing, terminology, and scope. A data pipeline should retain source URL, retrieval date, file identifier, and verification status.
7. The empty arrays in the accompanying structured result mean **not verified**, not that the grades have no strands or sub-strands.

**Status:** authoritative catalogue links verified; grade-specific curriculum text not independently verified because the linked KICD Google Drive files were access-restricted at research time.
