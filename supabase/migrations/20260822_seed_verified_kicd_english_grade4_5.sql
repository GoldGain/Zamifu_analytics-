-- Source-verified KICD English Language additions for Grade 4–5.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/
-- Grade 4 Drive file: 1o3j3bJwiqJyerdZIFPDJaSprYdTp3Eu1
-- Grade 5 Drive file: 1ctDo-PB4W6AKbKV0Lb-1OobOC2-L3_e_
-- All inserts use normalized lookups and NOT EXISTS because production has no
-- natural-key constraints on the curriculum hierarchy tables.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, v.subject_name, 'ENG'
FROM (VALUES (4,'English'),(5,'English')) v(grade_number,subject_name)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
WHERE NOT EXISTS (SELECT 1 FROM curriculum_subjects s WHERE s.grade_id=g.id AND lower(trim(s.subject_name))=lower(trim(v.subject_name)));

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, v.description, v.strand_order
FROM (VALUES
 (4,'Listening and Speaking','Official KICD Grade 4 English Language strand.',1),
 (4,'Reading','Official KICD Grade 4 English Language strand.',2),
 (4,'Language Use','Official KICD Grade 4 English Language strand.',3),
 (4,'Writing','Official KICD Grade 4 English Language strand.',4),
 (5,'Listening and Speaking','Official KICD Grade 5 English Language strand.',1),
 (5,'Reading','Official KICD Grade 5 English Language strand.',2),
 (5,'Grammar in Use','Official KICD Grade 5 English Language strand.',3),
 (5,'Writing','Official KICD Grade 5 English Language strand.',4)
) v(grade_number,strand_name,description,strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD English Language sub-strand.', v.sub_strand_order
FROM (VALUES
 (4,'Listening and Speaking','Pronunciation vocabulary',1),
 (4,'Reading','Extensive reading',1),(4,'Reading','Intensive',2),(4,'Reading','Fluency',3),
 (4,'Language Use','Word classes',1),(4,'Language Use','Language patterns',2),
 (4,'Writing','Creative writing',1),(4,'Writing','Functional',2),(4,'Writing','Mechanics',3),(4,'Writing','Guided compositions',4),
 (5,'Listening and Speaking','Comprehension',1),(5,'Listening and Speaking','Pronunciation vocabulary',2),(5,'Listening and Speaking','Fluency',3),
 (5,'Reading','Extensive reading',1),(5,'Reading','Intensive',2),(5,'Reading','Fluency',3),
 (5,'Grammar in Use','Word classes',1),(5,'Grammar in Use','Language patterns',2),(5,'Grammar in Use','Tense',3),
 (5,'Writing','Creative writing',1),(5,'Writing','Functional',2),(5,'Writing','Mechanics',3)
) v(grade_number,strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], 1
FROM (VALUES
 (4,'English','Listening and Speaking','Pronunciation vocabulary','Pronunciation Vocabulary','Official Grade 4 KICD content heading.'),
 (4,'English','Language Use','Word classes','Word Classes: Determiners','Definite and indefinite articles, shown in the official Grade 4 design.'),
 (5,'English','Listening and Speaking','Pronunciation vocabulary','Pronunciation vocabulary','Official Grade 5 KICD content heading.'),
 (5,'English','Listening and Speaking','Comprehension','Comprehension','Official Grade 5 KICD content heading.'),
 (5,'English','Reading','Extensive reading','Extensive reading','Official Grade 5 KICD content heading.'),
 (5,'English','Grammar in Use','Word classes','Word Class: Demonstrative Determiners','This, these, that and those, shown in the official Grade 5 design.'),
 (5,'English','Grammar in Use','Tense','Tense','Official Grade 5 KICD content heading.'),
 (5,'English','Writing','Functional','Functional writing','Official Grade 5 KICD content heading.')
) v(grade_number,subject_name,strand_name,sub_strand_name,topic_name,topic_description)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))=lower(trim(v.subject_name))
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)));
COMMIT;
