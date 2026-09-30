-- exam_papers stores the term as text (the live schema has no term_id column).
CREATE INDEX IF NOT EXISTS exam_papers_school_term_year_idx
  ON public.exam_papers (school_id, term, year);
