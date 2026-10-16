-- Issue 6: allow normalized certificate standard values through Grade/Form 12.
-- The original migration remains unchanged; this replaces only its named CHECK constraint.
ALTER TABLE public.leaving_certificates
  DROP CONSTRAINT IF EXISTS leaving_certificates_standard_left_check;

ALTER TABLE public.leaving_certificates
  ADD CONSTRAINT leaving_certificates_standard_left_check
  CHECK (standard_left BETWEEN 1 AND 12);
