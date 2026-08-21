-- Persist the exact weekdays on which an assignment should be scheduled as a
-- consecutive two-period lesson block.
ALTER TABLE public.teacher_subject_assignments
  ADD COLUMN IF NOT EXISTS double_lesson_days TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Existing double-lesson assignments were previously all-days preferences.
-- Preserve that behavior by migrating their current availability into the new
-- explicit day list. Non-double assignments remain empty.
UPDATE public.teacher_subject_assignments
SET double_lesson_days = COALESCE(NULLIF(available_days, ARRAY[]::TEXT[]), ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::TEXT[])
WHERE is_double_lesson = true
  AND COALESCE(cardinality(double_lesson_days), 0) = 0;

COMMENT ON COLUMN public.teacher_subject_assignments.double_lesson_days IS
  'Weekday names on which this assignment should be placed as a consecutive two-period block. Empty when is_double_lesson is false.';

CREATE INDEX IF NOT EXISTS teacher_subject_assignments_double_lesson_days_gin_idx
  ON public.teacher_subject_assignments USING GIN (double_lesson_days)
  WHERE is_double_lesson = true;
