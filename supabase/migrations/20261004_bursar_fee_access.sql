-- Bursar fee access. The enum value is added separately by 20261004_add_bursar_role.sql.
-- Run this migration only after the enum migration has committed.

DROP POLICY IF EXISTS fee_invoices_school_insert ON public.fee_invoices;
CREATE POLICY fee_invoices_school_insert ON public.fee_invoices
FOR INSERT WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
);

DROP POLICY IF EXISTS fee_invoices_school_update ON public.fee_invoices;
CREATE POLICY fee_invoices_school_update ON public.fee_invoices
FOR UPDATE USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
) WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
);

DROP POLICY IF EXISTS fee_invoices_school_delete ON public.fee_invoices;
CREATE POLICY fee_invoices_school_delete ON public.fee_invoices
FOR DELETE USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
);

DROP POLICY IF EXISTS fee_payments_school_insert ON public.fee_payments;
CREATE POLICY fee_payments_school_insert ON public.fee_payments
FOR INSERT WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
);

DROP POLICY IF EXISTS fee_payments_school_update ON public.fee_payments;
CREATE POLICY fee_payments_school_update ON public.fee_payments
FOR UPDATE USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
) WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
);

DROP POLICY IF EXISTS fee_payments_school_delete ON public.fee_payments;
CREATE POLICY fee_payments_school_delete ON public.fee_payments
FOR DELETE USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role, 'bursar'::public.user_role)
  AND school_id = public.auth_school_id()
);
