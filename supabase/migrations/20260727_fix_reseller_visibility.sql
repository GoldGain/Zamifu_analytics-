-- Fix Reseller visibility for self-registered schools (reseller_id IS NULL)
-- This migration ensures that resellers can see and manage schools that are not explicitly assigned to a reseller

-- 1. Update the can_access_school function
CREATE OR REPLACE FUNCTION public.can_access_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_master_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.schools s
      WHERE s.id = p_school_id
        AND (
          s.owner_id = auth.uid() 
          OR s.reseller_id IS NULL 
          OR s.reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
        )
        AND public.current_profile_role() IN ('super_admin'::public.user_role, 'reseller_super_admin'::public.user_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.school_id = p_school_id
        AND p.role IN ('school_admin'::public.user_role, 'teacher'::public.user_role, 'student'::public.user_role, 'parent'::public.user_role)
    )
$$;

-- 2. Update schools RLS policies
DROP POLICY IF EXISTS schools_tenant_select ON public.schools;
CREATE POLICY schools_tenant_select ON public.schools
FOR SELECT USING (
  public.is_master_super_admin()
  OR (
    public.current_profile_role() IN ('super_admin'::public.user_role, 'reseller_super_admin'::public.user_role)
    AND (
      owner_id = auth.uid() 
      OR reseller_id IS NULL 
      OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    )
  )
  OR id = public.current_profile_school_id()
);

-- 3. Update schools RLS update policy to allow resellers to manage these schools
DROP POLICY IF EXISTS schools_tenant_update ON public.schools;
CREATE POLICY schools_tenant_update ON public.schools
FOR UPDATE USING (
  public.is_master_super_admin() 
  OR (
    public.current_profile_role() IN ('super_admin'::public.user_role, 'reseller_super_admin'::public.user_role)
    AND (
      owner_id = auth.uid() 
      OR reseller_id IS NULL 
      OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    )
  )
) WITH CHECK (
  public.is_master_super_admin() 
  OR (
    public.current_profile_role() IN ('super_admin'::public.user_role, 'reseller_super_admin'::public.user_role)
    AND (
      owner_id = auth.uid() 
      OR reseller_id IS NULL 
      OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    )
  )
);

-- 4. Update parent_payments RLS
DROP POLICY IF EXISTS reseller_own_payments ON public.parent_payments;
CREATE POLICY reseller_own_payments ON public.parent_payments
FOR SELECT USING (
  reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
  OR (
    reseller_id IS NULL 
    AND public.current_profile_role() = 'reseller_super_admin'::public.user_role
  )
);

-- 5. Update school_subscription_payments RLS
DROP POLICY IF EXISTS reseller_own_sub_payments ON public.school_subscription_payments;
CREATE POLICY reseller_own_sub_payments ON public.school_subscription_payments
FOR SELECT USING (
  reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
  OR (
    reseller_id IS NULL 
    AND public.current_profile_role() = 'reseller_super_admin'::public.user_role
  )
);
