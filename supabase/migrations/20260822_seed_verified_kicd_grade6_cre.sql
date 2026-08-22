-- Source-verified KICD Grade 6 Christian Religious Education addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
-- Official Drive file: 11IpqIrMdTmPcoFRKhELKaUliB3IQw6oP (Christian Religious Education Grade 6).
-- Production catalog uses the learning-area alias Religious Education with internal code CRE.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Religious Education', 'CRE'
FROM curriculum_grades g
WHERE g.grade_number=6
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name)) IN ('religious education','christian religious education','cre')
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 6 Christian Religious Education revised-design strand.', v.strand_order
FROM (VALUES
  ('Creation',1),('The Bible',2),('The Life of Jesus Christ',3),('The Church',4),('Christian Living Today',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('religious education','christian religious education','cre')
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 6 Christian Religious Education revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Creation','My purpose',1),('Creation','Marriage and Family',2),('Creation','Leisure',3),
  ('The Bible','The Inspired Word of God',1),('The Bible','The Ten Commandments',2),('The Bible','Samson defeats the Philistines',3),('The Bible','Faith in God (Elisha)',4),('The Bible','Jacob wrestles an Angel',5),
  ('The Life of Jesus Christ','The call of the Disciples',1),('The Life of Jesus Christ','The Temptations of Jesus Christ',2),('The Life of Jesus Christ','Miracles of Jesus Christ (The Roman Officer’s Servant)',3),('The Life of Jesus Christ','Faith in God',4),('The Life of Jesus Christ','Lazarus is raised from Dead',5),('The Life of Jesus Christ','The Hidden Treasure',6),('The Life of Jesus Christ','The Rich Man and Lazarus',7),
  ('The Church','The Apostles’ Creed',1),('The Church','Standing Firm in Faith',2),('The Church','Church Unity',3),
  ('Christian Living Today','Friendship Formation',1),('Christian Living Today','Human Sexuality',2),('Christian Living Today','Sanctity of Life',3),('Christian Living Today','Alcohol, drug and Substance Abuse',4)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('religious education','christian religious education','cre')
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id,
       CASE WHEN v.sub_strand_name='My purpose' THEN 'Talents and Abilities' ELSE v.sub_strand_name END,
       'Official KICD Grade 6 Christian Religious Education revised-design content anchor.',
       ARRAY[]::text[], 1
FROM (VALUES
  ('Creation','My purpose'),('Creation','Marriage and Family'),('Creation','Leisure'),
  ('The Bible','The Inspired Word of God'),('The Bible','The Ten Commandments'),('The Bible','Samson defeats the Philistines'),('The Bible','Faith in God (Elisha)'),('The Bible','Jacob wrestles an Angel'),
  ('The Life of Jesus Christ','The call of the Disciples'),('The Life of Jesus Christ','The Temptations of Jesus Christ'),('The Life of Jesus Christ','Miracles of Jesus Christ (The Roman Officer’s Servant)'),('The Life of Jesus Christ','Faith in God'),('The Life of Jesus Christ','Lazarus is raised from Dead'),('The Life of Jesus Christ','The Hidden Treasure'),('The Life of Jesus Christ','The Rich Man and Lazarus'),
  ('The Church','The Apostles’ Creed'),('The Church','Standing Firm in Faith'),('The Church','Church Unity'),
  ('Christian Living Today','Friendship Formation'),('Christian Living Today','Human Sexuality'),('Christian Living Today','Sanctity of Life'),('Christian Living Today','Alcohol, drug and Substance Abuse')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name)) IN ('religious education','christian religious education','cre')
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(CASE WHEN v.sub_strand_name='My purpose' THEN 'Talents and Abilities' ELSE v.sub_strand_name END))
    AND t.topic_description ~* 'Official KICD Grade 6 Christian Religious Education'
);

COMMIT;
