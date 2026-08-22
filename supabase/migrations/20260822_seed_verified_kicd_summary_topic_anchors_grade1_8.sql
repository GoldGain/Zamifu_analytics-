-- Official KICD primary sources are documented in /home/ubuntu/Zamifu_kicd_curriculum_research.md.
-- Source indices: lower-primary, Grade 4, Grade 5, Grade 6, Grade 7, and Grade 8 KICD curriculum-design pages.
-- This migration adds conservative topic anchors equal to exact source-backed sub-strand labels when the
-- source summary provides the hierarchy but the existing database has no official-tagged topic row.
-- These are explicitly called source-summary anchors in the description; they are not invented detailed topics.
-- Additive/idempotent: no deletes, renames, or broad overwrites.
BEGIN;

-- Lower-primary Mathematics and upper-primary/junior Mathematics source-summary anchors.
INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id,
       ss.sub_strand_name,
       CASE WHEN g.grade_number <= 3
         THEN 'Official KICD Grade 1–3 Mathematics source-summary topic anchor from Drive file 1YlwoCFAVxhjUo_V1A-89GRcho0r0Gq1u.'
         ELSE 'Official KICD Mathematics source-summary topic anchor for Grade ' || g.grade_number || '.'
       END,
       ARRAY[]::text[],
       COALESCE(ss.sub_strand_order,1)
FROM curriculum_sub_strands ss
JOIN curriculum_strands st ON st.id=ss.strand_id
JOIN curriculum_subjects s ON s.id=st.subject_id
JOIN curriculum_grades g ON g.id=s.grade_id
WHERE lower(trim(s.subject_name))='mathematics'
  AND g.grade_number IN (1,2,3,5,6,7,8)
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_topics t
    WHERE t.sub_strand_id=ss.id
      AND lower(trim(t.topic_name))=lower(trim(ss.sub_strand_name))
      AND t.topic_description ~* '(official|source-verified)[[:space:]]+kicd'
  );

-- Grade 1–8 English source-summary anchors. The underlying exact sub-strand labels are already
-- source-tagged by the official KICD hierarchy migrations.
INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id,
       ss.sub_strand_name,
       'Official KICD English source-summary topic anchor for Grade ' || g.grade_number || '; exact detailed content is retained only where separately extracted from the official design.',
       ARRAY[]::text[],
       COALESCE(ss.sub_strand_order,1)
FROM curriculum_sub_strands ss
JOIN curriculum_strands st ON st.id=ss.strand_id
JOIN curriculum_subjects s ON s.id=st.subject_id
JOIN curriculum_grades g ON g.id=s.grade_id
WHERE lower(trim(s.subject_name))='english'
  AND g.grade_number BETWEEN 1 AND 8
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_topics t
    WHERE t.sub_strand_id=ss.id
      AND lower(trim(t.topic_name))=lower(trim(ss.sub_strand_name))
      AND t.topic_description ~* '(official|source-verified)[[:space:]]+kicd'
  );

-- Lower-primary Environmental Activities source-summary anchors.
INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id,
       ss.sub_strand_name,
       'Official KICD Grade 1–3 Environmental Activities source-summary topic anchor from the official Lower Primary design.',
       ARRAY[]::text[],
       COALESCE(ss.sub_strand_order,1)
FROM curriculum_sub_strands ss
JOIN curriculum_strands st ON st.id=ss.strand_id
JOIN curriculum_subjects s ON s.id=st.subject_id
JOIN curriculum_grades g ON g.id=s.grade_id
WHERE lower(trim(s.subject_name))='environmental activities'
  AND g.grade_number IN (1,2,3)
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_topics t
    WHERE t.sub_strand_id=ss.id
      AND lower(trim(t.topic_name))=lower(trim(ss.sub_strand_name))
      AND t.topic_description ~* '(official|source-verified)[[:space:]]+kicd'
  );

COMMIT;
