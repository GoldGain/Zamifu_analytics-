-- Zamifu Assessment Studio foundation
-- Adds versioning, review, validation, visual-asset, generation-job, and audit records
-- without replacing the existing exam-generation tables.

ALTER TABLE public.exam_papers
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'approved', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
  ADD COLUMN IF NOT EXISTS parent_paper_id UUID REFERENCES public.exam_papers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS learning_outcome VARCHAR(500),
  ADD COLUMN IF NOT EXISTS competency VARCHAR(180),
  ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(80),
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'reviewed', 'approved', 'flagged', 'archived')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.exam_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'generating', 'validating', 'ready', 'failed', 'cancelled')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_paper_id UUID REFERENCES public.exam_papers(id) ON DELETE SET NULL,
  provider VARCHAR(80),
  model VARCHAR(120),
  error_message TEXT,
  idempotency_key VARCHAR(180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (created_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.exam_paper_question_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES public.exam_papers(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.exam_questions(id) ON DELETE SET NULL,
  question_order INTEGER NOT NULL CHECK (question_order > 0),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paper_id, question_order)
);

CREATE TABLE IF NOT EXISTS public.exam_question_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'approved', 'flagged', 'archived')),
  notes TEXT,
  validation_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_visual_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.exam_questions(id) ON DELETE SET NULL,
  paper_id UUID REFERENCES public.exam_papers(id) ON DELETE SET NULL,
  asset_type VARCHAR(30) NOT NULL DEFAULT 'illustration'
    CHECK (asset_type IN ('diagram', 'map', 'chart', 'graph', 'shape', 'flowchart', 'illustration', 'table', 'number_line')),
  source_kind VARCHAR(30) NOT NULL DEFAULT 'generated'
    CHECK (source_kind IN ('generated', 'school_owned', 'official_public', 'licensed', 'permission_granted')),
  storage_path TEXT,
  visual_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  alt_text VARCHAR(500),
  caption VARCHAR(500),
  attribution TEXT,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'approved', 'rejected', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_papers_status_idx
  ON public.exam_papers (school_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_questions_review_status_idx
  ON public.exam_questions (school_id, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_generation_jobs_school_idx
  ON public.exam_generation_jobs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_snapshots_paper_idx
  ON public.exam_paper_question_snapshots (paper_id, question_order);
CREATE INDEX IF NOT EXISTS exam_reviews_question_idx
  ON public.exam_question_reviews (question_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS exam_visual_assets_school_idx
  ON public.exam_visual_assets (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_audit_events_school_idx
  ON public.exam_audit_events (school_id, created_at DESC);

ALTER TABLE public.exam_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_paper_question_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_question_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_visual_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_jobs_school_access" ON public.exam_generation_jobs;
CREATE POLICY "exam_jobs_school_access" ON public.exam_generation_jobs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.school_id = exam_generation_jobs.school_id
      AND p.role IN ('teacher', 'school_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.school_id = exam_generation_jobs.school_id
      AND p.role IN ('teacher', 'school_admin')
  ));

DROP POLICY IF EXISTS "exam_snapshots_school_access" ON public.exam_paper_question_snapshots;
CREATE POLICY "exam_snapshots_school_access" ON public.exam_paper_question_snapshots
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exam_papers paper
    JOIN public.profiles p ON p.school_id = paper.school_id
    WHERE paper.id = exam_paper_question_snapshots.paper_id AND p.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exam_papers paper
    JOIN public.profiles p ON p.school_id = paper.school_id
    WHERE paper.id = exam_paper_question_snapshots.paper_id AND p.id = auth.uid()
  ));

DROP POLICY IF EXISTS "exam_reviews_school_access" ON public.exam_question_reviews;
CREATE POLICY "exam_reviews_school_access" ON public.exam_question_reviews
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exam_questions q
    JOIN public.profiles p ON p.school_id = q.school_id
    WHERE q.id = exam_question_reviews.question_id AND p.id = auth.uid()
      AND p.role IN ('teacher', 'school_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exam_questions q
    JOIN public.profiles p ON p.school_id = q.school_id
    WHERE q.id = exam_question_reviews.question_id AND p.id = auth.uid()
      AND p.role IN ('teacher', 'school_admin')
  ));

DROP POLICY IF EXISTS "exam_visual_assets_school_access" ON public.exam_visual_assets;
CREATE POLICY "exam_visual_assets_school_access" ON public.exam_visual_assets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.school_id = exam_visual_assets.school_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.school_id = exam_visual_assets.school_id
      AND p.role IN ('teacher', 'school_admin')
  ));

DROP POLICY IF EXISTS "exam_audit_events_school_read" ON public.exam_audit_events;
CREATE POLICY "exam_audit_events_school_read" ON public.exam_audit_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.school_id = exam_audit_events.school_id
  ));

DROP POLICY IF EXISTS "exam_audit_events_school_insert" ON public.exam_audit_events;
CREATE POLICY "exam_audit_events_school_insert" ON public.exam_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.school_id = exam_audit_events.school_id
  ));

COMMENT ON TABLE public.exam_generation_jobs IS 'Auditable Assessment Studio generation jobs with idempotency and validation state.';
COMMENT ON TABLE public.exam_visual_assets IS 'Stable, reviewable diagrams, maps, charts, and other exam visuals.';
COMMENT ON TABLE public.exam_paper_question_snapshots IS 'Immutable question payloads captured at paper version approval time.';
