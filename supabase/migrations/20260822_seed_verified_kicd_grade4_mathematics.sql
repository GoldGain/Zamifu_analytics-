-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/
-- Official Drive file: 1o5tDq16yC0Jj1h6zb9mo3dsxtjqXUk4G (Grade 4 Math Design - Revised.pdf).
-- Exact hierarchy source: KICD viewer page 12 summary table.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Mathematics', 'MATH'
FROM curriculum_grades g
WHERE g.grade_number=4
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name))='mathematics'
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 4 Mathematics revised-design strand.', v.strand_order
FROM (VALUES
  ('Numbers',1),
  ('Measurement',2),
  ('Geometry',3),
  ('Data Handling',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='mathematics'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 4 Mathematics revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Numbers','Whole Numbers',1),
  ('Numbers','Addition',2),
  ('Numbers','Subtraction',3),
  ('Numbers','Multiplication',4),
  ('Numbers','Division',5),
  ('Numbers','Fractions',6),
  ('Numbers','Decimals',7),
  ('Numbers','Use of letters',8),
  ('Measurement','Length',1),
  ('Measurement','Area',2),
  ('Measurement','Volume',3),
  ('Measurement','Capacity',4),
  ('Measurement','Mass',5),
  ('Measurement','Time',6),
  ('Measurement','Money',7),
  ('Geometry','Position and Direction',1),
  ('Geometry','Angles',2),
  ('Geometry','Plane Figures',3),
  ('Data Handling','Data',1)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='mathematics'
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
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 4 Mathematics revised-design content anchor from the exact summary-table sub-strand heading.', ARRAY[]::text[], 1
FROM (VALUES
  ('Numbers','Whole Numbers'),
  ('Numbers','Addition'),
  ('Numbers','Subtraction'),
  ('Numbers','Multiplication'),
  ('Numbers','Division'),
  ('Numbers','Fractions'),
  ('Numbers','Decimals'),
  ('Numbers','Use of letters'),
  ('Measurement','Length'),
  ('Measurement','Area'),
  ('Measurement','Volume'),
  ('Measurement','Capacity'),
  ('Measurement','Mass'),
  ('Measurement','Time'),
  ('Measurement','Money'),
  ('Geometry','Position and Direction'),
  ('Geometry','Angles'),
  ('Geometry','Plane Figures'),
  ('Data Handling','Data')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='mathematics'
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
    AND t.topic_description ~* 'Official KICD Grade 4 Mathematics'
);

COMMIT;
