-- Secure phone password-reset OTP storage.
-- OTP values are stored only as SHA-256 hashes and are never returned to the browser.
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_otps_phone_created_idx
  ON public.password_reset_otps (phone, created_at DESC);

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- This table is accessed only by the send-sms Edge Function with the service role.
DROP POLICY IF EXISTS password_reset_otps_no_client_access ON public.password_reset_otps;
CREATE POLICY password_reset_otps_no_client_access
  ON public.password_reset_otps
  FOR ALL
  USING (false)
  WITH CHECK (false);
