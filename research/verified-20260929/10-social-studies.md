# Social Studies — Kenya Junior School Grades 7, 8 and 9

## Evidence used

The first-party starting points were the three Kenya Institute of Curriculum Development (KICD) grade-design landing pages: Grade 7 [1], Grade 8 [2], and Grade 9 [3]. In the HTML of those pages, the Social Studies entry is an embedded Google Drive preview: Grade 7 [4], Grade 8 [5], and Grade 9 [6]. The preview links are the first-party design links currently exposed by the landing pages.

The Google Drive previews were viewable, but the direct-download request returned an HTML access message rather than a PDF: “Sorry, the owner hasn't given you permission to download this file. Only the owner and editors can download this file.” Therefore, no non-PDF placeholder is retained in the source-PDF directory. The exact hierarchy below was transcribed from directly downloaded, independently hosted PDF mirrors whose title pages identify KICD as the publisher. The Grade 7 mirror is hosted by Easylearn; its curriculum-design index explicitly says the attached copies are revised copies from KICD [7]. The Grade 8 and Grade 9 mirrors are hosted by Teachers Palace [8] [9] and each PDF identifies “KENYA INSTITUTE OF CURRICULUM DEVELOPMENT,” “JUNIOR SCHOOL CURRICULUM DESIGN,” and “Published and printed by Kenya Institute of Curriculum Development” on its title/credit pages.

All three mirror PDFs were downloaded directly with `curl` and text-extracted with `pdftotext -layout`; no search-result snippet was used as the hierarchy evidence. The local text sidecars are retained beside the PDFs for auditability.

## Grade 7 — exact hierarchy

**Local PDF:** `/home/ubuntu/zamifu-work/kicd-source-pdfs/social-studies/grade-7-social-studies-mirror.pdf`
**Text extraction:** `/home/ubuntu/zamifu-work/kicd-source-pdfs/social-studies/grade-7-social-studies-mirror.txt`
**Source mirror:** Easylearn direct PDF [7].
**Hierarchy evidence:** the summary table is PDF page 12 (printed page xii) and its continuation is PDF page 13 (printed page xiii). The numbered strand sections begin on PDF pages 14, 19, 32, 35, and 49.

**Counts:** 5 strands; 20 sub-strands; the design’s summary table totals 120 suggested lessons.

1. **1.0 Social Studies Personal Development**
   - **1.1 Self-Exploration**
   - **1.2 Social Entrepreneurial Opportunities**
2. **2.0 People and Relationships**
   - **2.1 Human Origin**
   - **2.2 Early Civilisation**
   - **2.3 Slavery and Servitude**
   - **2.4 Developments in Medium of Trade**
   - **2.5 Diversity and Interpersonal Relationships**
   - **2.6 Peaceful Coexistence**
3. **3.0 Community Service-Learning**
   - **3.1 Community Service-Learning Project**
4. **4.0 Natural and Historic Built Environments**
   - **4.1 Historical Information**
   - **4.2 Historical Development of Agriculture**
   - **4.3 Maps and Map Work**
   - **4.4 Earth and the Solar System**
   - **4.5 Weather**
   - **4.6 Fieldwork**
5. **5.0 Political Development and Governance**
   - **5.1 Political Development in Africa**
   - **5.2 The Constitution of Kenya**
   - **5.3 Human Rights**
   - **5.4 African Diasporas**
   - **5.5 Citizenship**

## Grade 8 — exact hierarchy

**Local PDF:** `/home/ubuntu/zamifu-work/kicd-source-pdfs/social-studies/grade-8-social-studies-mirror.pdf`
**Text extraction:** `/home/ubuntu/zamifu-work/kicd-source-pdfs/social-studies/grade-8-social-studies-mirror.txt`
**Source mirror:** Teachers Palace direct PDF [8].
**Hierarchy evidence:** the summary table is PDF page 12 (printed page xii). Numbered strand/sub-strand sections begin on PDF pages 13 (1.0), 18 (2.0), 22 (3.0), 38 (4.0), and 49 (5.0).

**Counts:** 5 strands; 16 sub-strands; the design’s summary table totals 120 suggested lessons.

1. **1.0 Social Studies and Personal Management**
   - **1.1 Self-Improvement**
   - **1.2 Self- Esteem Assessment**
2. **2.0 Community Service Learning**
   - **2.1 Community Service-Learning Project**
3. **3.0 People and Relationships**
   - **3.1 Scientific Theory about Human Origin**
   - **3.2 Early Civilisations**
   - **3.3 Trans Saharan Slave Trade**
   - **3.4 Population Growth in Africa**
   - **3.5 Diversity and Interpersonal skills**
   - **3.6 Peaceful Conflict Resolutions**
4. **4.0 Natural and Historic Built Environments**
   - **4.1 Map Reading and Interpretation**
   - **4.2 Weather and Climate**
   - **4.3 Vegetation in Africa**
   - **4.4 Historical sites and monuments in Africa**
5. **5.0 Political Developments and Governance**
   - **5.1 The Constitution of Kenya**
   - **5.2 Human Rights**
   - **5.3 Citizenship**

