-- Source-verified KICD Grade 4 Christian Religious Education addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/
-- Official Drive file: 1vW3aipLZDPSkl2z29W7RbBEEUrCdEbt7 (CRE Grade 4, revised 2024).
-- Production catalog uses the Religious Education alias with internal code CRE.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Religious Education', 'CRE'
FROM curriculum_grades g
WHERE g.grade_number=4
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name)) IN ('religious education','christian religious education','cre')
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 4 Christian Religious Education revised-design strand.', v.strand_order
FROM (VALUES
  ('Creation',1),('The Holy Bible',2),('The Life of Jesus Christ',3),('Christian Values',4),('The Church',5),('Morality and Social Media',6)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 4 Christian Religious Education revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Creation','Self-awareness',1),('Creation','Thoughts and feelings',2),('Creation','Making choices',3),('Creation','My Family',4),('Creation','Relationships within the Family',5),('Creation','Attributes of God',6),
  ('The Holy Bible','The Inspired Word of God',1),('The Holy Bible','Zacchaeus the Tax Collector',2),('The Holy Bible','Balaam’s Donkey',3),('The Holy Bible','Samson kills a Lion',4),('The Holy Bible','Joseph interprets a Dream',5),('The Holy Bible','Bible Patriarchs Abraham',6),
  ('The Life of Jesus Christ','The Annunciation',1),('The Life of Jesus Christ','Birth of John the Baptist',2),('The Life of Jesus Christ','Healing of Blind Bartimaeus',3),('The Life of Jesus Christ','Healing the 10 Lepers',4),('The Life of Jesus Christ','Jesus raises a Widow’s Son',5),('The Life of Jesus Christ','Forgiveness',6),('The Life of Jesus Christ','Helping the Needy',7),('The Life of Jesus Christ','Parable of the lost coin',8),('The Life of Jesus Christ','Parable of the mustard seed',9),('The Life of Jesus Christ','Nicodemus’ encounter with Jesus Christ',10),
  ('Christian Values','Trust',1),('Christian Values','Truthfulness',2),('Christian Values','Obedience',3),('Christian Values','Love',4),('Christian Values','Responsibility',5),('Christian Values','Holiness',6),
  ('The Church','House of God',1),('The Church','The Early Church',2),('The Church','Standing Firm in Faith',3),('The Church','The Lord’s Prayer',4),('The Church','Fruit of the Holy Spirit',5),('The Church','Self-control',6),
  ('Morality and Social Media','Use of Social Media',1)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 4 Christian Religious Education revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
  ('Creation','Self-awareness'),('Creation','Thoughts and feelings'),('Creation','Making choices'),('Creation','My Family'),('Creation','Relationships within the Family'),('Creation','Attributes of God'),
  ('The Holy Bible','The Inspired Word of God'),('The Holy Bible','Zacchaeus the Tax Collector'),('The Holy Bible','Balaam’s Donkey'),('The Holy Bible','Samson kills a Lion'),('The Holy Bible','Joseph interprets a Dream'),('The Holy Bible','Bible Patriarchs Abraham'),
  ('The Life of Jesus Christ','The Annunciation'),('The Life of Jesus Christ','Birth of John the Baptist'),('The Life of Jesus Christ','Healing of Blind Bartimaeus'),('The Life of Jesus Christ','Healing the 10 Lepers'),('The Life of Jesus Christ','Jesus raises a Widow’s Son'),('The Life of Jesus Christ','Forgiveness'),('The Life of Jesus Christ','Helping the Needy'),('The Life of Jesus Christ','Parable of the lost coin'),('The Life of Jesus Christ','Parable of the mustard seed'),('The Life of Jesus Christ','Nicodemus’ encounter with Jesus Christ'),
  ('Christian Values','Trust'),('Christian Values','Truthfulness'),('Christian Values','Obedience'),('Christian Values','Love'),('Christian Values','Responsibility'),('Christian Values','Holiness'),
  ('The Church','House of God'),('The Church','The Early Church'),('The Church','Standing Firm in Faith'),('The Church','The Lord’s Prayer'),('The Church','Fruit of the Holy Spirit'),('The Church','Self-control'),
  ('Morality and Social Media','Use of Social Media')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=4
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='religious education'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.sub_strand_name))
    AND t.topic_description ~* 'Official KICD Grade 4 Christian Religious Education'
);

COMMIT;
