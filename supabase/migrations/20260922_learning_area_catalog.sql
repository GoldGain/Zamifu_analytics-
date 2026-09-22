-- Zamifu Analytics: canonical learning-area catalog and school-level mappings.
-- This migration is idempotent and deliberately preserves existing subjects/results.

BEGIN;

-- First create a point-in-time backup of the existing operational subject rows.
-- RLS is enabled below with no public policies so the backup is not exposed to clients.
CREATE TABLE IF NOT EXISTS public.subjects_learning_area_backup_20260922 AS
TABLE public.subjects WITH DATA;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.learning_area_catalog (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('pre_school', 'lower_primary', 'upper_primary', 'junior', 'senior')),
  name TEXT NOT NULL,
  display_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (level, name)
);

CREATE TABLE IF NOT EXISTS public.school_learning_areas (
  id SERIAL PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learning_area_id INT NOT NULL REFERENCES public.learning_area_catalog(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, learning_area_id)
);

INSERT INTO public.learning_area_catalog (level, name, display_order)
VALUES
  ('pre_school', 'English Language Activities', 1),
  ('pre_school', 'Mathematics Activities', 2),
  ('pre_school', 'Environmental Activities', 3),
  ('pre_school', 'Creative Arts Activities', 4),
  ('pre_school', 'Reading Activities', 5),

  ('lower_primary', 'Kiswahili Language Activities', 1),
  ('lower_primary', 'English Language Activities', 2),
  ('lower_primary', 'Mathematical Activities', 3),
  ('lower_primary', 'Religious Education', 4),
  ('lower_primary', 'Environmental Activities', 5),

  ('upper_primary', 'English', 1),
  ('upper_primary', 'Mathematics', 2),
  ('upper_primary', 'Kiswahili', 3),
  ('upper_primary', 'Creative Arts', 4),
  ('upper_primary', 'Science & Technology', 5),
  ('upper_primary', 'Agriculture', 6),
  ('upper_primary', 'Social Studies', 7),
  ('upper_primary', 'CRE', 8),
  ('upper_primary', 'IRE', 9),
  ('upper_primary', 'HRE', 10),

  ('junior', 'Mathematics', 1),
  ('junior', 'English', 2),
  ('junior', 'Kiswahili', 3),
  ('junior', 'KSL (Kenya Sign Language)', 4),
  ('junior', 'Social Studies', 5),
  ('junior', 'Pre-Technical Studies', 6),
  ('junior', 'Agriculture', 7),
  ('junior', 'Creative Arts', 8),
  ('junior', 'CRE (Christian Religious Education)', 9),
  ('junior', 'IRE (Islamic Religious Education)', 10),
  ('junior', 'HRE (Hindu Religious Education)', 11),
  ('junior', 'Integrated Science', 12),

  ('senior', 'English', 1),
  ('senior', 'Kiswahili', 2),
  ('senior', 'Physical Education', 3),
  ('senior', 'Community Service Learning (CSL)', 4),
  ('senior', 'Literature in English', 5),
  ('senior', 'Fasihi ya Kiswahili', 6),
  ('senior', 'Sign Language', 7),
  ('senior', 'Arabic', 8),
  ('senior', 'French', 9),
  ('senior', 'German', 10),
  ('senior', 'Mandarin Chinese', 11),
  ('senior', 'Indigenous Languages', 12),
  ('senior', 'History and Citizenship', 13),
  ('senior', 'Geography', 14),
  ('senior', 'Christian Religious Education (CRE)', 15),
  ('senior', 'Islamic Religious Education (IRE)', 16),
  ('senior', 'Hindu Religious Education (HRE)', 17),
  ('senior', 'Business Studies', 18),
  ('senior', 'Music and Dance', 19),
  ('senior', 'Theatre and Film', 20),
  ('senior', 'Fine Arts', 21),
  ('senior', 'Sports and Recreation', 22),
  ('senior', 'Mathematics', 23),
  ('senior', 'Physics', 24),
  ('senior', 'Chemistry', 25),
  ('senior', 'Biology', 26),
  ('senior', 'General Science', 27),
  ('senior', 'Agriculture', 28),
  ('senior', 'Computer Studies', 29),
  ('senior', 'Home Science', 30),
  ('senior', 'Aviation', 31),
  ('senior', 'Building and Construction', 32),
  ('senior', 'Electricity', 33),
  ('senior', 'Metalwork', 34),
  ('senior', 'Power Mechanics', 35),
  ('senior', 'Woodwork', 36),
  ('senior', 'Media Technology', 37),
  ('senior', 'Marine and Fisheries Technology', 38),
  ('senior', 'ICT Skills', 39),
  ('senior', 'Pastoral/Religious Programme of Instruction', 40),
  ('senior', 'Learner Personal/Group Study', 41)
ON CONFLICT (level, name) DO UPDATE
SET display_order = EXCLUDED.display_order;

