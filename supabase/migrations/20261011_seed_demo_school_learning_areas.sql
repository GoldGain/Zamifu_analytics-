BEGIN;

-- These are empty onboarding/demo tenants, so they have no classes from which
-- to infer a curriculum level yet. Keep the full catalogue available for demo
-- setup; school admins can activate/deactivate areas as they configure classes.
INSERT INTO public.school_learning_areas (school_id, learning_area_id, is_active)
SELECT s.id, lac.id, true
FROM public.schools s
CROSS JOIN public.learning_area_catalog lac
WHERE lower(s.name) IN ('demo academy one', 'demo academy two')
ON CONFLICT (school_id, learning_area_id)
DO UPDATE SET is_active = true;

COMMIT;
