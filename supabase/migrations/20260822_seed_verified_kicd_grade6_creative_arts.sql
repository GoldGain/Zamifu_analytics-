-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
-- Official Drive file: 1ar14Jn_EMuxsqbJ_evfZCNoHg66r4Fvv (Creative Arts Curriculum designs - Revised.pdf).
-- Production catalog alias is Creative Arts and Sports; source curriculum title is Creative Arts.
-- Exact hierarchy source: KICD viewer pages 13-14 summary table.
-- Additive/idempotent: legacy rows are preserved; no natural-key ON CONFLICT is used.
BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, 'Creative Arts and Sports', 'CAS'
FROM curriculum_grades g
WHERE g.grade_number=6
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_subjects s
    WHERE s.grade_id=g.id
      AND lower(trim(s.subject_name)) IN ('creative arts','creative arts and sports')
  );

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 6 Creative Arts revised-design strand.', v.strand_order
FROM (VALUES
  ('Creating and Executing',1),
  ('Performing and Displaying',2),
  ('Appreciation in Creative Arts',3)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name)) IN ('creative arts','creative arts and sports')
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id
    AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 6 Creative Arts revised-design sub-strand.', v.sub_strand_order
FROM (VALUES
  ('Creating and Executing','String Musical Instruments and Drawing',1),
  ('Creating and Executing','Painting and Collage',2),
  ('Creating and Executing','Volleyball',3),
  ('Creating and Executing','Rhythm and Pattern Making',4),
  ('Creating and Executing','Weaving',5),
  ('Creating and Executing','Gymnastics',6),
  ('Creating and Executing','Melody',7),
  ('Performing and Displaying','Athletics',1),
  ('Performing and Displaying','Descant Recorder',2),
  ('Performing and Displaying','Indigenous Kenyan Instrumental ensembles',3),
  ('Performing and Displaying','Indigenous Kenyan Craft- Pottery',4),
  ('Performing and Displaying','Swimming',5),
  ('Performing and Displaying','Indigenous Kenyan Games',6),
  ('Appreciation in Creative Arts','Analysis of Creative Arts works',1)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name)) IN ('creative arts','creative arts and sports')
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id
    AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.sub_strand_name, 'Official KICD Grade 6 Creative Arts revised-design content anchor from the exact summary-table sub-strand heading.', ARRAY[]::text[], 1
FROM (VALUES
  ('Creating and Executing','String Musical Instruments and Drawing'),
  ('Creating and Executing','Painting and Collage'),
  ('Creating and Executing','Volleyball'),
  ('Creating and Executing','Rhythm and Pattern Making'),
  ('Creating and Executing','Weaving'),
  ('Creating and Executing','Gymnastics'),
  ('Creating and Executing','Melody'),
  ('Performing and Displaying','Athletics'),
  ('Performing and Displaying','Descant Recorder'),
  ('Performing and Displaying','Indigenous Kenyan Instrumental ensembles'),
  ('Performing and Displaying','Indigenous Kenyan Craft- Pottery'),
  ('Performing and Displaying','Swimming'),
  ('Performing and Displaying','Indigenous Kenyan Games'),
  ('Appreciation in Creative Arts','Analysis of Creative Arts works')
) v(strand_name,sub_strand_name)
JOIN curriculum_grades g ON g.grade_number=6
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name)) IN ('creative arts','creative arts and sports')
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id
  AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.sub_strand_name))
    AND t.topic_description ~* 'Official KICD Grade 6 Creative Arts'
);

COMMIT;
