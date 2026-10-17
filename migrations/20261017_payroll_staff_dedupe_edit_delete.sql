-- Zamifu Analytics - 2026-10-17
-- Issue 2: payroll staff duplicates, edit and delete. Additive only.
BEGIN;
CREATE OR REPLACE FUNCTION public.payroll_save_staff(p_staff_id uuid, p_expected_version integer, p_staff jsonb, p_components jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE s uuid; old_staff public.payroll_staff; new_staff public.payroll_staff; old_components jsonb; c jsonb; b numeric; sensitive_changed jsonb;
BEGIN
  s := public.payroll_require_school_admin();
  PERFORM pg_advisory_xact_lock(hashtextextended('payroll:' || s::text,0));
  IF p_staff IS NULL OR jsonb_typeof(p_staff) <> 'object' THEN RAISE EXCEPTION 'Staff details required'; END IF;
  b := (p_staff->>'basic_salary')::numeric;
  PERFORM public.payroll_calculate_snapshot(b,p_components);
  IF p_staff_id IS NULL THEN
    SELECT * INTO new_staff FROM public.payroll_staff
     WHERE school_id = s AND is_active
       AND lower(btrim(full_name)) = lower(btrim(p_staff->>'full_name'))
       AND NULLIF(btrim(staff_number),'') IS NOT DISTINCT FROM NULLIF(btrim(p_staff->>'staff_number'),'')
       AND created_at > now() - interval '10 minutes'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN RETURN new_staff.id; END IF;
  END IF;
  IF p_staff_id IS NOT NULL THEN
    SELECT * INTO old_staff FROM public.payroll_staff WHERE id = p_staff_id AND school_id = s FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Staff not found in your school'; END IF;
    IF p_expected_version IS DISTINCT FROM old_staff.version THEN RAISE EXCEPTION 'Staff was changed by another administrator. Reload before saving.'; END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(x) - ARRAY['id','school_id','staff_id'] ORDER BY x.name,x.id),'[]'::jsonb) INTO old_components FROM public.payroll_staff_components x WHERE x.staff_id = p_staff_id AND x.school_id = s;
    UPDATE public.payroll_staff SET full_name = btrim(p_staff->>'full_name'), staff_number = NULLIF(btrim(p_staff->>'staff_number'),''),
      position = btrim(p_staff->>'position'), department = NULLIF(btrim(p_staff->>'department'),''),
      national_id = NULLIF(btrim(p_staff->>'national_id'),''), kra_pin = NULLIF(btrim(p_staff->>'kra_pin'),''),
      phone = NULLIF(btrim(p_staff->>'phone'),''), email = NULLIF(btrim(p_staff->>'email'),''),
      bank_name = NULLIF(btrim(p_staff->>'bank_name'),''), bank_account = NULLIF(btrim(p_staff->>'bank_account'),''),
      date_employed = NULLIF(p_staff->>'date_employed','')::date, employment_type = coalesce(p_staff->>'employment_type','permanent'),
      basic_salary = b, is_active = coalesce((p_staff->>'is_active')::boolean,true), version = version + 1, updated_at = now()
      WHERE id = p_staff_id AND school_id = s RETURNING * INTO new_staff;
    DELETE FROM public.payroll_staff_components WHERE staff_id = p_staff_id AND school_id = s;
  ELSE
    INSERT INTO public.payroll_staff(school_id,full_name,staff_number,position,department,date_employed,employment_type,basic_salary,is_active,created_by,national_id,kra_pin,phone,email,bank_name,bank_account)
    VALUES (s,btrim(p_staff->>'full_name'),NULLIF(btrim(p_staff->>'staff_number'),''),btrim(p_staff->>'position'),NULLIF(btrim(p_staff->>'department'),''),
      NULLIF(p_staff->>'date_employed','')::date,coalesce(p_staff->>'employment_type','permanent'),b,coalesce((p_staff->>'is_active')::boolean,true),auth.uid(),
      NULLIF(btrim(p_staff->>'national_id'),''),NULLIF(btrim(p_staff->>'kra_pin'),''),NULLIF(btrim(p_staff->>'phone'),''),NULLIF(btrim(p_staff->>'email'),''),NULLIF(btrim(p_staff->>'bank_name'),''),NULLIF(btrim(p_staff->>'bank_account'),'')) RETURNING * INTO new_staff;
  END IF;
  FOR c IN SELECT x FROM jsonb_array_elements(p_components) AS j(x) LOOP
    INSERT INTO public.payroll_staff_components(school_id,staff_id,kind,name,amount,is_percentage,percentage_of,is_statutory)
    VALUES (s,new_staff.id,c->>'kind',btrim(c->>'name'),(c->>'amount')::numeric,coalesce((c->>'is_percentage')::boolean,false),c->>'percentage_of',coalesce((c->>'is_statutory')::boolean,false));
  END LOOP;
  SELECT coalesce(jsonb_agg(k),'[]'::jsonb) INTO sensitive_changed FROM unnest(ARRAY['national_id','kra_pin','phone','email','bank_name','bank_account']) k
    WHERE (to_jsonb(old_staff)->k) IS DISTINCT FROM (to_jsonb(new_staff)->k);
  INSERT INTO public.payroll_audit(school_id,staff_id,actor_id,event,detail) VALUES(s,new_staff.id,auth.uid(),CASE WHEN p_staff_id IS NULL THEN 'staff_created' ELSE 'staff_updated' END,
    jsonb_build_object('before',CASE WHEN p_staff_id IS NULL THEN NULL ELSE to_jsonb(old_staff) - ARRAY['national_id','kra_pin','phone','email','bank_name','bank_account'] END,
      'after',to_jsonb(new_staff) - ARRAY['national_id','kra_pin','phone','email','bank_name','bank_account'],'sensitive_fields_changed',sensitive_changed,
      'components_before',old_components,'components_after',p_components));
  RETURN new_staff.id;
END $function$;
CREATE OR REPLACE FUNCTION public.payroll_delete_staff(p_staff_id uuid, p_expected_version integer)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE s uuid; st public.payroll_staff; has_history boolean;
BEGIN
  s := public.payroll_require_school_admin();
  PERFORM pg_advisory_xact_lock(hashtextextended('payroll:' || s::text,0));
  SELECT * INTO st FROM public.payroll_staff WHERE id = p_staff_id AND school_id = s FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff not found in your school'; END IF;
  IF p_expected_version IS DISTINCT FROM st.version THEN RAISE EXCEPTION 'Staff was changed by another administrator. Reload before deleting.'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.payroll_lines WHERE staff_id = st.id AND school_id = s) INTO has_history;
  IF has_history THEN
    UPDATE public.payroll_staff SET is_active = false, version = version + 1, updated_at = now() WHERE id = st.id;
    INSERT INTO public.payroll_audit(school_id,staff_id,actor_id,event,detail)
      VALUES(s,NULL,auth.uid(),'staff_deactivated',jsonb_build_object('staff_id',st.id,'full_name',st.full_name,'reason','delete requested; payroll history preserved'));
    RETURN 'deactivated';
  END IF;
  DELETE FROM public.payroll_staff_components WHERE staff_id = st.id AND school_id = s;
  DELETE FROM public.payroll_staff WHERE id = st.id AND school_id = s;
  INSERT INTO public.payroll_audit(school_id,staff_id,actor_id,event,detail)
    VALUES(s,NULL,auth.uid(),'staff_deleted',jsonb_build_object('staff_id',st.id,'full_name',st.full_name));
  RETURN 'deleted';
END $function$;
COMMIT;
