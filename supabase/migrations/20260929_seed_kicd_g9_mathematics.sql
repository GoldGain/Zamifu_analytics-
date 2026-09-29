-- Stage Mathematics, Grade 9. Inactive until final activation; legacy rows remain available.
DO $stage_one_catalog$
DECLARE
  v_catalog jsonb := $payload${"subject":"Mathematics","grade":9,"strand_count":5,"sub_strand_count":19,"source_name":"KICD Junior School Curriculum Design - Mathematics Grade 9 (Rationalized 2024)","source_url":"https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview","source_note":"Official KICD Grade 9 index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ Current public viewer: https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview. Numbered two-level hierarchy transcribed from the grade summary; no topics tier. Report: research/verified-20260929/08-mathematics.md","strands":[{"strand_name":"1.0 Numbers","order":1,"sub_strands":[{"sub_strand_name":"1.1 Integers","order":1},{"sub_strand_name":"1.2 Cubes and Cube Roots","order":2},{"sub_strand_name":"1.3 Indices and Logarithms","order":3},{"sub_strand_name":"1.4 Compound Proportions and Rates of Work","order":4}]},{"strand_name":"2.0 Algebra","order":2,"sub_strands":[{"sub_strand_name":"2.1 Matrices","order":1},{"sub_strand_name":"2.2 Equation of a Straight Line","order":2},{"sub_strand_name":"2.3 Linear Inequalities","order":3}]},{"strand_name":"3.0 Measurements","order":3,"sub_strands":[{"sub_strand_name":"3.1 Area","order":1},{"sub_strand_name":"3.2 Volume of Solids","order":2},{"sub_strand_name":"3.3 Mass, Volume, Weight, and Density","order":3},{"sub_strand_name":"3.4 Time, Distance, and Speed","order":4},{"sub_strand_name":"3.5 Money","order":5},{"sub_strand_name":"3.6 Approximations and Errors","order":6}]},{"strand_name":"4.0 Geometry","order":4,"sub_strands":[{"sub_strand_name":"4.1 Coordinates and Graphs","order":1},{"sub_strand_name":"4.2 Scale Drawing","order":2},{"sub_strand_name":"4.3 Similarity and Enlargement","order":3},{"sub_strand_name":"4.4 Trigonometry","order":4}]},{"strand_name":"5.0 Data Handling and Probability","order":5,"sub_strands":[{"sub_strand_name":"5.1 Data Interpretation (Grouped Data)","order":1},{"sub_strand_name":"5.2 Probability","order":2}]}]}$payload$::jsonb;
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
