-- Official index: https://kicd.ac.ke/cbc-materials/lower-primary/
-- Official Drive file: 1YlwoCFAVxhjUo_V1A-89GRcho0r0Gq1u (Mathematical Activities Grade 1, 2 & 3 - Revised.pdf).
-- Exact Grade 2 content headings: official viewer pages 47, 79, 80, 86, 87, 88, 89, 70–73.
-- Additive/idempotent; no existing rows are deleted, renamed, or broadly overwritten.
BEGIN;

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], v.topic_order
FROM (VALUES
  ('Numbers','Whole','Counting forward and backward','Official KICD Grade 2 Mathematics detailed table heading: counting forward and backward.',1),
  ('Numbers','Whole','Place value','Official KICD Grade 2 Mathematics detailed table heading: place value.',2),
  ('Numbers','Whole','Reading and writing numbers','Official KICD Grade 2 Mathematics detailed table heading: reading and writing numbers.',3),
  ('Numbers','Addition','Addition of numbers','Official KICD Grade 2 Mathematics detailed table heading: addition of numbers.',1),
  ('Numbers','Addition','Missing numbers','Official KICD Grade 2 Mathematics detailed table heading: missing numbers in addition patterns.',2),
  ('Numbers','Subtraction','Subtraction of numbers','Official KICD Grade 2 Mathematics detailed table heading: subtraction of numbers.',1),
  ('Numbers','Subtraction','Missing numbers','Official KICD Grade 2 Mathematics detailed table heading: missing numbers in subtraction patterns.',2),
  ('Measurements','Time','Months of the year','Official KICD Grade 2 Mathematics detailed table heading: months of the year.',1),
  ('Measurements','Time','Days in a month','Official KICD Grade 2 Mathematics detailed table heading: days in a month.',2),
  ('Measurements','Time','Calendar','Official KICD Grade 2 Mathematics detailed table heading: calendar.',3),
  ('Measurements','Time','Minute and hour hand','Official KICD Grade 2 Mathematics detailed table heading: minute and hour hand.',4),
  ('Measurements','Time','Reading and writing time','Official KICD Grade 2 Mathematics detailed table heading: reading and writing time.',5),
  ('Measurements','Money','Kenyan currency','Official KICD Grade 2 Mathematics detailed table heading: Kenyan currency.',1),
  ('Measurements','Money','Counting money','Official KICD Grade 2 Mathematics detailed table heading: counting money.',2),
  ('Measurements','Money','Addition in money','Official KICD Grade 2 Mathematics detailed table heading: addition in money.',3)
) AS v(strand_name, sub_strand_name, topic_name, topic_description, topic_order)
JOIN curriculum_grades g ON g.grade_number=2
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='mathematics'
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
