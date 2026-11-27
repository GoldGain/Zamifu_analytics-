-- Fix: the BEFORE INSERT OR UPDATE trigger re-ran the clock-in logic on UPDATE,
-- resetting clock_in_time to now() and nulling clock_out_time, so staff_clock_out()
-- could never persist a clock-out. Clock-in data is now immutable on UPDATE and a
-- dedicated clock-out path validates the clock-out distance/window.

CREATE OR REPLACE FUNCTION public.staff_attendance_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_school public.schools%ROWTYPE;
  v_role public.user_role;
  v_local_time time;
  v_local_date date;
  v_distance double precision;
  v_late_after time;
  v_tz text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.user_id;
  IF v_role IS NULL OR v_role NOT IN ('teacher','school_admin','bursar','store_keeper') THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_STAFF';
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = NEW.school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ATTENDANCE:NO_SCHOOL'; END IF;
  v_tz := coalesce(nullif(v_school.attendance_timezone, ''), 'Africa/Nairobi');
  v_local_date := (now() AT TIME ZONE v_tz)::date;
  v_local_time := (now() AT TIME ZONE v_tz)::time;

  -- Admin manual override (insert or upsert)
  IF NEW.method = 'Manual' THEN
    IF auth.uid() IS NULL OR NOT public.is_school_admin_of(NEW.school_id) THEN
      RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_ADMIN';
    END IF;
    NEW.date := coalesce(NEW.date, v_local_date);
    NEW.overridden_by := auth.uid();
    NEW.overridden_at := now();
    IF NEW.status = 'Absent' THEN
      NEW.clock_in_time := NULL;
      NEW.clock_out_time := NULL;
    ELSIF NEW.clock_in_time IS NULL THEN
      NEW.clock_in_time := ((NEW.date::text || ' ' || v_school.check_in_start::text)::timestamp AT TIME ZONE v_tz);
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- GPS clock-out (row already exists and has no clock-out yet)
  IF TG_OP = 'UPDATE' THEN
    -- Clock-in details are immutable once recorded.
    NEW.school_id := OLD.school_id;
    NEW.user_id := OLD.user_id;
    NEW.date := OLD.date;
    NEW.clock_in_time := OLD.clock_in_time;
    NEW.clock_in_lat := OLD.clock_in_lat;
    NEW.clock_in_lng := OLD.clock_in_lng;
    NEW.clock_in_accuracy := OLD.clock_in_accuracy;
    NEW.clock_in_distance := OLD.clock_in_distance;
    NEW.method := OLD.method;
    NEW.status := OLD.status;
    NEW.overridden_by := OLD.overridden_by;
    NEW.overridden_at := OLD.overridden_at;
    NEW.override_reason := OLD.override_reason;

    IF OLD.clock_out_time IS NOT NULL THEN
      -- A recorded clock-out cannot be rewritten.
      NEW.clock_out_time := OLD.clock_out_time;
      NEW.clock_out_lat := OLD.clock_out_lat;
      NEW.clock_out_lng := OLD.clock_out_lng;
      NEW.clock_out_accuracy := OLD.clock_out_accuracy;
      NEW.clock_out_distance := OLD.clock_out_distance;
      NEW.updated_at := now();
      RETURN NEW;
    END IF;

    IF NEW.clock_out_time IS NULL THEN
      NEW.updated_at := now();
      RETURN NEW;
    END IF;

    IF v_school.latitude IS NULL OR v_school.longitude IS NULL THEN
      RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_CONFIGURED';
    END IF;
    IF NEW.clock_out_lat IS NULL OR NEW.clock_out_lng IS NULL THEN
      RAISE EXCEPTION 'STAFF_ATTENDANCE:NO_COORDINATES';
    END IF;

    v_distance := public.haversine_distance_m(NEW.clock_out_lat, NEW.clock_out_lng, v_school.latitude, v_school.longitude);
    NEW.clock_out_distance := round(v_distance::numeric, 1);
    IF v_distance > v_school.attendance_radius THEN
      RAISE EXCEPTION 'STAFF_ATTENDANCE:OUT_OF_RANGE:%', round(v_distance)::text;
    END IF;
    IF v_local_time < v_school.check_out_start OR v_local_time > v_school.check_out_end THEN
      RAISE EXCEPTION 'STAFF_ATTENDANCE:OUTSIDE_WINDOW:%', to_char(v_school.check_out_start,'HH24:MI') || '-' || to_char(v_school.check_out_end,'HH24:MI');
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- GPS clock-in (insert only)
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_SELF'; END IF;
  IF v_school.latitude IS NULL OR v_school.longitude IS NULL THEN RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_CONFIGURED'; END IF;
  IF NEW.clock_in_lat IS NULL OR NEW.clock_in_lng IS NULL THEN RAISE EXCEPTION 'STAFF_ATTENDANCE:NO_COORDINATES'; END IF;

  NEW.date := v_local_date;
  NEW.clock_in_time := now();
  NEW.clock_out_time := NULL;
  NEW.method := 'GPS';
  NEW.overridden_by := NULL;
  NEW.overridden_at := NULL;
  NEW.override_reason := NULL;

  v_distance := public.haversine_distance_m(NEW.clock_in_lat, NEW.clock_in_lng, v_school.latitude, v_school.longitude);
  NEW.clock_in_distance := round(v_distance::numeric, 1);
  IF v_distance > v_school.attendance_radius THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:OUT_OF_RANGE:%', round(v_distance)::text;
  END IF;
  IF v_local_time < v_school.check_in_start OR v_local_time > v_school.check_in_end THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:OUTSIDE_WINDOW:%', to_char(v_school.check_in_start,'HH24:MI') || '-' || to_char(v_school.check_in_end,'HH24:MI');
  END IF;

  v_late_after := v_school.check_in_start + make_interval(mins => v_school.grace_period);
  NEW.status := CASE WHEN v_local_time > v_late_after THEN 'Late' ELSE 'Present' END;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
