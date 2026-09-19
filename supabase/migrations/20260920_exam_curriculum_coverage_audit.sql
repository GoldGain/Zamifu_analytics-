-- Read-only curriculum coverage audit for the exam generator.
CREATE OR REPLACE VIEW public.exam_curriculum_coverage AS
SELECT subject, grade_level, strand, sub_strand, count(*) AS chunk_count, bool_or(is_approved) AS has_approved
FROM public.exam_knowledge_chunks
GROUP BY subject, grade_level, strand, sub_strand;

CREATE OR REPLACE FUNCTION public.exam_curriculum_gaps()
RETURNS TABLE (subject text, grade_level text, strand text)
LANGUAGE sql STABLE AS $$
  SELECT c.subject, c.grade_level, c.strand
  FROM public.exam_curriculum_coverage c
  LEFT JOIN public.exam_curriculum_coverage a
    ON a.subject = c.subject AND a.grade_level = c.grade_level AND a.strand = c.strand AND a.has_approved
  WHERE a.subject IS NULL
  ORDER BY c.subject, c.grade_level, c.strand;
$$;
GRANT SELECT ON public.exam_curriculum_coverage TO authenticated;
GRANT EXECUTE ON FUNCTION public.exam_curriculum_gaps() TO authenticated;
