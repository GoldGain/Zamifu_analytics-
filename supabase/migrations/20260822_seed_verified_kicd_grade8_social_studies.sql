-- Source-verified KICD Grade 8 Social Studies addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1yx30v28nVLKYSByRB9G2Omalh76-ZL6h
-- The seed is additive and preserves legacy hierarchy rows.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 Social Studies revised-design strand.', v.strand_order
FROM (VALUES
 ('Social Studies and Personal Management',1),('Community Service Learning',2),('People and Relationships',3),('Natural and Historic Built Environments',4),('Political Developments and Governance',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 Social Studies revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Social Studies and Personal Management','Self-Improvement',1),('Social Studies and Personal Management','Self-Esteem Assessment',2),
 ('Community Service Learning','Service-Learning Project',1),
 ('People and Relationships','Scientific Theory about Human Origin',1),('People and Relationships','Early Civilisations in Asia and Europe',2),('People and Relationships','Trans-Saharan Slave Trade',3),('People and Relationships','Population Growth in Africa',4),('People and Relationships','Diversity',5),('People and Relationships','Interpersonal Skills',6),('People and Relationships','Peaceful Conflict Resolutions',7),
 ('Natural and Historic Built Environments','Map Reading and Interpretation',1),('Natural and Historic Built Environments','Weather and Climate',2),('Natural and Historic Built Environments','Vegetation',3),('Natural and Historic Built Environments','Historical Sites and Monuments',4),
 ('Political Developments and Governance','Governance',1),('Political Developments and Governance','The Constitution of Kenya',2),('Political Developments and Governance','Rights',3),('Political Developments and Governance','Citizenship',4)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 8 Social Studies revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Social Studies and Personal Management','Self-Improvement'),('Community Service Learning','Service-Learning Project'),('People and Relationships','Scientific Theory about Human Origin'),('Natural and Historic Built Environments','Map Reading and Interpretation'),('Political Developments and Governance','The Constitution of Kenya'),('Political Developments and Governance','Citizenship')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 8 Social Studies%');
COMMIT;
