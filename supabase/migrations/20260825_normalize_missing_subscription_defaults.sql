-- Keep explicit per-school pricing overrides, but never leave a missing fee
-- without the requested subscription default.
UPDATE public.schools
SET fee_per_learner_per_term = 20,
    updated_at = NOW()
WHERE fee_per_learner_per_term IS NULL OR fee_per_learner_per_term <= 0;

UPDATE public.schools
SET fee_per_learner_per_year = 50,
    updated_at = NOW()
WHERE fee_per_learner_per_year IS NULL OR fee_per_learner_per_year <= 0;

UPDATE public.resellers
SET default_fee_per_learner = 20,
    updated_at = NOW()
WHERE default_fee_per_learner IS NULL OR default_fee_per_learner <= 0;

UPDATE public.resellers
SET default_fee_per_learner_per_year = 50,
    updated_at = NOW()
WHERE default_fee_per_learner_per_year IS NULL OR default_fee_per_learner_per_year <= 0;
