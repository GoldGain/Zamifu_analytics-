CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level integer NOT NULL DEFAULT 1 CHECK (reorder_level >= 0),
  location text,
  condition text DEFAULT 'Good',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_items_select ON public.inventory_items;
CREATE POLICY inventory_items_select ON public.inventory_items FOR SELECT USING (public.can_access_school(school_id));
DROP POLICY IF EXISTS inventory_items_insert ON public.inventory_items;
CREATE POLICY inventory_items_insert ON public.inventory_items FOR INSERT WITH CHECK (
  public.can_access_school(school_id)
  AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role)
);
DROP POLICY IF EXISTS inventory_items_update ON public.inventory_items;
CREATE POLICY inventory_items_update ON public.inventory_items FOR UPDATE USING (public.can_access_school(school_id)) WITH CHECK (public.can_access_school(school_id));
DROP POLICY IF EXISTS inventory_items_delete ON public.inventory_items;
CREATE POLICY inventory_items_delete ON public.inventory_items FOR DELETE USING (
  public.can_access_school(school_id)
  AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role)
);

CREATE INDEX IF NOT EXISTS inventory_items_school_name_idx ON public.inventory_items (school_id, item_name);
