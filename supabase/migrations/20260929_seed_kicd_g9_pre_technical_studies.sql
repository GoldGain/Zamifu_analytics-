-- Stage Pre-Technical Studies, Grade 9. Inactive until final activation; legacy rows remain available.
DO $stage_one_catalog$
DECLARE
  v_catalog jsonb := $payload${"subject":"Pre-Technical Studies","grade":9,"strand_count":5,"sub_strand_count":13,"source_name":"KICD Junior School Curriculum Design - Pre-Technical Studies Grade 9 (Rationalized 2024)","source_url":"https://drive.google.com/file/d/1sHIe4eN9oE8ojrjBPojqHj7YIdYdFWzP/view","source_note":"Official KICD Grade 9 index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ Current public viewer: https://drive.google.com/file/d/1sHIe4eN9oE8ojrjBPojqHj7YIdYdFWzP/view. Numbered two-level hierarchy transcribed from the grade summary; no topics tier. Report: research/verified-20260929/09-pre-technical-studies.md","strands":[{"strand_name":"1.0 Foundations of Pre-Technical Studies","order":1,"sub_strands":[{"sub_strand_name":"1.1 Safety on Raised Platforms","order":1},{"sub_strand_name":"1.2 Handling Hazardous Substances","order":2},{"sub_strand_name":"1.3 Self-Exploration and Career Development","order":3}]},{"strand_name":"2.0 Communication in Pre-Technical Studies","order":2,"sub_strands":[{"sub_strand_name":"2.1 Oblique Projection","order":1},{"sub_strand_name":"2.2 Visual Programming","order":2}]},{"strand_name":"3.0 Materials for Production","order":3,"sub_strands":[{"sub_strand_name":"3.1 Wood","order":1},{"sub_strand_name":"3.2 Handling Waste Materials","order":2}]},{"strand_name":"4.0. Tools and Production","order":4,"sub_strands":[{"sub_strand_name":"4.1 Holding Tools","order":1},{"sub_strand_name":"4.2 Driving Tools","order":2},{"sub_strand_name":"4.3 Project","order":3}]},{"strand_name":"5.0 Entrepreneurship","order":5,"sub_strands":[{"sub_strand_name":"5.1 Financial Services","order":1},{"sub_strand_name":"5.2 Government and Business","order":2},{"sub_strand_name":"5.3 Business Plan","order":3}]}]}$payload$::jsonb;
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
