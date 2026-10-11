BEGIN;

DROP POLICY IF EXISTS reseller_sms_transactions_select ON public.school_sms_transactions;
CREATE POLICY reseller_sms_transactions_select
  ON public.school_sms_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.resellers r ON r.user_id = p.id
      JOIN public.schools s ON s.reseller_id = r.id
      WHERE p.id = auth.uid()
        AND p.role::text = 'reseller_super_admin'
        AND s.id = school_sms_transactions.school_id
    )
  );

GRANT SELECT ON public.school_sms_transactions TO authenticated;

COMMIT;
