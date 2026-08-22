-- Source-verified KICD Grade 6 Agriculture addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
-- Official Drive file: 18PxeRHiqXx4I3uj71kxqspQn8za43YLO (AGRICULTURE Grade 6, revised 2024).
-- Production catalog alias is Agriculture and Nutrition; source curriculum title is Agriculture.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Agriculture and Nutrition', 'AGN'
FROM curriculum_grades g
WHERE g.grade_number=6
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 6 Agriculture revised-design strand.', v.strand_order
FROM (VALUES
  ('Conservation of Resources',1),('Food Production Processes',2),('Hygiene Practices',3),('Production Techniques',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 6 Agriculture revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Conservation of Resources','Controlling Soil Erosion',1),('Conservation of Resources','Conserving Water',2),('Conservation of Resources','Conserving Wild Animals',3),
  ('Food Production Processes','Rearing Small Domestic Animals',1),('Food Production Processes','Preserving Crop Products',2),('Food Production Processes','Cooking Food',3),
  ('Hygiene Practices','Good Grooming',1),('Hygiene Practices','Laundry: Stain Removal',2),
  ('Production Techniques','Crocheting of Personal Protective Equipment',1),('Production Techniques','Constructing Moist Bed Garden',2)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], v.topic_order
FROM (VALUES
  ('Conservation of Resources','Controlling Soil Erosion','Official KICD Grade 6 Agriculture revised-design content anchor for Controlling Soil Erosion.',1),
  ('Conservation of Resources','Sunken seedbed','Official KICD Grade 6 Agriculture revised-design content heading under Conserving Water.',1),
  ('Conservation of Resources','Shallow pits','Official KICD Grade 6 Agriculture revised-design content heading under Conserving Water.',2),
  ('Conservation of Resources','Conserving Wild Animals','Official KICD Grade 6 Agriculture revised-design content anchor for Conserving Wild Animals.',1),
  ('Food Production Processes','Rearing Small Domestic Animals','Official KICD Grade 6 Agriculture revised-design content anchor for Rearing Small Domestic Animals.',1),
  ('Food Production Processes','Preserving Crop Products','Official KICD Grade 6 Agriculture revised-design content anchor for Preserving Crop Products.',1),
  ('Food Production Processes','Cooking Food','Official KICD Grade 6 Agriculture revised-design content anchor for Cooking Food.',1),
  ('Hygiene Practices','Good Grooming','Official KICD Grade 6 Agriculture revised-design content anchor for Good Grooming.',1),
  ('Hygiene Practices','Laundry: Stain Removal','Official KICD Grade 6 Agriculture revised-design content anchor for Laundry: Stain Removal.',1),
  ('Production Techniques','Crocheting of Personal Protective Equipment','Official KICD Grade 6 Agriculture revised-design content anchor for Crocheting of Personal Protective Equipment.',1),
  ('Production Techniques','Constructing Moist Bed Garden','Official KICD Grade 6 Agriculture revised-design content anchor for Constructing Moist Bed Garden.',1)
) v(strand_name,topic_name,topic_description,topic_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND (
  (v.strand_name='Conservation of Resources' AND ((v.topic_name IN ('Sunken seedbed','Shallow pits') AND lower(trim(ss.sub_strand_name))='conserving water') OR lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name))))
  OR (v.strand_name<>'Conservation of Resources' AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)))
) AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.topic_name))
    AND t.topic_description ~* 'Official KICD Grade 6 Agriculture'
);

COMMIT;
