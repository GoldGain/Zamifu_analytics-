-- Source-verified KICD Grade 5 Kiswahili addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/
-- Official Drive file: 1aGnwbMdfKkwTBtVOcliEiyge6qAHpHhd (KISWAHILI GRADE 5 DESIGN - Revised.pdf).
-- Additive/idempotent: legacy rows are preserved; repeated headings from the source contents table are normalized once.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Kiswahili', 'KIS'
FROM curriculum_grades g
WHERE g.grade_number=5
  AND NOT EXISTS (SELECT 1 FROM curriculum_subjects s WHERE s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili');

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 5 Kiswahili revised-design strand.', v.strand_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza',1),('Kusoma',2),('Kuandika',3),('Sarufi',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 5 Kiswahili revised-design mada ndogo from the contents table.', v.sub_strand_order
FROM (VALUES
  ('Kusikiliza na Kuzungumza','Matamshi Bora',1),('Kusikiliza na Kuzungumza','Maamkuzi na Maagano',2),('Kusikiliza na Kuzungumza','Vitendawili',3),('Kusikiliza na Kuzungumza','Heshima Adabu na Vyeo',4),('Kusikiliza na Kuzungumza','Methali',5),('Kusikiliza na Kuzungumza','Ushairi',6),('Kusikiliza na Kuzungumza','Nahau',7),('Kusikiliza na Kuzungumza','Visawe',8),('Kusikiliza na Kuzungumza','Mazungumzo ya Kimuktadha',9),('Kusikiliza na Kuzungumza','Tashbihi',10),('Kusikiliza na Kuzungumza','Masimulizi',11),
  ('Kusoma','Kusoma kwa Ufahamu',1),('Kusoma','Kusoma kwa Kina',2),('Kusoma','Kusoma kwa Ufasaha',3),('Kusoma','Kusoma kwa Mapana',4),('Kusoma','Kusoma Kidijitali',5),
  ('Kuandika','Insha ya Wasifu',1),('Kuandika','Insha ya Masimulizi',2),('Kuandika','Kuandika kwa Tarakilishi',3),('Kuandika','Baruapepe',4),('Kuandika','Insha za Maelezo',5),('Kuandika','Kuandika Maelezo',6),('Kuandika','Insha za Masimulizi',7),
  ('Sarufi','Nomino za Pekee',1),('Sarufi','Nomino za Kawaida',2),('Sarufi','Nomino za Wingi',3),('Sarufi','Vitenzi Jina',4),('Sarufi','Nomino Ambata',5),('Sarufi','Nomino za Makundi',6),('Sarufi','Nomino Dhahania',7),('Sarufi','Uakifishaji',8),('Sarufi','Ngeli ya I -ZI',9),('Sarufi','Ngeli ya U -ZI',10),('Sarufi','Ngeli ya U -YA',11),('Sarufi','Ngeli ya KU -KU',12),('Sarufi','Mnyambuliko wa Vitenzi',13),('Sarufi','Vinyume vya Vitenzi',14),('Sarufi','Nyakati na Hali',15),('Sarufi','Ukanushaji',16),('Sarufi','Ukubwa na Udogo wa Nomino',17),('Sarufi','Udogo wa Nomino',18)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=5
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
  ('Kusikiliza na Kuzungumza','Matamshi Bora','Mapishi','Official KICD Grade 5 Kiswahili revised-design Mada 1.0 Mapishi; detailed content confirms Sauti f/v, s/z, l/r na th/dh.',1),
  ('Kusikiliza na Kuzungumza','Maamkuzi na Maagano','Huduma ya Kwanza','Official KICD Grade 5 Kiswahili revised-design Mada 2.0 Huduma ya Kwanza.',1),
  ('Kusikiliza na Kuzungumza','Vitendawili','Mapambo','Official KICD Grade 5 Kiswahili revised-design Mada 3.0 Mapambo.',1),
  ('Kusikiliza na Kuzungumza','Heshima Adabu na Vyeo','Saa na Majira','Official KICD Grade 5 Kiswahili revised-design Mada 4.0 Saa na Majira.',1),
  ('Kusikiliza na Kuzungumza','Methali','Kukabiliana na Umaskini','Official KICD Grade 5 Kiswahili revised-design Mada 5.0 Kukabiliana na Umaskini.',1),
  ('Kusikiliza na Kuzungumza','Ushairi','Maadili','Official KICD Grade 5 Kiswahili revised-design Mada 6.0 Maadili.',1),
  ('Kusikiliza na Kuzungumza','Nahau','Elimu ya Mazingira','Official KICD Grade 5 Kiswahili revised-design Mada 7.0 Elimu ya Mazingira.',1),
  ('Kusikiliza na Kuzungumza','Visawe','Ndege wa Porini','Official KICD Grade 5 Kiswahili revised-design Mada 8.0 Ndege wa Porini.',1),
  ('Kusikiliza na Kuzungumza','Mazungumzo ya Kimuktadha','Magonjwa','Official KICD Grade 5 Kiswahili revised-design Mada 9.0 Magonjwa.',1),
  ('Kusikiliza na Kuzungumza','Tashbihi','Kudhibiti Itikadi za Kidini na za Kijamii','Official KICD Grade 5 Kiswahili revised-design Mada 10.0 Kudhibiti Itikadi za Kidini na za Kijamii.',1),
  ('Kusikiliza na Kuzungumza','Masimulizi','Uwekezaji','Official KICD Grade 5 Kiswahili revised-design Mada 11.0 Uwekezaji.',1),

  ('Kusoma','Kusoma kwa Ufahamu','Mapishi','Official KICD Grade 5 Kiswahili revised-design Mada 1.0 Mapishi.',1),
  ('Kusoma','Kusoma kwa Kina','Huduma ya Kwanza','Official KICD Grade 5 Kiswahili revised-design Mada 2.0 Huduma ya Kwanza; detailed content confirms Matumizi ya kamusi.',1),
  ('Kusoma','Kusoma kwa Ufasaha','Mapambo','Official KICD Grade 5 Kiswahili revised-design Mada 3.0 Mapambo.',1),
  ('Kusoma','Kusoma kwa Mapana','Saa na Majira','Official KICD Grade 5 Kiswahili revised-design Mada 4.0 Saa na Majira.',1),
  ('Kusoma','Kusoma kwa Ufahamu','Kukabiliana na Umaskini','Official KICD Grade 5 Kiswahili revised-design Mada 5.0 Kukabiliana na Umaskini.',2),
  ('Kusoma','Kusoma kwa Kina','Maadili','Official KICD Grade 5 Kiswahili revised-design Mada 6.0 Maadili.',2),
  ('Kusoma','Kusoma kwa Mapana','Elimu ya Mazingira','Official KICD Grade 5 Kiswahili revised-design Mada 7.0 Elimu ya Mazingira.',2),
  ('Kusoma','Kusoma kwa Ufahamu','Ndege wa Porini','Official KICD Grade 5 Kiswahili revised-design Mada 8.0 Ndege wa Porini.',3),
  ('Kusoma','Kusoma kwa Mapana','Magonjwa','Official KICD Grade 5 Kiswahili revised-design Mada 9.0 Magonjwa.',3),
  ('Kusoma','Kusoma Kidijitali','Kudhibiti Itikadi za Kidini na za Kijamii','Official KICD Grade 5 Kiswahili revised-design Mada 10.0 Kudhibiti Itikadi za Kidini na za Kijamii.',1),
  ('Kusoma','Kusoma kwa Ufasaha','Uwekezaji','Official KICD Grade 5 Kiswahili revised-design Mada 11.0 Uwekezaji.',2),

  ('Kuandika','Insha ya Wasifu','Mapishi','Official KICD Grade 5 Kiswahili revised-design Mada 1.0 Mapishi.',1),
  ('Kuandika','Insha ya Masimulizi','Huduma ya Kwanza','Official KICD Grade 5 Kiswahili revised-design Mada 2.0 Huduma ya Kwanza; detailed content confirms Insha ya masimulizi.',1),
  ('Kuandika','Kuandika kwa Tarakilishi','Mapambo','Official KICD Grade 5 Kiswahili revised-design Mada 3.0 Mapambo.',1),
  ('Kuandika','Baruapepe','Saa na Majira','Official KICD Grade 5 Kiswahili revised-design Mada 4.0 Saa na Majira.',1),
  ('Kuandika','Insha za Maelezo','Kukabiliana na Umaskini','Official KICD Grade 5 Kiswahili revised-design Mada 5.0 Kukabiliana na Umaskini.',1),
  ('Kuandika','Insha za Masimulizi','Maadili','Official KICD Grade 5 Kiswahili revised-design Mada 6.0 Maadili.',1),
  ('Kuandika','Insha za Maelezo','Elimu ya Mazingira','Official KICD Grade 5 Kiswahili revised-design Mada 7.0 Elimu ya Mazingira.',2),
  ('Kuandika','Insha za Masimulizi','Ndege wa Porini','Official KICD Grade 5 Kiswahili revised-design Mada 8.0 Ndege wa Porini.',2),
  ('Kuandika','Kuandika Maelezo','Magonjwa','Official KICD Grade 5 Kiswahili revised-design Mada 9.0 Magonjwa.',1),
  ('Kuandika','Insha za Masimulizi','Kudhibiti Itikadi za Kidini na za Kijamii','Official KICD Grade 5 Kiswahili revised-design Mada 10.0 Kudhibiti Itikadi za Kidini na za Kijamii.',3),
  ('Kuandika','Baruapepe','Uwekezaji','Official KICD Grade 5 Kiswahili revised-design Mada 11.0 Uwekezaji.',2),

  ('Sarufi','Nomino za Pekee','Mapishi','Official KICD Grade 5 Kiswahili revised-design Mada 1.0 Mapishi; detailed content confirms Nomino za Pekee.',1),
  ('Sarufi','Nomino za Kawaida','Mapishi','Official KICD Grade 5 Kiswahili revised-design Mada 1.0 Mapishi; detailed content confirms Nomino za kawaida.',1),
  ('Sarufi','Nomino za Wingi','Huduma ya Kwanza','Official KICD Grade 5 Kiswahili revised-design Mada 2.0 Huduma ya Kwanza; detailed content confirms Nomino za Wingi.',1),
  ('Sarufi','Vitenzi Jina','Huduma ya Kwanza','Official KICD Grade 5 Kiswahili revised-design Mada 2.0 Huduma ya Kwanza.',1),
  ('Sarufi','Nomino Ambata','Huduma ya Kwanza','Official KICD Grade 5 Kiswahili revised-design Mada 2.0 Huduma ya Kwanza.',1),
  ('Sarufi','Nomino za Makundi','Mapambo','Official KICD Grade 5 Kiswahili revised-design Mada 3.0 Mapambo.',1),
  ('Sarufi','Nomino Ambata','Mapambo','Official KICD Grade 5 Kiswahili revised-design Mada 3.0 Mapambo.',2),
  ('Sarufi','Nomino Dhahania','Mapambo','Official KICD Grade 5 Kiswahili revised-design Mada 3.0 Mapambo.',1),
  ('Sarufi','Uakifishaji','Mapambo','Official KICD Grade 5 Kiswahili revised-design Mada 3.0 Mapambo.',1),
  ('Sarufi','Ngeli ya I -ZI','Saa na Majira','Official KICD Grade 5 Kiswahili revised-design Mada 4.0 Saa na Majira.',1),
  ('Sarufi','Ngeli ya U -ZI','Kukabiliana na Umaskini','Official KICD Grade 5 Kiswahili revised-design Mada 5.0 Kukabiliana na Umaskini.',1),
  ('Sarufi','Ngeli ya U -YA','Maadili','Official KICD Grade 5 Kiswahili revised-design Mada 6.0 Maadili.',1),
  ('Sarufi','Ngeli ya KU -KU','Elimu ya Mazingira','Official KICD Grade 5 Kiswahili revised-design Mada 7.0 Elimu ya Mazingira.',1),
  ('Sarufi','Mnyambuliko wa Vitenzi','Ndege wa Porini','Official KICD Grade 5 Kiswahili revised-design Mada 8.0 Ndege wa Porini.',1),
  ('Sarufi','Vinyume vya Vitenzi','Magonjwa','Official KICD Grade 5 Kiswahili revised-design Mada 9.0 Magonjwa.',1),
  ('Sarufi','Nyakati na Hali','Kudhibiti Itikadi za Kidini na za Kijamii','Official KICD Grade 5 Kiswahili revised-design Mada 10.0 Kudhibiti Itikadi za Kidini na za Kijamii.',1),
  ('Sarufi','Ukanushaji','Uwekezaji','Official KICD Grade 5 Kiswahili revised-design Mada 11.0 Uwekezaji.',1),
  ('Sarufi','Ukubwa na Udogo wa Nomino','Uwekezaji','Official KICD Grade 5 Kiswahili revised-design Mada 11.0 Uwekezaji.',1),
  ('Sarufi','Udogo wa Nomino','Uwekezaji','Official KICD Grade 5 Kiswahili revised-design Mada 11.0 Uwekezaji.',1)
) v(strand_name,sub_strand_name,topic_name,topic_description,topic_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.topic_name))
    AND t.topic_description ~* 'Official KICD Grade 5 Kiswahili'
);

COMMIT;
