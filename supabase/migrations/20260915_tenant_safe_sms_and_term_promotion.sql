-- Tenant-safe reseller messaging and atomic term promotion.
-- The reseller communication list includes self-registered schools only when
-- those schools are assigned to the signed-in reseller.
CREATE OR REPLACE FUNCTION public.get_reseller_communication_schools()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name::text
  FROM public.schools s
  WHERE public.current_profile_role() = 'reseller_super_admin'::public.user_role
    AND s.reseller_id IN (
      SELECT r.id
      FROM public.resellers r
      WHERE r.user_id = auth.uid()
    )
  ORDER BY s.name;
$$;

CREATE OR REPLACE FUNCTION public.get_reseller_school_admin_contacts()
RETURNS TABLE(id uuid, school_id uuid, first_name text, last_name text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_schools AS (
    SELECT s.id
    FROM public.schools s
    WHERE public.current_profile_role() = 'reseller_super_admin'::public.user_role
      AND s.reseller_id IN (
        SELECT r.id
        FROM public.resellers r
        WHERE r.user_id = auth.uid()
      )
  ),
  stored_admins AS (
    SELECT sa.id, sa.school_id, sa.first_name, sa.last_name, sa.phone
    FROM public.school_admins sa
    JOIN visible_schools vs ON vs.id = sa.school_id
    WHERE COALESCE(sa.is_active, TRUE)
  ),
  profile_admins AS (
    SELECT p.id, p.school_id, p.first_name, p.last_name, p.phone
    FROM public.profiles p
    JOIN visible_schools vs ON vs.id = p.school_id
    WHERE p.role = 'school_admin'::public.user_role
      AND COALESCE(p.is_active, TRUE)
      AND NOT EXISTS (
        SELECT 1
        FROM stored_admins sa
        WHERE sa.school_id = p.school_id
      )
  )
  SELECT * FROM stored_admins
  UNION ALL
  SELECT * FROM profile_admins;
$$;

-- Prevent an intermediate state with zero or multiple current terms per school.
-- Existing data was checked before this migration; the index is partial so
-- historical non-current term rows remain untouched.
CREATE UNIQUE INDEX IF NOT EXISTS terms_one_current_per_school
  ON public.terms (school_id)
  WHERE is_current = true;

CREATE OR REPLACE FUNCTION public.promote_school_to_next_term(p_school_id uuid)
RETURNS TABLE(next_term_id uuid, next_term_name text, next_academic_year varchar)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
  current_term public.terms%ROWTYPE;
  next_name public.term_type;
  next_year varchar;
  existing_term public.terms%ROWTYPE;
  next_start date;
  next_end date;
BEGIN
  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND COALESCE(p.is_active, true);

  IF caller_role NOT IN ('school_admin'::public.user_role, 'super_admin'::public.user_role, 'master_super_admin'::public.user_role) THEN
    RAISE EXCEPTION 'Only an authorised school administrator can promote a term';
  END IF;

  IF caller_role = 'school_admin'::public.user_role
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.school_id = p_school_id
     ) THEN
    RAISE EXCEPTION 'You can only promote your own school term';
  END IF;

  SELECT * INTO current_term
  FROM public.terms
  WHERE school_id = p_school_id AND is_current = true
  ORDER BY created_at DESC NULLS LAST, start_date DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No current term exists for this school';
  END IF;

  IF current_term.name::text ILIKE '%term 1%' THEN
    next_name := 'Term 2'::public.term_type;
    next_year := current_term.academic_year;
  ELSIF current_term.name::text ILIKE '%term 2%' THEN
    next_name := 'Term 3'::public.term_type;
    next_year := current_term.academic_year;
  ELSE
    next_name := 'Term 1'::public.term_type;
    next_year := (current_term.academic_year::integer + 1)::varchar;
  END IF;

  SELECT * INTO existing_term
  FROM public.terms
  WHERE school_id = p_school_id
    AND name = next_name
    AND academic_year = next_year
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.terms
    SET is_current = false
    WHERE school_id = p_school_id AND is_current = true;

    UPDATE public.terms
    SET is_current = true
    WHERE id = existing_term.id;

    RETURN QUERY SELECT existing_term.id, next_name::text, next_year;
    RETURN;
  END IF;

  next_start := COALESCE(current_term.end_date + 1, CURRENT_DATE);
  next_end := next_start + 90;

  UPDATE public.terms
  SET is_current = false
  WHERE school_id = p_school_id AND is_current = true;

  INSERT INTO public.terms (school_id, name, academic_year, start_date, end_date, is_current)
  VALUES (p_school_id, next_name, next_year, next_start, next_end, true)
  RETURNING id INTO existing_term.id;

  RETURN QUERY SELECT existing_term.id, next_name::text, next_year;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_school_to_next_term(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_school_to_next_term(uuid) TO authenticated;

COMMENT ON FUNCTION public.promote_school_to_next_term(uuid) IS
  'Atomically advances one authorised school to the next term without changing student classes.';

NOTIFY pgrst, 'reload schema';

-- DOWN/rollback guidance: drop only the function and partial index after a
-- replacement migration has been prepared; do not delete term data.
