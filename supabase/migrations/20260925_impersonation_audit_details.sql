BEGIN;
ALTER TABLE public.impersonation_audit ADD COLUMN IF NOT EXISTS impersonator_email text;
ALTER TABLE public.impersonation_audit ADD COLUMN IF NOT EXISTS target_email text;
COMMENT ON COLUMN public.impersonation_audit.impersonator_email IS 'Always the authorized master support email.';
COMMENT ON COLUMN public.impersonation_audit.target_email IS 'Email of the account viewed during the session.';
COMMIT;
