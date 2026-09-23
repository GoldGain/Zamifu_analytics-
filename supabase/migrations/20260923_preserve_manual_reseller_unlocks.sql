-- Preserve a reseller's manual unlock until the school's subscription state changes.
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
      locked_by_role = 'system'
  WHERE (COALESCE(s.registration_source, '') = 'self_register'
         OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()))
    AND NOT (LOWER(COALESCE(s.subscription_status::text, 'trial')) = 'active'
             AND s.subscription_expires_at IS NOT NULL
             AND s.subscription_expires_at > now())
    AND COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
    AND NOT (COALESCE(s.admin_portal_locked, FALSE) OR COALESCE(s.dos_portal_locked, FALSE))
    AND NOT EXISTS (
      SELECT 1
      FROM public.school_unlock_audit u
      WHERE u.school_id = s.id
        AND u.unlocked_at > COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days')
    );

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;
