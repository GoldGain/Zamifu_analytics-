-- Temporary staging helper for source-backed Junior School catalog rows.
-- Invoker-security only; access is limited to the trusted service role and migration owner.
CREATE OR REPLACE FUNCTION public.stage_junior_kicd_catalog(p_catalog jsonb)
RETURNS text
LANGUAGE plpgsql
AS $stage$
DECLARE
  v_grade_id uuid;
  v_subject_id uuid;
  v_source_id uuid;
  v_strand_id uuid;
  v_strand jsonb;
  v_sub_strand jsonb;
  v_strands integer := 0;
  v_sub_strands integer := 0;
BEGIN
  IF jsonb_typeof(p_catalog) <> 'object' OR p_catalog->>'subject' IS NULL OR p_catalog->>'grade' IS NULL THEN
    RAISE EXCEPTION 'Invalid single grade catalog payload.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.curriculum_sources WHERE source_name=p_catalog->>'source_name' LIMIT 1) THEN
    RAISE EXCEPTION 'Source already staged: %', p_catalog->>'source_name';
  END IF;
  SELECT id INTO v_grade_id
  FROM public.curriculum_grades
  WHERE grade_number=(p_catalog->>'grade')::integer AND curriculum_type='CBE'
  LIMIT 1;
  IF v_grade_id IS NULL THEN RAISE EXCEPTION 'CBE grade not found: %',p_catalog->>'grade'; END IF;
  SELECT id INTO v_subject_id
  FROM public.curriculum_subjects
  WHERE grade_id=v_grade_id AND subject_name=p_catalog->>'subject'
  LIMIT 1;
  IF v_subject_id IS NULL THEN RAISE EXCEPTION 'CBE subject not found: % / %',p_catalog->>'grade',p_catalog->>'subject'; END IF;

  INSERT INTO public.curriculum_sources(source_name,source_url,source_type,license_status,retrieval_status,notes)
  VALUES(p_catalog->>'source_name',p_catalog->>'source_url','official_design','official_public','approved',p_catalog->>'source_note')
  RETURNING id INTO v_source_id;
  UPDATE public.curriculum_subjects SET curriculum_source_id=v_source_id WHERE id=v_subject_id;

  FOR v_strand IN SELECT value FROM jsonb_array_elements(p_catalog->'strands') LOOP
    INSERT INTO public.curriculum_strands(subject_id,strand_name,strand_description,strand_order,is_current)
    VALUES(v_subject_id,v_strand->>'strand_name','Official KICD source-verified curriculum. Provenance is linked through curriculum_subjects.curriculum_source_id.',(v_strand->>'order')::integer,false)
    RETURNING id INTO v_strand_id;
    v_strands:=v_strands+1;
    FOR v_sub_strand IN SELECT value FROM jsonb_array_elements(v_strand->'sub_strands') LOOP
      INSERT INTO public.curriculum_sub_strands(strand_id,sub_strand_name,sub_strand_description,sub_strand_order,is_current)
      VALUES(v_strand_id,v_sub_strand->>'sub_strand_name','Official KICD source-verified sub-strand; no third-tier topic record is created.',(v_sub_strand->>'order')::integer,false);
      v_sub_strands:=v_sub_strands+1;
    END LOOP;
  END LOOP;
  IF v_strands<>(p_catalog->>'strand_count')::integer OR v_sub_strands<>(p_catalog->>'sub_strand_count')::integer THEN
    RAISE EXCEPTION 'Catalog count mismatch for % Grade %: expected %/% strands, %/% sub-strands',p_catalog->>'subject',p_catalog->>'grade',p_catalog->>'strand_count',v_strands,p_catalog->>'sub_strand_count',v_sub_strands;
  END IF;
  RETURN format('Staged %s Grade %s: %s strands, %s sub-strands (inactive).',p_catalog->>'subject',p_catalog->>'grade',v_strands,v_sub_strands);
END
$stage$;
REVOKE ALL ON FUNCTION public.stage_junior_kicd_catalog(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stage_junior_kicd_catalog(jsonb) TO service_role;
