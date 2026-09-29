# Christian Religious Education — Kenya Junior School Grades 7, 8 and 9

**Verification date:** 2026-09-29
**Scope:** Christian Religious Education (CRE) only. The extraction below includes only numbered strand and numbered sub-strand names. Unnumbered descriptors printed in the source tables are recorded under limitations and are not counted.

## Source and retrieval record

The official KICD landing pages were checked first:

- Grade 7 Designs: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/ [1]
- Grade 8 Designs: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/ [2]
- Grade 9 Designs: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ [3]

The current KICD HTML embeds CRE as Google Drive previews. The CRE preview URLs found in the page source were:

- Grade 7: https://drive.google.com/file/d/1Vx6Y8lWUiSpWO-MBO58nEOtPlFDM7JA3/preview [1]
- Grade 8: https://drive.google.com/file/d/1ZVqaVImBDLeGVUbLwA54C8zqWZMsr3V8/preview [2]
- Grade 9: https://drive.google.com/file/d/1FBMLUxBo1q4dHUkXLidZeqCiZWDzRBNI/preview [3]

Direct Drive download requests did not yield raw PDFs in this environment: Grade 7 and Grade 8 returned a Google Drive “Can’t download file” HTML response, while the Grade 9 preview/download endpoints returned access/error HTML. Therefore, the raw PDF files used for text extraction were downloaded from an education-resource mirror that exposes the same KICD-labelled revised documents. The mirror page lists the three files as CRE Grade 7/8/9 revised curriculum designs: https://easylearn.co.ke/curriculum-design [4]. Direct mirror PDF URLs are https://easylearn.co.ke/images/document/11752064/CRE-Grade-7-Revised.pdf [5], https://easylearn.co.ke/images/document/11752335/CRE-Grade-8-Revised.pdf [6], and https://easylearn.co.ke/images/document/11752401/CRE-Grade-9-Revised.pdf [7].

Each downloaded mirror PDF has a text layer. `pdftotext -layout` was used; OCR was not needed. The KICD attribution and grade/title are visible in the document front matter. The mirror PDFs have 78 pages (Grade 7), 72 pages (Grade 8), and 64 pages (Grade 9). The hierarchy is taken from the source document's **SUMMARY OF STRANDS AND SUB-STRANDS** pages: physical PDF pages 12–13, printed pages xii–xiii, for Grades 7 and 8; physical PDF page 12, printed page xii, for Grade 9.

## Grade 7 — verified

**Counts:** 6 strands; 19 numbered sub-strands. The numbered hierarchy is on PDF pages 12–13 (printed pages xii–xiii) of the revised 2024 mirror copy [5].

1. **1.0 Overview of Christian Religious Education**
   - **1.1 Importance of Learning CRE**
2. **2.0 Creation**
   - **2.1 Accounts of Creation**
   - **2.2 Responsibility over Animals, Fish and Birds**
   - **2.3 Responsibility over Plants**
   - **2.4 Use and Misuse of God’s Creation**
3. **3.0 The Bible**
   - **3.1 Functions of the Bible**
   - **3.2 Divisions of the Bible**
   - **3.3 Bible Translations**
   - **3.4 Leadership in the Bible: Moses**
4. **4.0 The Early Life of Jesus Christ**
   - **4.1 Background to the Birth of Jesus Christ**
   - **4.2 Annunciation of the Birth of John the Baptist**
   - **4.3 The Birth and Childhood of Jesus Christ**
5. **5.0 The church in Action**
   - **5.1 Selected Forms of Worship**
   - **5.2 Role of the Church in Education and Health**
6. **6.0 Christian Living Today**
   - **6.1 Human Sexuality**
   - **6.2 Christian Marriage and Family**
   - **6.3 Alcohol, drugs and substance use**
   - **6.4 Gambling**
   - **6.5 Social Media**

The case in **“The church in Action”** and **“Alcohol, drugs and substance use”** is preserved exactly as printed in the summary table. The Grade 7 summary continues from printed page xii to xiii; omitting page xiii would incorrectly lose strands 4.3–6.5.

