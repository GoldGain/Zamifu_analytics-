-- Source-verified KICD Grade 4 Kiswahili addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/
-- Official Drive file: 1MO1ddc7tFvcpKYy7Trr4VBhllBmwKntW (Kiswahili Gredi ya 4, revised 2024).
-- Additive/idempotent: legacy rows are preserved; repeated source headings are normalized per strand.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Kiswahili', 'KIS'
FROM curriculum_grades g
WHERE g.grade_number=4
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 4 Kiswahili revised-design strand.', v.strand_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza',1),('Kusoma',2),('Kuandika',3),('Sarufi',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 4 Kiswahili revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza','Matamshi Bora',1),('Kusikiliza na Kuzungumza','Maamkuzi na Maagano',2),('Kusikiliza na Kuzungumza','Vitendawili',3),('Kusikiliza na Kuzungumza','Maneno ya Upole',4),('Kusikiliza na Kuzungumza','Methali',5),('Kusikiliza na Kuzungumza','Ushairi',6),('Kusikiliza na Kuzungumza','Nahau',7),('Kusikiliza na Kuzungumza','Visawe',8),('Kusikiliza na Kuzungumza','Mazungumzo ya Kimuktadha',9),('Kusikiliza na Kuzungumza','Tashbihi',10),('Kusikiliza na Kuzungumza','Masimulizi',11),
  ('Kusoma','Kusoma kwa Ufahamu',1),('Kusoma','Kusoma kwa Kina',2),('Kusoma','Kusoma kwa Ufasaha',3),('Kusoma','Kusoma kwa Mapana',4),('Kusoma','Kusoma Kidijitali',5),
  ('Kuandika','Insha ya Wasifu',1),('Kuandika','Insha ya Masimulizi',2),('Kuandika','Kuandika kwa Tarakilishi',3),('Kuandika','Barua ya Kirafiki',4),('Kuandika','Insha za Maelezo',5),('Kuandika','Insha za Wasifu',6),('Kuandika','Kuandika Maelezo',7),
  ('Sarufi','Nomino',1),('Sarufi','Vitenzi',2),('Sarufi','Vivumishi',3),('Sarufi','Viakilishi',4),('Sarufi','Vielezi',5),('Sarufi','Viunganishi',6),('Sarufi','Vihusishi',7),('Sarufi','Vihisishi',8),('Sarufi','Ngeli ya A -WA',9),('Sarufi','Ngeli ya U - I',10),('Sarufi','Ngeli ya LI -YA',11),('Sarufi','Ngeli ya KI -VI',12),('Sarufi','Ngeli ya LI -LI',13),('Sarufi','Mnyambuliko wa Vitenzi',14),('Sarufi','Vinyume vya Nomino',15),('Sarufi','Nyakati na Hali',16),('Sarufi','Ukanushaji',17),('Sarufi','Ukubwa na Udogo wa Nomino',18),('Sarufi','Udogo wa Nomino',19)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 4 Kiswahili contents-table unit/topic anchor.', ARRAY[]::text[], v.topic_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza','Matamshi Bora','Nyumbani',1),('Kusikiliza na Kuzungumza','Maamkuzi na Maagano','Nidhamu Mezani',2),('Kusikiliza na Kuzungumza','Vitendawili','Mavazi',3),('Kusikiliza na Kuzungumza','Maneno ya Upole','Dira',4),('Kusikiliza na Kuzungumza','Methali','Ushauri-Nasaha',5),('Kusikiliza na Kuzungumza','Ushairi','Bendera ya Taifa',6),('Kusikiliza na Kuzungumza','Nahau','Matunda na Mimea',7),('Kusikiliza na Kuzungumza','Visawe','Wanyama wa Porini',8),('Kusikiliza na Kuzungumza','Mazungumzo ya Kimuktadha','Afya Bora',9),('Kusikiliza na Kuzungumza','Tashbihi','Kukabiliana na Uhalifu',10),('Kusikiliza na Kuzungumza','Masimulizi','Mapato',11),
  ('Kusoma','Kusoma kwa Ufahamu','Nyumbani',1),('Kusoma','Kusoma kwa Kina','Nidhamu Mezani',2),('Kusoma','Kusoma kwa Ufasaha','Mavazi',3),('Kusoma','Kusoma kwa Mapana','Dira',4),('Kusoma','Kusoma kwa Ufahamu','Ushauri-Nasaha',5),('Kusoma','Kusoma kwa Kina','Bendera ya Taifa',6),('Kusoma','Kusoma kwa Mapana','Matunda na Mimea',7),('Kusoma','Kusoma kwa Ufahamu','Wanyama wa Porini',8),('Kusoma','Kusoma kwa Mapana','Afya Bora',9),('Kusoma','Kusoma Kidijitali','Kukabiliana na Uhalifu',10),('Kusoma','Kusoma kwa Ufasaha','Mapato',11),
  ('Kuandika','Insha ya Wasifu','Nyumbani',1),('Kuandika','Insha ya Masimulizi','Nidhamu Mezani',2),('Kuandika','Kuandika kwa Tarakilishi','Mavazi',3),('Kuandika','Barua ya Kirafiki','Dira',4),('Kuandika','Insha za Maelezo','Ushauri-Nasaha',5),('Kuandika','Insha za Wasifu','Bendera ya Taifa',6),('Kuandika','Insha za Maelezo','Matunda na Mimea',7),('Kuandika','Insha za Masimulizi','Wanyama wa Porini',8),('Kuandika','Kuandika Maelezo','Afya Bora',9),('Kuandika','Insha za Masimulizi','Kukabiliana na Uhalifu',10),('Kuandika','Barua ya Kirafiki','Mapato',11),
  ('Sarufi','Nomino','Nyumbani',1),('Sarufi','Vitenzi','Nyumbani',2),('Sarufi','Vivumishi','Nyumbani',3),('Sarufi','Viakilishi','Nidhamu Mezani',4),('Sarufi','Vielezi','Nidhamu Mezani',5),('Sarufi','Viunganishi','Mavazi',6),('Sarufi','Vihusishi','Mavazi',7),('Sarufi','Vihisishi','Mavazi',8),('Sarufi','Ngeli ya A -WA','Dira',9),('Sarufi','Ngeli ya U - I','Ushauri-Nasaha',10),('Sarufi','Ngeli ya LI -YA','Bendera ya Taifa',11),('Sarufi','Ngeli ya KI -VI','Matunda na Mimea',12),('Sarufi','Ngeli ya LI -LI','Matunda na Mimea',13),('Sarufi','Mnyambuliko wa Vitenzi','Wanyama wa Porini',14),('Sarufi','Vinyume vya Nomino','Afya Bora',15),('Sarufi','Nyakati na Hali','Kukabiliana na Uhalifu',16),('Sarufi','Ukanushaji','Mapato',17),('Sarufi','Ukubwa na Udogo wa Nomino','Mapato',18),('Sarufi','Udogo wa Nomino','Mapato',19)
) v(strand_name,sub_strand_name,topic_name,topic_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.topic_name))
    AND t.topic_description ~* 'Official KICD Grade 4 Kiswahili'
);

COMMIT;
