-- Identifies intentionally seeded, non-production demonstration tenants.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS schools_demo_status_idx
  ON public.schools (is_demo, status)
  WHERE is_demo = true;

COMMENT ON COLUMN public.schools.is_demo IS
  'True only for seeded demonstration schools; excludes the tenant from production-school reporting.';
