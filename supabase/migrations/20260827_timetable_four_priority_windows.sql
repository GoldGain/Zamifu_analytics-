-- Four timetable priority windows for teacher-subject assignments.
-- Legacy 'morning' values remain accepted and are treated as early morning by the app.
ALTER TABLE public.teacher_subject_assignments
  DROP CONSTRAINT IF EXISTS teacher_subject_assignments_priority_band_check;

ALTER TABLE public.teacher_subject_assignments
  ADD CONSTRAINT teacher_subject_assignments_priority_band_check
  CHECK (priority_band IN ('none', 'morning', 'early_morning', 'mid_morning', 'late_morning', 'afternoon'));

COMMENT ON COLUMN public.teacher_subject_assignments.priority_band IS
  'Timetable preference: early_morning=L1-2, mid_morning=L3-4, late_morning=L5-6, afternoon=L7+, morning=legacy early_morning, none=no fixed band';
