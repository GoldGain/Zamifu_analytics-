-- Stage Kiswahili, Grade 9. Inactive until final activation; legacy rows remain available.
DO $stage_one_catalog$
DECLARE
  v_catalog jsonb := $payload${"subject":"Kiswahili","grade":9,"strand_count":4,"sub_strand_count":60,"source_name":"KICD Junior School Curriculum Design - Kiswahili Grade 9 (Rationalized 2024)","source_url":"https://drive.google.com/file/d/14r0D5u2jy79nZdcixJ2Gu3qTattpY0_Y/preview","source_note":"Official KICD Grade 9 index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ Current public viewer: https://drive.google.com/file/d/14r0D5u2jy79nZdcixJ2Gu3qTattpY0_Y/preview. Numbered two-level hierarchy transcribed from the grade summary; no topics tier. Report: research/verified-20260929/07-kiswahili.md","strands":[{"strand_name":"Kusikiliza na Kuzungumza","order":1,"sub_strands":[{"sub_strand_name":"1.1.1 Kusikiliza na Kujibu: Mjadala","order":1},{"sub_strand_name":"2.1.1 Kusikiliza kwa Kina: Sauti /b/ na /mb/","order":2},{"sub_strand_name":"3.1.1 Semi: tashbihi, sitiari na methali","order":3},{"sub_strand_name":"4.1.1 Semi: Vitendawili na nahau","order":4},{"sub_strand_name":"5.1.1 Ufahamu wa Kusikiliza","order":5},{"sub_strand_name":"6.1.1 Kusikiliza kwa Kufasiri","order":6},{"sub_strand_name":"7.1.1 Kusikiliza kwa Kutathmini","order":7},{"sub_strand_name":"8.1.1 Uzungumzaji wa Kushawishi","order":8},{"sub_strand_name":"9.1.1 Kusikiliza kwa Kina: Sauti /j/ na /nj/","order":9},{"sub_strand_name":"10.1.1 Mazungumzo: Malumbano ya Utani","order":10},{"sub_strand_name":"11.1.1 Uzungumzaji katika Sherehe","order":11},{"sub_strand_name":"12.1.1 Ufahamu wa Kusikiliza","order":12},{"sub_strand_name":"13.1.1 Mazungumzo: Mawaidha","order":13},{"sub_strand_name":"14.1.1 Mazungumzo: Mawaidha","order":14},{"sub_strand_name":"15.1.1 Kusikiliza kwa Kutathmini","order":15}]},{"strand_name":"Kusoma","order":2,"sub_strands":[{"sub_strand_name":"1.2.1 Kusoma kwa Ufahamu: Simulizi","order":1},{"sub_strand_name":"2.2.1 Kusoma kwa Mapana: Matini ya kujichagulia","order":2},{"sub_strand_name":"3.2.1 Kusoma kwa Kina: Ushairi","order":3},{"sub_strand_name":"4.2.1 Kusoma kwa Ufasaha","order":4},{"sub_strand_name":"5.2.1 Kusoma kwa Ufahamu","order":5},{"sub_strand_name":"6.2.1 Kusoma kwa Kina: Ushairi","order":6},{"sub_strand_name":"7.2.1 Ufupisho","order":7},{"sub_strand_name":"8.2.1 Kusoma kwa Kina: Ushairi","order":8},{"sub_strand_name":"9.2.1 Kusoma kwa Ufahamu: Kifungu cha Kushawishi","order":9},{"sub_strand_name":"10.2.1 Kusoma kwa Kina: Ushairi","order":10},{"sub_strand_name":"11.2.1 Kusoma kwa Mapana: Matini ya kujichagulia","order":11},{"sub_strand_name":"12.2.1 Kusoma kwa Ufasaha","order":12},{"sub_strand_name":"13.2.1 Kusoma kwa Kina: Ushairi","order":13},{"sub_strand_name":"14.2.1 Kusoma kwa Ufahamu","order":14},{"sub_strand_name":"15.2.1 Ufupisho","order":15}]},{"strand_name":"Kuandika","order":3,"sub_strands":[{"sub_strand_name":"1.3.1 Viakifishi: Koloni na Semi koloni","order":1},{"sub_strand_name":"2.3.1 Insha za Kiuamilifu: Barua ya Kirafiki","order":2},{"sub_strand_name":"3.3.1 Insha za Kubuni: Masimulizi","order":3},{"sub_strand_name":"4.3.1 Insha za Kubuni: Masimulizi","order":4},{"sub_strand_name":"5.3.1 Insha za Kiuamilifu: Shajara","order":5},{"sub_strand_name":"6.3.1 Insha za Kubuni: Methali","order":6},{"sub_strand_name":"7.3.1 Insha za Kubuni: Maelezo","order":7},{"sub_strand_name":"8.3.1 Viakifishi: Mabano na Kistari Kifupi","order":8},{"sub_strand_name":"9.3.1 Insha za Kubuni: Masimulizi","order":9},{"sub_strand_name":"10.3.1 Barua ya Kuomba Kazi","order":10},{"sub_strand_name":"11.3.1 Insha za Kubuni: Maelezo","order":11},{"sub_strand_name":"12.3.1 Hotuba ya Kushawishi","order":12},{"sub_strand_name":"13.3.1 Insha za Kubuni: Maelezo","order":13},{"sub_strand_name":"14.3.1 Insha za Kiuamilifu: Shajara","order":14},{"sub_strand_name":"15.3.1 Kujibu Baruapepe","order":15}]},{"strand_name":"Sarufi","order":4,"sub_strands":[{"sub_strand_name":"1.4.1 Vihusishi: Vihusishi vya Mahali na Vihusishi vya Wakati","order":1},{"sub_strand_name":"2.4.1 Vihusishi: Vihusishi vya -a Unganifu na Vihusishi vya Sababu","order":2},{"sub_strand_name":"3.4.1 Vihusishi: Vihusishi Vilinganishi na Kihusishi na","order":3},{"sub_strand_name":"4.4.1 Nyakati na Hali: -ki- ya masharti na -ka- ya kufuatana kwa vitendo","order":4},{"sub_strand_name":"5.4.1 Hali za Masharti: Hali ya masharti -nge- na Hali ya masharti - ngali-","order":5},{"sub_strand_name":"6.4.1 Vielezi: Vielezi vya Namna na Vielezi vya Wakati","order":6},{"sub_strand_name":"7.4.1 Vielezi: Vielezi vya Mahali na Vielezi vya Idadi","order":7},{"sub_strand_name":"8.4.1 Ngeli na Upatanisho wa Kisarufi: Ngeli ya U-ZI na Ngeli ya YA-YA","order":8},{"sub_strand_name":"9.4.1 Ngeli na Upatanisho wa Kisarufi: Ngeli ya LI, KU, PA-KU-MU","order":9},{"sub_strand_name":"10.4.1 Vinyume vya Vihusishi","order":10},{"sub_strand_name":"11.4.1 Mnyambuliko wa Vitenzi: Kauli ya: Kutendana, Kutendeana na Kutendesha","order":11},{"sub_strand_name":"12.4.1 Aina za Sentensi: Sentensi tata","order":12},{"sub_strand_name":"13.4.1 Ukanushaji: Hali ya masharti -nge-, -ngali- na -ki-","order":13},{"sub_strand_name":"14.4.1 Udogo na Ukubwa wa Nomino","order":14},{"sub_strand_name":"15.4.1 Usemi Halisi na Usemi wa Taarifa","order":15}]}]}$payload$::jsonb;
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
