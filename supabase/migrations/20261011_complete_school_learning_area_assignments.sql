BEGIN;

-- A legacy subject row is not a complete curriculum catalogue. Schools with a
-- class/level must receive the full canonical set for that level so teachers
-- can select every valid learning area, even before the first result exists.
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
SELECT school_levels.school_id, catalog.id, true
FROM school_levels
JOIN public.learning_area_catalog catalog ON catalog.level = school_levels.level
ON CONFLICT (school_id, learning_area_id)
DO UPDATE SET is_active = true;

COMMIT;
