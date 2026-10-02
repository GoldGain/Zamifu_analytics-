-- Allow each school to define the order of assessments used by comparisons and report cards.
ALTER TABLE public.school_exams
  ADD COLUMN IF NOT EXISTS sequence_order integer;

CREATE INDEX IF NOT EXISTS school_exams_school_sequence_idx
  ON public.school_exams (school_id, sequence_order, created_at DESC);

COMMENT ON COLUMN public.school_exams.sequence_order IS
  'School-defined assessment order. Lower values are earlier; null falls back to creation date.';
