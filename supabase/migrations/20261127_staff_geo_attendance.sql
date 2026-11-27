-- ============================================================================
-- Zamifu Analytics — Geo-Biometric Staff Attendance
-- 2026-11-27
--
-- Adds:
--   1. Geofence + operating-hours configuration on public.schools
--   2. public.staff_attendance (one row per staff member per calendar day)
--   3. Server-side Haversine distance validation (defence in depth)
--   4. Clock-out RPC (staff have no UPDATE policy, per the security model)
--   5. RLS: staff read/insert only their own GPS records; school admins manage
--      every record in their school; service_role keeps full access.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. School geofence configuration
-- ---------------------------------------------------------------------------
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS attendance_radius integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS check_in_start time NOT NULL DEFAULT '06:30',
  ADD COLUMN IF NOT EXISTS check_in_end time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS check_out_start time NOT NULL DEFAULT '16:00',
  ADD COLUMN IF NOT EXISTS check_out_end time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS grace_period integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS attendance_timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  ADD COLUMN IF NOT EXISTS attendance_working_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS staff_attendance_enabled boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_attendance_radius_check') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_attendance_radius_check CHECK (attendance_radius BETWEEN 10 AND 100000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_grace_period_check') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_grace_period_check CHECK (grace_period BETWEEN 0 AND 240);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_attendance_lat_check') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_attendance_lat_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
      ADD CONSTRAINT schools_attendance_lng_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
END $$;

COMMENT ON COLUMN public.schools.attendance_radius IS 'Allowed geofence radius in metres for staff clock-in/out';
COMMENT ON COLUMN public.schools.grace_period IS 'Minutes after check_in_start before a clock-in is flagged Late';
COMMENT ON COLUMN public.schools.attendance_working_days IS 'ISO weekday numbers (1=Mon .. 7=Sun) counted as working days in reports';

-- ---------------------------------------------------------------------------
-- 2. Attendance table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Nairobi')::date),
  clock_in_time timestamptz,
  clock_out_time timestamptz,
  clock_in_lat double precision,
  clock_in_lng double precision,
  clock_in_accuracy double precision,
  clock_in_distance numeric(10,1),
  clock_out_lat double precision,
  clock_out_lng double precision,
  clock_out_accuracy double precision,
  clock_out_distance numeric(10,1),
  status text NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Late', 'Absent')),
  method text NOT NULL DEFAULT 'GPS' CHECK (method IN ('GPS', 'Manual')),
  overridden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_reason text,
  overridden_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_attendance_user_date_key UNIQUE (user_id, date)
);

COMMENT ON TABLE public.staff_attendance IS 'Daily staff attendance with GPS geofence proof and admin manual overrides';
COMMENT ON COLUMN public.staff_attendance.method IS 'GPS = self clock-in inside the geofence; Manual = school-admin override';
COMMENT ON COLUMN public.staff_attendance.overridden_by IS 'School admin profile that recorded a manual override';

CREATE INDEX IF NOT EXISTS staff_attendance_school_date_idx
  ON public.staff_attendance (school_id, date DESC);
CREATE INDEX IF NOT EXISTS staff_attendance_user_date_idx
  ON public.staff_attendance (user_id, date DESC);

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

-- Great-circle distance in metres (Haversine).
CREATE OR REPLACE FUNCTION public.haversine_distance_m(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    )
  );
$$;

