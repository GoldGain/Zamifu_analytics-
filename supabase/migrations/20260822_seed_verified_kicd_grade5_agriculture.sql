-- Source-verified KICD Grade 5 Agriculture addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/
-- Official Drive file: 1jlMN272UeRa-FbyB5es488O5jI9llekn (AGRICULTURE Grade 5, revised 2024).
-- Production catalog alias is Agriculture and Nutrition; source curriculum title is Agriculture.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Agriculture and Nutrition', 'AGN'
FROM curriculum_grades g
WHERE g.grade_number=5
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 5 Agriculture revised-design strand.', v.strand_order
FROM (VALUES
  ('Conservation of Resources',1),('Food Production Processes',2),('Hygiene Practices',3),('Production Techniques',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 5 Agriculture revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Conservation of Resources','Soil Conservation',1),('Conservation of Resources','Water Conservation',2),('Conservation of Resources','Conserving Wild Animals',3),
  ('Food Production Processes','Growing Vegetables',1),('Food Production Processes','Uses of Domestic Animals',2),('Food Production Processes','Preservation of Cereals and Pulses',3),('Food Production Processes','Food Nutrients',4),('Food Production Processes','Cooking Food',5),
  ('Hygiene Practices','Good Grooming Practices',1),('Hygiene Practices','Home Hygiene',2),('Hygiene Practices','Laundering Cotton Item',3),
  ('Production Techniques','Repairing Garments',1),('Production Techniques','Constructing Innovative Gardens',2)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 5 Agriculture revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
  ('Conservation of Resources','Soil Conservation'),('Conservation of Resources','Water Conservation'),('Conservation of Resources','Conserving Wild Animals'),
  ('Food Production Processes','Growing Vegetables'),('Food Production Processes','Uses of Domestic Animals'),('Food Production Processes','Preservation of Cereals and Pulses'),('Food Production Processes','Food Nutrients'),('Food Production Processes','Cooking Food'),
  ('Hygiene Practices','Good Grooming Practices'),('Hygiene Practices','Home Hygiene'),('Hygiene Practices','Laundering Cotton Item'),
  ('Production Techniques','Repairing Garments'),('Production Techniques','Constructing Innovative Gardens')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('agriculture','agriculture and nutrition')
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.sub_strand_name))
    AND t.topic_description ~* 'Official KICD Grade 5 Agriculture'
);

COMMIT;
