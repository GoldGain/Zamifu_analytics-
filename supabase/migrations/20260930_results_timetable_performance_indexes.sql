-- Performance indexes for the tenant-scoped Results and timetable paths.
-- Every index is additive and guarded so the migration is safe to replay.

CREATE INDEX IF NOT EXISTS results_school_class_term_exam_idx
  ON public.results (school_id, class_id, term_id, exam_id);

CREATE INDEX IF NOT EXISTS results_school_exam_student_subject_idx
  ON public.results (school_id, exam_id, student_id, subject_id)
  WHERE exam_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS results_school_student_term_idx
  ON public.results (school_id, student_id, term_id);

CREATE INDEX IF NOT EXISTS students_school_class_active_idx
  ON public.students (school_id, class_id, is_active);

CREATE INDEX IF NOT EXISTS students_school_stream_active_idx
  ON public.students (school_id, stream_id, is_active)
  WHERE stream_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS teacher_assignments_school_teacher_subject_class_idx
  ON public.teacher_subject_assignments (school_id, teacher_id, subject_id, class_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS timetable_entries_school_class_day_slot_idx
  ON public.timetable_entries (school_id, class_id, day_of_week, time_slot_id);

CREATE INDEX IF NOT EXISTS timetable_entries_school_teacher_day_slot_idx
  ON public.timetable_entries (school_id, teacher_id, day_of_week, time_slot_id)
  WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_school_created_at_idx
  ON public.audit_logs (school_id, created_at DESC);

-- exam_papers stores the term as text (there is no term_id column in the live schema).
CREATE INDEX IF NOT EXISTS exam_papers_school_term_year_idx
  ON public.exam_papers (school_id, term, year);
