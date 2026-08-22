-- Source-verified KICD Grade 8 Agriculture addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1MzOFhLc8kbRwvjg03q7oeDrbbvux75Wy (Agriculture Grade 8, 1 August 2024 proofread design).
-- Production subject alias is Agriculture and Nutrition; the source curriculum title is Agriculture.
-- Additive/idempotent: legacy rows are preserved.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 Agriculture revised-design strand.', v.strand_order
FROM (VALUES
 ('Conservation of Resources',1),('Food Production Processes',2),('Hygiene Practices',3),('Production Techniques',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='agriculture and nutrition'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 Agriculture revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Conservation of Resources','Soil Measures',1),('Conservation of Resources','Water Harvesting and Storage',2),
 ('Food Production Processes','Kitchen and Backyard Gardening',1),('Food Production Processes','Poultry Rearing in Fold',2),('Food Production Processes','Crop Pest and Disease Control',3),('Food Production Processes','Preparation of Animal Products',4),('Food Production Processes','Preserving Animal Products',5),('Food Production Processes','Cooking: Preparing Balanced Meal',6),
 ('Hygiene Practices','Cleaning the Kitchen',1),
 ('Production Techniques','Sewing Skills: Constructing Household Items',1),('Production Techniques','Constructing Innovative Animal Waterer',2),('Production Techniques','ICT Support Services',3)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='agriculture and nutrition'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 8 Agriculture revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Conservation of Resources','Soil Measures'),('Conservation of Resources','Water Harvesting and Storage'),('Food Production Processes','Kitchen and Backyard Gardening'),('Food Production Processes','Poultry Rearing in Fold'),('Food Production Processes','Crop Pest and Disease Control'),('Food Production Processes','Preparation of Animal Products'),('Food Production Processes','Preserving Animal Products'),('Food Production Processes','Cooking: Preparing Balanced Meal'),('Hygiene Practices','Cleaning the Kitchen'),('Production Techniques','Sewing Skills: Constructing Household Items'),('Production Techniques','Constructing Innovative Animal Waterer'),('Production Techniques','ICT Support Services')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='agriculture and nutrition'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 8 Agriculture%');
COMMIT;
