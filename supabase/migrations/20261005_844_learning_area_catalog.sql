-- Separate the legacy 8-4-4 Form 3/4 learning-area catalogue from CBE Senior School.
-- Existing learning areas, results, and school selections are left untouched.
BEGIN;

ALTER TABLE public.learning_area_catalog
  DROP CONSTRAINT IF EXISTS learning_area_catalog_level_check;

ALTER TABLE public.learning_area_catalog
  ADD CONSTRAINT learning_area_catalog_level_check
  CHECK (level IN ('pre_school', 'lower_primary', 'upper_primary', 'junior', 'senior', 'senior_844'));

INSERT INTO public.learning_area_catalog (level, name, display_order)
VALUES
  ('senior', 'Mathematics A', 42),
  ('senior', 'Mathematics B', 43),
  ('senior_844', 'English', 1),
  ('senior_844', 'Kiswahili / Kenya Sign Language (KSL)', 2),
  ('senior_844', 'Mathematics A', 3),
  ('senior_844', 'Mathematics B', 4),
  ('senior_844', 'Biology', 5),
  ('senior_844', 'Physics', 6),
  ('senior_844', 'Chemistry', 7),
  ('senior_844', 'General Science', 8),
  ('senior_844', 'Biological Science', 9),
  ('senior_844', 'History and Government', 10),
  ('senior_844', 'Geography', 11),
  ('senior_844', 'CRE', 12),
  ('senior_844', 'IRE', 13),
  ('senior_844', 'HRE', 14),
  ('senior_844', 'Agriculture', 15),
  ('senior_844', 'Home Science', 16),
  ('senior_844', 'Computer Studies', 17),
  ('senior_844', 'Woodwork', 18),
  ('senior_844', 'Metalwork', 19),
  ('senior_844', 'Building Construction', 20),
  ('senior_844', 'Power Mechanics', 21),
  ('senior_844', 'Drawing and Design', 22),
  ('senior_844', 'Aviation Technology', 23),
  ('senior_844', 'Electricity', 24),
  ('senior_844', 'French', 25),
  ('senior_844', 'German', 26),
  ('senior_844', 'Arabic', 27),
  ('senior_844', 'Music', 28),
  ('senior_844', 'Art and Design', 29),
  ('senior_844', 'Business Studies', 30)
ON CONFLICT (level, name) DO UPDATE
SET display_order = EXCLUDED.display_order;

COMMIT;
