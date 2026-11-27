-- Track when staff attendance was switched on so reports never backfill
-- absences for days before the school started using the feature.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS staff_attendance_enabled_at timestamptz;

UPDATE public.schools
SET staff_attendance_enabled_at = coalesce(updated_at, now())
WHERE staff_attendance_enabled IS TRUE
  AND staff_attendance_enabled_at IS NULL;

CREATE OR REPLACE FUNCTION public.schools_staff_attendance_enabled_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.staff_attendance_enabled IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.staff_attendance_enabled IS NOT TRUE) THEN
    NEW.staff_attendance_enabled_at := now();
  ELSIF NEW.staff_attendance_enabled IS NOT TRUE THEN
    NEW.staff_attendance_enabled_at := NULL;
  ELSE
    NEW.staff_attendance_enabled_at := OLD.staff_attendance_enabled_at;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_schools_staff_attendance_enabled_at ON public.schools;
CREATE TRIGGER trg_schools_staff_attendance_enabled_at
BEFORE INSERT OR UPDATE OF staff_attendance_enabled ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.schools_staff_attendance_enabled_at();
