-- Source-verified KICD curriculum seed for Grade 1–8.
-- Primary index provenance:
--   Lower Primary: https://kicd.ac.ke/cbc-materials/lower-primary/
--   Grade 4: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/
--   Grade 5: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/
--   Grade 6: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
--   Grade 7: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
--   Grade 8: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive source IDs used in this batch:
--   Lower Primary Mathematics 1YlwoCFAVxhjUo_V1A-89GRcho0r0Gq1u
--   Lower Primary Environmental Activities 1aw6VOZadfc1cFTa0x4o4ztzdorLY8xUS
--   Lower Primary English Activities 10KIOCSmh7CyDbjElisPQeeMTLu8AJI9z
--   Grade 5 Mathematics 1ShOUex4qEQosDCvkKdaXIRvteOILPHTP
--   Grade 5 Science and Technology 1CituzlfluxqVvjExx7xHiV_j_ZDXwpja
--   Grade 6 Science and Technology 1Cqoxx-afRo1d3DdjdCY8l5STD1lXJhJI
--   Grade 7 Integrated Science 1jbicj1qkLFEV_ZXwO8Kmlw7KzGhZD2ri
--   Grade 8 Integrated Science 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v
--
-- The database has no natural-key constraints on these tables. Every insert below
-- therefore uses normalized parent lookups and NOT EXISTS sibling checks so it is
-- safe to run repeatedly and preserves existing rows.

BEGIN;

-- Missing grade rows are added without changing existing grade metadata.
INSERT INTO curriculum_grades (grade_number, grade_name, curriculum_type)
SELECT v.grade_number, v.grade_name, 'CBC'
FROM (VALUES
  (1, 'Grade 1'), (2, 'Grade 2'), (3, 'Grade 3'), (4, 'Grade 4'),
  (5, 'Grade 5'), (6, 'Grade 6'), (7, 'Grade 7'), (8, 'Grade 8')
) AS v(grade_number, grade_name)
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_grades g WHERE g.grade_number = v.grade_number
);

-- Only source-backed learning areas used by this verified batch are created.
INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, v.subject_name, v.subject_code
FROM (VALUES
  (1, 'English', 'ENG'), (1, 'Mathematics', 'MAT'), (1, 'Environmental Activities', 'ENV'),
  (2, 'English', 'ENG'), (2, 'Mathematics', 'MAT'), (2, 'Environmental Activities', 'ENV'),
  (3, 'English', 'ENG'), (3, 'Mathematics', 'MAT'), (3, 'Environmental Activities', 'ENV'),
  (4, 'Mathematics', 'MAT'), (4, 'Science and Technology', 'SCI'),
  (5, 'Mathematics', 'MAT'), (5, 'Science and Technology', 'SCI'),
  (6, 'Mathematics', 'MAT'), (6, 'Science and Technology', 'SCI'), (6, 'Social Studies', 'SST'),
  (7, 'Integrated Science', 'IS'), (8, 'Integrated Science', 'IS')
) AS v(grade_number, subject_name, subject_code)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_subjects s
  WHERE s.grade_id = g.id
    AND lower(trim(s.subject_name)) = lower(trim(v.subject_name))
);

