-- Shared class-list ownership for teachers and school administrators.
-- Existing teacher rows are backfilled from their class; admin rows use school_id
-- with a NULL teacher_id.
ALTER TABLE public.class_list_columns
  ALTER COLUMN teacher_id DROP NOT NULL;

ALTER TABLE public.class_list_columns
  ADD COLUMN IF NOT EXISTS school_id uuid;

UPDATE public.class_list_columns AS column_row
SET school_id = class_row.school_id
FROM public.classes AS class_row
WHERE column_row.school_id IS NULL
  AND column_row.class_id = class_row.id;

CREATE INDEX IF NOT EXISTS idx_class_list_columns_school_class
  ON public.class_list_columns (school_id, class_id);

DROP POLICY IF EXISTS "Teachers manage own columns" ON public.class_list_columns;
CREATE POLICY "School staff manage class list columns"
  ON public.class_list_columns
  FOR ALL
  TO public
  USING (
    (teacher_id = auth.uid())
    OR (teacher_id IN (SELECT teachers.id FROM public.teachers WHERE teachers.profile_id = auth.uid()))
    OR (
      teacher_id IS NULL
      AND school_id IN (
        SELECT profiles.school_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'school_admin'::user_role
      )
    )
  )
  WITH CHECK (
    (teacher_id = auth.uid())
    OR (teacher_id IN (SELECT teachers.id FROM public.teachers WHERE teachers.profile_id = auth.uid()))
    OR (
      teacher_id IS NULL
      AND school_id IN (
        SELECT profiles.school_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'school_admin'::user_role
      )
    )
  );

DROP POLICY IF EXISTS "Teachers manage own data" ON public.class_list_data;
CREATE POLICY "School staff manage class list data"
  ON public.class_list_data
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_list_columns AS column_row
      WHERE column_row.id = class_list_data.column_id
        AND (
          column_row.teacher_id = auth.uid()
          OR column_row.teacher_id IN (SELECT teachers.id FROM public.teachers WHERE teachers.profile_id = auth.uid())
          OR (
            column_row.teacher_id IS NULL
            AND column_row.school_id IN (
              SELECT profiles.school_id
              FROM public.profiles
              WHERE profiles.id = auth.uid()
                AND profiles.role = 'school_admin'::user_role
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.class_list_columns AS column_row
      WHERE column_row.id = class_list_data.column_id
        AND (
          column_row.teacher_id = auth.uid()
          OR column_row.teacher_id IN (SELECT teachers.id FROM public.teachers WHERE teachers.profile_id = auth.uid())
          OR (
            column_row.teacher_id IS NULL
            AND column_row.school_id IN (
              SELECT profiles.school_id
              FROM public.profiles
              WHERE profiles.id = auth.uid()
                AND profiles.role = 'school_admin'::user_role
            )
          )
        )
    )
  );

ALTER TABLE public.timetable_entries
  DROP CONSTRAINT IF EXISTS timetable_entries_entry_type_check;

ALTER TABLE public.timetable_entries
  ADD CONSTRAINT timetable_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY['lesson'::text, 'break'::text, 'lunch'::text, 'activity'::text, 'lesson_double'::text, 'study'::text]));

-- New platform pricing defaults.
ALTER TABLE public.schools
  ALTER COLUMN fee_per_learner_per_term SET DEFAULT 10,
  ALTER COLUMN fee_per_learner_per_year SET DEFAULT 20;

ALTER TABLE public.resellers
  ALTER COLUMN default_fee_per_learner SET DEFAULT 10,
  ALTER COLUMN default_fee_per_learner_per_year SET DEFAULT 20;

ALTER TABLE public.school_pricing
  ALTER COLUMN termly_per_learner SET DEFAULT 10,
  ALTER COLUMN annual_per_learner SET DEFAULT 20;

UPDATE public.schools
SET fee_per_learner_per_term = 10,
    fee_per_learner_per_year = 20;

UPDATE public.resellers
SET default_fee_per_learner = 10,
    default_fee_per_learner_per_year = 20;

UPDATE public.school_pricing
SET termly_per_learner = 10,
    annual_per_learner = 20;
