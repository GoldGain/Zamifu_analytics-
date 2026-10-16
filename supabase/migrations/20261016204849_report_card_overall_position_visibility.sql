ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS show_overall_report_positions boolean DEFAULT true;

COMMENT ON COLUMN public.schools.show_overall_report_positions IS
  'Controls display of overall Class and Stream Position on report cards; does not change ranking calculations or subject-level positions.';
