-- Durable, server-verified school billing for Zamifu Analytics.
-- Trial dates are backfilled from existing creation/start dates and are never
-- restarted from the moment this migration runs.

-- Ensure existing schools have a durable trial start date.
UPDATE public.schools
SET trial_started_at = COALESCE(trial_started_at, created_at, NOW())
WHERE trial_started_at IS NULL;

-- Normalize trial schools to the product's 60-day policy without touching paid
-- schools and without moving a trial start date forward.
UPDATE public.schools
SET trial_expires_at = CASE
      WHEN trial_expires_at IS NULL
        OR trial_expires_at < trial_started_at + INTERVAL '60 days'
      THEN trial_started_at + INTERVAL '60 days'
      ELSE trial_expires_at
    END,
    subscription_expires_at = CASE
      WHEN subscription_status::text = 'trial'
        AND (subscription_expires_at IS NULL
          OR subscription_expires_at < trial_started_at + INTERVAL '60 days')
      THEN trial_started_at + INTERVAL '60 days'
      ELSE subscription_expires_at
    END
WHERE COALESCE(subscription_status::text, 'trial') = 'trial'
  AND trial_started_at IS NOT NULL;

-- Paystack references are the idempotency key for server verification.
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_subscription_payments_reference_unique
  ON public.school_subscription_payments(payment_reference)
  WHERE payment_reference IS NOT NULL;

-- Prevent authenticated browser sessions from modifying subscription/trial
-- state directly. The privileged verification function below is allowed.
CREATE OR REPLACE FUNCTION public.prevent_client_billing_field_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') AND (
    NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan OR
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
    NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at OR
    NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at OR
    NEW.trial_expires_at IS DISTINCT FROM OLD.trial_expires_at
  ) THEN
    RAISE EXCEPTION 'Subscription and trial fields can only be changed by verified server billing operations';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_school_billing_fields ON public.schools;
CREATE TRIGGER protect_school_billing_fields
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_billing_field_changes();

-- Atomic, idempotent activation target for the Paystack verification Edge
-- Function. EXECUTE is granted only to the Supabase service role.
CREATE OR REPLACE FUNCTION public.record_verified_school_payment(
  p_school_id UUID,
  p_payment_reference TEXT,
  p_paystack_transaction_id TEXT,
  p_learners_count INTEGER,
  p_fee_per_learner INTEGER,
  p_amount INTEGER,
  p_currency TEXT,
  p_term_label TEXT,
  p_paid_by_email TEXT,
  p_paid_by_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school public.schools%ROWTYPE;
  v_payment public.school_subscription_payments%ROWTYPE;
  v_days INTEGER;
  v_plan subscription_plan;
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_school_id IS NULL
     OR NULLIF(TRIM(p_payment_reference), '') IS NULL
     OR p_learners_count IS NULL OR p_learners_count <= 0
     OR p_fee_per_learner IS NULL OR p_fee_per_learner <= 0
     OR p_amount IS NULL OR p_amount <= 0
     OR UPPER(COALESCE(p_currency, '')) <> 'KES' THEN
    RAISE EXCEPTION 'Invalid verified payment payload';
  END IF;

  SELECT * INTO v_school
  FROM public.schools
  WHERE id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  -- Annual is the discounted yearly product; all other labels are termly.
  IF LOWER(COALESCE(p_term_label, '')) LIKE '%annual%'
     OR LOWER(COALESCE(p_term_label, '')) LIKE '%year%' THEN
    v_days := 365;
    v_plan := 'premium'::subscription_plan;
  ELSE
    v_days := 90;
    v_plan := 'basic'::subscription_plan;
  END IF;

  v_expires := GREATEST(
    COALESCE(v_school.subscription_expires_at, NOW()),
    NOW()
  ) + make_interval(days => v_days);

  -- Lock the reference so retries cannot create duplicate subscription rows.
  SELECT * INTO v_payment
  FROM public.school_subscription_payments
  WHERE payment_reference = TRIM(p_payment_reference)
  FOR UPDATE;

  IF FOUND THEN
    IF v_payment.school_id IS DISTINCT FROM p_school_id THEN
      RAISE EXCEPTION 'Payment reference is already linked to another school';
    END IF;

    IF v_payment.status = 'success' THEN
      RETURN jsonb_build_object(
        'payment_id', v_payment.id,
        'school_id', p_school_id,
        'subscription_expires_at', v_school.subscription_expires_at,
        'already_processed', TRUE
      );
    END IF;

    UPDATE public.school_subscription_payments
    SET school_id = p_school_id,
        reseller_id = v_school.reseller_id,
        school_name = v_school.name,
        learners_count = p_learners_count,
        fee_per_learner = p_fee_per_learner,
        amount = p_amount,
        currency = UPPER(p_currency),
        term_label = p_term_label,
        payment_method = 'paystack',
        status = 'success',
        paid_by_email = p_paid_by_email,
        paid_by_name = p_paid_by_name,
        notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN 'Server verified by Paystack.' ELSE ' Server verified by Paystack.' END,
        updated_at = NOW()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  ELSE
    INSERT INTO public.school_subscription_payments (
      school_id,
      reseller_id,
      school_name,
      learners_count,
      fee_per_learner,
      amount,
      currency,
      term_label,
      payment_reference,
      payment_method,
      status,
      paid_by_email,
      paid_by_name,
      notes
    ) VALUES (
      p_school_id,
      v_school.reseller_id,
      v_school.name,
      p_learners_count,
      p_fee_per_learner,
      p_amount,
      UPPER(p_currency),
      p_term_label,
      TRIM(p_payment_reference),
      'paystack',
      'success',
      p_paid_by_email,
      p_paid_by_name,
      'Server verified by Paystack.'
    )
    RETURNING * INTO v_payment;
  END IF;

  UPDATE public.schools
  SET subscription_plan = v_plan,
      subscription_status = 'active'::subscription_status,
      subscription_expires_at = v_expires,
      admin_portal_locked = FALSE,
      dos_portal_locked = FALSE,
      lock_reason = NULL,
      locked_at = NULL,
      locked_by_role = NULL,
      updated_at = NOW()
  WHERE id = p_school_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'school_id', p_school_id,
    'subscription_expires_at', (SELECT subscription_expires_at FROM public.schools WHERE id = p_school_id),
    'already_processed', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_verified_school_payment(
  UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_school_payment(
  UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- Future registrations use the same 60-day server-side policy. Existing
-- creation and trial dates are preserved by the backfill above.
