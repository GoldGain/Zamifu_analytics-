-- Assessment-number credential transition for existing learners.
-- Backfill only when the legacy admission number is unique within its school,
-- does not collide with another assessment number, and the learner is active.
-- Ambiguous duplicate admission numbers remain NULL for explicit admin repair.
WITH duplicate_admissions AS (
  SELECT school_id, lower(btrim(admission_number)) AS admission_key
  FROM public.students
  WHERE COALESCE(is_active, true) = true
    AND NULLIF(btrim(admission_number), '') IS NOT NULL
  GROUP BY school_id, lower(btrim(admission_number))
  HAVING COUNT(*) > 1
)
UPDATE public.students AS student
SET assessment_number = btrim(student.admission_number),
    updated_at = now()
WHERE COALESCE(student.is_active, true) = true
  AND NULLIF(btrim(student.assessment_number), '') IS NULL
  AND NULLIF(btrim(student.admission_number), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM duplicate_admissions AS duplicate
    WHERE duplicate.school_id = student.school_id
      AND duplicate.admission_key = lower(btrim(student.admission_number))
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.students AS collision
    WHERE collision.school_id = student.school_id
      AND collision.id <> student.id
      AND NULLIF(btrim(collision.assessment_number), '') IS NOT NULL
      AND lower(btrim(collision.assessment_number)) = lower(btrim(student.admission_number))
  );

COMMENT ON COLUMN public.students.assessment_number IS 'Learner login and assessment identifier; new credentials use this value in capitals.';

-- Database-level protection: every results deletion, including direct SQL or a
-- future UI path, creates a school-scoped audit record with the deleted row.
CREATE OR REPLACE FUNCTION public.audit_results_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    school_id, user_id, action, table_name, record_id, old_values, new_values
  ) VALUES (
    OLD.school_id,
    auth.uid(),
    'DELETE',
    'results',
    OLD.id,
    to_jsonb(OLD),
    NULL
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_results_delete ON public.results;
CREATE TRIGGER trg_audit_results_delete
AFTER DELETE ON public.results
FOR EACH ROW
EXECUTE FUNCTION public.audit_results_delete();
