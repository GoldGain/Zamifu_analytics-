-- Source-verified KICD Grade 7 Social Studies addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
-- Official Drive file: 1nr9z0Z11ue76h2odpYQJNeUU4jFJWbbB
-- The seed is additive and preserves legacy hierarchy rows.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 7 Social Studies revised-design strand.', v.strand_order
FROM (VALUES
 ('Social Studies and Personal Development',1),('People and Relationships',2),('Community Service-Learning',3),('Natural and Historic Built Environments',4),('Political Development and Governance',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 7 Social Studies revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Social Studies and Personal Development','Self-Exploration',1),('Social Studies and Personal Development','Entrepreneurial Opportunities in Social Studies',2),
 ('People and Relationships','Human Origin',1),('People and Relationships','Early Civilisation',2),('People and Relationships','Slavery and Servitude',3),('People and Relationships','Developments in Medium of Trade',4),('People and Relationships','Diversity and Interpersonal Relationships',5),('People and Relationships','Peaceful Coexistence',6),
 ('Community Service-Learning','Project',1),
 ('Natural and Historic Built Environments','Historical Information',1),('Natural and Historic Built Environments','Agriculture',2),('Natural and Historic Built Environments','Maps and Map Work',3),('Natural and Historic Built Environments','Earth and the Solar System',4),('Natural and Historic Built Environments','Weather',5),('Natural and Historic Built Environments','Fieldwork',6),
 ('Political Development and Governance','Political Development in Africa up to 1900',1),('Political Development and Governance','The Constitution of Kenya',2),('Political Development and Governance','Human Rights',3),('Political Development and Governance','African Diasporas',4),('Political Development and Governance','Citizenship',5)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 7 Social Studies revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Social Studies and Personal Development','Self-Exploration'),('Social Studies and Personal Development','Entrepreneurial Opportunities in Social Studies'),('People and Relationships','Human Origin'),('People and Relationships','Early Civilisation'),('People and Relationships','Slavery and Servitude'),('People and Relationships','Developments in Medium of Trade'),('People and Relationships','Diversity and Interpersonal Relationships'),('People and Relationships','Peaceful Coexistence'),('Community Service-Learning','Project'),('Natural and Historic Built Environments','Maps and Map Work'),('Natural and Historic Built Environments','Earth and the Solar System'),('Natural and Historic Built Environments','Weather'),('Natural and Historic Built Environments','Fieldwork'),('Political Development and Governance','Political Development in Africa up to 1900'),('Political Development and Governance','The Constitution of Kenya'),('Political Development and Governance','Human Rights'),('Political Development and Governance','African Diasporas'),('Political Development and Governance','Citizenship')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 7 Social Studies%');
COMMIT;
