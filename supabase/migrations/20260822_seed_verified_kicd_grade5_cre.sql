-- Source-verified KICD Grade 5 CRE addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/
-- Official Drive file: 1unhtcU1tzdsPceoadKCovjFIkPTF1wP4 (CRE Grade 5).
-- UI subject alias is Religious Education; internal subject code is CRE.
-- Additive/idempotent: legacy rows are preserved.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Religious Education', 'CRE'
FROM curriculum_grades g
WHERE g.grade_number=5
AND NOT EXISTS (SELECT 1 FROM curriculum_subjects s WHERE s.grade_id=g.id AND lower(trim(s.subject_name))='religious education');

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 5 CRE revised-design strand.', v.strand_order
FROM (VALUES
 ('Creation',1),('The Bible',2),('The Life of Jesus Christ',3),('The Church',4),('Christian Living',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 5 CRE revised-design summary heading.', 1
FROM (VALUES
 ('Creation','Creation'),('The Bible','The Bible'),('The Life of Jesus Christ','The Life of Jesus Christ'),('The Church','The Church'),('Christian Living','Christian Living')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 5 CRE revised-design summary content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Creation','Creation'),('The Bible','The Bible'),('The Life of Jesus Christ','The Life of Jesus Christ'),('The Church','The Church'),('Christian Living','Christian Living')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=5
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 5 CRE%');
COMMIT;
