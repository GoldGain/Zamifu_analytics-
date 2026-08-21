-- Reseller-configurable annual school subscription pricing.
-- Existing schools retain their term fee and receive an annual fee from their
-- reseller default when available, otherwise the product default of KES 60.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS fee_per_learner_per_year INTEGER NULL;

ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS default_fee_per_learner_per_year INTEGER NULL;

UPDATE public.resellers
SET default_fee_per_learner_per_year = 60
WHERE default_fee_per_learner_per_year IS NULL
   OR default_fee_per_learner_per_year <= 0;

UPDATE public.schools AS s
SET fee_per_learner_per_year = COALESCE(
  s.fee_per_learner_per_year,
  r.default_fee_per_learner_per_year,
  60
)
FROM public.resellers AS r
WHERE s.reseller_id = r.id
  AND (s.fee_per_learner_per_year IS NULL OR s.fee_per_learner_per_year <= 0);

UPDATE public.schools
SET fee_per_learner_per_year = 60
WHERE fee_per_learner_per_year IS NULL
   OR fee_per_learner_per_year <= 0;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_fee_per_learner_per_year_positive;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_fee_per_learner_per_year_positive
  CHECK (fee_per_learner_per_year IS NULL OR fee_per_learner_per_year > 0);

ALTER TABLE public.resellers
  DROP CONSTRAINT IF EXISTS resellers_default_fee_per_learner_per_year_positive;

ALTER TABLE public.resellers
  ADD CONSTRAINT resellers_default_fee_per_learner_per_year_positive
  CHECK (default_fee_per_learner_per_year IS NULL OR default_fee_per_learner_per_year > 0);

-- Reseller defaults are editable only by the owning reseller or a master admin.
DROP POLICY IF EXISTS reseller_own_record_update ON public.resellers;
CREATE POLICY reseller_own_record_update ON public.resellers
FOR UPDATE
USING (user_id = auth.uid() OR public.is_master_super_admin())
WITH CHECK (user_id = auth.uid() OR public.is_master_super_admin());
