-- Reseller unlock workflow: expose only expired and currently locked schools,
-- enforce the existing reseller visibility rule, and record every unlock.
CREATE TABLE IF NOT EXISTS public.school_unlock_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  unlocked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_admin_portal_locked BOOLEAN NOT NULL DEFAULT FALSE,
  previous_dos_portal_locked BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS school_unlock_audit_school_idx
  ON public.school_unlock_audit (school_id, unlocked_at DESC);

ALTER TABLE public.school_unlock_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS school_unlock_audit_reseller_read ON public.school_unlock_audit;
CREATE POLICY school_unlock_audit_reseller_read ON public.school_unlock_audit
FOR SELECT USING (
  public.current_profile_role() = 'reseller_super_admin'::public.user_role
  AND school_id IN (
    SELECT s.id
    FROM public.schools s
    WHERE COALESCE(s.registration_source, '') = 'self_register'
       OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.get_reseller_expired_locked_schools()
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  trial_expires_at TIMESTAMPTZ,
  subscription_status TEXT,
  admin_portal_locked BOOLEAN,
  dos_portal_locked BOOLEAN,
  lock_reason TEXT,
  locked_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.code, s.trial_expires_at, s.subscription_status::text,
         COALESCE(s.admin_portal_locked, FALSE), COALESCE(s.dos_portal_locked, FALSE),
         s.lock_reason, s.locked_at
  FROM public.schools s
  WHERE public.current_profile_role() = 'reseller_super_admin'::public.user_role
    AND (
      COALESCE(s.registration_source, '') = 'self_register'
      OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid())
    )
    AND (COALESCE(s.admin_portal_locked, FALSE) OR COALESCE(s.dos_portal_locked, FALSE))
    AND NOT (
      LOWER(COALESCE(s.subscription_status::text, 'trial')) = 'active'
      AND s.subscription_expires_at IS NOT NULL
      AND s.subscription_expires_at > now()
    )
    AND COALESCE(s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
  ORDER BY s.trial_expires_at NULLS FIRST, s.name;
$$;
REVOKE ALL ON FUNCTION public.get_reseller_expired_locked_schools() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reseller_expired_locked_schools() TO authenticated;

CREATE OR REPLACE FUNCTION public.unlock_reseller_school(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_admin BOOLEAN;
  old_dos BOOLEAN;
  old_reason TEXT;
BEGIN
  IF public.current_profile_role() <> 'reseller_super_admin'::public.user_role THEN
    RAISE EXCEPTION 'Only reseller administrators can unlock schools';
  END IF;

  SELECT COALESCE(s.admin_portal_locked, FALSE), COALESCE(s.dos_portal_locked, FALSE), s.lock_reason
    INTO old_admin, old_dos, old_reason
  FROM public.schools s
  WHERE s.id = p_school_id
    AND (
      COALESCE(s.registration_source, '') = 'self_register'
      OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid())
    )
    AND (COALESCE(s.admin_portal_locked, FALSE) OR COALESCE(s.dos_portal_locked, FALSE))
    AND NOT (LOWER(COALESCE(s.subscription_status::text, 'trial')) = 'active' AND s.subscription_expires_at IS NOT NULL AND s.subscription_expires_at > now())
    AND COALESCE(s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School is not visible, expired, or currently locked';
  END IF;

  UPDATE public.schools
  SET admin_portal_locked = FALSE,
      dos_portal_locked = FALSE,
      lock_reason = NULL,
      locked_at = NULL,
      locked_by_role = NULL
  WHERE id = p_school_id;

  INSERT INTO public.school_unlock_audit (
    school_id, unlocked_by, previous_admin_portal_locked,
    previous_dos_portal_locked, reason
  ) VALUES (p_school_id, auth.uid(), old_admin, old_dos, old_reason);

  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.unlock_reseller_school(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_reseller_school(UUID) TO authenticated;
COMMENT ON FUNCTION public.unlock_reseller_school(UUID) IS
  'Unlocks an expired visible school for a reseller and records the action.';
