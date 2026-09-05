-- Zamifu Analytics: multiple Dean of Studies + school-admin managed admins.
-- The `teachers.is_dean_of_studies` boolean already exists on the live DB and is
-- the source of truth for multiple DoS from now on. This migration is idempotent
-- and safe to run repeatedly.

-- 1) Ensure the per-teacher DoS flag exists (in case a fresh DB is missing it).
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS is_dean_of_studies BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Backfill the flag from the legacy single-column assignment so existing DoS
--    keep their access after the switch to the multi-DoS model.
UPDATE public.teachers AS t
SET is_dean_of_studies = TRUE
FROM public.schools AS s
WHERE s.id = t.school_id
  AND s.dean_of_studies_id IS NOT NULL
  AND (t.profile_id = s.dean_of_studies_id OR t.id = s.dean_of_studies_id)
  AND t.is_dean_of_studies IS NOT TRUE;

-- 3) School administrators already create other school_admin rows through the
--    create-user edge function; no column change is required. Keep a comment so
--    future migrations stay aware of the multiple-admin contract.
COMMENT ON COLUMN public.teachers.is_dean_of_studies IS
  'TRUE when this teacher has Dean of Studies access. Supports multiple DoS per school.';
