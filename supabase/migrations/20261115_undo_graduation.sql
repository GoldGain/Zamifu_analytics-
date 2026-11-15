-- Reverses a graduation so a class graduated too early can be restored.
CREATE OR REPLACE FUNCTION public.undo_graduation(p_school_id uuid, p_student_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare restored integer := 0;
begin
  if p_school_id is null or p_student_ids is null or coalesce(array_length(p_student_ids, 1), 0) = 0 then
    raise exception 'School and at least one learner are required.';
  end if;
  update public.students
     set status = 'active',
         learner_status = case when lower(coalesce(learner_status, '')) like '%graduat%' then 'Active' else learner_status end,
         is_active = true,
         class_id = coalesce(class_id, previous_class_id),
         previous_class_id = null,
         graduation_date = null,
         graduation_year = null,
         updated_at = now()
   where school_id = p_school_id and id = any(p_student_ids)
     and (lower(coalesce(status, '')) = 'graduated' or lower(coalesce(learner_status, '')) like '%graduat%');
  get diagnostics restored = row_count;
  return jsonb_build_object('restored', restored);
end;
$function$;
revoke all on function public.undo_graduation(uuid, uuid[]) from public;
grant execute on function public.undo_graduation(uuid, uuid[]) to service_role;