Local source PDFs:

- `/home/ubuntu/zamifu-work/kicd-source-pdfs/christian-religious-education/grade-7-cre-easylearn.pdf` — 78 pages; SHA-256 `cad1e69f6db134639e90fca45beb6b177db9f9a958e5c569e6c982bbd28c58b0`.
- `/home/ubuntu/zamifu-work/kicd-source-pdfs/christian-religious-education/grade-7-cre-teacher-co-ke.pdf` — independent education-resource copy retained for version comparison; 70 pages; SHA-256 `4139f2b527b8c866b69eaebad454a23812f89987a0eb56e5544e096e8d45d6b8`.

## Grade 8 — verified

**Counts:** 6 strands; 18 numbered sub-strands. The numbered hierarchy is on PDF pages 12–13 (printed pages xii–xiii) of the revised 2024 mirror copy [6].

1. **1.0 Creation**
   - **1.1 Origin and Consequences of Sin**
   - **1.2 God’s Plan for Redemption**
2. **2.0 The Bible**
   - **2.1 Faith and God’s Promises**
   - **2.2 Abrahamic Covenant**
   - **2.3 Leadership in Israel (Saul)**
3. **3.0 The Life and Ministry of Jesus**
   - **3.1 Healing of Blind Bartimaeus**
   - **3.2 Calming the Storm**
   - **3.3 Healing of the Paralytic**
4. **4.0 Teachings of Jesus Christ**
   - **4.1 Teaching on Prayer**
   - **4.2 The Lost Sheep**
5. **5.0 The Church**
   - **5.1 The Holy Spirit**
   - **5.2 Acts of Compassion**
6. **6.0 Christian Living Today**
   - **6.1 Family Relationships**
   - **6.2 Human Sexuality**
   - **6.3 Sacredness of Life**
   - **6.4 Bullying**
   - **6.5 Work: Talents and Abilities**
   - **6.6 Leisure**

The Grade 8 table also prints the unnumbered descriptor **“Selected Miracles of Jesus Christ”** under strand 3.0 and the italic unnumbered descriptor **“Responsible sexual behaviour”** beneath 6.2. They are not numbered sub-strands and are therefore excluded from the count and hierarchy above.

There is a source-internal wording difference: the Grade 8 summary table names strand 3.0 **“The Life and Ministry of Jesus”**, while the table of contents/body heading uses **“MIRACLES OF JESUS CHRIST.”** Because the requested extraction is the numbered hierarchy and the summary table places the numbered sub-strands under the former wording, the JSON/report uses the exact summary-table label and records the TOC/body wording as a limitation rather than silently merging them.

Local source PDF:

- `/home/ubuntu/zamifu-work/kicd-source-pdfs/christian-religious-education/grade-8-cre-easylearn.pdf` — 72 pages; SHA-256 `4d946b5f4b0819bf0ca6e444a2f8304d1d5fa2c06c2bf09b9b3a77e1df086ffa`.

## Grade 9 — verified

**Counts:** 5 strands; 14 numbered sub-strands. The complete numbered hierarchy is on PDF page 12 (printed page xii) of the revised 2024 mirror copy [7].

1. **1.0 Creation**
   - **1.1 Work**
2. **2.0 The Bible**
   - **2.1 Christian Moral Values**
   - **2.2 Kings David and Solomon**
3. **3.0 The Life and Ministry of Jesus Christ**
   - **3.1 Raising the Widow’s Son**
   - **3.2 Healing the 10 Lepers**
   - **3.3 Parable on Prayer**
   - **3.4 Nicodemus Encounter with Jesus Christ**
   - **3.5 Jesus Ministry in Jerusalem**
4. **4.0 The Church**
   - **4.1 The Early Church**
   - **4.2 The Gifts of the Holy Spirit**
5. **5.0 Christian Living Today**
   - **5.1 Courtship and Marriage**
   - **5.2 Responsible Parenthood**
   - **5.3 Leisure**
   - **5.4 Wealth Money and Poverty**

