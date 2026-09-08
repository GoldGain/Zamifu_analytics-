-- Allow multiple learning areas in one class period, which is required when
-- CRE and IRE are taught in parallel in the same timetable cell.
ALTER TABLE public.timetable_entries
  DROP CONSTRAINT IF EXISTS timetable_entries_school_id_day_of_week_time_slot_id_class__key;

CREATE UNIQUE INDEX IF NOT EXISTS timetable_entries_cell_subject_teacher_key
  ON public.timetable_entries (
    school_id,
    day_of_week,
    time_slot_id,
    class_id,
    entry_type,
    COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
