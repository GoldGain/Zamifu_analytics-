-- Timetable priority defaults for newly created and legacy assignments.
-- Automatic keeps the default policy editable: administrators can choose a
-- concrete band or explicitly choose none in Teacher Assignments.

ALTER TABLE public.teacher_subject_assignments
  DROP CONSTRAINT IF EXISTS teacher_subject_assignments_priority_band_check;

ALTER TABLE public.teacher_subject_assignments
  ADD CONSTRAINT teacher_subject_assignments_priority_band_check
  CHECK (priority_band IN ('auto', 'none', 'morning', 'early_morning', 'mid_morning', 'late_morning', 'afternoon'));

UPDATE public.teacher_subject_assignments AS assignment
SET priority_band = 'auto'
FROM public.subjects AS subject
WHERE assignment.subject_id = subject.id
  AND assignment.school_id = subject.school_id
  AND COALESCE(assignment.is_priority, false) = false
  AND COALESCE(assignment.priority_band, 'none') = 'none'
  AND lower(subject.name) ~ '(mathemat|english|integrated[[:space:]]+science|(^|[[:space:]])science($|[[:space:]])|agricultur|pre[-[:space:]]*technical|social[[:space:]]+stud|religious|(^|[[:space:]])cre($|[[:space:]])|christian|islamic|creative[[:space:]]+arts?)';

COMMENT ON COLUMN public.teacher_subject_assignments.priority_band IS
  'Timetable preference: auto=subject default, morning=L1-3, mid_morning=L4-6, afternoon=L7+, none=no fixed band; early_morning and late_morning are legacy aliases.';