The Grade 9 copy was independently cross-checked against two accessible KICD-labelled education-resource mirrors. The Teachers Palace copy has the same 64-page structure and the same summary-table wording [9]. The Doyen Publishers copy is also KICD-labelled, first published 2024, and has the same summary hierarchy; its physical pagination differs by one page because of front-matter/layout treatment [10].

Local source PDFs:

- `/home/ubuntu/zamifu-work/kicd-source-pdfs/christian-religious-education/grade-9-cre-easylearn.pdf` — 64 pages; SHA-256 `cb68f4f49d7daa1f2264c8af8d885643d763725fac7b6e50aac829617dd9ba18`.
- `/home/ubuntu/zamifu-work/kicd-source-pdfs/christian-religious-education/grade-9-cre-teacherspalace.pdf` — independent cross-check; 64 pages; SHA-256 `f63b7a10318647f4eaddc3fa50788deea4c40d4aba5a995e470c4b01c332`.
- `/home/ubuntu/zamifu-work/kicd-source-pdfs/christian-religious-education/grade-9-cre-doyen.pdf` — independent cross-check; 65 pages; SHA-256 `161090e2ca6a05c750c02155cb4d240a110fa481bf16b73597420c2bdfd3f8f3`.

## Disagreements and limitations resolved

1. **Current revised edition versus an older Grade 7 draft.** Teacher.co.ke hosts a KICD-labelled Grade 7 document titled as a 2021 draft [8]. Its table of contents uses an older six-strand wording, including **“INTRODUCTION TO CHRISTIAN RELIGIOUS EDUCATION”** and **“CHRISTIAN LIVING TODAY.”** The current KICD Grade 7 landing page embeds a revised document, and the mirrored PDF used here is explicitly marked **“Revised 2024”** [1] [5]. The current revised hierarchy above was retained; the older draft was not merged into it.
2. **Grade 7 summary continuation.** Grade 7's summary occupies printed pages xii–xiii. The first page stops after 4.2; 4.3 and strands 5.0–6.5 continue on xiii [5].
3. **Grade 8 wording.** The Grade 8 summary-table label is **“3.0 The Life and Ministry of Jesus”**, but the TOC/body heading says **“MIRACLES OF JESUS CHRIST.”** The summary-table label is reported because it is the numbered hierarchy source; the unnumbered descriptor **“Selected Miracles of Jesus Christ”** is not promoted to a numbered sub-strand [6].
4. **No direct official raw-PDF artifact.** KICD exposes the designs through embedded Drive previews on the landing pages, but direct raw-file downloads were blocked or returned error HTML during retrieval. The report therefore retains verified downloaded mirror PDFs, records the official landing-page and preview URLs, and does not represent a mirror file as a direct KICD-hosted download.

## References

[1]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/ "KICD Grade Seven Designs"

[2]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/ "KICD Grade Eight Designs"

[3]: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ "KICD Grade Nine Designs"

[4]: https://easylearn.co.ke/curriculum-design "Easylearn curriculum-design mirror index"

[5]: https://easylearn.co.ke/images/document/11752064/CRE-Grade-7-Revised.pdf "Easylearn mirror — CRE Grade 7 Revised PDF"

[6]: https://easylearn.co.ke/images/document/11752335/CRE-Grade-8-Revised.pdf "Easylearn mirror — CRE Grade 8 Revised PDF"

[7]: https://easylearn.co.ke/images/document/11752401/CRE-Grade-9-Revised.pdf "Easylearn mirror — CRE Grade 9 Revised PDF"

[8]: https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-CRE-2024-TEACHER.CO_.KE_.pdf "Teacher.co.ke — KICD-labelled Grade 7 CRE draft copy"

[9]: https://www.teacherspalace.co.ke/uploads/documents/cre-grade-9-revised-unlocked-2024-12-02-o2v6MHwrcm.pdf "Teachers Palace — KICD-labelled Grade 9 CRE revised copy"

[10]: https://doyenpublishers.com/wp-content/uploads/2025/04/Grade-9-CRE-Curriculum-Design.pdf "Doyen Publishers — KICD-labelled Grade 9 CRE copy"
