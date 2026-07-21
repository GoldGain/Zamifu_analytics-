-- Zamifu Pathway Finder / Junior School / Exam Generator improvements
-- Safe, idempotent migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS junior_school_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name VARCHAR(100) NOT NULL,
  description TEXT,
  pathway_link VARCHAR(50),
  grade_level VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS junior_school_subjects_name_uidx
  ON junior_school_subjects (subject_name);

INSERT INTO junior_school_subjects (subject_name, description, pathway_link)
VALUES
  ('Mathematics', 'Builds skills in numbers, algebra, geometry, and problem-solving', 'STEM'),
  ('English', 'Focuses on reading, writing, and speaking English effectively', 'Social Sciences'),
  ('Kiswahili', 'Focuses on reading, writing, and speaking Kiswahili', 'Social Sciences'),
  ('Integrated Science', 'Combines General Science, Biology, Chemistry, and Physics', 'STEM'),
  ('Pre-Technical Studies', 'Equips learners with skills in computers, business, and technical trades', 'STEM'),
  ('Social Studies', 'Teaches history, geography, citizenship, and life skills', 'Social Sciences'),
  ('Agriculture and Nutrition', 'Blends farming practices with health and home science', 'STEM'),
  ('Creative Arts and Sports', 'Encourages talent through music, art, crafts, and physical education', 'Creative Arts and Sports'),
  ('Religious Education', 'CRE, IRE, or HRE to build morals and values', 'Social Sciences')
ON CONFLICT (subject_name) DO UPDATE
SET description = EXCLUDED.description,
    pathway_link = EXCLUDED.pathway_link;

CREATE TABLE IF NOT EXISTS pathway_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_name VARCHAR(50) NOT NULL,
  interest_text TEXT NOT NULL,
  interest_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level VARCHAR(10) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  strand VARCHAR(100) NOT NULL,
  sub_strand VARCHAR(100) NOT NULL,
  question_type VARCHAR(20),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  marking_scheme TEXT,
  image_url VARCHAR(500),
  difficulty VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grading_system (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_code VARCHAR(3) NOT NULL,
  description VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL,
  level VARCHAR(20)
);

CREATE UNIQUE INDEX IF NOT EXISTS grading_system_code_level_uidx
  ON grading_system (grade_code, level);

INSERT INTO grading_system (grade_code, description, points, level) VALUES
  ('EE1', 'Exceeding Expectations (1)', 8, 'junior'),
  ('EE2', 'Exceeding Expectations (2)', 7, 'junior'),
  ('ME1', 'Meeting Expectations (1)', 6, 'junior'),
  ('ME2', 'Meeting Expectations (2)', 5, 'junior'),
  ('AE1', 'Approaching Expectations (1)', 4, 'junior'),
  ('AE2', 'Approaching Expectations (2)', 3, 'junior'),
  ('BE1', 'Below Expectations (1)', 2, 'junior'),
  ('BE2', 'Below Expectations (2)', 1, 'junior')
ON CONFLICT (grade_code, level) DO UPDATE
SET description = EXCLUDED.description,
    points = EXCLUDED.points;

-- Optional payment tracking on student_results when table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_results'
  ) THEN
    ALTER TABLE student_results ADD COLUMN IF NOT EXISTS payment_status BOOLEAN DEFAULT FALSE;
    ALTER TABLE student_results ADD COLUMN IF NOT EXISTS payment_amount INTEGER DEFAULT 20;
    ALTER TABLE student_results ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
    ALTER TABLE student_results ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pathway_result_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(120),
  amount INTEGER DEFAULT 20,
  currency VARCHAR(8) DEFAULT 'KES',
  pathway_name VARCHAR(120),
  status VARCHAR(30) DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT now()
);
