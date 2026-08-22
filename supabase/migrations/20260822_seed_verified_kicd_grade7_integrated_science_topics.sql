-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
-- Official Drive file: 1jbicj1qkLFEV_ZXwO8Kmlw7KzGhZD2ri (Integrated Science Grade 7 - July 2024.pdf).
-- Exact source: KICD viewer page 13 detailed table plus the saved official summary extraction.
-- Conservative topic anchors are used where the official summary exposes a sub-strand but no separate topic column.
-- Additive/idempotent; no legacy junior rows are deleted or relabelled.
BEGIN;

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], v.topic_order
FROM (VALUES
  ('Scientific Investigation','Introduction to Integrated Science','Components of Integrated Science as a field of study','Official KICD Grade 7 Integrated Science detailed content heading.',1),
  ('Scientific Investigation','Introduction to Integrated Science','Importance of science in daily life, health, agriculture, industry, transport, food and textile, and work opportunities','Official KICD Grade 7 Integrated Science detailed content heading.',2),
  ('Scientific Investigation','Laboratory Safety','Laboratory Safety','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1),
  ('Scientific Investigation','Laboratory Apparatus and Instruments','Laboratory Apparatus and Instruments','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1),
  ('Mixtures, Elements and Compounds','Mixtures','Mixtures','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1),
  ('Mixtures, Elements and Compounds','Acids, Bases and Indicators','Acids, Bases and Indicators','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1),
  ('Living Things and the Environment','Human Reproductive System','Human Reproductive System','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1),
  ('Living Things and the Environment','Human Excretory System','Human Excretory System','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1),
  ('Force and Energy','Electrical Energy','Electrical Energy','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1),
  ('Force and Energy','Magnetism','Magnetism','Official KICD Grade 7 Integrated Science source-summary topic anchor.',1)
) AS v(strand_name, sub_strand_name, topic_name, topic_description, topic_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='integrated science'
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id
  AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.topic_name))
    AND t.topic_description ~* '(official|source-verified)[[:space:]]+kicd'
);

COMMIT;
