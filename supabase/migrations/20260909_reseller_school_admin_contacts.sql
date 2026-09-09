-- Reseller communication needs read access to school-admin contact rows for schools
-- explicitly owned by the signed-in reseller. Keep the authorization in the
-- database so a client cannot widen the recipient school scope.

ALTER TABLE public.school_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_admins_tenant_select ON public.school_admins;
CREATE POLICY school_admins_tenant_select ON public.school_admins
FOR SELECT USING (
  public.is_master_super_admin()
  OR (
    public.current_profile_role() <> 'reseller_super_admin'::public.user_role
    AND public.can_access_school(school_id)
  )
  OR (
    public.current_profile_role() = 'reseller_super_admin'::public.user_role
    AND EXISTS (
      SELECT 1
      FROM public.resellers r
      JOIN public.schools s ON s.reseller_id = r.id
      WHERE r.user_id = auth.uid()
        AND s.id = school_admins.school_id
    )
  )
);

COMMENT ON POLICY school_admins_tenant_select ON public.school_admins IS
  'Allows school users and the owning reseller to read school-admin contact rows, including phone numbers.';
