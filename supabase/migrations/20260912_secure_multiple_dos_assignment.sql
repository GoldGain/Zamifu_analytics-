-- Secure, transactional multi-Dean-of-Studies assignment.
-- The teachers.is_dean_of_studies flag remains the source of truth; the legacy
-- schools.dean_of_studies_id pointer is kept in sync with the first selected
-- teachers.id for older consumers.

CREATE OR REPLACE FUNCTION public.guard_teacher_dos_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_dean_of_studies IS DISTINCT FROM NEW.is_dean_of_studies
     AND public.current_profile_role() NOT IN (
       'school_admin'::user_role,
       'super_admin'::user_role,
       'master_super_admin'::user_role
     ) THEN
    RAISE EXCEPTION 'Only an authorized school administrator can assign Dean of Studies access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_teacher_dos_flag ON public.teachers;
CREATE TRIGGER guard_teacher_dos_flag
BEFORE UPDATE OF is_dean_of_studies ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.guard_teacher_dos_flag();

CREATE OR REPLACE FUNCTION public.assign_school_dos(
  p_school_id uuid,
  p_teacher_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
  first_teacher_id uuid;
  assigned_count integer := 0;
BEGIN
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role NOT IN (
    'school_admin'::user_role,
    'super_admin'::user_role,
    'master_super_admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Only an authorized school administrator can assign Dean of Studies access';
  END IF;

  IF caller_role = 'school_admin'::user_role
     AND public.current_profile_school_id() IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'You can only assign Deans of Studies for your own school';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_teacher_ids, ARRAY[]::uuid[])) AS requested(id)
    LEFT JOIN public.teachers AS teacher ON teacher.id = requested.id
    WHERE teacher.id IS NULL OR teacher.school_id IS DISTINCT FROM p_school_id OR teacher.is_active IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Every selected Dean of Studies must be an active teacher in this school';
  END IF;

  UPDATE public.teachers
  SET is_dean_of_studies = (id = ANY(COALESCE(p_teacher_ids, ARRAY[]::uuid[])))
  WHERE school_id = p_school_id;

  SELECT id INTO first_teacher_id
  FROM public.teachers
  WHERE school_id = p_school_id
    AND id = ANY(COALESCE(p_teacher_ids, ARRAY[]::uuid[]))
  ORDER BY array_position(COALESCE(p_teacher_ids, ARRAY[]::uuid[]), id)
  LIMIT 1;

  UPDATE public.schools
  SET dean_of_studies_id = first_teacher_id
  WHERE id = p_school_id;

  SELECT count(*)::integer INTO assigned_count
  FROM public.teachers
  WHERE school_id = p_school_id
    AND is_dean_of_studies IS TRUE;

  RETURN assigned_count;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_school_dos(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_school_dos(uuid, uuid[]) TO authenticated;
