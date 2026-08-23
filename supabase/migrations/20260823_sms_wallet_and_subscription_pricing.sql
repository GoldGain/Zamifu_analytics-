-- Confirmed pricing rollout and prepaid SMS wallet.
-- Subscription: KES 20 per active learner per term; KES 50 per active learner per year.
-- SMS: KES 1 per provider SMS segment, purchased by school administrators.

UPDATE public.schools
SET fee_per_learner_per_term = 20,
    fee_per_learner_per_year = 50,
    updated_at = NOW();

UPDATE public.resellers
SET default_fee_per_learner = 20,
    default_fee_per_learner_per_year = 50,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.school_sms_wallets (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  sms_balance INTEGER NOT NULL DEFAULT 0 CHECK (sms_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.school_sms_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('topup', 'debit', 'refund', 'adjustment')),
  credits INTEGER NOT NULL CHECK (credits <> 0),
  amount_ksh INTEGER NOT NULL DEFAULT 0 CHECK (amount_ksh >= 0),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('reserved', 'success', 'failed', 'refunded', 'reversed')),
  payment_reference TEXT,
  paystack_transaction_id TEXT,
  paid_by_email TEXT,
  paid_by_name TEXT,
  recipient_phone TEXT,
  message TEXT,
  sms_segments INTEGER NOT NULL DEFAULT 0 CHECK (sms_segments >= 0),
  provider_message_id TEXT,
  error_message TEXT,
  sent_by UUID,
  related_transaction_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS sms_segments INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_transaction_id UUID,
  ADD COLUMN IF NOT EXISTS billing_status TEXT;

INSERT INTO public.school_sms_wallets (school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_sms_topup_reference_unique
  ON public.school_sms_transactions(payment_reference)
  WHERE transaction_type = 'topup' AND payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_sms_transactions_school_created
  ON public.school_sms_transactions(school_id, created_at DESC);

ALTER TABLE public.school_sms_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_sms_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_admin_sms_wallet_select ON public.school_sms_wallets;
CREATE POLICY school_admin_sms_wallet_select
  ON public.school_sms_wallets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = school_sms_wallets.school_id
        AND p.role::text = 'school_admin'
    )
  );

DROP POLICY IF EXISTS school_admin_sms_transactions_select ON public.school_sms_transactions;
CREATE POLICY school_admin_sms_transactions_select
  ON public.school_sms_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = school_sms_transactions.school_id
        AND p.role::text = 'school_admin'
    )
  );

