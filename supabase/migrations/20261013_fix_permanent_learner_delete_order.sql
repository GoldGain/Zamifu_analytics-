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

  IF LOWER(COALESCE(p_target_type, '')) NOT IN ('student', 'learner') THEN
    RAISE EXCEPTION 'This function only deletes learner accounts';
  END IF;

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

  -- Clear the learner's four NO ACTION dependents first. Any failure aborts
  -- this function's transaction, leaving the learner and auth account intact.
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
  v_deleted_record := FOUND;

  IF NOT v_deleted_record THEN
    RAISE EXCEPTION 'Archived learner changed before deletion; no records were deleted';
  END IF;

  -- PostgreSQL commits the dependent and learner-row deletes as one transaction.
  -- Return the linked Auth id; the trusted Edge Function deletes it only after this RPC succeeds.

  RETURN jsonb_build_object(
    'success', true,
    'target_type', 'student',
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
