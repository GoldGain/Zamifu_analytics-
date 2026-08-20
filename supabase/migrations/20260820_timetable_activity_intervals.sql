-- Timetable activity intervals
-- Store the effective per-day time range used during generation. Base time slots
-- remain reusable, while Friday PPI or any other fixed interval can shift only
-- the affected class/day without moving the rest of the week.

ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS effective_start_time TIME,
  ADD COLUMN IF NOT EXISTS effective_end_time TIME;

-- Backfill existing rows from their base slot so the viewer has a complete
-- effective timeline immediately after migration.
UPDATE public.timetable_entries AS e
SET
  effective_start_time = COALESCE(e.effective_start_time, s.start_time),
  effective_end_time = COALESCE(e.effective_end_time, s.end_time)
FROM public.timetable_time_slots AS s
WHERE s.id = e.time_slot_id
  AND (e.effective_start_time IS NULL OR e.effective_end_time IS NULL);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_effective_time
  ON public.timetable_entries(school_id, day_of_week, effective_start_time, effective_end_time);
