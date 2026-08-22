-- Source-verified KICD English Language additions for Grade 6.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
-- Official Grade 6 Drive file: 1QR9nW3baakrHLIIpv-9UfQyMbOoDTcDX
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'English', 'ENG'
FROM curriculum_grades g
WHERE g.grade_number=6
  AND NOT EXISTS (SELECT 1 FROM curriculum_subjects s WHERE s.grade_id=g.id AND lower(trim(s.subject_name))='english');

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 6 English Language strand.', v.strand_order
FROM (VALUES
 ('Listening and Speaking',1),('Reading',2),('Language Use',3),('Writing',4)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 6 English Language sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Listening and Speaking','Pronunciation vocabulary',1),
 ('Reading','Extensive reading',1),('Reading','Intensive',2),('Reading','Fluency',3),
 ('Language Use','Word classes',1),('Language Use','Tenses',2),
 ('Writing','Creative writing',1),('Writing','Functional',2),('Writing','Mechanics',3),('Writing','Guided compositions',4)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], 1
FROM (VALUES
 ('Listening and Speaking','Pronunciation vocabulary','The /ɪə/ sound and child-labour vocabulary','Official Grade 6 KICD detailed content under the Child Labour theme; words include tear, appear, rear, clear and severe.'),
 ('Reading','Extensive reading','Child labour reference reading','Official Grade 6 KICD first-theme context for selecting and discussing age-appropriate reading materials.')
) v(strand_name,sub_strand_name,topic_name,topic_description)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)));
COMMIT;
