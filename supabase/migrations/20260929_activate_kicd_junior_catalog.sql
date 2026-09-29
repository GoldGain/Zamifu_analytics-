-- Atomically switch Grade 7-9 to the staged KICD catalogs; retain every legacy row.
DO $activate_catalog$
DECLARE
  v_subject_rows integer;
  v_strands integer;
  v_sub_strands integer;
  v_grade record;
BEGIN
  SELECT COUNT(*) INTO v_subject_rows
  FROM public.curriculum_subjects s
  JOIN public.curriculum_grades g ON g.id = s.grade_id
  JOIN public.curriculum_sources cs ON cs.id = s.curriculum_source_id
  WHERE g.curriculum_type = 'CBE' AND g.grade_number IN (7,8,9)
    AND s.subject_name = ANY(ARRAY['Agriculture and Nutrition', 'Creative Arts and Sports', 'Christian Religious Education', 'English', 'Integrated Science', 'Islamic Religious Education', 'Kiswahili', 'Mathematics', 'Pre-Technical Studies', 'Social Studies']::text[])
    AND cs.source_name LIKE 'KICD Junior School Curriculum Design - % (Rationalized 2024)' LIMIT 1;
  SELECT COUNT(*) INTO v_strands FROM public.curriculum_strands WHERE strand_description = 'Official KICD source-verified curriculum. Provenance is linked through curriculum_subjects.curriculum_source_id.' LIMIT 1;
  SELECT COUNT(*) INTO v_sub_strands FROM public.curriculum_sub_strands WHERE sub_strand_description = 'Official KICD source-verified sub-strand; no third-tier topic record is created.' LIMIT 1;
  IF v_subject_rows <> 30 OR v_strands <> 171 OR v_sub_strands <> 758 THEN
    RAISE EXCEPTION 'Refusing activation: staged totals are subjects %, strands %, sub-strands %.', v_subject_rows, v_strands, v_sub_strands;
  END IF;

  -- Exact grade-level count guard before exposing anything.
  FOR v_grade IN
    SELECT g.grade_number,
      COUNT(DISTINCT s.id) FILTER (WHERE s.curriculum_source_id IS NOT NULL AND s.subject_name = ANY(ARRAY['Agriculture and Nutrition', 'Creative Arts and Sports', 'Christian Religious Education', 'English', 'Integrated Science', 'Islamic Religious Education', 'Kiswahili', 'Mathematics', 'Pre-Technical Studies', 'Social Studies']::text[])) AS sourced_subjects,
      COUNT(st.id) FILTER (WHERE st.strand_description = 'Official KICD source-verified curriculum. Provenance is linked through curriculum_subjects.curriculum_source_id.') AS staged_strands,
      COUNT(ss.id) FILTER (WHERE ss.sub_strand_description = 'Official KICD source-verified sub-strand; no third-tier topic record is created.') AS staged_sub_strands
    FROM public.curriculum_grades g
    LEFT JOIN public.curriculum_subjects s ON s.grade_id = g.id
    LEFT JOIN public.curriculum_strands st ON st.subject_id = s.id
    LEFT JOIN public.curriculum_sub_strands ss ON ss.strand_id = st.id
    WHERE g.curriculum_type='CBE' AND g.grade_number IN (7,8,9)
    GROUP BY g.grade_number ORDER BY g.grade_number LIMIT 3
  LOOP
    IF v_grade.sourced_subjects <> 10 THEN
      RAISE EXCEPTION 'Grade % has % source-linked active-scope subjects, expected 10.', v_grade.grade_number, v_grade.sourced_subjects;
    END IF;
  END LOOP;

  UPDATE public.curriculum_subjects s SET is_current = false
  FROM public.curriculum_grades g WHERE s.grade_id=g.id AND g.curriculum_type='CBE' AND g.grade_number IN (7,8,9);
  UPDATE public.curriculum_strands st SET is_current = false
  FROM public.curriculum_subjects s JOIN public.curriculum_grades g ON g.id=s.grade_id
  WHERE st.subject_id=s.id AND g.curriculum_type='CBE' AND g.grade_number IN (7,8,9);
  UPDATE public.curriculum_sub_strands ss SET is_current = false
  FROM public.curriculum_strands st JOIN public.curriculum_subjects s ON s.id=st.subject_id
  JOIN public.curriculum_grades g ON g.id=s.grade_id
  WHERE ss.strand_id=st.id AND g.curriculum_type='CBE' AND g.grade_number IN (7,8,9);

  UPDATE public.curriculum_subjects s SET is_current = true
  FROM public.curriculum_grades g, public.curriculum_sources cs
  WHERE s.grade_id=g.id AND cs.id=s.curriculum_source_id
    AND g.curriculum_type='CBE' AND g.grade_number IN (7,8,9)
    AND s.subject_name = ANY(ARRAY['Agriculture and Nutrition', 'Creative Arts and Sports', 'Christian Religious Education', 'English', 'Integrated Science', 'Islamic Religious Education', 'Kiswahili', 'Mathematics', 'Pre-Technical Studies', 'Social Studies']::text[])
    AND cs.source_name LIKE 'KICD Junior School Curriculum Design - % (Rationalized 2024)';
  UPDATE public.curriculum_strands SET is_current = true WHERE strand_description = 'Official KICD source-verified curriculum. Provenance is linked through curriculum_subjects.curriculum_source_id.';
  UPDATE public.curriculum_sub_strands ss SET is_current = true
  FROM public.curriculum_strands st
  WHERE ss.strand_id=st.id AND ss.sub_strand_description='Official KICD source-verified sub-strand; no third-tier topic record is created.' AND st.is_current=true;

  IF EXISTS (
    SELECT 1 FROM public.curriculum_grades g
    LEFT JOIN public.curriculum_subjects s ON s.grade_id=g.id AND s.is_current=true
    WHERE g.curriculum_type='CBE' AND g.grade_number IN (7,8,9)
    GROUP BY g.grade_number HAVING COUNT(s.id) <> 10 LIMIT 3
  ) THEN RAISE EXCEPTION 'Active Grade 7-9 subject count is not ten per grade.'; END IF;
  IF (SELECT COUNT(*) FROM public.curriculum_strands WHERE is_current=true AND strand_description='Official KICD source-verified curriculum. Provenance is linked through curriculum_subjects.curriculum_source_id.' LIMIT 1) <> 171 THEN
    RAISE EXCEPTION 'Active KICD strand count is not 171.';
  END IF;
  IF (SELECT COUNT(*) FROM public.curriculum_sub_strands WHERE is_current=true AND sub_strand_description='Official KICD source-verified sub-strand; no third-tier topic record is created.' LIMIT 1) <> 758 THEN
    RAISE EXCEPTION 'Active KICD sub-strand count is not 758.';
  END IF;
END
$activate_catalog$;
