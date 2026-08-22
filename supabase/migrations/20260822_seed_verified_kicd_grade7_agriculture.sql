-- Source-verified KICD Grade 7 Agriculture addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
-- Official Drive file: 1ShQA3XZmu_X2jKolAA_rGzbvFVHNe-FA (Agriculture Grade 7, 1 August 2024 proofread design).
-- Production subject alias is Agriculture and Nutrition; the source curriculum title is Agriculture.
-- Additive/idempotent: legacy rows are preserved.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 7 Agriculture revised-design strand.', v.strand_order
FROM (VALUES
 ('Conservation of Resources',1),('Production Processes',2),('Hygiene',3),('Techniques',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='agriculture and nutrition'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 7 Agriculture revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Conservation of Resources','Controlling Soil Pollution',1),('Conservation of Resources','Constructing Water Retention Structures',2),('Conservation of Resources','Conserving Food Nutrients',3),('Conservation of Resources','Growing Trees',4),
 ('Production Processes','Crop Establishment',1),('Production Processes','Selected Management Practises',2),('Production Processes','Preparing Animal Products',3),('Production Processes','Cooking',4),
 ('Hygiene','Hygiene in Rearing Animals',1),('Hygiene','Laundry: Loose-coloured Items',2),
 ('Techniques','Knitting Skills',1),('Techniques','Framed Suspended Garden',2),('Techniques','Adding Value to Produce',3),('Techniques','Making Homemade Soap',4)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='agriculture and nutrition'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 7 Agriculture revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Conservation of Resources','Controlling Soil Pollution'),('Conservation of Resources','Constructing Water Retention Structures'),('Conservation of Resources','Conserving Food Nutrients'),('Conservation of Resources','Growing Trees'),('Production Processes','Crop Establishment'),('Production Processes','Selected Management Practises'),('Production Processes','Preparing Animal Products'),('Production Processes','Cooking'),('Hygiene','Hygiene in Rearing Animals'),('Hygiene','Laundry: Loose-coloured Items'),('Techniques','Knitting Skills'),('Techniques','Framed Suspended Garden'),('Techniques','Adding Value to Produce'),('Techniques','Making Homemade Soap')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='agriculture and nutrition'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 7 Agriculture%');
COMMIT;
