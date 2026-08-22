-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/
-- Official Drive file: 1CituzlfluxqVvjExx7xHiV_j_ZDXwpja (Grade 5 Science and Technology.pdf).
-- Exact hierarchy source: KICD viewer page 13 summary table and page 14 detailed strand heading.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Science and Technology', 'SCI'
FROM curriculum_grades g
WHERE g.grade_number=5
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name))='science and technology'
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 5 Science and Technology revised-design strand.', v.strand_order
FROM (VALUES
  ('Living Things and their Environment',1),
  ('Matter',2),
  ('Force and Energy',3)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='science and technology'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 5 Science and Technology revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Living Things and their Environment','Classification of plants',1),
  ('Living Things and their Environment','Invertebrates',2),
  ('Living Things and their Environment','The Human Breathing system',3),
  ('Matter','Mixtures',1),
  ('Matter','Water Pollution',2),
  ('Force and Energy','Floating and Sinking',1),
  ('Force and Energy','Sound Energy',2),
  ('Force and Energy','Heat transfer',3)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='science and technology'
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
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 5 Science and Technology revised-design content anchor from the exact summary-table sub-strand heading.', ARRAY[]::text[], 1
FROM (VALUES
  ('Living Things and their Environment','Classification of plants'),
  ('Living Things and their Environment','Invertebrates'),
  ('Living Things and their Environment','The Human Breathing system'),
  ('Matter','Mixtures'),
  ('Matter','Water Pollution'),
  ('Force and Energy','Floating and Sinking'),
  ('Force and Energy','Sound Energy'),
  ('Force and Energy','Heat transfer')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='science and technology'
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
    AND t.topic_description ~* 'Official KICD Grade 5 Science and Technology'
);

COMMIT;
