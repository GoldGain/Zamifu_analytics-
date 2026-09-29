-- Stage Islamic Religious Education, Grade 8. Inactive until final activation; legacy rows remain available.
DO $stage_one_catalog$
DECLARE
  v_catalog jsonb := $payload${"subject":"Islamic Religious Education","grade":8,"strand_count":7,"sub_strand_count":17,"source_name":"KICD Junior School Curriculum Design - Islamic Religious Education Grade 8 (Rationalized 2024)","source_url":"https://drive.google.com/file/d/10HXITblf3E9bwYFABlcbv_qA9ZGSSod1/preview","source_note":"Official KICD Grade 8 index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/ Current public viewer: https://drive.google.com/file/d/10HXITblf3E9bwYFABlcbv_qA9ZGSSod1/preview. Numbered two-level hierarchy transcribed from the grade summary; no topics tier. Report: research/verified-20260929/06-islamic-religious-education.md","strands":[{"strand_name":"1.0 Qur’an","order":1,"sub_strands":[{"sub_strand_name":"1.1 Modes of preservation of the Qur’an","order":1},{"sub_strand_name":"1.2 Divisions of the Qur’an","order":2},{"sub_strand_name":"1.3 Selected verses (Al-Luqman 12-19)","order":3}]},{"strand_name":"2.0 Hadith","order":2,"sub_strands":[{"sub_strand_name":"2.1 Ulum al-Hadith","order":1},{"sub_strand_name":"2.2 Selected Hadith","order":2}]},{"strand_name":"3.0 Pillars of Iman","order":3,"sub_strands":[{"sub_strand_name":"3.1 Belief in revealed scriptures","order":1},{"sub_strand_name":"3.2 Ulul-Azm Prophets","order":2}]},{"strand_name":"4.0 Devotional Acts","order":4,"sub_strands":[{"sub_strand_name":"4.1 Prayers on special occasions","order":1},{"sub_strand_name":"4.2 Hajj and Umrah","order":2}]},{"strand_name":"5.0 Akhlaq (Moral Teachings)","order":5,"sub_strands":[{"sub_strand_name":"5.1 Commanding good and forbidding evil","order":1},{"sub_strand_name":"5.2 Virtues in Islam","order":2},{"sub_strand_name":"5.3 Prohibitions in Islam","order":3}]},{"strand_name":"6.0 Muamalat (Social Relations)","order":6,"sub_strands":[{"sub_strand_name":"6.1 Divorce","order":1},{"sub_strand_name":"6.2 Types of divorce","order":2},{"sub_strand_name":"6.3 Trade and Finance in Islam","order":3},{"sub_strand_name":"6.4 Human Rights","order":4}]},{"strand_name":"7.0 Islamic Heritage and Civilisation","order":7,"sub_strands":[{"sub_strand_name":"7.1 The Rightly Guided Caliphs","order":1}]}]}$payload$::jsonb;
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
