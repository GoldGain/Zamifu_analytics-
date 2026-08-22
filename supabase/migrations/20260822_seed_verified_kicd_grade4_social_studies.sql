-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/
-- Official Drive file: 1I81sEkJJz7zj2rp4thpUN3MOlHPK5-mG (Grade 4 Social Studies 20.6.2024 - Revised.pdf).
-- Exact hierarchy source: KICD viewer page 12 summary and detailed page 13 heading.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Social Studies', 'SST'
FROM curriculum_grades g
WHERE g.grade_number=4
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name))='social studies'
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 4 Social Studies revised-design strand.', v.strand_order
FROM (VALUES
  ('Natural and Historic Built Environments',1),
  ('People and Population',2),
  ('Social Organisations',3),
  ('Resources and Economic Activities',4),
  ('Citizenship and Governance in Kenya',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='social studies'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 4 Social Studies revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Natural and Historic Built Environments','Compass Direction',1),
  ('Natural and Historic Built Environments','Location and size of the County',2),
  ('Natural and Historic Built Environments','Physical features in the County',3),
  ('Natural and Historic Built Environments','Seasons in the County',4),
  ('Natural and Historic Built Environments','Historic Built Environments in the County',5),
  ('People and Population','Inter-dependence of people',1),
  ('People and Population','Population distribution',2),
  ('Social Organisations','Aspects of Traditional Culture in the County',1),
  ('Social Organisations','The school',2),
  ('Resources and Economic Activities','Economic activities in the County',1),
  ('Resources and Economic Activities','Industries in the County',2),
  ('Resources and Economic Activities','Enterprise Project at school',3),
  ('Citizenship and Governance in Kenya','Good Citizenship in School',1),
  ('Citizenship and Governance in Kenya','Peace',2),
  ('Citizenship and Governance in Kenya','Child Rights',3),
  ('Citizenship and Governance in Kenya','Democracy in school',4),
  ('Citizenship and Governance in Kenya','Children’s Government in school',5),
  ('Citizenship and Governance in Kenya','Community Leadership',6),
  ('Citizenship and Governance in Kenya','The County Governments in Kenya',7)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=4
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
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 4 Social Studies revised-design content anchor from the exact summary-table sub-strand heading.', ARRAY[]::text[], 1
FROM (VALUES
  ('Natural and Historic Built Environments','Compass Direction'),
  ('Natural and Historic Built Environments','Location and size of the County'),
  ('Natural and Historic Built Environments','Physical features in the County'),
  ('Natural and Historic Built Environments','Seasons in the County'),
  ('Natural and Historic Built Environments','Historic Built Environments in the County'),
  ('People and Population','Inter-dependence of people'),
  ('People and Population','Population distribution'),
  ('Social Organisations','Aspects of Traditional Culture in the County'),
  ('Social Organisations','The school'),
  ('Resources and Economic Activities','Economic activities in the County'),
  ('Resources and Economic Activities','Industries in the County'),
  ('Resources and Economic Activities','Enterprise Project at school'),
  ('Citizenship and Governance in Kenya','Good Citizenship in School'),
  ('Citizenship and Governance in Kenya','Peace'),
  ('Citizenship and Governance in Kenya','Child Rights'),
  ('Citizenship and Governance in Kenya','Democracy in school'),
  ('Citizenship and Governance in Kenya','Children’s Government in school'),
  ('Citizenship and Governance in Kenya','Community Leadership'),
  ('Citizenship and Governance in Kenya','The County Governments in Kenya')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=4
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
    AND t.topic_description ~* 'Official KICD Grade 4 Social Studies'
);

COMMIT;
