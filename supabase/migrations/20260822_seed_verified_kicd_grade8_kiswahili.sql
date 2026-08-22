-- Source-verified KICD Grade 8 Kiswahili addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1l-TPHn7cSCasqwb7auMUX2Cbtcu2cWoI (Kiswahili Grade 8, July 2024 revised October design).
-- Additive/idempotent: legacy rows are preserved. Ambiguous OCR fragments are excluded.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 Kiswahili revised-design strand.', v.strand_order
FROM (VALUES
 ('Kusikiliza na Kuzungumza',1),('Kusoma',2),('Kuandika',3),('Sarufi',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 Kiswahili revised-design content heading.', v.sub_strand_order
FROM (VALUES
 ('Kusikiliza na Kuzungumza','Kujibu: Mahojiano',1),('Kusikiliza na Kuzungumza','kwa Kina: Sauti /g/ /gh/',2),('Kusikiliza na Kuzungumza','Hadithi: Mighani',3),('Kusikiliza na Kuzungumza','Visasili',4),('Kusikiliza na Kuzungumza','Maagizo',5),('Kusikiliza na Kuzungumza','Kufasiri',6),('Kusikiliza na Kuzungumza','Usikilizaji Husishi',7),('Kusikiliza na Kuzungumza','Uzungumzaji wa Papo Hapo',8),('Kusikiliza na Kuzungumza','/ch/ /sh/',9),('Kusikiliza na Kuzungumza','Hurafa Hekaya',10),('Kusikiliza na Kuzungumza','Kutumia Vidokezo vya Hoja',11),
 ('Kusoma','kwa Ufahamu: Simulizi',1),('Kusoma','Mapana: Matini ya kujichagulia',2),('Kusoma','Kina: Tamthilia',3),('Kusoma','Ufasaha',4),('Kusoma','Ufahamu',5),('Kusoma','Maudhui na Dhamira',6),('Kusoma','Ufupisho',7),('Kusoma','Mandhari na Ploti',8),('Kusoma','Kifungu cha Kushawishi',9),('Kusoma','Wahusika',10),('Kusoma','Mbinu za Lugha',11),
 ('Kuandika','Viakifishi: Alama ya hisi na Ritifaa',1),('Kuandika','Insha za Kubuni: Masimulizi',2),('Kuandika','Maelekezo',3),('Kuandika','Maelezo',4),('Kuandika','Viakifishi: Mtajo na mshazari',5),('Kuandika','Masimulizi',6),('Kuandika','Barua ya Kuomba Msaada',7),('Kuandika','Kiuamilifu: Hotuba ya kutoa ufafanuzi',8),('Kuandika','Baruapepe Kiofisi',9),
 ('Sarufi','Nyakati Hali: Hali ya mazoea na timilifu',1),('Sarufi','Wakati uliopita na hali ya ujao',2),('Sarufi','Vivumishi: Sifa na Viashiria',3),('Sarufi','Ngeli na Upatanisho wa Kisarufi: I-ZI, I-I',4),('Sarufi','Vinyume vya Vitenzi na Vielezi',5),('Sarufi','Mnyambuliko wa Vitenzi: Kauli ya Kutendeka, Kutendewa na Kutendatenda',6),('Sarufi','Aina za Sentensi: Sentensi changamano',7),('Sarufi','Ukanushaji kwa Kuzingatia Hali: Hali ya mazoea na timilifu',8),('Sarufi','Udogo wa Nomino',9),('Sarufi','Usemi Halisi na Taarifa',10)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 8 Kiswahili revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Kusikiliza na Kuzungumza','Kujibu: Mahojiano'),('Kusikiliza na Kuzungumza','kwa Kina: Sauti /g/ /gh/'),('Kusikiliza na Kuzungumza','Hadithi: Mighani'),('Kusikiliza na Kuzungumza','Visasili'),('Kusikiliza na Kuzungumza','Maagizo'),('Kusikiliza na Kuzungumza','Kufasiri'),('Kusikiliza na Kuzungumza','Usikilizaji Husishi'),('Kusikiliza na Kuzungumza','Uzungumzaji wa Papo Hapo'),('Kusikiliza na Kuzungumza','/ch/ /sh/'),('Kusikiliza na Kuzungumza','Hurafa Hekaya'),('Kusikiliza na Kuzungumza','Kutumia Vidokezo vya Hoja'),
 ('Kusoma','kwa Ufahamu: Simulizi'),('Kusoma','Mapana: Matini ya kujichagulia'),('Kusoma','Kina: Tamthilia'),('Kusoma','Ufasaha'),('Kusoma','Ufahamu'),('Kusoma','Maudhui na Dhamira'),('Kusoma','Ufupisho'),('Kusoma','Mandhari na Ploti'),('Kusoma','Kifungu cha Kushawishi'),('Kusoma','Wahusika'),('Kusoma','Mbinu za Lugha'),
 ('Kuandika','Viakifishi: Alama ya hisi na Ritifaa'),('Kuandika','Insha za Kubuni: Masimulizi'),('Kuandika','Maelekezo'),('Kuandika','Maelezo'),('Kuandika','Viakifishi: Mtajo na mshazari'),('Kuandika','Masimulizi'),('Kuandika','Barua ya Kuomba Msaada'),('Kuandika','Kiuamilifu: Hotuba ya kutoa ufafanuzi'),('Kuandika','Baruapepe Kiofisi'),
 ('Sarufi','Nyakati Hali: Hali ya mazoea na timilifu'),('Sarufi','Wakati uliopita na hali ya ujao'),('Sarufi','Vivumishi: Sifa na Viashiria'),('Sarufi','Ngeli na Upatanisho wa Kisarufi: I-ZI, I-I'),('Sarufi','Vinyume vya Vitenzi na Vielezi'),('Sarufi','Mnyambuliko wa Vitenzi: Kauli ya Kutendeka, Kutendewa na Kutendatenda'),('Sarufi','Aina za Sentensi: Sentensi changamano'),('Sarufi','Ukanushaji kwa Kuzingatia Hali: Hali ya mazoea na timilifu'),('Sarufi','Udogo wa Nomino'),('Sarufi','Usemi Halisi na Taarifa')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='kiswahili'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 8 Kiswahili%');
COMMIT;
