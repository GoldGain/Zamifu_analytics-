-- Source-verified KICD Grade 7 Pre-Technical Studies addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
-- Official Drive file: 1vBIF-5Z0-hpYxr2YWJIrg1ATzO9f4YRH (July 2024 revised design).
-- Additive/idempotent: legacy rows are preserved.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 7 Pre-Technical Studies revised-design strand.', v.strand_order
FROM (VALUES
 ('Foundations of Pre-Technical Studies',1),('Communication in Pre-Technical Studies',2),('Materials for Production',3),('Tools and Production',4),('Entrepreneurship',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='pre-technical studies'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 7 Pre-Technical Studies revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Foundations of Pre-Technical Studies','Introduction to Pre-Technical',1),('Foundations of Pre-Technical Studies','Safety in the Immediate Environment',2),('Foundations of Pre-Technical Studies','Computer Concepts',3),
 ('Communication in Pre-Technical Studies','Introduction to Drawing',1),('Communication in Pre-Technical Studies','Free-hand Sketching',2),('Communication in Pre-Technical Studies','ICT Tools',3),
 ('Materials for Production','Introduction to Materials for Production',1),('Materials for Production','Metallic',2),('Materials for Production','Non-Metallic',3),
 ('Tools and Production','Measuring and Marking Out',1),('Tools and Production','Computer Hardware',2),
 ('Entrepreneurship','Introduction to Entrepreneurship',1),('Entrepreneurship','Production Unit',2),('Entrepreneurship','Financial Goals',3)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='pre-technical studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 7 Pre-Technical Studies revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Foundations of Pre-Technical Studies','Introduction to Pre-Technical'),('Foundations of Pre-Technical Studies','Safety in the Immediate Environment'),('Foundations of Pre-Technical Studies','Computer Concepts'),('Communication in Pre-Technical Studies','Introduction to Drawing'),('Communication in Pre-Technical Studies','Free-hand Sketching'),('Communication in Pre-Technical Studies','ICT Tools'),('Materials for Production','Introduction to Materials for Production'),('Materials for Production','Metallic'),('Materials for Production','Non-Metallic'),('Tools and Production','Measuring and Marking Out'),('Tools and Production','Computer Hardware'),('Entrepreneurship','Introduction to Entrepreneurship'),('Entrepreneurship','Production Unit'),('Entrepreneurship','Financial Goals')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='pre-technical studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 7 Pre-Technical Studies%');
COMMIT;
