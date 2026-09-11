-- 20260911_stream_dashboard_gaps.sql
-- Additive, idempotent migration for the Stream Dashboard feature.
-- The 'stream' column already exists on classes in most deployments; the
-- guards below make this safe to run anywhere (including fresh databases).

-- Ensure classes support stream names (e.g. Grade 7 West / East / North / South)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS stream TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS stream_name TEXT;

-- Learners-level stream override (rare; most schools model streams as class rows)
ALTER TABLE students ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES classes(id) ON DELETE SET NULL;

-- Performance indexes used heavily by the Stream Dashboard queries
CREATE INDEX IF NOT EXISTS idx_results_class_term ON results (class_id, term_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results (student_id);
CREATE INDEX IF NOT EXISTS idx_results_exam ON results (exam_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students (class_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_active ON classes (school_id, is_active);
