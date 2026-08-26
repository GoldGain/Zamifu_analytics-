-- Teacher attendance register and class-teacher-only learner attendance marking.
-- This migration intentionally leaves timetable tables and teacher timetable access unchanged.

CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'on_leave')),
  remarks TEXT,
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_id, date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school_date
  ON public.teacher_attendance (school_id, date);

CREATE OR REPLACE FUNCTION public.update_teacher_attendance_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teacher_attendance_updated_at ON public.teacher_attendance;
CREATE TRIGGER teacher_attendance_updated_at
BEFORE UPDATE ON public.teacher_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_teacher_attendance_timestamp();

CREATE OR REPLACE FUNCTION public.can_mark_class_attendance(p_school_id UUID, p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = p_class_id
      AND c.school_id = p_school_id
      AND (
        c.class_teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.teachers t
          WHERE t.profile_id = auth.uid()
            AND t.school_id = p_school_id
            AND t.assigned_class_id = c.id
            AND t.is_class_teacher = true
            AND t.is_active = true
        )
      )
  );
$$;

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_attendance_select ON public.teacher_attendance;
CREATE POLICY teacher_attendance_select ON public.teacher_attendance
FOR SELECT USING (
  public.is_master_super_admin()
  OR (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role)
  )
);

DROP POLICY IF EXISTS teacher_attendance_insert ON public.teacher_attendance;
CREATE POLICY teacher_attendance_insert ON public.teacher_attendance
FOR INSERT WITH CHECK (
  public.is_master_super_admin()
  OR (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role)
  )
);

DROP POLICY IF EXISTS teacher_attendance_update ON public.teacher_attendance;
CREATE POLICY teacher_attendance_update ON public.teacher_attendance
FOR UPDATE USING (
  public.is_master_super_admin()
  OR (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role)
  )
)
WITH CHECK (
  public.is_master_super_admin()
  OR (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role)
  )
);

DROP POLICY IF EXISTS teacher_attendance_delete ON public.teacher_attendance;
CREATE POLICY teacher_attendance_delete ON public.teacher_attendance
FOR DELETE USING (
  public.is_master_super_admin()
  OR (
    public.can_access_school(school_id)
    AND public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role)
  )
);

DROP POLICY IF EXISTS attendance_insert ON public.attendance;
DROP POLICY IF EXISTS attendance_tenant_insert ON public.attendance;
DROP POLICY IF EXISTS attendance_tenant_update ON public.attendance;
DROP POLICY IF EXISTS attendance_tenant_delete ON public.attendance;
DROP POLICY IF EXISTS attendance_select ON public.attendance;
DROP POLICY IF EXISTS attendance_tenant_select ON public.attendance;

CREATE POLICY attendance_select ON public.attendance
FOR SELECT USING (
  public.is_master_super_admin()
  OR (
    public.can_access_school(school_id)
    AND (
      public.current_profile_role() IN ('school_admin'::user_role, 'super_admin'::user_role)
      OR public.can_mark_class_attendance(school_id, class_id)
    )
  )
);

CREATE POLICY attendance_class_teacher_insert ON public.attendance
FOR INSERT WITH CHECK (
  public.can_mark_class_attendance(school_id, class_id)
);

CREATE POLICY attendance_class_teacher_update ON public.attendance
FOR UPDATE USING (
  public.can_mark_class_attendance(school_id, class_id)
)
WITH CHECK (
  public.can_mark_class_attendance(school_id, class_id)
);

CREATE POLICY attendance_class_teacher_delete ON public.attendance
FOR DELETE USING (
  public.can_mark_class_attendance(school_id, class_id)
);
