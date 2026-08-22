-- Source-verified KICD Social Studies topic-anchor additions.
-- Official KICD Drive files:
--   Grade 6 Social Studies: 1H1QZ6wgFPsEL6S4A7dFdjukr2jEG8sS2
--   Grade 8 Social Studies: 1yx30v28nVLKYSByRB9G2Omalh76-ZL6h
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/
--
-- These rows are conservative source-summary topic anchors. The official summary
-- tables support the exact parent/sub-strand labels, but this migration does not
-- pretend that every mirrored name is a verbatim detailed content heading.
-- Existing detailed topic rows are preserved; NOT EXISTS makes the migration
-- additive and idempotent.

BEGIN;

-- Grade 6 has one source-tagged official sub-strand without its matching anchor.
INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, 'Vegetation in Eastern Africa',
       'Official KICD Grade 6 Social Studies source-summary topic anchor; mirrors the exact official summary sub-strand heading and is not claimed as a verbatim detailed topic.',
       ARRAY[]::text[], 1
FROM curriculum_grades g
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = 'social studies'
JOIN curriculum_strands st ON st.subject_id = s.id
  AND lower(trim(st.strand_name)) = 'natural and the built environments'
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id = st.id
  AND lower(trim(ss.sub_strand_name)) = 'vegetation in eastern africa'
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE g.grade_number = 6
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_topics t
    WHERE t.sub_strand_id = ss.id
      AND lower(trim(t.topic_name)) = 'vegetation in eastern africa'
      AND t.topic_description ~* 'Official KICD Grade 6 Social Studies'
  );

-- Grade 8 official summary parents with missing topic anchors.
INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.sub_strand_name,
       'Official KICD Grade 8 Social Studies source-summary topic anchor; mirrors the exact official summary sub-strand heading and is not claimed as a verbatim detailed topic.',
       ARRAY[]::text[], 1
FROM (VALUES
  ('Social Studies and Personal Management', 'Self-Esteem Assessment'),
  ('Community Service Learning', 'Service-Learning Project'),
  ('People and Relationships', 'Scientific Theory about Human Origin'),
  ('People and Relationships', 'Early Civilisations in Asia and Europe'),
  ('People and Relationships', 'Trans-Saharan Slave Trade'),
  ('People and Relationships', 'Population Growth in Africa'),
  ('People and Relationships', 'Diversity'),
  ('People and Relationships', 'Interpersonal Skills'),
  ('People and Relationships', 'Peaceful Conflict Resolutions'),
  ('Natural and Historic Built Environments', 'Map Reading and Interpretation'),
  ('Natural and Historic Built Environments', 'Weather and Climate'),
  ('Natural and Historic Built Environments', 'Vegetation'),
  ('Natural and Historic Built Environments', 'Historical Sites and Monuments'),
  ('Political Developments and Governance', 'Governance'),
  ('Political Developments and Governance', 'The Constitution of Kenya'),
  ('Political Developments and Governance', 'Rights'),
  ('Political Developments and Governance', 'Citizenship')
) AS v(strand_name, sub_strand_name)
JOIN curriculum_grades g ON g.grade_number = 8
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = 'social studies'
JOIN curriculum_strands st ON st.subject_id = s.id
  AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id = st.id
  AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id = ss.id
    AND lower(trim(t.topic_name)) = lower(trim(v.sub_strand_name))
    AND t.topic_description ~* 'Official KICD Grade 8 Social Studies'
);

COMMIT;
