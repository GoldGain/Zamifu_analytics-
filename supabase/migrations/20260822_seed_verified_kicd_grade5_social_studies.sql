-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/
-- Official Drive file: 1uOCVkljUKcfMkRs1gwAbDZMj_p9cjbut (Grade 5 Social Studies - Revised.pdf).
-- Exact hierarchy source: KICD viewer pages 12-13 summary table and page 14 detailed strand heading.
-- The summary table renders the first heading as Natural and the Built Environments; page 14's detailed source heading is Natural and Historic Built Environments. The detailed heading is used here because it is the explicit strand heading in the hierarchy table, consistent with the Grade 4 source nomenclature.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Social Studies', 'SST'
FROM curriculum_grades g
WHERE g.grade_number=5
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name))='social studies'
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 5 Social Studies revised-design strand.', v.strand_order
FROM (VALUES
  ('Natural and Historic Built Environments',1),
  ('People and Social Organisation',2),
  ('Resources and Economic Activities in Eastern Africa',3),
  ('Political Systems',4),
  ('Governance',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='social studies'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 5 Social Studies revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Natural and Historic Built Environments','Elements of a Map',1),
  ('Natural and Historic Built Environments','Location, position and size of Kenya',2),
  ('Natural and Historic Built Environments','Main Physical Features in Kenya',3),
  ('Natural and Historic Built Environments','Weather and Climate',4),
  ('Natural and Historic Built Environments','The Built Environments',5),
  ('People and Social Organisation','Language Groups in Kenya',1),
  ('People and Social Organisation','Population Distribution in Kenya',2),
  ('People and Social Organisation','African Traditional Education',3),
  ('People and Social Organisation','School Administration',4),
  ('Resources and Economic Activities in Eastern Africa','Resources in Kenya',1),
  ('Resources and Economic Activities in Eastern Africa','Mining in Kenya',2),
  ('Resources and Economic Activities in Eastern Africa','Fishing in Kenya',3),
  ('Resources and Economic Activities in Eastern Africa','Wildlife and Tourism in Kenya',4),
  ('Resources and Economic Activities in Eastern Africa','Development of Transport',5),
  ('Resources and Economic Activities in Eastern Africa','Development of Communication',6),
  ('Political Systems','Traditional Leaders in Kenya',1),
  ('Political Systems','Early forms of Government in Kenya',2),
  ('Political Systems','Citizenship in Kenya',3),
  ('Governance','National Unity in Kenya',1),
  ('Governance','Human Rights',2),
  ('Governance','Democracy in Society',3),
  ('Governance','National Government',4)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 5 Social Studies revised-design content anchor from the exact summary-table sub-strand heading.', ARRAY[]::text[], 1
FROM (VALUES
  ('Natural and Historic Built Environments','Elements of a Map'),
  ('Natural and Historic Built Environments','Location, position and size of Kenya'),
  ('Natural and Historic Built Environments','Main Physical Features in Kenya'),
  ('Natural and Historic Built Environments','Weather and Climate'),
  ('Natural and Historic Built Environments','The Built Environments'),
  ('People and Social Organisation','Language Groups in Kenya'),
  ('People and Social Organisation','Population Distribution in Kenya'),
  ('People and Social Organisation','African Traditional Education'),
  ('People and Social Organisation','School Administration'),
  ('Resources and Economic Activities in Eastern Africa','Resources in Kenya'),
  ('Resources and Economic Activities in Eastern Africa','Mining in Kenya'),
  ('Resources and Economic Activities in Eastern Africa','Fishing in Kenya'),
  ('Resources and Economic Activities in Eastern Africa','Wildlife and Tourism in Kenya'),
  ('Resources and Economic Activities in Eastern Africa','Development of Transport'),
  ('Resources and Economic Activities in Eastern Africa','Development of Communication'),
  ('Political Systems','Traditional Leaders in Kenya'),
  ('Political Systems','Early forms of Government in Kenya'),
  ('Political Systems','Citizenship in Kenya'),
  ('Governance','National Unity in Kenya'),
  ('Governance','Human Rights'),
  ('Governance','Democracy in Society'),
  ('Governance','National Government')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id
  AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.sub_strand_name))
    AND t.topic_description ~* 'Official KICD Grade 5 Social Studies'
);

COMMIT;
