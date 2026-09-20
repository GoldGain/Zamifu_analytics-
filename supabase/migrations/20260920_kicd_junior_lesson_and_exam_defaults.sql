-- KICD Junior School curriculum defaults (grades 7-9)
--
-- Adds the weekly lesson-allocation defaults from each KICD curriculum design,
-- the KNEC KJSEA paper durations, and the strands/sub-strands for the learning
-- areas whose designs had none on record (Christian and Islamic Religious
-- Education). Idempotent: safe to re-run. Nothing is deleted.

ALTER TABLE public.curriculum_subjects ADD COLUMN IF NOT EXISTS default_lessons_per_week integer;

CREATE TABLE IF NOT EXISTS public.curriculum_lesson_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_number integer,
  subject_name text NOT NULL,
  lessons_per_week integer NOT NULL,
  source text NOT NULL DEFAULT 'KICD Junior School Curriculum Design',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_lesson_defaults_grade_subject_key UNIQUE (grade_number, subject_name)
);

CREATE TABLE IF NOT EXISTS public.exam_paper_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name text NOT NULL,
  grade_number integer,
  paper_type text NOT NULL,
  duration_minutes integer,
  total_marks integer,
  source text NOT NULL DEFAULT 'KNEC 2026 KJSEA Timetable & Instructions',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_paper_defaults_subject_grade_paper_key UNIQUE (subject_name, grade_number, paper_type)
);

ALTER TABLE public.curriculum_lesson_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_paper_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read curriculum_lesson_defaults" ON public.curriculum_lesson_defaults;
CREATE POLICY "Public read curriculum_lesson_defaults" ON public.curriculum_lesson_defaults FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read exam_paper_defaults" ON public.exam_paper_defaults;
CREATE POLICY "Public read exam_paper_defaults" ON public.exam_paper_defaults FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS curriculum_subjects_grade_name_idx ON public.curriculum_subjects (grade_id, subject_name);

