-- Source-verified KICD Grade 7 Christian Religious Education addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
-- Official Drive file: 1Vx6Y8lWUiSpWO-MBO58nEOtPlFDM7JA3 (Christian Religious Education Grade 7, revised design).
-- Additive/idempotent: legacy rows are preserved.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 7 Christian Religious Education revised-design strand.', v.strand_order
FROM (VALUES
 ('Overview of Christian Religious Education',1),('Creation',2),('The Bible',3),('The Early Life of Jesus Christ',4),('The Church',5),('Christian Living Today',6)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 7 Christian Religious Education revised-design content heading.', v.sub_strand_order
FROM (VALUES
 ('Overview of Christian Religious Education','Importance of Studying CRE',1),
 ('Creation','Accounts of Creation',1),('Creation','Stewardship over Animals, Fish and Birds',2),('Creation','Responsibility over Plants',3),('Creation','Use of Natural Resources',4),
 ('The Bible','Functions of the Bible',1),('The Bible','Divisions of the Bible',2),('The Bible','Translation',3),('The Bible','Leadership in Israel: Moses',4),
 ('The Early Life of Jesus Christ','Prophecies about the Messiah',1),('The Early Life of Jesus Christ','John the Baptist: Precursor to the Messiah',2),('The Early Life of Jesus Christ','Birth and Childhood of Jesus Christ',3),
 ('The Church','Selected Forms of Worship',1),('The Church','Role of the Church in Education and Health',2),
 ('Christian Living Today','Human Sexuality',1),('Christian Living Today','Marriage and Family',2),('Christian Living Today','Alcohol, Drugs and Substance use',3),('Christian Living Today','Gambling',4),('Christian Living Today','Social Media',5)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 7 Christian Religious Education revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Overview of Christian Religious Education','Importance of Studying CRE'),
 ('Creation','Accounts of Creation'),('Creation','Stewardship over Animals, Fish and Birds'),('Creation','Responsibility over Plants'),('Creation','Use of Natural Resources'),
 ('The Bible','Functions of the Bible'),('The Bible','Divisions of the Bible'),('The Bible','Translation'),('The Bible','Leadership in Israel: Moses'),
 ('The Early Life of Jesus Christ','Prophecies about the Messiah'),('The Early Life of Jesus Christ','John the Baptist: Precursor to the Messiah'),('The Early Life of Jesus Christ','Birth and Childhood of Jesus Christ'),
 ('The Church','Selected Forms of Worship'),('The Church','Role of the Church in Education and Health'),
 ('Christian Living Today','Human Sexuality'),('Christian Living Today','Marriage and Family'),('Christian Living Today','Alcohol, Drugs and Substance use'),('Christian Living Today','Gambling'),('Christian Living Today','Social Media')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 7 Christian Religious Education%');
COMMIT;
