-- Corrective additive KICD lower-primary CRE completion.
-- Official KICD Drive file: 1YSXfOr81O2bn5t0ILvqDYkz3GchE9M3i
-- The preceding migration intentionally preserved exact visible Grade 1–3
-- evidence but its sub-strand VALUES contained only the Grade 1 rows. This
-- correction adds the exact official Grade 2 and Grade 3 `My Family` rows.
-- Additive/idempotent: existing rows are preserved and NOT EXISTS is used.

BEGIN;

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, 'My Family',
       'Official KICD Lower Primary Christian Religious Education Activities revised-2024 exact table-level sub-strand.',
       2
FROM curriculum_grades g
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))='creation'
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE g.grade_number IN (2,3)
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_sub_strands ss
    WHERE ss.strand_id=st.id
      AND lower(trim(ss.sub_strand_name))='my family'
      AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
  );

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, 'My Family',
       'Official KICD Lower Primary Christian Religious Education Activities revised-2024 exact table-level content anchor.',
       ARRAY[]::text[], 1
FROM curriculum_grades g
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))='creation'
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id
  AND lower(trim(ss.sub_strand_name))='my family'
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE g.grade_number IN (2,3)
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_topics t
    WHERE t.sub_strand_id=ss.id
      AND lower(trim(t.topic_name))='my family'
      AND t.topic_description ~* 'Official KICD Lower Primary Christian Religious Education'
  );

COMMIT;