REVOKE ALL ON TABLE public.school_sms_wallets FROM anon, authenticated;
GRANT SELECT ON TABLE public.school_sms_wallets TO authenticated;
REVOKE ALL ON TABLE public.school_sms_transactions FROM anon, authenticated;
GRANT SELECT ON TABLE public.school_sms_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.record_verified_school_sms_topup(
  p_school_id UUID,
  p_payment_reference TEXT,
  p_paystack_transaction_id TEXT,
  p_credits INTEGER,
  p_amount_ksh INTEGER,
  p_paid_by_email TEXT,
  p_paid_by_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.school_sms_wallets%ROWTYPE;
  v_tx public.school_sms_transactions%ROWTYPE;
  v_reference TEXT := NULLIF(TRIM(p_payment_reference), '');
BEGIN
  IF p_school_id IS NULL
     OR v_reference IS NULL
     OR p_credits IS NULL OR p_credits <= 0
     OR p_amount_ksh IS NULL OR p_amount_ksh <= 0
     OR p_amount_ksh <> p_credits THEN
    RAISE EXCEPTION 'Invalid verified SMS top-up payload';
  END IF;

  INSERT INTO public.school_sms_wallets (school_id)
  VALUES (p_school_id)
  ON CONFLICT (school_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.school_sms_wallets
  WHERE school_id = p_school_id
  FOR UPDATE;

  SELECT * INTO v_tx
  FROM public.school_sms_transactions
  WHERE transaction_type = 'topup'
    AND payment_reference = v_reference
  FOR UPDATE;

  IF FOUND THEN
    IF v_tx.school_id IS DISTINCT FROM p_school_id THEN
      RAISE EXCEPTION 'Payment reference is already linked to another school';
    END IF;
    IF v_tx.status = 'success' THEN
      RETURN jsonb_build_object(
        'topup_id', v_tx.id,
        'school_id', p_school_id,
        'credits_added', 0,
        'sms_balance', v_wallet.sms_balance,
        'already_processed', TRUE
      );
    END IF;

    UPDATE public.school_sms_transactions
    SET credits = p_credits,
        amount_ksh = p_amount_ksh,
        status = 'success',
        paystack_transaction_id = p_paystack_transaction_id,
        paid_by_email = p_paid_by_email,
        paid_by_name = p_paid_by_name,
        error_message = NULL,
        updated_at = NOW()
    WHERE id = v_tx.id;
  ELSE
    INSERT INTO public.school_sms_transactions (
      school_id, transaction_type, credits, amount_ksh, status,
      payment_reference, paystack_transaction_id, paid_by_email, paid_by_name,
      sms_segments, metadata
    ) VALUES (
      p_school_id, 'topup', p_credits, p_amount_ksh, 'success',
      v_reference, p_paystack_transaction_id, p_paid_by_email, p_paid_by_name,
      0, jsonb_build_object('price_per_sms', 1)
    )
    RETURNING * INTO v_tx;
  END IF;

  UPDATE public.school_sms_wallets
  SET sms_balance = sms_balance + p_credits,
      updated_at = NOW()
  WHERE school_id = p_school_id
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object(
    'topup_id', v_tx.id,
    'school_id', p_school_id,
    'credits_added', p_credits,
    'sms_balance', v_wallet.sms_balance,
    'already_processed', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_school_sms_credits(
  p_school_id UUID,
  p_sms_segments INTEGER,
  p_recipient_phone TEXT,
  p_message TEXT,
  p_sent_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.school_sms_wallets%ROWTYPE;
  v_tx public.school_sms_transactions%ROWTYPE;
BEGIN
  IF p_school_id IS NULL
     OR p_sms_segments IS NULL OR p_sms_segments <= 0
     OR NULLIF(TRIM(COALESCE(p_recipient_phone, '')), '') IS NULL
     OR NULLIF(TRIM(COALESCE(p_message, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid SMS reservation payload';
  END IF;

  INSERT INTO public.school_sms_wallets (school_id)
  VALUES (p_school_id)
  ON CONFLICT (school_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.school_sms_wallets
  WHERE school_id = p_school_id
  FOR UPDATE;

  IF v_wallet.sms_balance < p_sms_segments THEN
    RAISE EXCEPTION 'INSUFFICIENT_SMS_CREDITS';
  END IF;

  UPDATE public.school_sms_wallets
  SET sms_balance = sms_balance - p_sms_segments,
      updated_at = NOW()
  WHERE school_id = p_school_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.school_sms_transactions (
    school_id, transaction_type, credits, amount_ksh, status,
    recipient_phone, message, sms_segments, sent_by, metadata
  ) VALUES (
    p_school_id, 'debit', -p_sms_segments, p_sms_segments, 'reserved',
    p_recipient_phone, p_message, p_sms_segments, p_sent_by,
    jsonb_build_object('price_per_sms', 1)
  )
  RETURNING * INTO v_tx;

  RETURN jsonb_build_object(
    'reservation_id', v_tx.id,
    'sms_segments', p_sms_segments,
    'sms_balance', v_wallet.sms_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_school_sms_charge(
  p_reservation_id UUID,
  p_success BOOLEAN,
  p_provider_message_id TEXT,
  p_error_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.school_sms_transactions%ROWTYPE;
  v_wallet public.school_sms_wallets%ROWTYPE;
  v_refund public.school_sms_transactions%ROWTYPE;
  v_log_id UUID;
  v_segments INTEGER;
  v_log_status TEXT;
BEGIN
  SELECT * INTO v_tx
  FROM public.school_sms_transactions
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND OR v_tx.transaction_type <> 'debit' THEN
    RAISE EXCEPTION 'SMS reservation not found';
  END IF;

  IF v_tx.status <> 'reserved' THEN
    SELECT * INTO v_wallet FROM public.school_sms_wallets WHERE school_id = v_tx.school_id;
    RETURN jsonb_build_object(
      'reservation_id', v_tx.id,
      'status', v_tx.status,
      'sms_balance', COALESCE(v_wallet.sms_balance, 0),
      'already_settled', TRUE
    );
  END IF;

  v_segments := ABS(v_tx.credits);
  v_log_status := CASE WHEN p_success THEN 'sent' ELSE 'failed' END;

  IF p_success THEN
    UPDATE public.school_sms_transactions
    SET status = 'success',
        provider_message_id = NULLIF(TRIM(COALESCE(p_provider_message_id, '')), ''),
        error_message = NULL,
        updated_at = NOW()
    WHERE id = v_tx.id;
  ELSE
    UPDATE public.school_sms_transactions
    SET status = 'failed',
        error_message = NULLIF(TRIM(COALESCE(p_error_message, 'SMS delivery failed')), ''),
        updated_at = NOW()
    WHERE id = v_tx.id;

    INSERT INTO public.school_sms_transactions (
      school_id, transaction_type, credits, amount_ksh, status,
      related_transaction_id, sms_segments, error_message, metadata
    ) VALUES (
      v_tx.school_id, 'refund', v_segments, v_segments, 'refunded',
      v_tx.id, v_segments, p_error_message, jsonb_build_object('reason', 'provider_failure')
    )
    RETURNING * INTO v_refund;

    UPDATE public.school_sms_wallets
    SET sms_balance = sms_balance + v_segments,
        updated_at = NOW()
    WHERE school_id = v_tx.school_id;
  END IF;

  INSERT INTO public.sms_logs (
    school_id, recipient_phone, message, status, message_id, error_message,
    sent_by, sent_at, sms_segments, billing_transaction_id, billing_status
  ) VALUES (
    v_tx.school_id, v_tx.recipient_phone, v_tx.message, v_log_status,
    NULLIF(TRIM(COALESCE(p_provider_message_id, '')), ''),
    CASE WHEN p_success THEN NULL ELSE COALESCE(p_error_message, 'SMS delivery failed') END,
    v_tx.sent_by, NOW(), v_segments, v_tx.id,
    CASE WHEN p_success THEN 'charged' ELSE 'refunded' END
  )
  RETURNING id INTO v_log_id;

  SELECT * INTO v_wallet
  FROM public.school_sms_wallets
  WHERE school_id = v_tx.school_id;

  RETURN jsonb_build_object(
    'reservation_id', v_tx.id,
    'status', CASE WHEN p_success THEN 'success' ELSE 'failed' END,
    'sms_balance', COALESCE(v_wallet.sms_balance, 0),
    'sms_segments', v_segments,
    'sms_log_id', v_log_id,
    'refunded', NOT p_success
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_verified_school_sms_topup(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_school_sms_topup(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.reserve_school_sms_credits(UUID, INTEGER, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_school_sms_credits(UUID, INTEGER, TEXT, TEXT, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.settle_school_sms_charge(UUID, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_school_sms_charge(UUID, BOOLEAN, TEXT, TEXT)
  TO service_role;
