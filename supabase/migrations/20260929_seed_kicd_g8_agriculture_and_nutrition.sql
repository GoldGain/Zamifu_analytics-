-- Stage Agriculture and Nutrition, Grade 8. Inactive until final activation; legacy rows remain available.
DO $stage_one_catalog$
DECLARE
  v_catalog jsonb := $payload${"subject":"Agriculture and Nutrition","grade":8,"strand_count":4,"sub_strand_count":12,"source_name":"KICD Junior School Curriculum Design - Agriculture and Nutrition Grade 8 (Rationalized 2024)","source_url":"https://drive.google.com/file/d/1MzOFhLc8kbRwvjg03q7oeDrbbvux75Wy/preview","source_note":"Official KICD Grade 8 index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/ Current public viewer: https://drive.google.com/file/d/1MzOFhLc8kbRwvjg03q7oeDrbbvux75Wy/preview. Numbered two-level hierarchy transcribed from the grade summary; no topics tier. Report: research/verified-20260929/01-agriculture-and-nutrition.md","strands":[{"strand_name":"1.0 Conservation of Resources","order":1,"sub_strands":[{"sub_strand_name":"1.1 Soil Conservation Measures","order":1},{"sub_strand_name":"1.2 Water Harvesting and Storage","order":2}]},{"strand_name":"2.0 Food Production Processes","order":2,"sub_strands":[{"sub_strand_name":"2.1 Kitchen and Backyard Gardening","order":1},{"sub_strand_name":"2.2 Poultry Rearing in a Fold","order":2},{"sub_strand_name":"2.3 Crop Pest and Disease Control","order":3},{"sub_strand_name":"2.4 Preparation of Animal Products","order":4},{"sub_strand_name":"2.5 Preserving Animal Products","order":5},{"sub_strand_name":"2.6 Cooking: Preparing a Balanced Meal","order":6}]},{"strand_name":"3.0 Hygiene Practices","order":3,"sub_strands":[{"sub_strand_name":"3.1 Cleaning the Kitchen","order":1}]},{"strand_name":"4.0 Production Techniques","order":4,"sub_strands":[{"sub_strand_name":"4.1 Sewing Skills: Constructing Household Items","order":1},{"sub_strand_name":"4.2 Constructing Innovative Animal Waterer","order":2},{"sub_strand_name":"4.3 ICT Support Services","order":3}]}]}$payload$::jsonb;
  v_grade_id uuid;
  v_subject_id uuid;
  v_source_id uuid;
  v_strand_id uuid;
  v_strand jsonb;
  v_sub_strand jsonb;
  v_strands integer := 0;
  v_sub_strands integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.curriculum_sources WHERE source_name = v_catalog->>'source_name' LIMIT 1) THEN
    RAISE EXCEPTION 'Source already staged: %', v_catalog->>'source_name';
  END IF;
  SELECT id INTO v_grade_id FROM public.curriculum_grades
    WHERE grade_number = (v_catalog->>'grade')::integer AND curriculum_type = 'CBE' LIMIT 1;
  IF v_grade_id IS NULL THEN RAISE EXCEPTION 'CBE Grade % missing.', v_catalog->>'grade'; END IF;
  SELECT id INTO v_subject_id FROM public.curriculum_subjects
    WHERE grade_id = v_grade_id AND subject_name = v_catalog->>'subject' LIMIT 1;
  IF v_subject_id IS NULL THEN RAISE EXCEPTION 'CBE Grade % subject missing: %.', v_catalog->>'grade', v_catalog->>'subject'; END IF;

  INSERT INTO public.curriculum_sources (source_name, source_url, source_type, license_status, retrieval_status, notes)
  VALUES (v_catalog->>'source_name', v_catalog->>'source_url', 'official_design', 'official_public', 'approved', v_catalog->>'source_note')
  RETURNING id INTO v_source_id;
  UPDATE public.curriculum_subjects SET curriculum_source_id = v_source_id WHERE id = v_subject_id;

  FOR v_strand IN SELECT value FROM jsonb_array_elements(v_catalog->'strands') LOOP
    INSERT INTO public.curriculum_strands (subject_id, strand_name, strand_description, strand_order, is_current)
    VALUES (v_subject_id, v_strand->>'strand_name', 'Official KICD source-verified curriculum. Provenance is linked through curriculum_subjects.curriculum_source_id.', (v_strand->>'order')::integer, false)
    RETURNING id INTO v_strand_id;
    v_strands := v_strands + 1;
    FOR v_sub_strand IN SELECT value FROM jsonb_array_elements(v_strand->'sub_strands') LOOP
      INSERT INTO public.curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order, is_current)
      VALUES (v_strand_id, v_sub_strand->>'sub_strand_name', 'Official KICD source-verified sub-strand; no third-tier topic record is created.', (v_sub_strand->>'order')::integer, false);
      v_sub_strands := v_sub_strands + 1;
    END LOOP;
  END LOOP;

  IF v_strands <> (v_catalog->>'strand_count')::integer OR v_sub_strands <> (v_catalog->>'sub_strand_count')::integer THEN
    RAISE EXCEPTION 'Catalog count mismatch for % Grade %: strands %/%, sub-strands %/%',
      v_catalog->>'subject',v_catalog->>'grade',v_catalog->>'strand_count',v_strands,v_catalog->>'sub_strand_count',v_sub_strands;
  END IF;
END
$stage_one_catalog$;
