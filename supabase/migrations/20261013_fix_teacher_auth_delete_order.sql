CREATE OR REPLACE FUNCTION public.permanently_delete_school_user(
  p_record_id uuid,
  p_target_type text,
  p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
AS $function$
DECLARE
  v_caller_school_id uuid;
  v_caller_role text;
  v_profile_id uuid;
  v_target_type text := LOWER(COALESCE(p_target_type, ''));
  v_deleted_record boolean := false;
  v_marklist_rows integer := 0;
  v_parent_payment_rows integer := 0;
  v_term_average_rows integer := 0;
  v_teacher_message_rows integer := 0;
BEGIN
  SELECT p.school_id, p.role
    INTO v_caller_school_id, v_caller_role
    FROM public.profiles p
    WHERE p.id = auth.uid();

  IF auth.uid() IS NULL OR COALESCE(v_caller_role, '') NOT IN ('school_admin', 'super_admin', 'master_super_admin') THEN
    RAISE EXCEPTION 'Only an authorized administrator can permanently delete accounts';
  END IF;

  IF v_caller_role = 'school_admin' AND v_caller_school_id IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'Account deletion is restricted to the administrator''s school';
  END IF;

  IF v_target_type = 'learner' THEN
    v_target_type := 'student';
  END IF;
  IF v_target_type NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'This function only permanently deletes learners or teachers';
  END IF;

  IF v_target_type = 'student' THEN
    SELECT s.profile_id
      INTO v_profile_id
      FROM public.students s
      WHERE s.id = p_record_id
        AND s.school_id = p_school_id
        AND s.is_active = false
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Archived learner was not found in the requested school';
    END IF;
  ELSE
    SELECT t.profile_id
      INTO v_profile_id
      FROM public.teachers t
      WHERE t.id = p_record_id
        AND t.school_id = p_school_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Teacher was not found in the requested school';
    END IF;

    -- Preserve the school and exam-timetable records while detaching their
    -- nullable NO ACTION references to the teacher record.
    UPDATE public.exam_timetable SET invigilator_id = NULL WHERE invigilator_id = p_record_id;
    UPDATE public.schools SET dean_of_studies_id = NULL WHERE id = p_school_id AND dean_of_studies_id = p_record_id;
  END IF;

  -- Keep immutable impersonation history intact. Abort the transaction before
  -- deleting the school record when its NOT NULL profile references exist.
  IF v_profile_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.impersonation_audit ia
    WHERE ia.master_user_id = v_profile_id OR ia.target_user_id = v_profile_id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'This account is referenced by immutable impersonation audit history; no records were deleted';
  END IF;

  -- These historical actor references are nullable but NO ACTION. Preserve the
  -- history and clear only the deleted user's attribution before Auth cleanup.
  IF v_profile_id IS NOT NULL THEN
    UPDATE public.announcements SET created_by = NULL WHERE created_by = v_profile_id;
    UPDATE public.curriculum_resources SET uploaded_by = NULL WHERE uploaded_by = v_profile_id;
    UPDATE public.fee_payments SET recorded_by = NULL WHERE recorded_by = v_profile_id;
    UPDATE public.results SET approved_by = NULL WHERE approved_by = v_profile_id;
    UPDATE public.student_promotions SET promoted_by = NULL WHERE promoted_by = v_profile_id;
  END IF;

  IF v_target_type = 'student' THEN
    -- Clear the learner's NO ACTION dependents first. Any failure aborts this
    -- transaction, leaving the learner record and Auth account intact.
    DELETE FROM public.marklist_data WHERE student_id = p_record_id;
    GET DIAGNOSTICS v_marklist_rows = ROW_COUNT;

    DELETE FROM public.parent_payments WHERE student_id = p_record_id;
    GET DIAGNOSTICS v_parent_payment_rows = ROW_COUNT;

    DELETE FROM public.student_term_averages WHERE student_id = p_record_id;
    GET DIAGNOSTICS v_term_average_rows = ROW_COUNT;

    DELETE FROM public.teacher_messages WHERE student_id = p_record_id;
    GET DIAGNOSTICS v_teacher_message_rows = ROW_COUNT;

    DELETE FROM public.students
      WHERE id = p_record_id
        AND school_id = p_school_id
        AND is_active = false;
  ELSE
    DELETE FROM public.teachers
      WHERE id = p_record_id
        AND school_id = p_school_id;
  END IF;
  v_deleted_record := FOUND;

  IF NOT v_deleted_record THEN
    RAISE EXCEPTION 'The account record changed before deletion; no records were deleted';
  END IF;

  -- Auth Admin deletion is deliberately a separate server-side step after
  -- this transaction commits. The caller can safely retry that step by ID.
  RETURN jsonb_build_object(
    'success', true,
    'target_type', v_target_type,
    'deleted_record', v_deleted_record,
    'auth_user_id', v_profile_id,
    'deleted_dependent_counts', jsonb_build_object(
      'marklist_data', v_marklist_rows,
      'parent_payments', v_parent_payment_rows,
      'student_term_averages', v_term_average_rows,
      'teacher_messages', v_teacher_message_rows
    )
  );
END;
$function$;
