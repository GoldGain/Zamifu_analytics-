-- Subscription receipts, trial-expiry notification idempotency, school activity history,
-- and reseller unlock eligibility for expired subscriptions.

CREATE TABLE IF NOT EXISTS public.trial_expiry_notification_deliveries (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  trial_expires_at TIMESTAMPTZ NOT NULL,
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  email_error TEXT,
  sms_error TEXT,
  last_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_expiry_notification_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trial_expiry_delivery_school_admin_read ON public.trial_expiry_notification_deliveries;
CREATE POLICY trial_expiry_delivery_school_admin_read
ON public.trial_expiry_notification_deliveries
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.school_id = trial_expiry_notification_deliveries.school_id
    AND p.role = 'school_admin'::public.user_role
));

-- School administrators may view their own verified subscription receipts.
DROP POLICY IF EXISTS school_admin_own_subscription_payments ON public.school_subscription_payments;
CREATE POLICY school_admin_own_subscription_payments
ON public.school_subscription_payments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.school_id = school_subscription_payments.school_id
    AND p.role = 'school_admin'::public.user_role
));

-- School administrators may view their own portal activity history.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS school_admin_own_audit_read ON public.audit_logs;
CREATE POLICY school_admin_own_audit_read
ON public.audit_logs
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.school_id = audit_logs.school_id
    AND p.role = 'school_admin'::public.user_role
));

-- Capture future changes to the main school-scoped operational tables. The
-- trigger is intentionally generic so it can be reused without exposing a
-- table's full payload to the browser.
CREATE OR REPLACE FUNCTION public.capture_school_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  resolved_school_id UUID;
BEGIN
  payload := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  resolved_school_id := NULLIF(payload->>'school_id', '')::UUID;
  IF resolved_school_id IS NULL AND TG_TABLE_NAME = 'schools' THEN
    resolved_school_id := NULLIF(payload->>'id', '')::UUID;
  END IF;
  IF resolved_school_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  INSERT INTO public.audit_logs (school_id, user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    resolved_school_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    NULLIF(payload->>'id', '')::UUID,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN OTHERS THEN
  -- Activity capture must never block a legitimate school operation.
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'schools','students','teachers','classes','subjects','results','assessments',
    'school_announcements','announcements','school_subscription_payments'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS capture_school_activity_%I ON public.%I', table_name, table_name);
      EXECUTE format('CREATE TRIGGER capture_school_activity_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_school_activity()', table_name, table_name);
    END IF;
  END LOOP;
END $$;

-- Expiry locks may be caused by an expired paid subscription as well as by an
-- expired trial. Resellers should see every currently locked school whose
-- subscription is not active, regardless of the old trial date.
DROP FUNCTION IF EXISTS public.get_reseller_expired_locked_schools();
CREATE OR REPLACE FUNCTION public.get_reseller_expired_locked_schools()
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  trial_expires_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
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
  SELECT s.id, s.name, s.code, s.trial_expires_at, s.subscription_expires_at,
         s.subscription_status::text,
         COALESCE(s.admin_portal_locked, FALSE), COALESCE(s.dos_portal_locked, FALSE),
         s.lock_reason, s.locked_at
  FROM public.schools s
  WHERE public.current_profile_role() = 'reseller_super_admin'::public.user_role
    AND (COALESCE(s.registration_source, '') = 'self_register'
      OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()))
    AND (COALESCE(s.admin_portal_locked, FALSE) OR COALESCE(s.dos_portal_locked, FALSE))
    AND NOT (LOWER(COALESCE(s.subscription_status::text, 'trial')) = 'active'
      AND s.subscription_expires_at IS NOT NULL AND s.subscription_expires_at > now())
    AND COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
  ORDER BY COALESCE(s.subscription_expires_at, s.trial_expires_at) NULLS FIRST, s.name;
$$;

CREATE OR REPLACE FUNCTION public.unlock_reseller_school(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE old_admin BOOLEAN; old_dos BOOLEAN; old_reason TEXT;
BEGIN
  IF public.current_profile_role() <> 'reseller_super_admin'::public.user_role THEN
    RAISE EXCEPTION 'Only reseller administrators can unlock schools';
  END IF;
  SELECT COALESCE(s.admin_portal_locked, FALSE), COALESCE(s.dos_portal_locked, FALSE), s.lock_reason
    INTO old_admin, old_dos, old_reason
  FROM public.schools s
  WHERE s.id = p_school_id
    AND (COALESCE(s.registration_source, '') = 'self_register'
      OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()))
    AND (COALESCE(s.admin_portal_locked, FALSE) OR COALESCE(s.dos_portal_locked, FALSE))
    AND NOT (LOWER(COALESCE(s.subscription_status::text, 'trial')) = 'active'
      AND s.subscription_expires_at IS NOT NULL AND s.subscription_expires_at > now())
    AND COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'School is not visible, expired, or currently locked'; END IF;
  UPDATE public.schools
  SET admin_portal_locked = FALSE, dos_portal_locked = FALSE,
      lock_reason = NULL, locked_at = NULL, locked_by_role = NULL
  WHERE id = p_school_id;
  INSERT INTO public.school_unlock_audit (school_id, unlocked_by, previous_admin_portal_locked, previous_dos_portal_locked, reason)
  VALUES (p_school_id, auth.uid(), old_admin, old_dos, old_reason);
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.get_reseller_expired_locked_schools() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reseller_expired_locked_schools() TO authenticated;
REVOKE ALL ON FUNCTION public.unlock_reseller_school(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_reseller_school(UUID) TO authenticated;

COMMENT ON TABLE public.trial_expiry_notification_deliveries IS 'Idempotent delivery state for automated trial-expiry SMS and email alerts.';
COMMENT ON TABLE public.audit_logs IS 'School-scoped audit history displayed to school administrators.';
COMMENT ON FUNCTION public.get_reseller_expired_locked_schools() IS 'Returns every visible locked school whose trial or paid subscription has expired.';
COMMENT ON FUNCTION public.unlock_reseller_school(UUID) IS 'Unlocks an expired visible school for a reseller and records the action.';
