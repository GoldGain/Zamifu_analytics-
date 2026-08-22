-- Source-verified KICD Grade 8 Mathematics addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1ttNvzuQbHUnABVcP-TAoix8-TVmehYph
-- The seed is additive and preserves legacy hierarchy rows.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 Mathematics revised-2024 strand.', v.strand_order
FROM (VALUES
 ('Numbers',1),('Algebra',2),('Measurements',3),('Geometry',4),('Data Handling and Probability',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='mathematics'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 Mathematics revised-2024 sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Numbers','Integers',1),('Numbers','Fractions',2),('Numbers','Decimals',3),('Numbers','Squares and Square Roots',4),('Numbers','Rates, Ratio, Proportions Percentages',5),
 ('Algebra','Algebraic Expressions',1),('Algebra','Linear Equations',2),
 ('Measurements','Circles',1),('Measurements','Area',2),('Measurements','Money',3),
 ('Geometry','Geometrical Constructions',1),('Geometry','Coordinates graphs',2),('Geometry','Scale Drawing',3),('Geometry','Common Solids',4),
 ('Data Handling and Probability','Data Presentation and Interpretation',1),('Data Handling and Probability','Probability',2)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='mathematics'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], 1
FROM (VALUES
 ('Numbers','Integers','Representing integers on a number line; addition and subtraction of integers','Exact Grade 8 KICD detailed content focus.'),
 ('Numbers','Fractions','Reciprocals of fractions and combined operations on fractions','Exact Grade 8 KICD detailed content focus.'),
 ('Numbers','Decimals','Conversions, recurring decimals, rounding, significant figures, standard form and operations','Exact Grade 8 KICD detailed content focus.'),
 ('Data Handling and Probability','Data Presentation and Interpretation','Presentation and interpretation of data','Exact Grade 8 KICD summary sub-strand and content focus.')
) v(strand_name,sub_strand_name,topic_name,topic_description)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='mathematics'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Grade 8 KICD%');
COMMIT;
