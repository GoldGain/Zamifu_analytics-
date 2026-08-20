BEGIN;

ALTER TABLE public.after_school_activities
  ADD COLUMN IF NOT EXISTS target_level_group TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS blocks_lessons BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_after_school_activities_school_level_day_time
  ON public.after_school_activities (school_id, target_level_group, day_of_week, start_time);

COMMENT ON COLUMN public.after_school_activities.target_level_group IS
  'Timetable level group to which this activity applies; all means every level.';
COMMENT ON COLUMN public.after_school_activities.blocks_lessons IS
  'When true, the exact activity interval is reserved and no lesson may overlap it.';

COMMIT;
