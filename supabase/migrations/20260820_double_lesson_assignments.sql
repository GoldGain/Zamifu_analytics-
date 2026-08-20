-- Optional double-lesson preference for teacher-subject assignments.
-- Existing assignments remain single lessons by default.
ALTER TABLE public.teacher_subject_assignments
  ADD COLUMN IF NOT EXISTS is_double_lesson BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teacher_subject_assignments.is_double_lesson IS
  'When true, lessons_per_week is scheduled as consecutive two-period practical blocks that cannot cross breaks, lunch, or blocked activities.';

CREATE INDEX IF NOT EXISTS teacher_subject_assignments_double_lesson_idx
  ON public.teacher_subject_assignments (teacher_id, class_id)
  WHERE is_double_lesson = true;

-- Store the marker on both periods so all timetable views can display the
-- practical block without adding a second timetable row type.
ALTER TABLE public.timetable_entries
  DROP CONSTRAINT IF EXISTS timetable_entries_entry_type_check;

ALTER TABLE public.timetable_entries
  ADD CONSTRAINT timetable_entries_entry_type_check
  CHECK (entry_type IN ('lesson', 'break', 'lunch', 'activity', 'lesson_double'));
