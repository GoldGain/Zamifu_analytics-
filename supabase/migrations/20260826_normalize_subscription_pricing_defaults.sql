-- Normalize every new-school and reseller default to KES 20 per learner per term and KES 50 per learner per year.
ALTER TABLE public.schools
  ALTER COLUMN fee_per_learner_per_term SET DEFAULT 20,
  ALTER COLUMN fee_per_learner_per_year SET DEFAULT 50;

ALTER TABLE public.resellers
  ALTER COLUMN default_fee_per_learner SET DEFAULT 20,
  ALTER COLUMN default_fee_per_learner_per_year SET DEFAULT 50;

ALTER TABLE public.school_subscription_payments
  ALTER COLUMN fee_per_learner SET DEFAULT 20;

UPDATE public.resellers
SET default_fee_per_learner = 20
WHERE default_fee_per_learner IS NULL OR default_fee_per_learner = 50;

UPDATE public.resellers
SET default_fee_per_learner_per_year = 50
WHERE default_fee_per_learner_per_year IS NULL OR default_fee_per_learner_per_year = 150;

UPDATE public.schools
SET fee_per_learner_per_term = 20,
    fee_per_learner_per_year = 50
WHERE (fee_per_learner_per_term IS NULL OR fee_per_learner_per_term = 50)
  AND (fee_per_learner_per_year IS NULL OR fee_per_learner_per_year IN (50, 150));
