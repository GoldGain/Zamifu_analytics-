-- A learner may have results for the same school-wide assessment while enrolled
-- in different grades/classes at different times. Keep those result rows distinct.
-- The previous indexes omitted class_id and blocked Grade 8 uploads when the same
-- learner already had marks for that subject/term/assessment in Grade 7.
DROP INDEX IF EXISTS public.idx_results_unique_exam;
DROP INDEX IF EXISTS public.results_student_subject_term_exam_idx;

CREATE UNIQUE INDEX results_student_subject_term_exam_idx
  ON public.results (student_id, class_id, subject_id, term_id, exam_id)
  WHERE exam_id IS NOT NULL;
