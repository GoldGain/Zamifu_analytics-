-- Return only school-admin contact fields needed by the reseller communication page.
-- Self-registered schools are included regardless of which reseller is currently
-- recorded on the school; manually created schools remain limited to the caller's
-- reseller account.

CREATE OR REPLACE FUNCTION public.get_reseller_school_admin_contacts()
RETURNS TABLE (
  id UUID,
  school_id UUID,
  first_name TEXT,
  last_name TEXT,
  phone TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT public.current_profile_role() AS role
  ),
  visible_schools AS (
    SELECT s.id
    FROM public.schools s
    CROSS JOIN caller c
    WHERE c.role = 'reseller_super_admin'::public.user_role
      AND (
        COALESCE(s.registration_source, '') = 'self_register'
        OR s.reseller_id IN (
          SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()
        )
      )
  ),
  stored_admins AS (
    SELECT sa.id, sa.school_id, sa.first_name, sa.last_name, sa.phone
    FROM public.school_admins sa
    JOIN visible_schools vs ON vs.id = sa.school_id
    WHERE COALESCE(sa.is_active, TRUE)
  ),
  profile_admins AS (
    SELECT p.id, p.school_id, p.first_name, p.last_name, p.phone
    FROM public.profiles p
    JOIN visible_schools vs ON vs.id = p.school_id
    WHERE p.role = 'school_admin'::public.user_role
      AND COALESCE(p.is_active, TRUE)
      AND NOT EXISTS (
        SELECT 1 FROM stored_admins sa
        WHERE sa.school_id = p.school_id
      )
  )
  SELECT * FROM stored_admins
  UNION ALL
  SELECT * FROM profile_admins;
$$;

REVOKE ALL ON FUNCTION public.get_reseller_school_admin_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reseller_school_admin_contacts() TO authenticated;

COMMENT ON FUNCTION public.get_reseller_school_admin_contacts() IS
  'Returns only admin names and phone numbers for the signed-in reseller''s schools and all self-registered schools.';

CREATE OR REPLACE FUNCTION public.get_reseller_communication_schools()
RETURNS TABLE (
  id UUID,
  name TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name
  FROM public.schools s
  WHERE public.current_profile_role() = 'reseller_super_admin'::public.user_role
    AND (
      COALESCE(s.registration_source, '') = 'self_register'
      OR s.reseller_id IN (
        SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()
      )
    )
  ORDER BY s.name;
$$;

REVOKE ALL ON FUNCTION public.get_reseller_communication_schools() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reseller_communication_schools() TO authenticated;
