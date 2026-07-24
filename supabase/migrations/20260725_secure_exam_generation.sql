-- Secure Curriculum Navigator / Exam Generator data model
-- This migration is intentionally provenance-first: it stores only approved summaries or
-- licensed material, never bulk-copied third-party examination content.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Extend the existing table without replacing historic columns or data.
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_kind VARCHAR(30) NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS marks INTEGER NOT NULL DEFAULT 1 CHECK (marks BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS topic VARCHAR(180),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS exam_questions_school_subject_grade_idx
  ON public.exam_questions (school_id, subject, grade_level, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_questions_created_by_idx
  ON public.exam_questions (created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.exam_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  grade_level VARCHAR(32) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  term VARCHAR(30),
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  marking_scheme TEXT,
  instructions TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 10 AND 240),
  total_marks INTEGER NOT NULL DEFAULT 0 CHECK (total_marks BETWEEN 0 AND 200),
  format VARCHAR(20) NOT NULL DEFAULT 'cbe' CHECK (format IN ('cbe', 'kpsea', 'kjsea', 'custom')),
  source_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_papers_school_created_idx
  ON public.exam_papers (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_papers_subject_grade_idx
  ON public.exam_papers (subject, grade_level);

CREATE TABLE IF NOT EXISTS public.curriculum_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(255) NOT NULL,
  source_url TEXT,
  source_type VARCHAR(40) NOT NULL DEFAULT 'curriculum_design',
  license_status VARCHAR(40) NOT NULL DEFAULT 'pending_review'
    CHECK (license_status IN ('official_public', 'licensed', 'school_owned', 'permission_granted', 'pending_review', 'rejected')),
  retrieval_status VARCHAR(30) NOT NULL DEFAULT 'pending_review'
    CHECK (retrieval_status IN ('pending_review', 'approved', 'rejected', 'disabled')),
  terms_reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_url)
);

CREATE TABLE IF NOT EXISTS public.exam_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
  source_name VARCHAR(255) NOT NULL,
  content_summary TEXT NOT NULL CHECK (char_length(content_summary) <= 5000),
  subject VARCHAR(100),
  grade_level VARCHAR(32),
  strand VARCHAR(180),
  sub_strand VARCHAR(180),
  topic VARCHAR(180),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_knowledge_chunks_lookup_idx
  ON public.exam_knowledge_chunks (is_approved, subject, grade_level, strand);

-- Each school can retain optional images (usually teacher-uploaded) with question links.
CREATE TABLE IF NOT EXISTS public.exam_question_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.exam_questions(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  alt_text VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_question_images_school_idx
  ON public.exam_question_images (school_id, created_at DESC);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_question_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_questions_read_for_school" ON public.exam_questions;
CREATE POLICY "exam_questions_read_for_school" ON public.exam_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.school_id = exam_questions.school_id
    )
  );

DROP POLICY IF EXISTS "exam_questions_write_for_school" ON public.exam_questions;
CREATE POLICY "exam_questions_write_for_school" ON public.exam_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = exam_questions.school_id
        AND p.role IN ('teacher', 'school_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = exam_questions.school_id
        AND p.role IN ('teacher', 'school_admin')
    )
  );

DROP POLICY IF EXISTS "exam_papers_read_for_school" ON public.exam_papers;
CREATE POLICY "exam_papers_read_for_school" ON public.exam_papers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.school_id = exam_papers.school_id
    )
  );

DROP POLICY IF EXISTS "exam_papers_write_for_school" ON public.exam_papers;
CREATE POLICY "exam_papers_write_for_school" ON public.exam_papers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = exam_papers.school_id
        AND p.role IN ('teacher', 'school_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = exam_papers.school_id
        AND p.role IN ('teacher', 'school_admin')
    )
  );

DROP POLICY IF EXISTS "approved_knowledge_read" ON public.exam_knowledge_chunks;
CREATE POLICY "approved_knowledge_read" ON public.exam_knowledge_chunks
  FOR SELECT TO authenticated
  USING (is_approved = true);

DROP POLICY IF EXISTS "teacher_read_exam_images" ON public.exam_question_images;
CREATE POLICY "teacher_read_exam_images" ON public.exam_question_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.school_id = exam_question_images.school_id
    )
  );

DROP POLICY IF EXISTS "teacher_write_exam_images" ON public.exam_question_images;
CREATE POLICY "teacher_write_exam_images" ON public.exam_question_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = exam_question_images.school_id
        AND p.role IN ('teacher', 'school_admin')
    )
  );

-- Source records and unapproved material are administered only by privileged server-side workflows.
DROP POLICY IF EXISTS "no_direct_source_reads" ON public.curriculum_sources;
CREATE POLICY "no_direct_source_reads" ON public.curriculum_sources
  FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS "no_direct_source_writes" ON public.curriculum_sources;
CREATE POLICY "no_direct_source_writes" ON public.curriculum_sources
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