-- Staff roles tracked by this module (students and parents are excluded).
CREATE OR REPLACE FUNCTION public.is_attendance_staff(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND coalesce(p.is_active, true) = true
      AND p.role IN ('teacher', 'school_admin', 'bursar', 'store_keeper')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin_of(p_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT
    public.is_master_super_admin()
    OR public.current_profile_role() IN ('super_admin'::public.user_role, 'master_super_admin'::public.user_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'school_admin'::public.user_role
        AND p.school_id = p_school_id
        AND coalesce(p.is_active, true) = true
    );
$$;

CREATE OR REPLACE FUNCTION public.staff_attendance_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Server-side validation / status computation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_attendance_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
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
  IF v_role IS NULL OR v_role NOT IN ('teacher', 'school_admin', 'bursar', 'store_keeper') THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_STAFF';
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = NEW.school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:NO_SCHOOL';
  END IF;
  v_tz := coalesce(nullif(v_school.attendance_timezone, ''), 'Africa/Nairobi');
  v_local_date := (now() AT TIME ZONE v_tz)::date;
  v_local_time := (now() AT TIME ZONE v_tz)::time;

  -- ---- Admin manual override -------------------------------------------
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

  -- ---- Staff GPS self clock-in -----------------------------------------
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_SELF';
  END IF;
  IF v_school.latitude IS NULL OR v_school.longitude IS NULL THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:NOT_CONFIGURED';
  END IF;
  IF NEW.clock_in_lat IS NULL OR NEW.clock_in_lng IS NULL THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:NO_COORDINATES';
  END IF;

  -- Server is authoritative for the timestamp and date.
  NEW.date := v_local_date;
  NEW.clock_in_time := now();
  NEW.clock_out_time := NULL;
  NEW.method := 'GPS';
  NEW.overridden_by := NULL;
  NEW.overridden_at := NULL;
  NEW.override_reason := NULL;

  v_distance := public.haversine_distance_m(
    NEW.clock_in_lat, NEW.clock_in_lng, v_school.latitude, v_school.longitude
  );
  NEW.clock_in_distance := round(v_distance::numeric, 1);
  IF v_distance > v_school.attendance_radius THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:OUT_OF_RANGE:%', round(v_distance)::text;
  END IF;

  IF v_local_time < v_school.check_in_start OR v_local_time > v_school.check_in_end THEN
    RAISE EXCEPTION 'STAFF_ATTENDANCE:OUTSIDE_WINDOW:%',
      to_char(v_school.check_in_start, 'HH24:MI') || '-' || to_char(v_school.check_in_end, 'HH24:MI');
  END IF;

  v_late_after := v_school.check_in_start + make_interval(mins => v_school.grace_period);
  NEW.status := CASE WHEN v_local_time > v_late_after THEN 'Late' ELSE 'Present' END;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_attendance_before_write ON public.staff_attendance;
CREATE TRIGGER staff_attendance_before_write
  BEFORE INSERT OR UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.staff_attendance_before_write();

DROP TRIGGER IF EXISTS staff_attendance_touch_updated_at ON public.staff_attendance;
CREATE TRIGGER staff_attendance_touch_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.staff_attendance_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Clock-out RPC
--    Staff deliberately have no UPDATE policy, so clock-out is a narrow,
--    validated SECURITY DEFINER function instead of a broad table update.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_clock_out(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_school public.schools%ROWTYPE;
  v_record public.staff_attendance%ROWTYPE;
  v_tz text;
  v_local_time time;
  v_local_date date;
  v_distance double precision;
  v_updated public.staff_attendance%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED', 'message', 'Please sign in again.');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.role NOT IN ('teacher', 'school_admin', 'bursar', 'store_keeper') THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_STAFF', 'message', 'Only staff members can clock out.');
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_profile.school_id;
  IF NOT FOUND OR v_school.latitude IS NULL OR v_school.longitude IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_CONFIGURED', 'message', 'School attendance settings are not configured.');
  END IF;

  v_tz := coalesce(nullif(v_school.attendance_timezone, ''), 'Africa/Nairobi');
  v_local_date := (now() AT TIME ZONE v_tz)::date;
  v_local_time := (now() AT TIME ZONE v_tz)::time;

  SELECT * INTO v_record
  FROM public.staff_attendance
  WHERE user_id = v_uid AND date = v_local_date
  FOR UPDATE;

  IF NOT FOUND OR v_record.clock_in_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_CLOCKED_IN', 'message', 'You have not clocked in today.');
  END IF;
  IF v_record.clock_out_time IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CLOCKED_OUT', 'message', 'You have already clocked out today.');
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_COORDINATES', 'message', 'Location is required.');
  END IF;

  v_distance := public.haversine_distance_m(p_lat, p_lng, v_school.latitude, v_school.longitude);
  IF v_distance > v_school.attendance_radius THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'OUT_OF_RANGE',
      'distance', round(v_distance::numeric, 1),
      'message', 'You must be at school to clock out. You are currently ' || round(v_distance)::text || ' meters away.'
    );
  END IF;

  IF v_local_time < v_school.check_out_start OR v_local_time > v_school.check_out_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'OUTSIDE_WINDOW',
      'message', 'Clock-out is only allowed between '
        || to_char(v_school.check_out_start, 'HH24:MI') || ' and '
        || to_char(v_school.check_out_end, 'HH24:MI') || '.'
    );
  END IF;

  UPDATE public.staff_attendance
  SET clock_out_time = now(),
      clock_out_lat = p_lat,
      clock_out_lng = p_lng,
      clock_out_accuracy = p_accuracy,
      clock_out_distance = round(v_distance::numeric, 1),
      updated_at = now()
  WHERE id = v_record.id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'OK',
    'distance', round(v_distance::numeric, 1),
    'record', to_jsonb(v_updated)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_clock_out(double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_clock_out(double precision, double precision, double precision) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_attendance_select_own ON public.staff_attendance;
DROP POLICY IF EXISTS staff_attendance_select_admin ON public.staff_attendance;
DROP POLICY IF EXISTS staff_attendance_insert_own ON public.staff_attendance;
DROP POLICY IF EXISTS staff_attendance_admin_insert ON public.staff_attendance;
DROP POLICY IF EXISTS staff_attendance_admin_update ON public.staff_attendance;
DROP POLICY IF EXISTS staff_attendance_admin_delete ON public.staff_attendance;

-- Staff: read only their own history.
CREATE POLICY staff_attendance_select_own
  ON public.staff_attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- School admins: read every record in their school.
CREATE POLICY staff_attendance_select_admin
  ON public.staff_attendance FOR SELECT TO authenticated
  USING (public.is_school_admin_of(school_id));

-- Staff: insert only their own GPS clock-in, into their own school.
CREATE POLICY staff_attendance_insert_own
  ON public.staff_attendance FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND method = 'GPS'
    AND school_id = public.current_profile_school()
    AND public.is_attendance_staff()
  );

-- School admins: insert manual overrides, attributed to themselves.
CREATE POLICY staff_attendance_admin_insert
  ON public.staff_attendance FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin_of(school_id)
    AND method = 'Manual'
    AND overridden_by = auth.uid()
  );

-- School admins: correct / override any record in their school.
CREATE POLICY staff_attendance_admin_update
  ON public.staff_attendance FOR UPDATE TO authenticated
  USING (public.is_school_admin_of(school_id))
  WITH CHECK (public.is_school_admin_of(school_id));

-- School admins: delete records in their school.
CREATE POLICY staff_attendance_admin_delete
  ON public.staff_attendance FOR DELETE TO authenticated
  USING (public.is_school_admin_of(school_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance TO authenticated;
GRANT ALL ON public.staff_attendance TO service_role;
