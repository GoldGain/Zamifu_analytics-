-- Keep admission and assessment identifiers as separate learner attributes.
-- Existing legacy data may contain duplicate admission numbers, so future duplicate
-- prevention remains enforced by school-scoped application validation rather than
-- a new index that would make this migration fail on historical data.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS assessment_number varchar;

CREATE INDEX IF NOT EXISTS idx_students_school_assessment_number
  ON public.students (school_id, assessment_number)
  WHERE assessment_number IS NOT NULL AND btrim(assessment_number) <> '';

COMMENT ON COLUMN public.students.admission_number IS 'Primary admission identifier for the learner.';
COMMENT ON COLUMN public.students.assessment_number IS 'Separate national/assessment identifier for the learner.';
