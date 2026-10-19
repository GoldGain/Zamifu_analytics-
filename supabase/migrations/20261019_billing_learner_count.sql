ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS billing_learner_count INTEGER NULL;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_billing_learner_count_positive;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_billing_learner_count_positive
  CHECK (billing_learner_count IS NULL OR billing_learner_count > 0);

CREATE OR REPLACE FUNCTION public.set_school_billing_learner_count(p_billing_learner_count INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_billing_learner_count IS NOT NULL AND p_billing_learner_count <= 0 THEN
    RAISE EXCEPTION 'Billing learner count must be a positive integer or NULL';
  END IF;

  SELECT school_id INTO v_school_id
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'school_admin'::public.user_role;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Only a school admin linked to a school can change billing learner count';
  END IF;

  UPDATE public.schools
  SET billing_learner_count = p_billing_learner_count,
      updated_at = NOW()
  WHERE id = v_school_id
  RETURNING billing_learner_count INTO v_count;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_school_billing_learner_count(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_school_billing_learner_count(INTEGER) TO authenticated;
