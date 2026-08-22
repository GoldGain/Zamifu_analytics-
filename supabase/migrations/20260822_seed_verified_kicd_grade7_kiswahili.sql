-- Source-verified KICD Grade 7 Kiswahili addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
-- Official Drive file: 1pZ3Q6EwKhyBSfpmbYCjF8yTDrJifUrJJ (Kiswahili Grade 7, July 2024 revised October design).
-- Additive/idempotent: legacy rows are preserved. Ambiguous OCR fragments are excluded.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 7 Kiswahili revised-design strand.', v.strand_order
FROM (VALUES
 ('Kusikiliza na Kuzungumza',1),('Kusoma',2),('Kuandika',3),('Sarufi',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 7 Kiswahili revised-design content heading.', v.sub_strand_order
FROM (VALUES
 ('Kusikiliza na Kuzungumza','Kujibu: Mazungumzo',1),('Kusikiliza na Kuzungumza','kwa Kina: Sauti /dh/ /th/',2),('Kusikiliza na Kuzungumza','Kufasiri',3),('Kusikiliza na Kuzungumza','Ufahamu: Ufahamu wa kusikiliza',4),('Kusikiliza na Kuzungumza','/d/ /nd/',5),('Kusikiliza na Kuzungumza','Kuambatanisha Vitendo/Ishara',6),('Kusikiliza na Kuzungumza','Makini',7),
 ('Kusoma','Kifungu cha Simulizi',1),('Kusoma','Mapana: Matini ya kujichagulia',2),('Kusoma','Kusoma kwa Kina: Novela',3),('Kusoma','Ufasaha',4),('Kusoma','Ufahamu',5),('Kusoma','Maudhui na Dhamira',6),('Kusoma','Ufupisho',7),('Kusoma','Ufahamu: Kifungu cha Kushawishi',8),('Kusoma','Wahusika',9),('Kusoma','Mbinu za Lugha',10),('Kusoma','Mjadala',11),
 ('Kuandika','Maelekezo',1),('Kuandika','Picha',2),('Kuandika','Maelezo',3),('Kuandika','Insha za Kubuni: Masimulizi',4),('Kuandika','Barua ya Kuomba Msamaha',5),('Kuandika','Kuandika Kidijitali: Baruapepe',6),
 ('Sarufi','Vishirikishi',1),('Sarufi','Sentensi: Sentensi Sahili',2),('Sarufi','Ukubwa wa Nomino',3)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 7 Kiswahili revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Kusikiliza na Kuzungumza','Kujibu: Mazungumzo'),('Kusikiliza na Kuzungumza','kwa Kina: Sauti /dh/ /th/'),('Kusikiliza na Kuzungumza','Kufasiri'),('Kusikiliza na Kuzungumza','Ufahamu: Ufahamu wa kusikiliza'),('Kusikiliza na Kuzungumza','/d/ /nd/'),('Kusikiliza na Kuzungumza','Kuambatanisha Vitendo/Ishara'),('Kusikiliza na Kuzungumza','Makini'),
 ('Kusoma','Kifungu cha Simulizi'),('Kusoma','Mapana: Matini ya kujichagulia'),('Kusoma','Kusoma kwa Kina: Novela'),('Kusoma','Ufasaha'),('Kusoma','Ufahamu'),('Kusoma','Maudhui na Dhamira'),('Kusoma','Ufupisho'),('Kusoma','Ufahamu: Kifungu cha Kushawishi'),('Kusoma','Wahusika'),('Kusoma','Mbinu za Lugha'),('Kusoma','Mjadala'),
 ('Kuandika','Maelekezo'),('Kuandika','Picha'),('Kuandika','Maelezo'),('Kuandika','Insha za Kubuni: Masimulizi'),('Kuandika','Barua ya Kuomba Msamaha'),('Kuandika','Kuandika Kidijitali: Baruapepe'),
 ('Sarufi','Vishirikishi'),('Sarufi','Sentensi: Sentensi Sahili'),('Sarufi','Ukubwa wa Nomino')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 7 Kiswahili%');
COMMIT;
