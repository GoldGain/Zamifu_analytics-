-- 20260912_zamifu_analytics_fixes.sql (idempotent)
-- No schema changes are strictly required: stream/stream_name columns and indexes exist.
-- The learning-area (9 / 900) fix is applied in application code.
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS stream TEXT;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS stream_name TEXT;
UPDATE public.classes SET stream_name = stream WHERE stream_name IS NULL AND stream IS NOT NULL AND stream <> '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_results_class_term ON public.results (class_id, term_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON public.results (student_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students (class_id);
