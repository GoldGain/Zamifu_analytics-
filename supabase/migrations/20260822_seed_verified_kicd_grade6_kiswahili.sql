-- Source-verified KICD Grade 6 Kiswahili addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
-- Official Drive file: 1p4DSwvmGPzn3ZHCZhRTN88Zvju3XtgYf (LATEST 6.8.2024 KISWAHILI GRADE 6 - Revised.pdf).
-- Additive/idempotent: legacy rows are preserved; repeated headings from the source contents table are normalized once.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Kiswahili', 'KIS'
FROM curriculum_grades g
WHERE g.grade_number=6
  AND NOT EXISTS (SELECT 1 FROM curriculum_subjects s WHERE s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili');

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 6 Kiswahili revised-design strand.', v.strand_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza',1),('Kusoma',2),('Kuandika',3),('Sarufi',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 6 Kiswahili revised-design mada ndogo from the contents table.', v.sub_strand_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza','Matamshi Bora (sauti p/b, t/dj)',1),('Kusikiliza na Kuzungumza','Maamkuzi na Maagano',2),('Kusikiliza na Kuzungumza','Matamshi Bora (sauti k/g, ch/j)',3),('Kusikiliza na Kuzungumza','Heshima Adabu na Vyeo',4),('Kusikiliza na Kuzungumza','Methali',5),('Kusikiliza na Kuzungumza','Matamshi Bora',6),('Kusikiliza na Kuzungumza','Nahau',7),('Kusikiliza na Kuzungumza','Visawe',8),('Kusikiliza na Kuzungumza','Mazungumzo ya Kimuktadha',9),('Kusikiliza na Kuzungumza','Sitiara za Tabia',10),('Kusikiliza na Kuzungumza','Kujieleza kwa Ufasaha',11),
  ('Kusoma','Kusoma kwa Ufahamu',1),('Kusoma','Kusoma kwa Kina',2),('Kusoma','Kusoma kwa Ufasaha',3),('Kusoma','Kusoma kwa Mapana',4),
  ('Kuandika','Insha ya Wasifu',1),('Kuandika','Insha ya Masimulizi',2),('Kuandika','Kuandika kwa Tarakilishi',3),('Kuandika','Barua Rasmi',4),('Kuandika','Insha za Maelezo',5),('Kuandika','Insha za Wasifu',6),('Kuandika','Kuandika Maelezo',7),
  ('Sarufi','Vivumishi vya Sifa',1),('Sarufi','Vivumishi Viashiria',2),('Sarufi','Vivumishi Vimilikishi',3),('Sarufi','Vivumishi vya Idadi',4),('Sarufi','Vivumishi Viulizi',5),('Sarufi','Kivumishi Kielezi',6),('Sarufi','Viakilishi vya Nafsi',7),('Sarufi','Viakilishi Viashiria',8),('Sarufi','Viakilishi vya Idadi',9),('Sarufi','Uakifishaji',10),('Sarufi','Ngeli ya YA -YA',11),('Sarufi','Ngeli ya U - U',12),('Sarufi','Ngeli ya I - I',13),('Sarufi','Ngeli ya PA-KU-MU',14),('Sarufi','Mnyambuliko wa Vitenzi',15),('Sarufi','Vinyume vya Vivumishi',16),('Sarufi','Hali ya Masharti-nge/ -ngali na ki',17),('Sarufi','Ukanusho wa Maneno',18),('Sarufi','Ukubwa na Udogo wa Nomino',19),('Sarufi','Udogo wa nomino',20)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], v.topic_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza','Matamshi Bora (sauti p/b, t/dj)','Viungo vya Mwili vya Ndani','Official KICD Grade 6 Kiswahili revised-design Mada 1.0 Viungo vya Mwili vya Ndani.',1),
  ('Kusikiliza na Kuzungumza','Maamkuzi na Maagano','Michezo','Official KICD Grade 6 Kiswahili revised-design Mada 2.0 Michezo.',1),
  ('Kusikiliza na Kuzungumza','Matamshi Bora (sauti k/g, ch/j)','Mahusiano','Official KICD Grade 6 Kiswahili revised-design Mada 3.0 Mahusiano.',1),
  ('Kusikiliza na Kuzungumza','Heshima Adabu na Vyeo','Misimu','Official KICD Grade 6 Kiswahili revised-design Mada 4.0 Misimu.',1),
  ('Kusikiliza na Kuzungumza','Methali','Mshikamano wa Kitaifa','Official KICD Grade 6 Kiswahili revised-design Mada 5.0 Mshikamano wa Kitaifa.',1),
  ('Kusikiliza na Kuzungumza','Matamshi Bora','Usawa wa Kijinsia','Official KICD Grade 6 Kiswahili revised-design Mada 6.0 Usawa wa Kijinsia.',1),
  ('Kusikiliza na Kuzungumza','Nahau','Majanga na Jinsi ya Kuyazuia','Official KICD Grade 6 Kiswahili revised-design Mada 7.0 Majanga na Jinsi ya Kuyazuia.',1),
  ('Kusikiliza na Kuzungumza','Visawe','Wanyama wa Majini','Official KICD Grade 6 Kiswahili revised-design Mada 8.0 Wanyama wa Majini.',1),
  ('Kusikiliza na Kuzungumza','Mazungumzo ya Kimuktadha','Afya ya Akili','Official KICD Grade 6 Kiswahili revised-design Mada 9.0 Afya ya Akili.',1),
  ('Kusikiliza na Kuzungumza','Sitiara za Tabia','Kukabiliana na Ugaidi','Official KICD Grade 6 Kiswahili revised-design Mada 10.0 Kukabiliana na Ugaidi.',1),
  ('Kusikiliza na Kuzungumza','Kujieleza kwa Ufasaha','Ushuru','Official KICD Grade 6 Kiswahili revised-design Mada 11.0 Ushuru.',1),

  ('Kusoma','Kusoma kwa Ufahamu','Viungo vya Mwili vya Ndani','Official KICD Grade 6 Kiswahili revised-design Mada 1.0 Viungo vya Mwili vya Ndani.',1),
  ('Kusoma','Kusoma kwa Kina','Michezo','Official KICD Grade 6 Kiswahili revised-design Mada 2.0 Michezo.',1),
  ('Kusoma','Kusoma kwa Ufasaha','Mahusiano','Official KICD Grade 6 Kiswahili revised-design Mada 3.0 Mahusiano.',1),
  ('Kusoma','Kusoma kwa Mapana','Misimu','Official KICD Grade 6 Kiswahili revised-design Mada 4.0 Misimu.',1),
  ('Kusoma','Kusoma kwa Ufahamu','Mshikamano wa Kitaifa','Official KICD Grade 6 Kiswahili revised-design Mada 5.0 Mshikamano wa Kitaifa.',2),
  ('Kusoma','Kusoma kwa Kina','Usawa wa Kijinsia','Official KICD Grade 6 Kiswahili revised-design Mada 6.0 Usawa wa Kijinsia.',2),
  ('Kusoma','Kusoma kwa Mapana','Majanga na Jinsi ya Kuyazuia','Official KICD Grade 6 Kiswahili revised-design Mada 7.0 Majanga na Jinsi ya Kuyazuia.',2),
  ('Kusoma','Kusoma kwa Ufahamu','Wanyama wa Majini','Official KICD Grade 6 Kiswahili revised-design Mada 8.0 Wanyama wa Majini.',3),
  ('Kusoma','Kusoma kwa Mapana','Afya ya Akili','Official KICD Grade 6 Kiswahili revised-design Mada 9.0 Afya ya Akili.',3),
  ('Kusoma','Kusoma kwa Mapana','Kukabiliana na Ugaidi','Official KICD Grade 6 Kiswahili revised-design Mada 10.0 Kukabiliana na Ugaidi.',4),
  ('Kusoma','Kusoma kwa Ufasaha','Ushuru','Official KICD Grade 6 Kiswahili revised-design Mada 11.0 Ushuru.',2),

  ('Kuandika','Insha ya Wasifu','Viungo vya Mwili vya Ndani','Official KICD Grade 6 Kiswahili revised-design Mada 1.0 Viungo vya Mwili vya Ndani.',1),
  ('Kuandika','Insha ya Masimulizi','Michezo','Official KICD Grade 6 Kiswahili revised-design Mada 2.0 Michezo.',1),
  ('Kuandika','Kuandika kwa Tarakilishi','Mahusiano','Official KICD Grade 6 Kiswahili revised-design Mada 3.0 Mahusiano.',1),
  ('Kuandika','Barua Rasmi','Misimu','Official KICD Grade 6 Kiswahili revised-design Mada 4.0 Misimu.',1),
  ('Kuandika','Insha za Maelezo','Mshikamano wa Kitaifa','Official KICD Grade 6 Kiswahili revised-design Mada 5.0 Mshikamano wa Kitaifa.',1),
  ('Kuandika','Insha za Wasifu','Usawa wa Kijinsia','Official KICD Grade 6 Kiswahili revised-design Mada 6.0 Usawa wa Kijinsia.',1),
  ('Kuandika','Insha za Maelezo','Majanga na Jinsi ya Kuyazuia','Official KICD Grade 6 Kiswahili revised-design Mada 7.0 Majanga na Jinsi ya Kuyazuia.',2),
  ('Kuandika','Insha za Masimulizi','Wanyama wa Majini','Official KICD Grade 6 Kiswahili revised-design Mada 8.0 Wanyama wa Majini.',1),
  ('Kuandika','Kuandika Maelezo','Afya ya Akili','Official KICD Grade 6 Kiswahili revised-design Mada 9.0 Afya ya Akili.',1),
  ('Kuandika','Insha za Masimulizi','Kukabiliana na Ugaidi','Official KICD Grade 6 Kiswahili revised-design Mada 10.0 Kukabiliana na Ugaidi.',2),
  ('Kuandika','Barua Rasmi','Ushuru','Official KICD Grade 6 Kiswahili revised-design Mada 11.0 Ushuru.',2),

  ('Sarufi','Vivumishi vya Sifa','Viungo vya Mwili vya Ndani','Official KICD Grade 6 Kiswahili revised-design Mada 1.0 Viungo vya Mwili vya Ndani.',1),
  ('Sarufi','Vivumishi Viashiria','Viungo vya Mwili vya Ndani','Official KICD Grade 6 Kiswahili revised-design Mada 1.0 Viungo vya Mwili vya Ndani.',1),
  ('Sarufi','Vivumishi Vimilikishi','Viungo vya Mwili vya Ndani','Official KICD Grade 6 Kiswahili revised-design Mada 1.0 Viungo vya Mwili vya Ndani.',1),
  ('Sarufi','Vivumishi vya Idadi','Michezo','Official KICD Grade 6 Kiswahili revised-design Mada 2.0 Michezo.',1),
  ('Sarufi','Vivumishi Viulizi','Michezo','Official KICD Grade 6 Kiswahili revised-design Mada 2.0 Michezo.',1),
  ('Sarufi','Kivumishi Kielezi','Michezo','Official KICD Grade 6 Kiswahili revised-design Mada 2.0 Michezo.',1),
  ('Sarufi','Viakilishi vya Nafsi','Mahusiano','Official KICD Grade 6 Kiswahili revised-design Mada 3.0 Mahusiano.',1),
  ('Sarufi','Viakilishi Viashiria','Mahusiano','Official KICD Grade 6 Kiswahili revised-design Mada 3.0 Mahusiano.',1),
  ('Sarufi','Viakilishi vya Idadi','Mahusiano','Official KICD Grade 6 Kiswahili revised-design Mada 3.0 Mahusiano.',1),
  ('Sarufi','Uakifishaji','Mahusiano','Official KICD Grade 6 Kiswahili revised-design Mada 3.0 Mahusiano.',2),
  ('Sarufi','Ngeli ya YA -YA','Misimu','Official KICD Grade 6 Kiswahili revised-design Mada 4.0 Misimu.',1),
  ('Sarufi','Ngeli ya U - U','Mshikamano wa Kitaifa','Official KICD Grade 6 Kiswahili revised-design Mada 5.0 Mshikamano wa Kitaifa.',1),
  ('Sarufi','Ngeli ya I - I','Usawa wa Kijinsia','Official KICD Grade 6 Kiswahili revised-design Mada 6.0 Usawa wa Kijinsia.',1),
  ('Sarufi','Ngeli ya PA-KU-MU','Majanga na Jinsi ya Kuyazuia','Official KICD Grade 6 Kiswahili revised-design Mada 7.0 Majanga na Jinsi ya Kuyazuia.',1),
  ('Sarufi','Mnyambuliko wa Vitenzi','Wanyama wa Majini','Official KICD Grade 6 Kiswahili revised-design Mada 8.0 Wanyama wa Majini.',1),
  ('Sarufi','Vinyume vya Vivumishi','Afya ya Akili','Official KICD Grade 6 Kiswahili revised-design Mada 9.0 Afya ya Akili.',1),
  ('Sarufi','Hali ya Masharti-nge/ -ngali na ki','Kukabiliana na Ugaidi','Official KICD Grade 6 Kiswahili revised-design Mada 10.0 Kukabiliana na Ugaidi.',1),
  ('Sarufi','Ukanusho wa Maneno','Ushuru','Official KICD Grade 6 Kiswahili revised-design Mada 11.0 Ushuru.',1),
  ('Sarufi','Ukubwa na Udogo wa Nomino','Ushuru','Official KICD Grade 6 Kiswahili revised-design Mada 11.0 Ushuru.',1),
  ('Sarufi','Udogo wa nomino','Ushuru','Official KICD Grade 6 Kiswahili revised-design Mada 11.0 Ushuru.',1)
) v(strand_name,sub_strand_name,topic_name,topic_description,topic_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.topic_name))
    AND t.topic_description ~* 'Official KICD Grade 6 Kiswahili'
);

COMMIT;
