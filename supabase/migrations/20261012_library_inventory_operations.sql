-- Extend the existing library tables used by the first release.
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS publisher text;
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS year_published integer;
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.library_borrowings ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.library_borrowings ADD COLUMN IF NOT EXISTS borrower_name text;
ALTER TABLE public.library_borrowings ADD COLUMN IF NOT EXISTS borrower_class text;
ALTER TABLE public.library_borrowings ADD COLUMN IF NOT EXISTS condition_out text DEFAULT 'Good';
ALTER TABLE public.library_borrowings ADD COLUMN IF NOT EXISTS condition_in text;
ALTER TABLE public.library_borrowings ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.library_borrowings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE public.library_borrowings b SET school_id = lb.school_id FROM public.library_books lb WHERE b.book_id = lb.id AND b.school_id IS NULL;
ALTER TABLE public.library_borrowings ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_borrowings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_books_select ON public.library_books;
CREATE POLICY library_books_select ON public.library_books FOR SELECT USING (public.can_access_school(school_id));
DROP POLICY IF EXISTS library_books_insert ON public.library_books;
CREATE POLICY library_books_insert ON public.library_books FOR INSERT WITH CHECK (public.can_access_school(school_id) AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role));
DROP POLICY IF EXISTS library_books_update ON public.library_books;
CREATE POLICY library_books_update ON public.library_books FOR UPDATE USING (public.can_access_school(school_id)) WITH CHECK (public.can_access_school(school_id));
DROP POLICY IF EXISTS library_books_delete ON public.library_books;
CREATE POLICY library_books_delete ON public.library_books FOR DELETE USING (public.can_access_school(school_id) AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role));
DROP POLICY IF EXISTS library_borrowings_select ON public.library_borrowings;
CREATE POLICY library_borrowings_select ON public.library_borrowings FOR SELECT USING (public.can_access_school(school_id));
DROP POLICY IF EXISTS library_borrowings_insert ON public.library_borrowings;
CREATE POLICY library_borrowings_insert ON public.library_borrowings FOR INSERT WITH CHECK (public.can_access_school(school_id) AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role));
DROP POLICY IF EXISTS library_borrowings_update ON public.library_borrowings;
CREATE POLICY library_borrowings_update ON public.library_borrowings FOR UPDATE USING (public.can_access_school(school_id)) WITH CHECK (public.can_access_school(school_id));
DROP POLICY IF EXISTS library_borrowings_delete ON public.library_borrowings;
CREATE POLICY library_borrowings_delete ON public.library_borrowings FOR DELETE USING (public.can_access_school(school_id) AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role));
CREATE INDEX IF NOT EXISTS library_books_school_title_idx ON public.library_books (school_id, title);
CREATE INDEX IF NOT EXISTS library_borrowings_school_due_idx ON public.library_borrowings (school_id, due_date) WHERE returned_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('received','used','adjustment','damaged','lost')),
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_transactions_select ON public.inventory_transactions;
CREATE POLICY inventory_transactions_select ON public.inventory_transactions FOR SELECT USING (public.can_access_school(school_id));
DROP POLICY IF EXISTS inventory_transactions_insert ON public.inventory_transactions;
CREATE POLICY inventory_transactions_insert ON public.inventory_transactions FOR INSERT WITH CHECK (public.can_access_school(school_id) AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role));
DROP POLICY IF EXISTS inventory_transactions_delete ON public.inventory_transactions;
CREATE POLICY inventory_transactions_delete ON public.inventory_transactions FOR DELETE USING (public.can_access_school(school_id) AND public.current_profile_role() IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role));
CREATE INDEX IF NOT EXISTS inventory_transactions_school_date_idx ON public.inventory_transactions (school_id, transaction_date DESC);
CREATE OR REPLACE FUNCTION public.touch_inventory_items_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS inventory_items_touch_updated_at ON public.inventory_items;
CREATE TRIGGER inventory_items_touch_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.touch_inventory_items_updated_at();
