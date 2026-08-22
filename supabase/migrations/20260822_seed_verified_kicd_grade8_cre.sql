-- Source-verified KICD Grade 8 Christian Religious Education addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1ZVqaVImBDLeGVUbLwA54C8zqWZMsr3V8 (Christian Religious Education Grade 8, revised design).
-- Additive/idempotent: legacy rows are preserved.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 Christian Religious Education revised-design strand.', v.strand_order
FROM (VALUES
 ('Creation',1),('The Bible',2),('Life and Ministry of Jesus Christ',3),('Teachings',4),('Church',5),('Christian Living Today',6)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 Christian Religious Education revised-design summary heading.', v.sub_strand_order
FROM (VALUES
 ('Creation','Origin and Consequences of Sin',1),('Creation','God’s Plan for Redemption',2),
 ('The Bible','Faith Promises',1),('The Bible','Abrahamic Covenant',2),('The Bible','Leadership in Israel (Saul)',3),
 ('Life and Ministry of Jesus Christ','Healing Blind Bartimaeus',1),('Life and Ministry of Jesus Christ','Calming the Storm',2),('Life and Ministry of Jesus Christ','Paralytic',3),
 ('Teachings','Teaching on Prayer',1),('Teachings','Lost Sheep',2),
 ('Church','Holy Spirit',1),('Church','Acts Compassion',2),
 ('Christian Living Today','Family Relationships',1),('Christian Living Today','Human Sexuality Responsible sexual behaviour',2),('Christian Living Today','Sacredness of Life',3),('Christian Living Today','Bullying',4),('Christian Living Today','Work: Talents and Abilities',5),('Christian Living Today','Leisure',6)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 8 Christian Religious Education revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Creation','Origin and Consequences of Sin'),('Creation','God’s Plan for Redemption'),
 ('The Bible','Faith Promises'),('The Bible','Abrahamic Covenant'),('The Bible','Leadership in Israel (Saul)'),
 ('Life and Ministry of Jesus Christ','Healing Blind Bartimaeus'),('Life and Ministry of Jesus Christ','Calming the Storm'),('Life and Ministry of Jesus Christ','Paralytic'),
 ('Teachings','Teaching on Prayer'),('Teachings','Lost Sheep'),
 ('Church','Holy Spirit'),('Church','Acts Compassion'),
 ('Christian Living Today','Family Relationships'),('Christian Living Today','Human Sexuality Responsible sexual behaviour'),('Christian Living Today','Sacredness of Life'),('Christian Living Today','Bullying'),('Christian Living Today','Work: Talents and Abilities'),('Christian Living Today','Leisure')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 8 Christian Religious Education%');
COMMIT;
