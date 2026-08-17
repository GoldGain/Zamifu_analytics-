-- Three explicit timetable priority bands for teacher-subject assignments.
-- Legacy is_priority=true assignments are migrated to the Morning band in production.
ALTER TABLE public.teacher_subject_assignments
  ADD COLUMN IF NOT EXISTS priority_band TEXT NOT NULL DEFAULT 'none'
  CHECK (priority_band IN ('none', 'morning', 'mid_morning', 'afternoon'));

UPDATE public.teacher_subject_assignments
SET priority_band = 'morning'
WHERE is_priority = true
  AND (priority_band IS NULL OR priority_band = 'none');

COMMENT ON COLUMN public.teacher_subject_assignments.priority_band IS
  'Timetable preference: morning=L1-3, mid_morning=L4-6, afternoon=L7+, none=no fixed band';
