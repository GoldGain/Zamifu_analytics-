-- Assessment targeting migration
-- Supports assessments created for a whole school, one grade, or one specific class.

ALTER TABLE public.school_exams
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS target_class_id UUID NULL REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_grade_level INTEGER NULL;

-- Normalize any pre-existing or invalid values to the safe whole-school default.
UPDATE public.school_exams
SET target_type = 'school',
    target_class_id = NULL,
    target_grade_level = NULL
WHERE target_type IS NULL
   OR target_type NOT IN ('school', 'grade', 'class');

ALTER TABLE public.school_exams
  DROP CONSTRAINT IF EXISTS school_exams_target_type_check;

ALTER TABLE public.school_exams
  ADD CONSTRAINT school_exams_target_type_check
  CHECK (target_type IN ('school', 'grade', 'class'));

ALTER TABLE public.school_exams
  DROP CONSTRAINT IF EXISTS school_exams_target_scope_check;

ALTER TABLE public.school_exams
  ADD CONSTRAINT school_exams_target_scope_check
  CHECK (
    (target_type = 'school' AND target_class_id IS NULL AND target_grade_level IS NULL)
    OR (target_type = 'grade' AND target_class_id IS NULL AND target_grade_level IS NOT NULL)
    OR (target_type = 'class' AND target_class_id IS NOT NULL AND target_grade_level IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_school_exams_scope
  ON public.school_exams (school_id, target_type, target_grade_level, target_class_id)
  WHERE is_active = true;

COMMENT ON COLUMN public.school_exams.target_type IS
  'Audience scope for an assessment: school, grade, or class.';
COMMENT ON COLUMN public.school_exams.target_class_id IS
  'Target class when target_type is class.';
COMMENT ON COLUMN public.school_exams.target_grade_level IS
  'Target grade level when target_type is grade.';
