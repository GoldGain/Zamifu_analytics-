BEGIN;

CREATE TABLE IF NOT EXISTS public.impersonation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id uuid NOT NULL REFERENCES public.profiles(id),
  target_user_id uuid NOT NULL REFERENCES public.profiles(id),
  target_role public.user_role NOT NULL,
  target_school_id uuid REFERENCES public.schools(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text,
  notified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS impersonation_audit_master_started_idx
  ON public.impersonation_audit (master_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS impersonation_audit_target_started_idx
  ON public.impersonation_audit (target_user_id, started_at DESC);

ALTER TABLE public.impersonation_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS impersonation_audit_master_read ON public.impersonation_audit;
CREATE POLICY impersonation_audit_master_read ON public.impersonation_audit
  FOR SELECT USING (public.is_master_super_admin() OR master_user_id = auth.uid());
DROP POLICY IF EXISTS impersonation_audit_master_insert ON public.impersonation_audit;
CREATE POLICY impersonation_audit_master_insert ON public.impersonation_audit
  FOR INSERT WITH CHECK (public.is_master_super_admin() AND master_user_id = auth.uid());
DROP POLICY IF EXISTS impersonation_audit_master_update ON public.impersonation_audit;
CREATE POLICY impersonation_audit_master_update ON public.impersonation_audit
  FOR UPDATE USING (public.is_master_super_admin() AND master_user_id = auth.uid())
  WITH CHECK (public.is_master_super_admin() AND master_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.impersonation_audit TO authenticated;

COMMENT ON TABLE public.impersonation_audit IS
  'Immutable operational record of master-super-admin support impersonation sessions.';

COMMIT;
