-- Grade 10 learner pathway/track and exceptional mark codes.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS pathway TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS track TEXT;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS mark_code TEXT;
ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_mark_code_check;
ALTER TABLE public.results ADD CONSTRAINT results_mark_code_check CHECK (mark_code IS NULL OR upper(mark_code) IN ('X','Y'));
