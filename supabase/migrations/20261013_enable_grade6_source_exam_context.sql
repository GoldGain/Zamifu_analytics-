-- Makes the existing official Grade 6 hierarchy usable by the source-grounded exam generator.
-- Existing Grade 6 strand, sub-strand and topic rows were seeded from official KICD designs.
-- This migration standardizes the learner-facing learning-area labels and creates approved evidence records.
BEGIN;

UPDATE public.curriculum_subjects s
SET subject_name = v.canonical_name,
    subject_code = v.subject_code
FROM (
  VALUES
    ('English', 'English Activities', 'ENGA'),
    ('Kiswahili', 'Kiswahili Activities', 'KISA'),
    ('Science and Technology', 'Science & Technology', 'SCIT'),
    ('Agriculture and Nutrition', 'Agriculture & Nutrition', 'AGNU'),
    ('Creative Arts and Sports', 'Creative Arts', 'CRAR')
) AS v(legacy_name, canonical_name, subject_code)
JOIN public.curriculum_grades g ON g.grade_number = 6
WHERE s.grade_id = g.id
  AND lower(trim(s.subject_name)) = lower(trim(v.legacy_name));

UPDATE public.learning_area_catalog lac
SET name = v.canonical_name
FROM (
  VALUES
    ('English', 'English Activities'),
    ('Kiswahili', 'Kiswahili Activities'),
    ('Science and Technology', 'Science & Technology'),
    ('Agriculture and Nutrition', 'Agriculture & Nutrition'),
    ('Creative Arts and Sports', 'Creative Arts')
) AS v(legacy_name, canonical_name)
WHERE lac.level = 'upper_primary'
  AND lower(trim(lac.name)) = lower(trim(v.legacy_name));

INSERT INTO public.exam_knowledge_chunks (
  source_name, content_summary, subject, grade_level, strand, sub_strand, topic, is_approved
)
SELECT
  'KICD Grade 6 Curriculum Design — source-verified hierarchy',
  'Official KICD Grade 6 curriculum scope: ' || s.subject_name || ' — ' || st.strand_name || ' — ' || ss.sub_strand_name || '.' ||
    CASE WHEN count(t.id) > 0 THEN ' Source topic anchors: ' || string_agg(DISTINCT t.topic_name, '; ' ORDER BY t.topic_name) || '.' ELSE '' END,
  s.subject_name,
  'Grade 6',
  st.strand_name,
  ss.sub_strand_name,
  min(t.topic_name),
  true
FROM public.curriculum_grades g
JOIN public.curriculum_subjects s ON s.grade_id = g.id
JOIN public.curriculum_strands st ON st.subject_id = s.id
JOIN public.curriculum_sub_strands ss ON ss.strand_id = st.id
LEFT JOIN public.curriculum_topics t ON t.sub_strand_id = ss.id
WHERE g.grade_number = 6
  AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
  AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
  AND NOT EXISTS (
    SELECT 1 FROM public.exam_knowledge_chunks ek
    WHERE ek.source_name = 'KICD Grade 6 Curriculum Design — source-verified hierarchy'
      AND ek.subject = s.subject_name
      AND ek.grade_level = 'Grade 6'
      AND ek.strand = st.strand_name
      AND ek.sub_strand = ss.sub_strand_name
  )
GROUP BY s.subject_name, st.strand_name, ss.sub_strand_name;

COMMIT;