The space in **Self- Esteem Assessment**, the missing hyphen in **Trans Saharan Slave Trade**, the lowercase **skills** in **Diversity and Interpersonal skills**, and the lowercase **sites** in **Historical sites and monuments in Africa** are retained exactly as printed in the summary table. They were not normalized.

## Grade 9 — exact hierarchy

**Local PDF:** `/home/ubuntu/zamifu-work/kicd-source-pdfs/social-studies/grade-9-social-studies-mirror.pdf`
**Text extraction:** `/home/ubuntu/zamifu-work/kicd-source-pdfs/social-studies/grade-9-social-studies-mirror.txt`
**Source mirror:** Teachers Palace direct PDF [9].
**Hierarchy evidence:** the summary table is PDF page 13 (printed page xiii), with the 5.0 continuation on PDF page 14 (printed page xiv). Numbered strand/sub-strand sections begin on PDF pages 15 (1.0), 21 (2.0), 25 (3.0), 40 (4.0), and 53 (5.0).

**Counts:** 5 strands; 18 sub-strands; the design’s summary table totals 120 suggested lessons.

1. **1.0 Social Studies and Career Development**
   - **1.1 Pathway Choices**
   - **1.2 Pre-career Support Systems**
2. **2.0 Community Service-Learning**
   - **2.1 Community Service-Learning Project**
3. **3.0 People and Relationships**
   - **3.1 Socio-economic practices of early humans**
   - **3.2 Indigenous knowledge systems in African Societies**
   - **3.3 Poverty Reduction**
   - **3.4 Population Structure**
   - **3.5 Peaceful Conflict Resolution**
   - **3.6 Healthy Relationships**
4. **4.0 Natural and Historic Built Environments**
   - **4.1 Topographical maps**
   - **4.2 Internal Land Forming Processes**
   - **4.3 Multipurpose River Projects in Africa**
   - **4.4 Management and Conservation of the Environment**
   - **4.5 World Heritage Sites in Africa**
5. **5.0 Political Developments and Governance**
   - **5.1 The Constitution of Kenya**
   - **5.2 Civic Engagement in Governance**
   - **5.3 Kenya’s Bill of Rights**
   - **5.4 Cultural Globalisation**

The lowercase words in **Socio-economic practices of early humans**, **Indigenous knowledge systems in African Societies**, and **Topographical maps**, and the spelling **Globalisation**, are retained exactly as printed. No grade’s hierarchy was merged with another grade.

## Cross-check and disagreements resolved

The official landing pages [1]–[3] and their embedded preview links [4]–[6] establish the first-party grade-specific design locations. The independently downloaded PDFs [7]–[9] were checked against their own summary tables and numbered strand-section headings. The strand/sub-strand counts are internally consistent: Grade 7 has 2+6+1+6+5 = 20 sub-strands; Grade 8 has 2+1+6+4+3 = 16; Grade 9 has 2+1+6+5+4 = 18.

There are literal source-layout differences between some summary-table strand labels and the all-caps table-of-contents/section headings. For example, the Grade 7 summary table prints **1.0 Social Studies Personal Development** and **4.0 Natural and Historic Built Environments**, while the table of contents/section headings include “and” in the first and “in Africa” in the fourth. Grade 8’s summary table prints **2.0 Community Service Learning**, while its section heading likewise omits the hyphen. Grade 9’s summary table and section heading use **2.0 Community Service-Learning**. For the returned hierarchy, the summary-table strings are used because that is the design’s explicit “SUMMARY OF STRANDS AND SUB-STRANDS” hierarchy; section-heading differences are recorded here rather than silently normalized.

The source PDFs are complete for all three grades in the independent mirrors. The limitation is first-party binary access: the KICD landing pages expose Google Drive previews, but the direct-download endpoint refused PDF download to this unauthenticated session. No credentials were used, and no database or app files were modified.

## References

[1]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/ "KICD Grade Seven Designs landing page"
[2]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/ "KICD Grade Eight Designs landing page"
[3]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ "KICD Grade Nine Designs landing page"
[4]: https://drive.google.com/file/d/1nr9z0Z11ue76h2odpYQJNeUU4jFJWbbB/preview "KICD Grade 7 Social Studies embedded preview"
[5]: https://drive.google.com/file/d/1yx30v28nVLKYSByRB9G2Omalh76-ZL6h/preview "KICD Grade 8 Social Studies embedded preview"
[6]: https://drive.google.com/file/d/1gMXIzQnV-F1a7n_dJ82QU2-BTtw3B-NW/preview "KICD Grade 9 Social Studies embedded preview"
[7]: https://easylearn.co.ke/images/document/11752154/Social-Studies-Grade-7-Revised-1.pdf "Easylearn mirror: Social Studies Grade 7 Revised 1"
[8]: https://www.teacherspalace.co.ke/uploads/documents/social-studies-grade-8-revised-1-unlocked-2025-01-05-Up5cUrwpuP.pdf "Teachers Palace mirror: Social Studies Grade 8 Revised 1"
[9]: https://www.teacherspalace.co.ke/uploads/documents/social-studies-grade-9-revised-1-unlocked-2024-12-02-QzcK6QzeMT.pdf "Teachers Palace mirror: Social Studies Grade 9 Revised 1"
