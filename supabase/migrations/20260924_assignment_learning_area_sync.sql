-- Keep the legacy subjects table (referenced by teacher_subject_assignments)
-- synchronized with the newer school_learning_areas catalogue.
CREATE OR REPLACE FUNCTION public.sync_school_learning_area_subject()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    INSERT INTO public.subjects (school_id, name, code, curriculum, class_levels, is_core)
    SELECT NEW.school_id, c.name, NULL, 'CBE', ARRAY[]::INTEGER[], FALSE
    FROM public.learning_area_catalog c
    WHERE c.id = NEW.learning_area_id
      AND NOT EXISTS (
        SELECT 1 FROM public.subjects s
        WHERE s.school_id = NEW.school_id AND lower(trim(s.name)) = lower(trim(c.name))
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_school_learning_area_subject_trigger ON public.school_learning_areas;
CREATE TRIGGER sync_school_learning_area_subject_trigger
AFTER INSERT OR UPDATE OF is_active, learning_area_id ON public.school_learning_areas
FOR EACH ROW EXECUTE FUNCTION public.sync_school_learning_area_subject();

-- Backfill active catalogue areas that were added before the trigger existed.
INSERT INTO public.subjects (school_id, name, code, curriculum, class_levels, is_core)
SELECT sla.school_id, c.name, NULL, 'CBE', ARRAY[]::INTEGER[], FALSE
FROM public.school_learning_areas sla
JOIN public.learning_area_catalog c ON c.id = sla.learning_area_id
WHERE sla.is_active
  AND NOT EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.school_id = sla.school_id AND lower(trim(s.name)) = lower(trim(c.name))
  );

-- Make the reseller unlock operation idempotent: a school whose portal flags
-- are already open can still receive the billing override and audit record.
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

  SELECT COALESCE(s.admin_portal_locked, FALSE), COALESCE(s.dos_portal_locked, FALSE),
         s.lock_reason, s.subscription_status::TEXT, s.subscription_expires_at, s.trial_expires_at
    INTO old_admin, old_dos, old_reason, current_status,
         current_subscription_expires_at, current_trial_expires_at
  FROM public.schools s
  WHERE s.id = p_school_id
    AND (COALESCE(s.registration_source, '') = 'self_register'
      OR s.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid()))
    AND NOT (LOWER(COALESCE(s.subscription_status::TEXT, 'trial')) = 'active'
      AND s.subscription_expires_at IS NOT NULL AND s.subscription_expires_at > now())
    AND COALESCE(s.subscription_expires_at, s.trial_expires_at, s.created_at + INTERVAL '60 days') <= now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School is not visible or has an active subscription';
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

  INSERT INTO public.school_unlock_audit (
    school_id, unlocked_by, previous_admin_portal_locked,
    previous_dos_portal_locked, reason
  ) VALUES (p_school_id, auth.uid(), old_admin, old_dos, old_reason);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_reseller_school(UUID) TO authenticated;