-- Lesson allocation, as printed in every design's "LESSON ALLOCATION AT JUNIOR SCHOOL" table.
INSERT INTO public.curriculum_lesson_defaults (grade_number, subject_name, lessons_per_week, source) VALUES
  (7,'English',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Kiswahili',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Mathematics',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Integrated Science',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Pre-Technical Studies',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Social Studies',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Agriculture and Nutrition',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Creative Arts and Sports',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Christian Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Islamic Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (7,'Pastoral/Religious Instruction',1,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'English',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Kiswahili',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Mathematics',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Integrated Science',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Pre-Technical Studies',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Social Studies',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Agriculture and Nutrition',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Creative Arts and Sports',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Christian Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Islamic Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (8,'Pastoral/Religious Instruction',1,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'English',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Kiswahili',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Mathematics',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Integrated Science',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Pre-Technical Studies',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Social Studies',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Agriculture and Nutrition',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Creative Arts and Sports',5,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Christian Religious Education',4,'KICD Junior School Curriculum Design (lesson allocation table)'),
  -- The Grade 9 IRE design prints Religious Education at 5 lessons (and adds Physical
  -- Education and Sports at 2), unlike every other design. Recorded as printed.
  (9,'Islamic Religious Education',5,'KICD Junior School Curriculum Design, Grade 9 IRE (lesson allocation table)'),
  (9,'Pastoral/Religious Instruction',1,'KICD Junior School Curriculum Design (lesson allocation table)'),
  (9,'Physical Education and Sports',2,'KICD Junior School Curriculum Design, Grade 9 IRE (lesson allocation table)')
ON CONFLICT (grade_number, subject_name) DO UPDATE
  SET lessons_per_week = EXCLUDED.lessons_per_week, updated_at = now();

-- Mirror onto curriculum_subjects so the value is readable per subject row.
UPDATE public.curriculum_subjects s
   SET default_lessons_per_week = d.lessons_per_week
  FROM public.curriculum_lesson_defaults d
  JOIN public.curriculum_grades g ON g.grade_number = d.grade_number
 WHERE s.grade_id = g.id AND btrim(s.subject_name) = btrim(d.subject_name);

-- Exam paper durations, from the 2026 KJSEA timetable. Paper codes:
-- 901/1, 901/2 English | 902/1, 902/2 Kiswahili | 903 Mathematics
-- 905/1, 905/2 Integrated Science | 906/1 Agriculture | 907 Social Studies
-- 908 CRE | 909 IRE | 910 HRE | 911/2 Creative Arts and Sports
-- 912/1 Pre-Technical Studies. 904/1, 904/2 Kenyan Sign Language.
-- Project papers (911/1, 912/2, 906/2) are stated as a period, not minutes, so no
-- duration is invented for them.
INSERT INTO public.exam_paper_defaults (subject_name, grade_number, paper_type, duration_minutes, total_marks, source) VALUES
  ('English',9,'Paper 1',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('English',9,'Paper 2',105,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Kiswahili',9,'Paper 1',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Kiswahili',9,'Paper 2',105,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Kenyan Sign Language',9,'Paper 1',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Kenyan Sign Language',9,'Paper 2',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Mathematics',9,'Standard',120,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Integrated Science',9,'Paper 1',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Integrated Science',9,'Paper 2',60,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Agriculture and Nutrition',9,'Paper 1',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Social Studies',9,'Standard',90,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Christian Religious Education',9,'Standard',90,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Islamic Religious Education',9,'Standard',90,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Hindu Religious Education',9,'Standard',90,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Creative Arts and Sports',9,'Paper 2',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Pre-Technical Studies',9,'Paper 1',100,NULL,'KNEC 2026 KJSEA Timetable & Instructions'),
  ('Agriculture and Nutrition',9,'Paper 2',NULL,NULL,'KNEC 2026 KJSEA Timetable (project paper: stated as a period, not minutes)'),
  ('Creative Arts and Sports',9,'Paper 1',NULL,NULL,'KNEC 2026 KJSEA Timetable (project paper: stated as a period, not minutes)'),
  ('Pre-Technical Studies',9,'Paper 2',NULL,NULL,'KNEC 2026 KJSEA Timetable (project paper: stated as a period, not minutes)')
ON CONFLICT (subject_name, grade_number, paper_type) DO UPDATE
  SET duration_minutes = EXCLUDED.duration_minutes, updated_at = now();

-- Source tagging.
INSERT INTO public.curriculum_sources (id, source_name, source_url, source_type, license_status, retrieval_status, notes) VALUES
  (gen_random_uuid(),'KICD Junior School Curriculum Design - Christian Religious Education Grade 7','https://uploads.codewords.ai/c04fad5fe379065461d6f7c5290454e2e3f701d7751a77290dafd5b3b3d09e5e/GRADE.7.CRE_.pdf','official_design','official_public','approved','6 strands, 18 sub-strands extracted (Task A)'),
  (gen_random_uuid(),'KICD Junior School Curriculum Design - Christian Religious Education Grade 9','https://uploads.codewords.ai/cc5054d1e0160a5bb8bee6ebab954d30e8f4077cbc896ce7388171ed7d266e24/GRADE.9.CRE_.pdf','official_design','official_public','approved','5 strands, 16 sub-strands extracted (Task A)'),
  (gen_random_uuid(),'KICD Junior School Curriculum Design - Islamic Religious Education Grade 7','https://uploads.codewords.ai/3b28d1617dc8408dfb1a573adf08e293576f1eae023a04a862494d3e28398a33/GRADE.7.IRE_.pdf','official_design','official_public','approved','7 strands, 16 sub-strands extracted (Task A)'),
  (gen_random_uuid(),'KICD Junior School Curriculum Design - Islamic Religious Education Grade 9','https://uploads.codewords.ai/f6800610a445442b53516894b458f2ca4553ba849664fa06f2067f726ecaa09d/GRADE.9.IRE_.edit_.pdf','official_design','official_public','approved','7 strands, 20 sub-strands extracted; numbering taken from the design''s SUMMARY OF STRANDS AND SUB-STRANDS'),
  (gen_random_uuid(),'KNEC 2026 KJSEA Timetable & Instructions','https://uploads.codewords.ai/1dbcda5c46ea0fe65bbf296f392bb5d135dc7f238ad445d2afdbaae94bb4611f/2026-KJSEA-TIMETABLE.pdf','official_design','official_public','approved','Exam paper durations (Task C) for grade 9 subjects')
ON CONFLICT (source_url) DO UPDATE
  SET source_name = EXCLUDED.source_name, notes = EXCLUDED.notes, updated_at = now();
