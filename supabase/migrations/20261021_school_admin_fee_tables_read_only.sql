-- School administrators may review fee records, but financial record writes remain with bursars and super-admins.
-- These restrictive policies layer on top of the existing school-scoped permissive policies.

CREATE POLICY fee_invoices_school_admin_no_insert
ON public.fee_invoices AS RESTRICTIVE
FOR INSERT TO public
WITH CHECK (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_invoices_school_admin_no_update
ON public.fee_invoices AS RESTRICTIVE
FOR UPDATE TO public
USING (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role)
WITH CHECK (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_invoices_school_admin_no_delete
ON public.fee_invoices AS RESTRICTIVE
FOR DELETE TO public
USING (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_payments_school_admin_no_insert
ON public.fee_payments AS RESTRICTIVE
FOR INSERT TO public
WITH CHECK (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_payments_school_admin_no_update
ON public.fee_payments AS RESTRICTIVE
FOR UPDATE TO public
USING (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role)
WITH CHECK (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_payments_school_admin_no_delete
ON public.fee_payments AS RESTRICTIVE
FOR DELETE TO public
USING (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_structures_school_admin_no_insert
ON public.fee_structures AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_structures_school_admin_no_update
ON public.fee_structures AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role)
WITH CHECK (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);

CREATE POLICY fee_structures_school_admin_no_delete
ON public.fee_structures AS RESTRICTIVE
FOR DELETE TO authenticated
USING (auth_user_role() IS DISTINCT FROM 'school_admin'::user_role);
