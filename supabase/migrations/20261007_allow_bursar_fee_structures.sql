-- Allow bursars to manage fee structures for their own school.
-- Access remains restricted by the authenticated user's school_id.
DROP POLICY IF EXISTS fee_structures_all ON public.fee_structures;
DROP POLICY IF EXISTS fee_structures_select ON public.fee_structures;
DROP POLICY IF EXISTS fee_structures_tenant_select ON public.fee_structures;
DROP POLICY IF EXISTS fee_structures_tenant_insert ON public.fee_structures;
DROP POLICY IF EXISTS fee_structures_tenant_update ON public.fee_structures;
DROP POLICY IF EXISTS fee_structures_tenant_delete ON public.fee_structures;

CREATE POLICY fee_structures_school_read
ON public.fee_structures
FOR SELECT TO authenticated
USING (
  public.auth_user_role() = 'super_admin'::public.user_role
  OR school_id = public.auth_school_id()
);

CREATE POLICY fee_structures_school_insert
ON public.fee_structures
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_user_role() IN (
    'super_admin'::public.user_role,
    'school_admin'::public.user_role,
    'bursar'::public.user_role
  )
  AND school_id = public.auth_school_id()
);

CREATE POLICY fee_structures_school_update
ON public.fee_structures
FOR UPDATE TO authenticated
USING (
  public.auth_user_role() IN (
    'super_admin'::public.user_role,
    'school_admin'::public.user_role,
    'bursar'::public.user_role
  )
  AND school_id = public.auth_school_id()
)
WITH CHECK (
  public.auth_user_role() IN (
    'super_admin'::public.user_role,
    'school_admin'::public.user_role,
    'bursar'::public.user_role
  )
  AND school_id = public.auth_school_id()
);

CREATE POLICY fee_structures_school_delete
ON public.fee_structures
FOR DELETE TO authenticated
USING (
  public.auth_user_role() IN (
    'super_admin'::public.user_role,
    'school_admin'::public.user_role,
    'bursar'::public.user_role
  )
  AND school_id = public.auth_school_id()
);
