-- Source-verified KICD Grade 6 Social Studies addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
-- Readable KICD-printed cross-check: https://www.teacherspalace.co.ke/uploads/documents/grade-6-social-studies-revised-oct-1-unlocked-2025-01-05-9sliAQRfhA.pdf
-- The seed is additive and preserves legacy hierarchy rows.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 6 Social Studies strand; exact summary label from the KICD-printed design.', v.strand_order
FROM (VALUES
 ('Natural and the Built Environments',1),('People and Social Organisation',2),('Resources and Economic Activities in Eastern Africa',3),('Political Systems',4),('Governance',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 6 Social Studies sub-strand; exact summary label from the KICD-printed design.', v.sub_strand_order
FROM (VALUES
 ('Natural and the Built Environments','Position and Size of Countries in Eastern Africa',1),('Natural and the Built Environments','Main Physical Features in Eastern Africa',2),('Natural and the Built Environments','Climatic Regions in Eastern Africa',3),('Natural and the Built Environments','Vegetation in Eastern Africa',4),('Natural and the Built Environments','Historic Built Environments',5),
 ('People and Social Organisation','Language Groups in Eastern Africa',1),('People and Social Organisation','Population Distribution in Eastern Africa',2),('People and Social Organisation','Culture and Social Organisation',3),('People and Social Organisation','School and Community',4),
 ('Resources and Economic Activities in Eastern Africa','Beef Farming',1),('Resources and Economic Activities in Eastern Africa','Fishing',2),('Resources and Economic Activities in Eastern Africa','Wildlife and Tourism',3),('Resources and Economic Activities in Eastern Africa','Transport',4),('Resources and Economic Activities in Eastern Africa','Communication',5),('Resources and Economic Activities in Eastern Africa','Mining',6),
 ('Political Systems','Traditional Forms of Government',1),('Political Systems','Regional Co-operations',2),('Political Systems','Citizenship',3),('Political Systems','Human Rights',4),
 ('Governance','Peace and Conflict Resolution',1),('Governance','Government Revenue and Expenditure',2),('Governance','Preamble of the Constitution of Kenya',3)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 6 Social Studies content anchor from the KICD-printed curriculum design summary.', ARRAY[]::text[], 1
FROM (VALUES
 ('Natural and the Built Environments','Position and Size of Countries in Eastern Africa'),('Natural and the Built Environments','Main Physical Features in Eastern Africa'),('Natural and the Built Environments','Climatic Regions in Eastern Africa'),('Natural and the Built Environments','Historic Built Environments'),
 ('People and Social Organisation','Language Groups in Eastern Africa'),('People and Social Organisation','Population Distribution in Eastern Africa'),('People and Social Organisation','Culture and Social Organisation'),('People and Social Organisation','School and Community'),
 ('Resources and Economic Activities in Eastern Africa','Beef Farming'),('Resources and Economic Activities in Eastern Africa','Fishing'),('Resources and Economic Activities in Eastern Africa','Wildlife and Tourism'),('Resources and Economic Activities in Eastern Africa','Transport'),('Resources and Economic Activities in Eastern Africa','Communication'),('Resources and Economic Activities in Eastern Africa','Mining'),
 ('Political Systems','Traditional Forms of Government'),('Political Systems','Regional Co-operations'),('Political Systems','Citizenship'),('Political Systems','Human Rights'),
 ('Governance','Peace and Conflict Resolution'),('Governance','Government Revenue and Expenditure'),('Governance','Preamble of the Constitution of Kenya')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 6 Social Studies%');
COMMIT;
