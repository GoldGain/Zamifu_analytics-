-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/
-- Official Drive file: 1xfUKusjuRlNi22arhYCWy3IS_obPhcvL (AGRICULTURE Grade 4 30.07.2024.pdf).
-- Production catalog alias is Agriculture and Nutrition; source curriculum title is Agriculture.
-- Exact hierarchy source: KICD viewer page 11 summary plus detailed pages beginning at viewer page 13.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Agriculture and Nutrition', 'AGN'
FROM curriculum_grades g
WHERE g.grade_number=4
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 4 Agriculture revised-design strand.', v.strand_order
FROM (VALUES
  ('Conservation of Resources',1),
  ('Food Production Processes',2),
  ('Hygiene Practices',3),
  ('Production Techniques',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 4 Agriculture revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Conservation of Resources','Soil Conservation',1),
  ('Conservation of Resources','Water Conservation',2),
  ('Conservation of Resources','Fuel Conservation',3),
  ('Conservation of Resources','Conserving Wild Animals',4),
  ('Food Production Processes','Direct Sowing of Tiny Seeds',1),
  ('Food Production Processes','Growing Fruits',2),
  ('Food Production Processes','Uses of Domestic Animals',3),
  ('Food Production Processes','Balanced Meal',4),
  ('Food Production Processes','Cooking Food',5),
  ('Hygiene Practices','Personal Hygiene',1),
  ('Hygiene Practices','Domestic Hygiene',2),
  ('Hygiene Practices','Cleaning Personal Protective Equipment',3),
  ('Production Techniques','Making Tacking Stitches',1)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
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
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 4 Agriculture revised-design content anchor from the exact summary-table sub-strand heading.', ARRAY[]::text[], 1
FROM (VALUES
  ('Conservation of Resources','Soil Conservation'),
  ('Conservation of Resources','Water Conservation'),
  ('Conservation of Resources','Fuel Conservation'),
  ('Conservation of Resources','Conserving Wild Animals'),
  ('Food Production Processes','Direct Sowing of Tiny Seeds'),
  ('Food Production Processes','Growing Fruits'),
  ('Food Production Processes','Uses of Domestic Animals'),
  ('Food Production Processes','Balanced Meal'),
  ('Food Production Processes','Cooking Food'),
  ('Hygiene Practices','Personal Hygiene'),
  ('Hygiene Practices','Domestic Hygiene'),
  ('Hygiene Practices','Cleaning Personal Protective Equipment'),
  ('Production Techniques','Making Tacking Stitches')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
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
    AND t.topic_description ~* 'Official KICD Grade 4 Agriculture'
);

COMMIT;
