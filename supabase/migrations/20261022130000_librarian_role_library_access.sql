-- Add a school-scoped librarian account that can operate only Library tables.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'librarian';

-- Librarians must not gain access to unrelated tables through can_access_school.
-- Keep access limited to their own school's Library books and borrowings.
CREATE OR REPLACE FUNCTION public.can_access_library(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.can_access_school(p_school_id), false)
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.school_id = p_school_id
        AND profile.role::text = 'librarian'
        AND profile.is_active IS DISTINCT FROM FALSE
    );
$$;
REVOKE ALL ON FUNCTION public.can_access_library(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_library(uuid) TO authenticated;

-- A narrow, identity-bound school context supports the Library header and the
-- existing subscription/manual-lock gate without granting SELECT on schools.
CREATE OR REPLACE FUNCTION public.get_librarian_portal_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', school.id,
    'name', school.name,
    'logo_url', school.logo_url,
    'admin_portal_locked', COALESCE(school.admin_portal_locked, false),
    'dos_portal_locked', COALESCE(school.dos_portal_locked, false),
    'lock_reason', school.lock_reason,
    'subscription_plan', school.subscription_plan,
    'subscription_status', school.subscription_status,
    'subscription_expires_at', school.subscription_expires_at,
    'trial_started_at', school.trial_started_at,
    'trial_expires_at', school.trial_expires_at,
    'reseller_unlock_at', school.reseller_unlock_at,
    'reseller_unlock_subscription_status', school.reseller_unlock_subscription_status,
    'reseller_unlock_subscription_expires_at', school.reseller_unlock_subscription_expires_at,
    'reseller_unlock_trial_expires_at', school.reseller_unlock_trial_expires_at,
    'created_at', school.created_at
  )
  FROM public.profiles AS profile
  JOIN public.schools AS school ON school.id = profile.school_id
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'librarian'
    AND profile.is_active IS DISTINCT FROM FALSE
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_librarian_portal_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_librarian_portal_context() TO authenticated;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_borrowings ENABLE ROW LEVEL SECURITY;

-- Remove the legacy public-role ALL policy and replace every operation policy.
DROP POLICY IF EXISTS library_books_all ON public.library_books;
DROP POLICY IF EXISTS library_books_select ON public.library_books;
CREATE POLICY library_books_select ON public.library_books
  FOR SELECT TO authenticated
  USING (public.can_access_library(school_id));
DROP POLICY IF EXISTS library_books_insert ON public.library_books;
CREATE POLICY library_books_insert ON public.library_books
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
  );
DROP POLICY IF EXISTS library_books_update ON public.library_books;
CREATE POLICY library_books_update ON public.library_books
  FOR UPDATE TO authenticated
  USING (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
  )
  WITH CHECK (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
  );
DROP POLICY IF EXISTS library_books_delete ON public.library_books;
CREATE POLICY library_books_delete ON public.library_books
  FOR DELETE TO authenticated
  USING (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
  );

DROP POLICY IF EXISTS library_borrowings_select ON public.library_borrowings;
CREATE POLICY library_borrowings_select ON public.library_borrowings
  FOR SELECT TO authenticated
  USING (public.can_access_library(school_id));
DROP POLICY IF EXISTS library_borrowings_insert ON public.library_borrowings;
CREATE POLICY library_borrowings_insert ON public.library_borrowings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
    AND EXISTS (
      SELECT 1
      FROM public.library_books AS book
      WHERE book.id = library_borrowings.book_id
        AND book.school_id = library_borrowings.school_id
    )
  );
DROP POLICY IF EXISTS library_borrowings_update ON public.library_borrowings;
CREATE POLICY library_borrowings_update ON public.library_borrowings
  FOR UPDATE TO authenticated
  USING (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
  )
  WITH CHECK (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
    AND EXISTS (
      SELECT 1
      FROM public.library_books AS book
      WHERE book.id = library_borrowings.book_id
        AND book.school_id = library_borrowings.school_id
    )
  );
DROP POLICY IF EXISTS library_borrowings_delete ON public.library_borrowings;
CREATE POLICY library_borrowings_delete ON public.library_borrowings
  FOR DELETE TO authenticated
  USING (
    public.can_access_library(school_id)
    AND public.current_profile_role()::text = ANY (ARRAY['school_admin', 'librarian', 'super_admin', 'master_super_admin'])
  );