-- Exact shared Lower Primary Mathematics hierarchy from the official Grade 1–3 design.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 1–3 Mathematics strand.', v.strand_order
FROM (VALUES
  (1, 'Mathematics', 'Numbers', 1), (1, 'Mathematics', 'Measurements', 2), (1, 'Mathematics', 'Geometry', 3),
  (2, 'Mathematics', 'Numbers', 1), (2, 'Mathematics', 'Measurements', 2), (2, 'Mathematics', 'Geometry', 3),
  (3, 'Mathematics', 'Numbers', 1), (3, 'Mathematics', 'Measurements', 2), (3, 'Mathematics', 'Geometry', 3)
) AS v(grade_number, subject_name, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = lower(trim(v.subject_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id = s.id AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 1–3 Mathematics sub-strand.', v.sub_strand_order
FROM (VALUES
  (1, 'Mathematics', 'Numbers', 'Pre-Number Activities', 1), (1, 'Mathematics', 'Numbers', 'Whole', 2),
  (1, 'Mathematics', 'Numbers', 'Addition', 3), (1, 'Mathematics', 'Numbers', 'Subtraction', 4),
  (1, 'Mathematics', 'Measurements', 'Length', 1), (1, 'Mathematics', 'Measurements', 'Mass', 2),
  (1, 'Mathematics', 'Measurements', 'Capacity', 3), (1, 'Mathematics', 'Measurements', 'Time', 4),
  (1, 'Mathematics', 'Measurements', 'Money', 5), (1, 'Mathematics', 'Geometry', 'Lines', 1),
  (1, 'Mathematics', 'Geometry', 'Shapes', 2),
  (2, 'Mathematics', 'Numbers', 'Pre-Number Activities', 1), (2, 'Mathematics', 'Numbers', 'Whole', 2),
  (2, 'Mathematics', 'Numbers', 'Addition', 3), (2, 'Mathematics', 'Numbers', 'Subtraction', 4),
  (2, 'Mathematics', 'Measurements', 'Length', 1), (2, 'Mathematics', 'Measurements', 'Mass', 2),
  (2, 'Mathematics', 'Measurements', 'Capacity', 3), (2, 'Mathematics', 'Measurements', 'Time', 4),
  (2, 'Mathematics', 'Measurements', 'Money', 5), (2, 'Mathematics', 'Geometry', 'Lines', 1),
  (2, 'Mathematics', 'Geometry', 'Shapes', 2),
  (3, 'Mathematics', 'Numbers', 'Pre-Number Activities', 1), (3, 'Mathematics', 'Numbers', 'Whole', 2),
  (3, 'Mathematics', 'Numbers', 'Addition', 3), (3, 'Mathematics', 'Numbers', 'Subtraction', 4),
  (3, 'Mathematics', 'Measurements', 'Length', 1), (3, 'Mathematics', 'Measurements', 'Mass', 2),
  (3, 'Mathematics', 'Measurements', 'Capacity', 3), (3, 'Mathematics', 'Measurements', 'Time', 4),
  (3, 'Mathematics', 'Measurements', 'Money', 5), (3, 'Mathematics', 'Geometry', 'Lines', 1),
  (3, 'Mathematics', 'Geometry', 'Shapes', 2)
) AS v(grade_number, subject_name, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = lower(trim(v.subject_name))
JOIN curriculum_strands st ON st.subject_id = s.id AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id = st.id AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
);

-- Exact Lower Primary Environmental Activities hierarchy extracted from the official design.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 1–3 Environmental Activities strand.', v.strand_order
FROM (VALUES
  (1, 'Social Environment', 1), (1, 'Natural Environment', 2), (1, 'Resources in Our Environment', 3),
  (2, 'Social Environment', 1), (2, 'Natural Environment', 2), (2, 'Resources in Our Environment', 3),
  (3, 'Social Environment', 1), (3, 'Natural Environment', 2), (3, 'Resources in Our Environment', 3)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = 'environmental activities'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id = s.id AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 1–3 Environmental Activities sub-strand.', v.sub_strand_order
FROM (VALUES
  (1, 'Social Environment', 'Cleaning My Body', 1), (1, 'Social Environment', 'Our Home', 2),
  (1, 'Social Environment', 'Family Needs', 3), (1, 'Social Environment', 'School', 4),
  (1, 'Social Environment', 'Market', 5), (1, 'Natural Environment', 'Weather and the Sky', 1),
  (1, 'Natural Environment', 'Soil', 2), (1, 'Natural Environment', 'Sound', 3),
  (1, 'Resources in Our Environment', 'Water', 1), (1, 'Resources in Our Environment', 'Plants', 2),
  (1, 'Resources in Our Environment', 'Animals', 3),
  (2, 'Social Environment', 'Our Home', 1), (2, 'Social Environment', 'Family Needs and Wants', 2),
  (2, 'Social Environment', 'Our School', 3), (2, 'Social Environment', 'Our National Flag', 4),
  (2, 'Social Environment', 'Our Rights and Responsibilities', 5), (2, 'Social Environment', 'Our Market', 6),
  (2, 'Natural Environment', 'Weather', 1), (2, 'Natural Environment', 'Soil', 2), (2, 'Natural Environment', 'Light', 3),
  (2, 'Resources in Our Environment', 'Water', 1), (2, 'Resources in Our Environment', 'Plants', 2),
  (2, 'Resources in Our Environment', 'Animals', 3),
  (3, 'Social Environment', 'Our Living Environment', 1), (3, 'Social Environment', 'Family Needs (Emotional)', 2),
  (3, 'Social Environment', 'Food in Our Environment', 3), (3, 'Social Environment', 'Our Community', 4),
  (3, 'Social Environment', 'Cultural Events', 5), (3, 'Natural Environment', 'Weather', 1),
  (3, 'Natural Environment', 'Soil', 2), (3, 'Natural Environment', 'Heat', 3),
  (3, 'Resources in Our Environment', 'Water', 1), (3, 'Resources in Our Environment', 'Plants', 2),
  (3, 'Resources in Our Environment', 'Animals', 3), (3, 'Resources in Our Environment', 'Waste Materials', 4)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = 'environmental activities'
JOIN curriculum_strands st ON st.subject_id = s.id AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id = st.id AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
);

-- Exact shared Lower Primary English Activities summary labels from the official design.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 1–3 English Language Activities strand.', v.strand_order
FROM (VALUES
  (1, 'Listening and Speaking', 1), (1, 'Reading', 2), (1, 'Language Use', 3), (1, 'Writing', 4),
  (2, 'Listening and Speaking', 1), (2, 'Reading', 2), (2, 'Language Use', 3), (2, 'Writing', 4),
  (3, 'Listening and Speaking', 1), (3, 'Reading', 2), (3, 'Language Use', 3), (3, 'Writing', 4)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = 'english'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id = s.id AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 1–3 English Language Activities sub-strand.', v.sub_strand_order
FROM (VALUES
  (1, 'Listening and Speaking', 'Pronunciation vocabulary', 1), (1, 'Reading', 'Pre-reading', 1),
  (1, 'Reading', 'Word', 2), (1, 'Reading', 'Fluency', 3), (1, 'Reading', 'Comprehension', 4),
  (1, 'Language Use', 'Word classes', 1), (1, 'Language Use', 'Tense', 2), (1, 'Language Use', 'Sentences', 3),
  (1, 'Writing', 'Pre-writing', 1), (1, 'Writing', 'Handwriting', 2), (1, 'Writing', 'Spelling', 3),
  (1, 'Writing', 'Punctuation', 4), (1, 'Writing', 'Guided composition', 5),
  (2, 'Listening and Speaking', 'Pronunciation vocabulary', 1), (2, 'Reading', 'Pre-reading', 1),
  (2, 'Reading', 'Word', 2), (2, 'Reading', 'Fluency', 3), (2, 'Reading', 'Comprehension', 4),
  (2, 'Language Use', 'Word classes', 1), (2, 'Language Use', 'Tense', 2), (2, 'Language Use', 'Sentences', 3),
  (2, 'Writing', 'Pre-writing', 1), (2, 'Writing', 'Handwriting', 2), (2, 'Writing', 'Spelling', 3),
  (2, 'Writing', 'Punctuation', 4), (2, 'Writing', 'Guided composition', 5),
  (3, 'Listening and Speaking', 'Pronunciation vocabulary', 1), (3, 'Reading', 'Pre-reading', 1),
  (3, 'Reading', 'Word', 2), (3, 'Reading', 'Fluency', 3), (3, 'Reading', 'Comprehension', 4),
  (3, 'Language Use', 'Word classes', 1), (3, 'Language Use', 'Tense', 2), (3, 'Language Use', 'Sentences', 3),
  (3, 'Writing', 'Pre-writing', 1), (3, 'Writing', 'Handwriting', 2), (3, 'Writing', 'Spelling', 3),
  (3, 'Writing', 'Punctuation', 4), (3, 'Writing', 'Guided composition', 5)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = 'english'
JOIN curriculum_strands st ON st.subject_id = s.id AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id = st.id AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
);

-- Grade 4 Science and Technology source-verified hierarchy cross-checked against the KICD-printed design.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'KICD Grade 4 Science and Technology source-verified strand.', v.strand_order
FROM (VALUES
  (4, 'Living Things and their Environment', 1), (4, 'Matter', 2), (4, 'Force and Energy', 3)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s ON s.grade_id = g.id AND lower(trim(s.subject_name)) = 'science and technology'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'KICD Grade 4 Science and Technology source-verified sub-strand.', v.sub_strand_order
FROM (VALUES
  (4, 'Living Things and their Environment', 'Plants', 1), (4, 'Living Things and their Environment', 'Animals', 2),
  (4, 'Living Things and their Environment', 'Human Digestive System', 3),
  (4, 'Matter', 'Properties of Matter', 1), (4, 'Matter', 'Management of Solid Waste', 2),
  (4, 'Matter', 'Water Conservation', 3), (4, 'Force and Energy', 'Force and its Effect', 1),
  (4, 'Force and Energy', 'Light', 2), (4, 'Force and Energy', 'Heat', 3)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='science and technology'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

-- Grade 5 Science and Technology exact summary from official KICD Drive file 1CituzlfluxqVvjExx7xHiV_j_ZDXwpja.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 5 Science and Technology strand.', v.strand_order
FROM (VALUES
  (5, 'Living Things and their Environment', 1), (5, 'Matter', 2), (5, 'Force and Energy', 3)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='science and technology'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 5 Science and Technology sub-strand.', v.sub_strand_order
FROM (VALUES
  (5, 'Living Things and their Environment', 'Classification of Plants', 1), (5, 'Living Things and their Environment', 'Invertebrates', 2),
  (5, 'Living Things and their Environment', 'The Human Breathing System', 3), (5, 'Matter', 'Mixtures', 1),
  (5, 'Matter', 'Water Pollution', 2), (5, 'Force and Energy', 'Floating and Sinking', 1),
  (5, 'Force and Energy', 'Sound', 2), (5, 'Force and Energy', 'Heat Transfer', 3)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='science and technology'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

-- Grade 6 Science and Technology exact summary from official KICD Drive file 1Cqoxx-afRo1d3DdjdCY8l5STD1lXJhJI.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 6 Science and Technology strand.', v.strand_order
FROM (VALUES
  (6, 'Living Things and their Environment', 1), (6, 'Matter', 2), (6, 'Force and energy', 3)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='science and technology'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 6 Science and Technology sub-strand.', v.sub_strand_order
FROM (VALUES
  (6, 'Living Things and their Environment', 'Fungi', 1), (6, 'Living Things and their Environment', 'Invertebrates', 2),
  (6, 'Living Things and their Environment', 'Human circulatory system', 3), (6, 'Matter', 'Change of state', 1),
  (6, 'Matter', 'Composition of air', 2), (6, 'Force and energy', 'Light', 1),
  (6, 'Force and energy', 'Levers as simple machines', 2), (6, 'Force and energy', 'Slopes', 3)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='science and technology'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

-- Grade 5 and Grade 6 Mathematics exact summary labels from official KICD designs.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Mathematics strand.', v.strand_order
FROM (VALUES
  (5, 'Numbers', 1), (5, 'Measurement', 2), (5, 'Geometry', 3), (5, 'Data Handling', 4),
  (6, 'Numbers', 1), (6, 'Measurement', 2), (6, 'Geometry', 3), (6, 'Data Handling', 4)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='mathematics'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Mathematics summary sub-strand.', v.sub_strand_order
FROM (VALUES
  (5, 'Numbers', 'Whole', 1), (5, 'Numbers', 'Addition', 2), (5, 'Numbers', 'Subtraction', 3),
  (5, 'Numbers', 'Multiplication', 4), (5, 'Numbers', 'Division', 5), (5, 'Numbers', 'Fractions', 6),
  (5, 'Numbers', 'Decimals', 7), (5, 'Numbers', 'Simple Equations', 8), (5, 'Measurement', 'Length', 1),
  (5, 'Measurement', 'Area', 2), (5, 'Measurement', 'Volume', 3), (5, 'Measurement', 'Capacity', 4),
  (5, 'Measurement', 'Mass', 5), (5, 'Measurement', 'Time', 6), (5, 'Measurement', 'Money', 7),
  (5, 'Geometry', 'Lines', 1), (5, 'Geometry', 'Angles', 2), (5, 'Geometry', 'Three Dimension (3-D) Objects', 3),
  (5, 'Data Handling', 'Representation', 1),
  (6, 'Numbers', 'Whole Numbers', 1), (6, 'Numbers', 'Multiplication', 2), (6, 'Numbers', 'Division', 3),
  (6, 'Numbers', 'Fractions', 4), (6, 'Numbers', 'Decimals', 5), (6, 'Numbers', 'Inequalities', 6),
  (6, 'Measurement', 'Length', 1), (6, 'Measurement', 'Area', 2), (6, 'Measurement', 'Capacity', 3),
  (6, 'Measurement', 'Mass', 4), (6, 'Measurement', 'Time', 5), (6, 'Measurement', 'Money', 6),
  (6, 'Geometry', 'Lines', 1), (6, 'Geometry', 'Angles', 2), (6, 'Geometry', '3-D Objects', 3),
  (6, 'Data Handling', 'Bar Graphs', 1)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='mathematics'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

-- Grade 6 Social Studies exact summary labels from the KICD-printed design cross-check.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'KICD Grade 6 Social Studies source-verified strand.', v.strand_order
FROM (VALUES
  (6, 'Natural and the Built Environments', 1), (6, 'People and Social Organisation', 2),
  (6, 'Resources and Economic Activities in Eastern Africa', 3), (6, 'Political Systems', 4), (6, 'Governance', 5)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'KICD Grade 6 Social Studies source-verified sub-strand.', v.sub_strand_order
FROM (VALUES
  (6, 'Natural and the Built Environments', 'Position and Size of Countries in Eastern Africa', 1),
  (6, 'Natural and the Built Environments', 'Main Physical Features in Eastern Africa', 2),
  (6, 'Natural and the Built Environments', 'Climatic Regions in Eastern Africa', 3),
  (6, 'Natural and the Built Environments', 'Vegetation in Eastern Africa', 4),
  (6, 'Natural and the Built Environments', 'Historic Built Environments', 5),
  (6, 'People and Social Organisation', 'Language Groups in Eastern Africa', 1),
  (6, 'People and Social Organisation', 'Population Distribution in Eastern Africa', 2),
  (6, 'People and Social Organisation', 'Culture and Social Organisation', 3),
  (6, 'People and Social Organisation', 'School and Community', 4),
  (6, 'Resources and Economic Activities in Eastern Africa', 'Beef Farming', 1),
  (6, 'Resources and Economic Activities in Eastern Africa', 'Fishing', 2),
  (6, 'Resources and Economic Activities in Eastern Africa', 'Wildlife and Tourism', 3),
  (6, 'Resources and Economic Activities in Eastern Africa', 'Transport', 4),
  (6, 'Resources and Economic Activities in Eastern Africa', 'Communication', 5),
  (6, 'Resources and Economic Activities in Eastern Africa', 'Mining', 6),
  (6, 'Political Systems', 'Traditional Forms of Government', 1), (6, 'Political Systems', 'Regional Co-operations', 2),
  (6, 'Political Systems', 'Citizenship', 3), (6, 'Political Systems', 'Human Rights', 4),
  (6, 'Governance', 'Peace and Conflict Resolution', 1), (6, 'Governance', 'Government Revenue and Expenditure', 2),
  (6, 'Governance', 'Preamble of the Constitution of Kenya', 3)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='social studies'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

-- Grade 7 Integrated Science revised-2024 hierarchy; deliberately additive and never relabels old generic rows.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 7 Integrated Science revised-2024 strand.', v.strand_order
FROM (VALUES
  (7, 'Scientific Investigation', 1), (7, 'Mixtures, Elements and Compounds', 2),
  (7, 'Living Things and the Environment', 3), (7, 'Force and Energy', 4)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='integrated science'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 7 Integrated Science revised-2024 sub-strand.', v.sub_strand_order
FROM (VALUES
  (7, 'Scientific Investigation', 'Introduction to Integrated Science', 1), (7, 'Scientific Investigation', 'Laboratory Safety', 2),
  (7, 'Scientific Investigation', 'Laboratory Apparatus and Instruments', 3),
  (7, 'Mixtures, Elements and Compounds', 'Mixtures', 1), (7, 'Mixtures, Elements and Compounds', 'Acids, Bases and Indicators', 2),
  (7, 'Living Things and the Environment', 'Human Reproductive System', 1), (7, 'Living Things and the Environment', 'Human Excretory System', 2),
  (7, 'Force and Energy', 'Electrical Energy', 1), (7, 'Force and Energy', 'Magnetism', 2)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='integrated science'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

-- Grade 8 Integrated Science revised-2024 hierarchy from official KICD Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 Integrated Science revised-2024 strand.', v.strand_order
FROM (VALUES
  (8, 'Mixtures, Elements and Compounds', 1), (8, 'Living Things and their Environment', 2), (8, 'Force and Energy', 3)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='integrated science'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)));

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 Integrated Science revised-2024 sub-strand.', v.sub_strand_order
FROM (VALUES
  (8, 'Mixtures, Elements and Compounds', 'Atoms, elements, molecules and compounds', 1),
  (8, 'Mixtures, Elements and Compounds', 'Physical and chemical changes', 2),
  (8, 'Mixtures, Elements and Compounds', 'Classes of fire', 3),
  (8, 'Living Things and their Environment', 'The Cell', 1),
  (8, 'Living Things and their Environment', 'Movement of Materials in and out of the Cell', 2),
  (8, 'Living Things and their Environment', 'Reproduction in Human Beings', 3),
  (8, 'Force and Energy', 'Transformation of Energy', 1), (8, 'Force and Energy', 'Pressure', 2)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='integrated science'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)));

-- Topic rows are explicit content headings/phrases extracted from the designs. They are
-- intentionally attached through parent-name lookups and never create orphan children.
INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], v.topic_order
FROM (VALUES
  -- Lower Primary Mathematics, official Grade 1–3 design
  (1,'Mathematics','Numbers','Pre-Number Activities','Sorting and matching objects','Sorting and matching objects; ordering; creating patterns.',1),
  (1,'Mathematics','Numbers','Pre-Number Activities','Ordering','Ordering objects by the criteria shown in the design.',2),
  (1,'Mathematics','Numbers','Pre-Number Activities','Creating patterns','Creating patterns using real objects.',3),
  (1,'Mathematics','Numbers','Whole','Counting numbers forward and backward','Counting numbers forward and backward; reading and writing numbers in symbols and words.',1),
  (1,'Mathematics','Numbers','Whole','Missing number patterns','Identifying missing number patterns in the official whole-number activities.',2),
  (1,'Mathematics','Numbers','Addition','Modelling addition','Modelling addition as putting objects together.',1),
  (1,'Mathematics','Numbers','Addition','Plus and equal symbols','Using plus and equal symbols in number statements.',2),
  (1,'Mathematics','Numbers','Subtraction','Modelling subtraction','Modelling subtraction by taking objects away.',1),
  (1,'Mathematics','Measurements','Length','Comparing length','Comparing and measuring length using arbitrary units.',1),
  (1,'Mathematics','Measurements','Mass','Comparing mass','Comparing mass using real objects.',1),
  (1,'Mathematics','Measurements','Capacity','Comparing capacity','Comparing capacity using containers.',1),
  (1,'Mathematics','Measurements','Time','Day and night','Recognising day and night in the time activities.',1),
  (1,'Mathematics','Measurements','Money','Recognising money','Recognising and using money in everyday situations.',1),
  (1,'Mathematics','Geometry','Lines','Straight and curved lines','Identifying straight and curved lines.',1),
  (1,'Mathematics','Geometry','Shapes','Rectangles, triangles and circles','Identifying rectangles, triangles and circles.',1),
  -- Reuse only the shared official Grade 1–3 summary labels for Grades 2 and 3.
  (2,'Mathematics','Numbers','Pre-Number Activities','Sorting and matching objects','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Numbers','Whole','Whole numbers','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Numbers','Addition','Addition','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Numbers','Subtraction','Subtraction','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Measurements','Length','Length','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Measurements','Mass','Mass','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Measurements','Capacity','Capacity','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Measurements','Time','Time','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Measurements','Money','Money','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Geometry','Lines','Lines','Official Grade 1–3 design content heading.',1),
  (2,'Mathematics','Geometry','Shapes','Shapes','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Numbers','Pre-Number Activities','Sorting and matching objects','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Numbers','Whole','Whole numbers','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Numbers','Addition','Addition','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Numbers','Subtraction','Subtraction','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Measurements','Length','Length','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Measurements','Mass','Mass','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Measurements','Capacity','Capacity','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Measurements','Time','Time','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Measurements','Money','Money','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Geometry','Lines','Lines','Official Grade 1–3 design content heading.',1),
  (3,'Mathematics','Geometry','Shapes','Shapes','Official Grade 1–3 design content heading.',1),
  -- Environmental Activities: exact lower-primary design phrases
  (1,'Environmental Activities','Social Environment','Cleaning My Body','Face, teeth, hands, feet and hair','Body-cleaning activities named in the official design.',1),
  (1,'Environmental Activities','Social Environment','Our Home','Parts and cleanliness of our home','Official home and hygiene content.',1),
  (1,'Environmental Activities','Social Environment','Family Needs','Food, clothing and shelter','Basic family needs named in the design.',1),
  (1,'Environmental Activities','Natural Environment','Weather and the Sky','Day and night sky; weather conditions and symbols','Official weather and sky content phrases.',1),
  (1,'Environmental Activities','Natural Environment','Soil','Types and uses of soil','Official soil content.',1),
  (1,'Environmental Activities','Natural Environment','Sound','Sources of sound','Official sound content.',1),
  (1,'Environmental Activities','Resources in Our Environment','Water','Sources, uses and conservation of water','Official water content phrases.',1),
  (1,'Environmental Activities','Resources in Our Environment','Plants','Parts and uses of plants','Official plants content.',1),
  (1,'Environmental Activities','Resources in Our Environment','Animals','Domestic and wild animals','Official animals content.',1),
  (2,'Environmental Activities','Social Environment','Our Rights and Responsibilities','Rights and responsibilities','Exact Grade 2 design sub-strand content heading.',1),
  (2,'Environmental Activities','Natural Environment','Weather','Weather conditions and symbols','Official Grade 2 weather content.',1),
  (2,'Environmental Activities','Resources in Our Environment','Water','Sources, uses and conservation of water','Official Grade 2 water content.',1),
  (3,'Environmental Activities','Social Environment','Food in Our Environment','Sources and uses of food','Official Grade 3 food content.',1),
  (3,'Environmental Activities','Social Environment','Cultural Events','Cultural events in the community','Official Grade 3 cultural-events content.',1),
  (3,'Environmental Activities','Resources in Our Environment','Plants','Edible and non-edible plants; kitchen garden','Exact source phrases recorded from the design.',1),
  (3,'Environmental Activities','Resources in Our Environment','Waste Materials','Types, reuse, income and waste management','Exact source phrases recorded from the design.',1),
  -- English shared lower-primary summary labels
  (1,'English','Listening and Speaking','Pronunciation vocabulary','Target letters and sounds; vocabulary building','Visible Grade 1 English design content.',1),
  (1,'English','Reading','Pre-reading','Letters, posture and preparedness for reading','Visible Grade 1 English design content.',1),
  (1,'English','Reading','Word','Reading words containing target letters','Official design reading content.',1),
  (1,'English','Language Use','Tense','Verb to be in the present tense','Visible Grade 1 English design content.',1),
  (1,'English','Writing','Handwriting','Handwriting practice','Official design writing content.',1),
  (2,'English','Listening and Speaking','Pronunciation vocabulary','Pronunciation and vocabulary','Official Grade 1–3 English summary label.',1),
  (2,'English','Reading','Pre-reading','Pre-reading','Official Grade 1–3 English summary label.',1),
  (2,'English','Reading','Word','Word reading','Official Grade 1–3 English summary label.',1),
  (2,'English','Reading','Fluency','Reading fluency','Official Grade 1–3 English summary label.',1),
  (2,'English','Reading','Comprehension','Reading comprehension','Official Grade 1–3 English summary label.',1),
  (2,'English','Language Use','Word classes','Word classes','Official Grade 1–3 English summary label.',1),
  (2,'English','Language Use','Tense','Tense','Official Grade 1–3 English summary label.',1),
  (2,'English','Language Use','Sentences','Sentences','Official Grade 1–3 English summary label.',1),
  (2,'English','Writing','Guided composition','Guided composition','Official Grade 1–3 English summary label.',1),
  (3,'English','Listening and Speaking','Pronunciation vocabulary','Pronunciation and vocabulary','Official Grade 1–3 English summary label.',1),
  (3,'English','Reading','Pre-reading','Pre-reading','Official Grade 1–3 English summary label.',1),
  (3,'English','Reading','Word','Word reading','Official Grade 1–3 English summary label.',1),
  (3,'English','Reading','Fluency','Reading fluency','Official Grade 1–3 English summary label.',1),
  (3,'English','Reading','Comprehension','Reading comprehension','Official Grade 1–3 English summary label.',1),
  (3,'English','Language Use','Word classes','Word classes','Official Grade 1–3 English summary label.',1),
  (3,'English','Language Use','Tense','Tense','Official Grade 1–3 English summary label.',1),
  (3,'English','Language Use','Sentences','Sentences','Official Grade 1–3 English summary label.',1),
  (3,'English','Writing','Guided composition','Guided composition','Official Grade 1–3 English summary label.',1),
  -- Grade 4 Science and Technology source-backed content phrases
  (4,'Science and Technology','Living Things and their Environment','Plants','Parts, needs and growth of plants','KICD Grade 4 design content focus.',1),
  (4,'Science and Technology','Living Things and their Environment','Animals','Animal groups and adaptations','KICD Grade 4 design content focus.',1),
  (4,'Science and Technology','Living Things and their Environment','Human Digestive System','Parts and functions of the human digestive system','KICD Grade 4 design content focus.',1),
  (4,'Science and Technology','Matter','Properties of Matter','Meaning, states, properties and importance of matter','Exact content headings extracted from the readable KICD-printed design.',1),
  (4,'Science and Technology','Matter','Management of Solid Waste','Types, effects and management of solid waste','KICD Grade 4 design content focus.',1),
  (4,'Science and Technology','Matter','Water Conservation','Sources, uses and conservation of water','KICD Grade 4 design content focus.',1),
  (4,'Science and Technology','Force and Energy','Force and its Effect','Pushes, pulls and effects of force','KICD Grade 4 design content focus.',1),
  (4,'Science and Technology','Force and Energy','Light','Sources and properties of light','KICD Grade 4 design content focus.',1),
  (4,'Science and Technology','Force and Energy','Heat','Sources, transfer and effects of heat','KICD Grade 4 design content focus.',1),
  -- Grade 5 Science and Technology exact content phrases
  (5,'Science and Technology','Living Things and their Environment','Classification of Plants','Flowering and non-flowering plants; parts of a flower','Official Grade 5 KICD viewer content.',1),
  (5,'Science and Technology','Living Things and their Environment','Invertebrates','Groups and characteristics of invertebrates','Official Grade 5 KICD viewer content.',1),
  (5,'Science and Technology','Living Things and their Environment','The Human Breathing System','Organs and process of human breathing','Official Grade 5 KICD viewer content.',1),
  (5,'Science and Technology','Matter','Mixtures','Meaning, types, examples and separation of mixtures','Official Grade 5 KICD viewer content.',1),
  (5,'Science and Technology','Matter','Water Pollution','Pollutants, effects, reduction and treatment','Official Grade 5 KICD viewer content.',1),
  (5,'Science and Technology','Force and Energy','Floating and Sinking','Factors and applications of floating and sinking','Official Grade 5 KICD viewer content.',1),
  (5,'Science and Technology','Force and Energy','Sound','Sources, movement, effects and role of sound','Official Grade 5 KICD viewer content.',1),
  (5,'Science and Technology','Force and Energy','Heat Transfer','Conduction, convection, radiation, conductors, uses and safety','Official Grade 5 KICD viewer content.',1),
  -- Grade 6 Science and Technology exact summary/content phrases
  (6,'Science and Technology','Living Things and their Environment','Fungi','Common fungi: mushrooms, toadstool, puff balls, yeast and moulds','Official Grade 6 KICD viewer content.',1),
  (6,'Science and Technology','Living Things and their Environment','Invertebrates','Groups and characteristics of invertebrates','Official Grade 6 KICD summary content.',1),
  (6,'Science and Technology','Living Things and their Environment','Human circulatory system','Main parts and functions of the human circulatory system','Official Grade 6 KICD summary content.',1),
  (6,'Science and Technology','Matter','Change of state','Changes of state of matter','Official Grade 6 KICD summary content.',1),
  (6,'Science and Technology','Matter','Composition of air','Components and importance of air','Official Grade 6 KICD summary content.',1),
  (6,'Science and Technology','Force and energy','Light','Sources and properties of light','Official Grade 6 KICD summary content.',1),
  (6,'Science and Technology','Force and energy','Levers as simple machines','Parts and uses of levers as simple machines','Official Grade 6 KICD summary content.',1),
  (6,'Science and Technology','Force and energy','Slopes','Uses and effects of slopes','Official Grade 6 KICD summary content.',1),
  -- Grade 5 Mathematics exact summary labels
  (5,'Mathematics','Numbers','Whole','Place value, rounding, divisibility, HCF/GCD and LCM','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Numbers','Addition','Addition of whole numbers','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Numbers','Subtraction','Subtraction of whole numbers','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Numbers','Multiplication','Multiplication of whole numbers','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Numbers','Division','Division of whole numbers','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Numbers','Fractions','Fractions','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Numbers','Decimals','Decimals','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Numbers','Simple Equations','Simple equations','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Measurement','Length','Length','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Measurement','Area','Area','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Measurement','Volume','Volume','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Measurement','Capacity','Capacity','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Measurement','Mass','Mass','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Measurement','Time','Time','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Measurement','Money','Money','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Geometry','Lines','Lines','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Geometry','Angles','Angles','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Geometry','Three Dimension (3-D) Objects','Three Dimension (3-D) Objects','Official Grade 5 KICD Mathematics summary/content.',1),
  (5,'Mathematics','Data Handling','Representation','Representation of data','Official Grade 5 KICD Mathematics summary/content.',1),
  -- Grade 6 Mathematics exact summary labels
  (6,'Mathematics','Numbers','Whole Numbers','Whole numbers','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Numbers','Multiplication','Multiplication','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Numbers','Division','Division','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Numbers','Fractions','Fractions','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Numbers','Decimals','Decimals','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Numbers','Inequalities','Inequalities','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Measurement','Length','Length','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Measurement','Area','Area','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Measurement','Capacity','Capacity','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Measurement','Mass','Mass','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Measurement','Time','Time','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Measurement','Money','Money','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Geometry','Lines','Lines','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Geometry','Angles','Angles','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Geometry','3-D Objects','3-D objects','Official Grade 6 KICD Mathematics summary.',1),
  (6,'Mathematics','Data Handling','Bar Graphs','Bar graphs','Official Grade 6 KICD Mathematics summary.',1),
  -- Grade 6 Social Studies exact sub-strand labels as source-backed topic anchors
  (6,'Social Studies','Natural and the Built Environments','Position and Size of Countries in Eastern Africa','Position and size of countries in Eastern Africa','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Natural and the Built Environments','Main Physical Features in Eastern Africa','Main physical features in Eastern Africa','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Natural and the Built Environments','Climatic Regions in Eastern Africa','Climatic regions in Eastern Africa','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Natural and the Built Environments','Vegetation in Eastern Africa','Vegetation in Eastern Africa','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Natural and the Built Environments','Historic Built Environments','Historic built environments','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','People and Social Organisation','Language Groups in Eastern Africa','Language groups in Eastern Africa','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','People and Social Organisation','Population Distribution in Eastern Africa','Population distribution in Eastern Africa','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','People and Social Organisation','Culture and Social Organisation','Culture and social organisation','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','People and Social Organisation','School and Community','School and community','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Resources and Economic Activities in Eastern Africa','Beef Farming','Beef farming','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Resources and Economic Activities in Eastern Africa','Fishing','Fishing','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Resources and Economic Activities in Eastern Africa','Wildlife and Tourism','Wildlife and tourism','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Resources and Economic Activities in Eastern Africa','Transport','Transport','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Resources and Economic Activities in Eastern Africa','Communication','Communication','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Resources and Economic Activities in Eastern Africa','Mining','Mining','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Political Systems','Traditional Forms of Government','Traditional forms of government','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Political Systems','Regional Co-operations','Regional co-operations','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Political Systems','Citizenship','Citizenship','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Political Systems','Human Rights','Human rights','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Governance','Peace and Conflict Resolution','Peace and conflict resolution','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Governance','Government Revenue and Expenditure','Government revenue and expenditure','Exact KICD Grade 6 Social Studies summary label.',1),
  (6,'Social Studies','Governance','Preamble of the Constitution of Kenya','Preamble of the Constitution of Kenya','Exact KICD Grade 6 Social Studies summary label.',1),
  -- Grade 7 Integrated Science revised 2024
  (7,'Integrated Science','Scientific Investigation','Introduction to Integrated Science','Scope and applications of integrated science','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Scientific Investigation','Laboratory Safety','Laboratory rules, safety symbols and protective equipment','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Scientific Investigation','Laboratory Apparatus and Instruments','Identification, uses and care of laboratory apparatus and instruments','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Mixtures, Elements and Compounds','Mixtures','Components, types and separation of mixtures','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Mixtures, Elements and Compounds','Acids, Bases and Indicators','Properties of acids and bases; indicators','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Living Things and the Environment','Human Reproductive System','Parts and functions of the human reproductive system','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Living Things and the Environment','Human Excretory System','Organs and functions of the human excretory system','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Force and Energy','Electrical Energy','Electrical circuits, uses and safety','Official revised-2024 KICD Grade 7 content focus.',1),
  (7,'Integrated Science','Force and Energy','Magnetism','Magnetic poles, fields and uses of magnets','Official revised-2024 KICD Grade 7 content focus.',1),
  -- Grade 8 Integrated Science revised 2024
  (8,'Integrated Science','Mixtures, Elements and Compounds','Atoms, elements, molecules and compounds','Symbols of common elements; molecules and compounds; word equations; uses of common elements','Official revised-2024 KICD Grade 8 content focus.',1),
  (8,'Integrated Science','Mixtures, Elements and Compounds','Physical and chemical changes','Kinetic theory; heating curves; effects of impurities; temporary and permanent changes','Official revised-2024 KICD Grade 8 content focus.',1),
  (8,'Integrated Science','Mixtures, Elements and Compounds','Classes of fire','Causes, classes, control and safety in relation to fire','Official revised-2024 KICD Grade 8 content focus.',1),
  (8,'Integrated Science','Living Things and their Environment','The Cell','Cell structure and microscope work','Official revised-2024 KICD Grade 8 content focus.',1),
  (8,'Integrated Science','Living Things and their Environment','Movement of Materials in and out of the Cell','Diffusion, osmosis and movement of water, nutrients and gases','Official revised-2024 KICD Grade 8 content focus.',1),
  (8,'Integrated Science','Living Things and their Environment','Reproduction in Human Beings','Menstrual cycle, fertilisation, implantation and common STIs','Official revised-2024 KICD Grade 8 content focus.',1),
  (8,'Integrated Science','Force and Energy','Transformation of Energy','Forms, sources, transformations and safety of energy','Official revised-2024 KICD Grade 8 content focus.',1),
  (8,'Integrated Science','Force and Energy','Pressure','Pressure in solids and liquids','Official revised-2024 KICD Grade 8 content focus.',1)
) AS v(grade_number, subject_name, strand_name, sub_strand_name, topic_name, topic_description, topic_order)
JOIN curriculum_grades g ON g.grade_number=v.grade_number
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))=lower(trim(v.subject_name))
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name))
);

COMMIT;
