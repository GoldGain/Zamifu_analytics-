-- Canonical four-priority timetable contract.
-- Early Morning=L1-2, Mid Morning=L3-4, Late Morning=L5-6, Afternoon=L7+.
-- Keep the legacy morning value accepted for old rows, while the application
-- normalizes it to early_morning and never writes it for new assignments.

ALTER TABLE public.teacher_subject_assignments
  DROP CONSTRAINT IF EXISTS teacher_subject_assignments_priority_band_check;

UPDATE public.teacher_subject_assignments
SET priority_band = 'early_morning'
WHERE priority_band = 'morning';

ALTER TABLE public.teacher_subject_assignments
  ALTER COLUMN priority_band SET DEFAULT 'auto';

ALTER TABLE public.teacher_subject_assignments
  ADD CONSTRAINT teacher_subject_assignments_priority_band_check
  CHECK (priority_band IN ('auto', 'none', 'early_morning', 'mid_morning', 'late_morning', 'afternoon', 'morning'));

COMMENT ON COLUMN public.teacher_subject_assignments.priority_band IS
  'Timetable priority: auto=subject default, early_morning=L1-2, mid_morning=L3-4, late_morning=L5-6, afternoon=L7+, none=no fixed priority; morning is a legacy alias for early_morning.';

-- Make legacy unprioritized rows participate in the automatic subject policy.
UPDATE public.teacher_subject_assignments AS assignment
SET priority_band = 'auto'
FROM public.subjects AS subject
WHERE assignment.subject_id = subject.id
  AND assignment.school_id = subject.school_id
  AND COALESCE(assignment.is_priority, false) = false
  AND COALESCE(assignment.priority_band, 'none') = 'none'
  AND lower(subject.name) ~ '(mathemat|english|integrated[[:space:]]+science|(^|[[:space:]])science($|[[:space:]])|agricultur|kiswahili|language|french|german|arabic|pre[-[:space:]]*technical|social[[:space:]]+stud|religious|(^|[[:space:]])cre($|[[:space:]])|christian|islamic|creative[[:space:]]+arts?)';

UPDATE public.teacher_subject_assignments
SET priority_band = 'auto'
WHERE priority_band IS NULL;

ALTER TABLE public.teacher_subject_assignments
  ALTER COLUMN priority_band SET NOT NULL;

UPDATE public.teacher_subject_assignments
SET is_priority = (priority_band NOT IN ('auto', 'none'))
WHERE priority_band IS NOT NULL;

ALTER TABLE public.teacher_subject_assignments
  DROP CONSTRAINT IF EXISTS teacher_subject_assignments_priority_band_check;

ALTER TABLE public.teacher_subject_assignments
  ADD CONSTRAINT teacher_subject_assignments_priority_band_check
  CHECK (priority_band IN ('auto', 'none', 'early_morning', 'mid_morning', 'late_morning', 'afternoon'));

COMMENT ON COLUMN public.teacher_subject_assignments.priority_band IS
  'Timetable priority: auto=subject default, early_morning=L1-2, mid_morning=L3-4, late_morning=L5-6, afternoon=L7+, none=no fixed priority.';

UPDATE public.teacher_subject_assignments
SET is_priority = (priority_band NOT IN ('auto', 'none'));
