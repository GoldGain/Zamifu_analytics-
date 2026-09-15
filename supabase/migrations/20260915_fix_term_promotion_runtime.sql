-- Fix term promotion runtime errors by using scalar IDs and explicit values.
-- The operation remains tenant-scoped and atomic.
CREATE OR REPLACE FUNCTION public.promote_school_to_next_term(p_school_id uuid)
RETURNS TABLE(next_term_id uuid, next_term_name text, next_academic_year varchar)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
  current_term_id uuid;
  current_term_name text;
  current_academic_year varchar;
  current_end_date date;
  existing_term_id uuid;
  next_name public.term_type;
  next_year varchar;
  next_start date;
  next_end date;
BEGIN
  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND COALESCE(p.is_active, true);

  IF caller_role NOT IN (
    'school_admin'::public.user_role,
    'super_admin'::public.user_role,
    'master_super_admin'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Only an authorised school administrator can promote a term';
  END IF;

  IF caller_role = 'school_admin'::public.user_role
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.school_id = p_school_id
         AND COALESCE(p.is_active, true)
     ) THEN
    RAISE EXCEPTION 'You can only promote your own school term';
  END IF;

  SELECT t.id, t.name::text, t.academic_year, t.end_date
  INTO current_term_id, current_term_name, current_academic_year, current_end_date
  FROM public.terms t
  WHERE t.school_id = p_school_id AND t.is_current = true
  ORDER BY t.created_at DESC NULLS LAST, t.start_date DESC
  LIMIT 1
  FOR UPDATE;

  IF current_term_id IS NULL THEN
    RAISE EXCEPTION 'No current term exists for this school';
  END IF;

  IF current_term_name ILIKE '%term 1%' THEN
    next_name := 'Term 2'::public.term_type;
    next_year := current_academic_year;
  ELSIF current_term_name ILIKE '%term 2%' THEN
    next_name := 'Term 3'::public.term_type;
    next_year := current_academic_year;
  ELSE
    next_name := 'Term 1'::public.term_type;
    next_year := (current_academic_year::integer + 1)::varchar;
  END IF;

  SELECT t.id INTO existing_term_id
  FROM public.terms t
  WHERE t.school_id = p_school_id
    AND t.name = next_name
    AND t.academic_year = next_year
  ORDER BY t.created_at ASC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  UPDATE public.terms
  SET is_current = false
  WHERE school_id = p_school_id AND is_current = true;

  IF existing_term_id IS NULL THEN
    next_start := COALESCE(current_end_date + 1, CURRENT_DATE);
    next_end := next_start + 90;
    INSERT INTO public.terms (
      school_id, name, academic_year, start_date, end_date, is_current
    )
    VALUES (
      p_school_id, next_name, next_year, next_start, next_end, true
    )
    RETURNING id INTO existing_term_id;
  ELSE
    UPDATE public.terms
    SET is_current = true
    WHERE id = existing_term_id;
  END IF;

  RETURN QUERY
  SELECT existing_term_id, next_name::text, next_year;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_school_to_next_term(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_school_to_next_term(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.diagnose_term_promotion_dry_run(uuid);
NOTIFY pgrst, 'reload schema';
