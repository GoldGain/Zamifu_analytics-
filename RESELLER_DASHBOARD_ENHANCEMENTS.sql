-- ============================================================
-- Reseller dashboard enhancements: school currency and lookup index
-- Safe to re-run
-- ============================================================

-- Per-school pricing already exists as fee_per_learner_per_term.
-- Store an explicit display currency for each school and normalize legacy rows.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'KES';

UPDATE public.schools
SET currency = COALESCE(NULLIF(UPPER(BTRIM(currency)), ''), 'KES')
WHERE currency IS NULL OR BTRIM(currency) = '';

ALTER TABLE public.schools
  ALTER COLUMN currency SET DEFAULT 'KES';

ALTER TABLE public.schools
  ALTER COLUMN currency SET NOT NULL;

-- Dashboard queries consistently filter schools by reseller.
CREATE INDEX IF NOT EXISTS idx_schools_reseller_id
  ON public.schools(reseller_id);
