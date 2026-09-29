-- Curriculum Navigator uses the official two-level hierarchy only:
-- strand -> sub-strand. Keep legacy topic_id columns and rows intact for
-- backwards compatibility; new UI reads/writes the direct sub_strand_id links.

ALTER TABLE public.curriculum_topic_progress
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid REFERENCES public.curriculum_sub_strands(id) ON DELETE SET NULL;
ALTER TABLE public.curriculum_resources
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid REFERENCES public.curriculum_sub_strands(id) ON DELETE SET NULL;
ALTER TABLE public.curriculum_schemes_of_work
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid REFERENCES public.curriculum_sub_strands(id) ON DELETE SET NULL;
ALTER TABLE public.curriculum_lesson_plans
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid REFERENCES public.curriculum_sub_strands(id) ON DELETE SET NULL;
ALTER TABLE public.curriculum_questions
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid REFERENCES public.curriculum_sub_strands(id) ON DELETE SET NULL;

-- Preserve each old curriculum link by deriving its parent sub-strand from the
-- existing topic row; this is a data copy, not a deletion or reassignment.
UPDATE public.curriculum_topic_progress p
SET sub_strand_id = t.sub_strand_id
FROM public.curriculum_topics t
WHERE p.topic_id = t.id AND p.sub_strand_id IS NULL;

UPDATE public.curriculum_resources r
SET sub_strand_id = t.sub_strand_id
FROM public.curriculum_topics t
WHERE r.topic_id = t.id AND r.sub_strand_id IS NULL;

UPDATE public.curriculum_schemes_of_work s
SET sub_strand_id = t.sub_strand_id
FROM public.curriculum_topics t
WHERE s.topic_id = t.id AND s.sub_strand_id IS NULL;

UPDATE public.curriculum_lesson_plans l
SET sub_strand_id = t.sub_strand_id
FROM public.curriculum_topics t
WHERE l.topic_id = t.id AND l.sub_strand_id IS NULL;

UPDATE public.curriculum_questions q
SET sub_strand_id = t.sub_strand_id
FROM public.curriculum_topics t
WHERE q.topic_id = t.id AND q.sub_strand_id IS NULL;

CREATE INDEX IF NOT EXISTS curriculum_topic_progress_sub_strand_idx
  ON public.curriculum_topic_progress(sub_strand_id);
CREATE INDEX IF NOT EXISTS curriculum_resources_sub_strand_idx
  ON public.curriculum_resources(sub_strand_id);
CREATE INDEX IF NOT EXISTS curriculum_schemes_of_work_sub_strand_idx
  ON public.curriculum_schemes_of_work(sub_strand_id);
CREATE INDEX IF NOT EXISTS curriculum_lesson_plans_sub_strand_idx
  ON public.curriculum_lesson_plans(sub_strand_id);
CREATE INDEX IF NOT EXISTS curriculum_questions_sub_strand_idx
  ON public.curriculum_questions(sub_strand_id);
