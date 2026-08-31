-- Fix school-admin fee recording by consolidating overlapping policies.
-- School admins may only manage fee rows belonging to their own school.

DROP POLICY IF EXISTS fee_invoices_all ON public.fee_invoices;
DROP POLICY IF EXISTS fee_invoices_select ON public.fee_invoices;
DROP POLICY IF EXISTS fee_invoices_tenant_select ON public.fee_invoices;
DROP POLICY IF EXISTS fee_invoices_tenant_insert ON public.fee_invoices;
DROP POLICY IF EXISTS fee_invoices_tenant_update ON public.fee_invoices;
DROP POLICY IF EXISTS fee_invoices_tenant_delete ON public.fee_invoices;

CREATE POLICY fee_invoices_school_read ON public.fee_invoices
FOR SELECT
USING (
  public.auth_user_role() = 'super_admin'::public.user_role
  OR school_id = public.auth_school_id()
);

CREATE POLICY fee_invoices_school_insert ON public.fee_invoices
FOR INSERT
WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
);

CREATE POLICY fee_invoices_school_update ON public.fee_invoices
FOR UPDATE
USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
)
WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
);

CREATE POLICY fee_invoices_school_delete ON public.fee_invoices
FOR DELETE
USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
);

DROP POLICY IF EXISTS fee_payments_insert ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_select ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_tenant_select ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_tenant_insert ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_tenant_update ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_tenant_delete ON public.fee_payments;

CREATE POLICY fee_payments_school_read ON public.fee_payments
FOR SELECT
USING (
  public.auth_user_role() = 'super_admin'::public.user_role
  OR school_id = public.auth_school_id()
);

CREATE POLICY fee_payments_school_insert ON public.fee_payments
FOR INSERT
WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
);

CREATE POLICY fee_payments_school_update ON public.fee_payments
FOR UPDATE
USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
)
WITH CHECK (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
);

CREATE POLICY fee_payments_school_delete ON public.fee_payments
FOR DELETE
USING (
  public.auth_user_role() IN ('super_admin'::public.user_role, 'school_admin'::public.user_role)
  AND school_id = public.auth_school_id()
);
