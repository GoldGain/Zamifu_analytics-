ALTER TABLE public.exam_papers
  DROP CONSTRAINT IF EXISTS exam_papers_format_check;

ALTER TABLE public.exam_papers
  ADD CONSTRAINT exam_papers_format_check
  CHECK (format IN ('cbe', 'kpsea', 'kjsea', 'custom', 'standard30'));
