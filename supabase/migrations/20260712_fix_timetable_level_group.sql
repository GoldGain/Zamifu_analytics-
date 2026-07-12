-- ============================================================
-- Fix timetable_time_slots to support per-level slot generation
-- Adds level_group column and updates unique constraint
-- ============================================================

-- 1. Add level_group column to timetable_time_slots
ALTER TABLE public.timetable_time_slots
  ADD COLUMN IF NOT EXISTS level_group TEXT NOT NULL DEFAULT 'default';

-- 2. Drop old unique constraint (school_id, slot_order)
DROP INDEX IF EXISTS timetable_time_slots_school_slot_uidx;
ALTER TABLE public.timetable_time_slots
  DROP CONSTRAINT IF EXISTS timetable_time_slots_school_id_slot_order_key;

-- 3. Create new unique constraint including level_group
CREATE UNIQUE INDEX IF NOT EXISTS timetable_time_slots_school_level_slot_uidx
  ON public.timetable_time_slots (school_id, level_group, slot_order);

-- 4. Also add level_group to timetable_entries for filtering
ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS level_group TEXT;
