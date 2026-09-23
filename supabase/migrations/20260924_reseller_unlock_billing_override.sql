-- Issue 6: a reseller unlock must override the expired-billing gate until the
-- school's subscription state changes. The snapshot prevents the override from
-- surviving a later renewal/status change.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS reseller_unlock_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reseller_unlock_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS reseller_unlock_subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reseller_unlock_trial_expires_at TIMESTAMPTZ;

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
  current_status TEXT;
  current_subscription_expires_at TIMESTAMPTZ;
  current_trial_expires_at TIMESTAMPTZ;
BEGIN
  IF public.current_profile_role() <> 'reseller_super_admin'::public.user_role THEN
    RAISE EXCEPTION 'Only reseller administrators can unlock schools';
  END IF;

  SELECT COALESCE(s.admin_portal_locked, FALSE),
         COALESCE(s.dos_portal_locked, FALSE),
         s.lock_reason,
         s.subscription_status::TEXT,
         s.subscription_expires_at,
         s.trial_expires_at
    INTO old_admin, old_dos, old_reason, current_status,
         current_subscription_expires_at, current_trial_expires_at
  FROM public.schools s
  WHERE s.id = p_school_id
    AND (COALESCE(s.registration_source, '') = 'self_register'
      OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()))
    AND (COALESCE(s.admin_portal_locked, FALSE) OR COALESCE(s.dos_portal_locked, FALSE))
    AND NOT (LOWER(COALESCE(s.subscription_status::TEXT, 'trial')) = 'active'
      AND s.subscription_expires_at IS NOT NULL AND s.subscription_expires_at > now())
    AND COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School is not visible, expired, or currently locked';
  END IF;

  UPDATE public.schools
  SET admin_portal_locked = FALSE,
      dos_portal_locked = FALSE,
      lock_reason = NULL,
      locked_at = NULL,
      locked_by_role = NULL,
      reseller_unlock_at = now(),
      reseller_unlock_subscription_status = current_status,
      reseller_unlock_subscription_expires_at = current_subscription_expires_at,
      reseller_unlock_trial_expires_at = current_trial_expires_at
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not persist school unlock';
  END IF;

  INSERT INTO public.school_unlock_audit (
    school_id, unlocked_by, previous_admin_portal_locked,
    previous_dos_portal_locked, reason
  ) VALUES (p_school_id, auth.uid(), old_admin, old_dos, old_reason);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_expired_school_portals_for_reseller()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count INTEGER;
BEGIN
  IF public.current_profile_role() <> 'reseller_super_admin'::public.user_role THEN
    RAISE EXCEPTION 'Only reseller administrators can materialize expired school locks';
  END IF;

  UPDATE public.schools s
  SET admin_portal_locked = TRUE,
      dos_portal_locked = TRUE,
      lock_reason = COALESCE(NULLIF(s.lock_reason, ''), 'Subscription or free trial expired'),
      locked_at = COALESCE(s.locked_at, now()),
      locked_by_role = 'system',
      reseller_unlock_at = NULL,
      reseller_unlock_subscription_status = NULL,
      reseller_unlock_subscription_expires_at = NULL,
      reseller_unlock_trial_expires_at = NULL
  WHERE (COALESCE(s.registration_source, '') = 'self_register'
         OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()))
    AND NOT (LOWER(COALESCE(s.subscription_status::TEXT, 'trial')) = 'active'
             AND s.subscription_expires_at IS NOT NULL
             AND s.subscription_expires_at > now())
    AND COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
    AND NOT (COALESCE(s.admin_portal_locked, FALSE) OR COALESCE(s.dos_portal_locked, FALSE))
    AND NOT (
      s.reseller_unlock_at IS NOT NULL
      AND s.reseller_unlock_at > COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days')
      AND s.reseller_unlock_subscription_status IS NOT DISTINCT FROM s.subscription_status::TEXT
      AND s.reseller_unlock_subscription_expires_at IS NOT DISTINCT FROM s.subscription_expires_at
      AND s.reseller_unlock_trial_expires_at IS NOT DISTINCT FROM s.trial_expires_at
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.school_unlock_audit u
      WHERE u.school_id = s.id
        AND u.unlocked_at > COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days')
    );

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_reseller_school(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_expired_school_portals_for_reseller() TO authenticated;
