BEGIN;

CREATE TABLE IF NOT EXISTS public.after_school_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  activity_name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  target_classes TEXT NOT NULL DEFAULT 'All',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT after_school_activities_valid_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_after_school_activities_school_day_time
  ON public.after_school_activities (school_id, day_of_week, start_time);

ALTER TABLE public.after_school_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS after_school_activities_access ON public.after_school_activities;
CREATE POLICY after_school_activities_access ON public.after_school_activities
FOR ALL USING (public.can_access_school(school_id))
WITH CHECK (public.can_access_school(school_id));

CREATE OR REPLACE FUNCTION public.update_after_school_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_school_activities_updated_at_trigger ON public.after_school_activities;
CREATE TRIGGER after_school_activities_updated_at_trigger
BEFORE UPDATE ON public.after_school_activities
FOR EACH ROW EXECUTE FUNCTION public.update_after_school_activities_updated_at();

COMMIT;
