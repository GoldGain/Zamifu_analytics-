ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_left date;

CREATE TABLE IF NOT EXISTS public.leaving_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date_left date NOT NULL,
  standard_left integer NOT NULL CHECK (standard_left BETWEEN 1 AND 8),
  date_of_issue date NOT NULL DEFAULT CURRENT_DATE,
  conduct_category text NOT NULL CHECK (conduct_category IN ('Excellent', 'Very good', 'Good', 'Satisfactory', 'Needs improvement')),
  conduct_elaboration varchar(140),
  academic_comment varchar(220),
  cocurricular_comment varchar(140),
  conduct_comment varchar(140),
  extra_notes text,
  pupil_signature_url text,
  pupil_signature_type text,
  head_teacher_signature_url text,
  head_teacher_signature_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id)
);

ALTER TABLE public.leaving_certificates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaving_certificates' AND policyname = 'leaving_certificates_school_admin_select') THEN
    CREATE POLICY leaving_certificates_school_admin_select ON public.leaving_certificates FOR SELECT USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role = 'school_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaving_certificates' AND policyname = 'leaving_certificates_school_admin_insert') THEN
    CREATE POLICY leaving_certificates_school_admin_insert ON public.leaving_certificates FOR INSERT WITH CHECK (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role = 'school_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaving_certificates' AND policyname = 'leaving_certificates_school_admin_update') THEN
    CREATE POLICY leaving_certificates_school_admin_update ON public.leaving_certificates FOR UPDATE USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role = 'school_admin')) WITH CHECK (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role = 'school_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaving_certificates' AND policyname = 'leaving_certificates_school_admin_delete') THEN
    CREATE POLICY leaving_certificates_school_admin_delete ON public.leaving_certificates FOR DELETE USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role = 'school_admin'));
  END IF;
END $$;
