-- ============================================================
-- Reseller Portal: locks, pricing, subscription payments
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- Per-school platform pricing (KES per learner per term)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS fee_per_learner_per_term INTEGER DEFAULT 50;

-- Portal locks (School Admin + Dean of Studies only)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS admin_portal_locked BOOLEAN DEFAULT FALSE;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS dos_portal_locked BOOLEAN DEFAULT FALSE;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS lock_reason TEXT;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS locked_by_role TEXT;

-- Default fee on resellers (optional default when creating schools)
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS default_fee_per_learner INTEGER DEFAULT 50;

-- Subscription payments (school platform fees paid to reseller / platform)
CREATE TABLE IF NOT EXISTS public.school_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  school_name TEXT,
  reseller_name TEXT,
  learners_count INTEGER DEFAULT 0,
  fee_per_learner INTEGER DEFAULT 50,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'KES',
  term_label TEXT,
  payment_reference TEXT,
  payment_method TEXT DEFAULT 'paystack',
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'pending', 'failed', 'refunded')),
  paid_by_email TEXT,
  paid_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_sub_payments_reseller
  ON public.school_subscription_payments(reseller_id);
CREATE INDEX IF NOT EXISTS idx_school_sub_payments_school
  ON public.school_subscription_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_school_sub_payments_created
  ON public.school_subscription_payments(created_at DESC);

ALTER TABLE public.school_subscription_payments ENABLE ROW LEVEL SECURITY;

-- Master admin: all
DROP POLICY IF EXISTS "master_all_sub_payments" ON public.school_subscription_payments;
CREATE POLICY "master_all_sub_payments" ON public.school_subscription_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'master_super_admin'
    )
  );

-- Reseller: own payments
DROP POLICY IF EXISTS "reseller_own_sub_payments" ON public.school_subscription_payments;
CREATE POLICY "reseller_own_sub_payments" ON public.school_subscription_payments
  FOR ALL USING (
    reseller_id IN (
      SELECT id FROM public.resellers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    reseller_id IN (
      SELECT id FROM public.resellers WHERE user_id = auth.uid()
    )
  );

-- School admin: see own school payments
DROP POLICY IF EXISTS "school_admin_own_sub_payments" ON public.school_subscription_payments;
CREATE POLICY "school_admin_own_sub_payments" ON public.school_subscription_payments
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Allow school users to insert their own subscription payment records after Paystack success
DROP POLICY IF EXISTS "school_insert_sub_payments" ON public.school_subscription_payments;
CREATE POLICY "school_insert_sub_payments" ON public.school_subscription_payments
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Backfill defaults
UPDATE public.schools
SET fee_per_learner_per_term = COALESCE(fee_per_learner_per_term, 50)
WHERE fee_per_learner_per_term IS NULL;

UPDATE public.schools
SET admin_portal_locked = COALESCE(admin_portal_locked, FALSE),
    dos_portal_locked = COALESCE(dos_portal_locked, FALSE)
WHERE admin_portal_locked IS NULL OR dos_portal_locked IS NULL;
