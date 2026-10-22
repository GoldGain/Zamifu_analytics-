-- Older permissive policies use these helpers directly rather than
-- can_access_school(). Hide the school identifier from the librarian role so
-- those legacy policies cannot expose classes, students, fees, etc.
CREATE OR REPLACE FUNCTION public.auth_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN profile.role::text = 'librarian' THEN NULL::uuid
    ELSE profile.school_id
  END
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN profile.role::text = 'librarian' THEN NULL::uuid
    ELSE profile.school_id
  END
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.is_active = true
  LIMIT 1;
$$;

-- The profiles table previously had RLS policies defined but RLS disabled.
-- Enable those policies and add a role-specific restrictive guard: librarians
-- can see/update only their own profile, cannot change role/school/active state,
-- while existing policy behavior for other roles remains unchanged.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS librarian_profile_scope_guard ON public.profiles;
CREATE POLICY librarian_profile_scope_guard ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    COALESCE(public.auth_user_role()::text <> 'librarian', true)
    OR id = auth.uid()
  )
  WITH CHECK (
    COALESCE(public.auth_user_role()::text <> 'librarian', true)
    OR (
      id = auth.uid()
      AND role::text = 'librarian'
      AND school_id = (public.get_librarian_portal_context() ->> 'id')::uuid
      AND is_active IS DISTINCT FROM FALSE
    )
  );