-- Preserve all old rows. Common historical spellings and abbreviations are treated as
-- matching the catalog; genuinely unrelated rows remain available to old records and
-- are explicitly marked legacy.
UPDATE public.subjects AS old_subject
SET is_legacy = NOT EXISTS (
  SELECT 1
  FROM public.learning_area_catalog AS catalog
  WHERE lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) =
        lower(regexp_replace(trim(catalog.name), '[^a-zA-Z0-9]+', '', 'g'))
     OR (
       catalog.name IN ('Environmental Activities', 'Science & Technology')
       AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('environmentactivities', 'scienceandtechnology')
     )
     OR (
       catalog.name IN ('CRE', 'CRE (Christian Religious Education)', 'Christian Religious Education (CRE)')
       AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('cre', 'christianreligiouseducation')
     )
     OR (
       catalog.name IN ('IRE', 'IRE (Islamic Religious Education)', 'Islamic Religious Education (IRE)')
       AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('ire', 'islamicreligiouseducation')
     )
     OR (
       catalog.name IN ('HRE', 'HRE (Hindu Religious Education)', 'Hindu Religious Education (HRE)')
       AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('hre', 'hindureligiouseducation')
     )
     OR (
       catalog.name = 'Community Service Learning (CSL)'
       AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('csl', 'communityservicelearning')
     )
);

-- Derive the levels evidenced by each school. Explicit school_level is preferred;
-- class grade bands fill the gap for legacy schools with a null school_level.
WITH explicit_school_levels AS (
  SELECT
    s.id AS school_id,
    CASE lower(regexp_replace(coalesce(s.school_level, ''), '[^a-zA-Z0-9]+', '', 'g'))
      WHEN 'preschool' THEN 'pre_school'
      WHEN 'preprimary' THEN 'pre_school'
      WHEN 'lowerprimary' THEN 'lower_primary'
      WHEN 'upperprimary' THEN 'upper_primary'
      WHEN 'junior' THEN 'junior'
      WHEN 'juniorschool' THEN 'junior'
      WHEN 'senior' THEN 'senior'
      WHEN 'seniorschool' THEN 'senior'
      ELSE NULL
    END AS level
  FROM public.schools AS s
), class_school_levels AS (
  SELECT DISTINCT
    c.school_id,
    CASE
      WHEN coalesce(c.grade_level, c.level) = 0 THEN 'pre_school'
      WHEN coalesce(c.grade_level, c.level) BETWEEN 1 AND 3 THEN 'lower_primary'
      WHEN coalesce(c.grade_level, c.level) BETWEEN 4 AND 6 THEN 'upper_primary'
      WHEN coalesce(c.grade_level, c.level) BETWEEN 7 AND 9 THEN 'junior'
      WHEN coalesce(c.grade_level, c.level) >= 10 THEN 'senior'
      ELSE NULL
    END AS level
  FROM public.classes AS c
), school_levels AS (
  SELECT school_id, level FROM explicit_school_levels WHERE level IS NOT NULL
  UNION
  SELECT school_id, level FROM class_school_levels WHERE level IS NOT NULL
)
INSERT INTO public.school_learning_areas (school_id, learning_area_id, is_active)
SELECT DISTINCT
  old_subject.school_id,
  catalog.id,
  true
FROM public.subjects AS old_subject
JOIN public.learning_area_catalog AS catalog
  ON (
    lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) =
    lower(regexp_replace(trim(catalog.name), '[^a-zA-Z0-9]+', '', 'g'))
    OR (
      catalog.name IN ('Environmental Activities', 'Science & Technology')
      AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('environmentactivities', 'scienceandtechnology')
    )
    OR (
      catalog.name IN ('CRE', 'CRE (Christian Religious Education)', 'Christian Religious Education (CRE)')
      AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('cre', 'christianreligiouseducation')
    )
    OR (
      catalog.name IN ('IRE', 'IRE (Islamic Religious Education)', 'Islamic Religious Education (IRE)')
      AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('ire', 'islamicreligiouseducation')
    )
    OR (
      catalog.name IN ('HRE', 'HRE (Hindu Religious Education)', 'Hindu Religious Education (HRE)')
      AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('hre', 'hindureligiouseducation')
    )
    OR (
      catalog.name = 'Community Service Learning (CSL)'
      AND lower(regexp_replace(trim(old_subject.name), '[^a-zA-Z0-9]+', '', 'g')) IN ('csl', 'communityservicelearning')
    )
  )
JOIN school_levels
  ON school_levels.school_id = old_subject.school_id
 AND school_levels.level = catalog.level
ON CONFLICT (school_id, learning_area_id) DO NOTHING;

ALTER TABLE public.learning_area_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_learning_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects_learning_area_backup_20260922 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_area_catalog_select ON public.learning_area_catalog;
CREATE POLICY learning_area_catalog_select
  ON public.learning_area_catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS school_learning_areas_select ON public.school_learning_areas;
CREATE POLICY school_learning_areas_select
  ON public.school_learning_areas
  FOR SELECT TO authenticated
  USING (public.can_access_school(school_id));

DROP POLICY IF EXISTS school_learning_areas_insert ON public.school_learning_areas;
CREATE POLICY school_learning_areas_insert
  ON public.school_learning_areas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role, 'master_super_admin'::user_role)
  );

DROP POLICY IF EXISTS school_learning_areas_update ON public.school_learning_areas;
CREATE POLICY school_learning_areas_update
  ON public.school_learning_areas
  FOR UPDATE TO authenticated
  USING (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role, 'master_super_admin'::user_role)
  )
  WITH CHECK (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role, 'master_super_admin'::user_role)
  );

GRANT SELECT ON public.learning_area_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.school_learning_areas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.school_learning_areas_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.learning_area_catalog_id_seq TO authenticated;

COMMIT;
