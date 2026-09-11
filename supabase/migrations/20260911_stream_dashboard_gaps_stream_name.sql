-- 20260911_stream_dashboard_gaps_stream_name.sql
-- Additive, idempotent migration for the Stream Dashboard feature.
-- Ensures classes.stream_name exists and keeps the stream/performance indexes.

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS stream TEXT;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS stream_name TEXT;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_results_class_term ON public.results (class_id, term_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON public.results (student_id);
CREATE INDEX IF NOT EXISTS idx_results_exam ON public.results (exam_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students (class_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_active ON public.classes (school_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_results_unique_exam
  ON public.results (student_id, subject_id, term_id, exam_id)
  WHERE exam_id IS NOT NULL;
