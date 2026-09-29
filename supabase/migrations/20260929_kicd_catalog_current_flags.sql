-- Active-catalog flags and source provenance for the Grade 7-9 KICD rebuild.
ALTER TABLE public.curriculum_subjects
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
ALTER TABLE public.curriculum_subjects
  ADD COLUMN IF NOT EXISTS curriculum_source_id uuid REFERENCES public.curriculum_sources(id) ON DELETE SET NULL;
ALTER TABLE public.curriculum_strands
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
ALTER TABLE public.curriculum_sub_strands
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS curriculum_subjects_current_grade_idx
  ON public.curriculum_subjects (grade_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS curriculum_strands_current_subject_idx
  ON public.curriculum_strands (subject_id, strand_order) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS curriculum_sub_strands_current_strand_idx
  ON public.curriculum_sub_strands (strand_id, sub_strand_order) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS curriculum_subjects_source_idx
  ON public.curriculum_subjects (curriculum_source_id);
