-- School calendar dates used by report cards and the admin dashboard.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS school_closes_on DATE,
  ADD COLUMN IF NOT EXISTS school_opens_on DATE;

-- Preserve existing next-term dates for schools that already configured them.
UPDATE public.schools
SET school_opens_on = next_term_start_date
WHERE school_opens_on IS NULL
  AND next_term_start_date IS NOT NULL;

COMMENT ON COLUMN public.schools.school_closes_on IS 'Date the current school term closes, shown on report cards';
COMMENT ON COLUMN public.schools.school_opens_on IS 'Date the next school term opens, shown on report cards';
