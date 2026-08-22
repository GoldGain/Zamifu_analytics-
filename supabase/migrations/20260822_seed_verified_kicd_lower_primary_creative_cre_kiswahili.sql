-- Source-verified KICD lower-primary curriculum additions.
-- Official index: https://kicd.ac.ke/cbc-materials/lower-primary/
-- Official KICD Drive files:
--   Creative Activities & Indigenous Languages Grade 1–3: 1vrC5cJO2MpDm9v4u3-qwCze9yPa9HcEZ
--   Christian Religious Education Activities Grade 1–3: 1YSXfOr81O2bn5t0ILvqDYkz3GchE9M3i
--   Kiswahili Mazoezi ya Lugha Grade 1–3: 1xVa-cvQ3jSlfR4yNEL3DIXGmU-U7tHXk
--
-- The Creative Activities strand/sub-strand rows are exact readable summary-table
-- headings from the official 2024-revised design. Their matching topic rows are
-- explicitly labelled source-summary topic anchors; they are not claimed to be
-- verbatim detailed topic headings.
-- The CRE rows are exact readable table headings from the official design.
-- The Kiswahili rows are exact table-level Grade 1 and Grade 2 observations:
--   Grade 1: Kusikiliza na Kuzungumza > Maamkuzi na Maagano > Darasani
--   Grade 2: Kusikiliza na Kuzungumza > Maamkuzi na Maagano > Shuleni
--
-- Additive/idempotent: no rows are deleted, relabelled, or broadly overwritten.
-- No natural-key ON CONFLICT is used; normalized parent lookups and NOT EXISTS
-- sibling checks preserve existing legacy content.

BEGIN;

INSERT INTO curriculum_subjects (grade_id, subject_name, subject_code)
SELECT g.id, v.subject_name, v.subject_code
FROM (VALUES
  (1, 'Creative Activities', 'CA'),
  (2, 'Creative Activities', 'CA'),
  (3, 'Creative Activities', 'CA'),
  (1, 'Religious Education', 'CRE'),
  (2, 'Religious Education', 'CRE'),
  (3, 'Religious Education', 'CRE'),
  (1, 'Kiswahili', 'KIS'),
  (2, 'Kiswahili', 'KIS'),
  (3, 'Kiswahili', 'KIS')
) AS v(grade_number, subject_name, subject_code)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
WHERE NOT EXISTS (
  SELECT 1
  FROM curriculum_subjects s
  WHERE s.grade_id = g.id
    AND lower(trim(s.subject_name)) = lower(trim(v.subject_name))
);

-- Creative Activities Grade 1–3: exact official summary-table strands.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name,
       'Official KICD Lower Primary Creative Activities revised-2024 summary-table strand.',
       v.strand_order
FROM (VALUES
  (1, 'Creating and Executing', 1), (1, 'Performing and Displaying', 2), (1, 'Appreciation', 3),
  (2, 'Creating and Executing', 1), (2, 'Performing and Displaying', 2), (2, 'Appreciation', 3),
  (3, 'Creating and Executing', 1), (3, 'Performing and Displaying', 2), (3, 'Appreciation', 3)
) AS v(grade_number, strand_name, strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'creative activities'
WHERE NOT EXISTS (
  SELECT 1
  FROM curriculum_strands st
  WHERE st.subject_id = s.id
    AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

-- Creative Activities Grade 1–3: exact readable summary-table sub-strands.
INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name,
       'Official KICD Lower Primary Creative Activities revised-2024 summary-table sub-strand.',
       v.sub_strand_order
FROM (VALUES
  (1, 'Creating and Executing', 'Jumping', 1),
  (1, 'Creating and Executing', 'Rhythm', 2),
  (1, 'Creating and Executing', 'Drawing', 3),
  (1, 'Creating and Executing', 'Stretching', 4),
  (1, 'Creating and Executing', 'Painting and Colouring', 5),
  (1, 'Creating and Executing', 'Melody', 6),
  (1, 'Creating and Executing', 'Pattern Making', 7),
  (1, 'Performing and Displaying', 'Singing Games - Kenyan style', 1),
  (1, 'Performing and Displaying', 'Throwing and Catching', 2),
  (1, 'Performing and Displaying', 'Paper Craft', 3),
  (1, 'Performing and Displaying', 'Log Roll and Balances', 4),
  (1, 'Performing and Displaying', 'Songs-Action', 5),
  (1, 'Performing and Displaying', 'Modelling', 6),
  (1, 'Performing and Displaying', 'Percussion Musical Instruments', 7),
  (1, 'Appreciation', 'Musical Sounds', 1),
  (1, 'Appreciation', 'Water Safety Awareness', 2),
  (2, 'Creating and Executing', 'Hopping', 1),
  (2, 'Creating and Executing', 'Drawing and Painting', 2),
  (2, 'Creating and Executing', 'Rhythm and Pattern Making', 3),
  (2, 'Creating and Executing', 'Turning', 4),
  (2, 'Creating and Executing', 'Mosaic', 5),
  (2, 'Creating and Executing', 'Melody', 6),
  (2, 'Performing and Displaying', 'Singing Games- Western Style', 1),
  (2, 'Performing and Displaying', 'Kicking', 2),
  (2, 'Performing and Displaying', 'Plaited Ornaments', 3),
  (2, 'Performing and Displaying', 'Egg Roll and Swan Balance', 4),
  (2, 'Performing and Displaying', 'Wind Musical Instruments', 5),
  (2, 'Performing and Displaying', 'Modelling', 6),
  (2, 'Performing and Displaying', 'Songs', 7),
  (2, 'Appreciation', 'Singing Games - Western', 1),
  (2, 'Appreciation', 'Water Safety Awareness', 2),
  (3, 'Creating and Executing', 'Pushing and Pulling', 1),
  (3, 'Creating and Executing', 'Drawing and Painting', 2),
  (3, 'Creating and Executing', 'Rhythm and Pattern Making', 3),
  (3, 'Creating and Executing', 'Skipping', 4),
  (3, 'Creating and Executing', 'Collage', 5),
  (3, 'Creating and Executing', 'Melody', 6),
  (3, 'Creating and Executing', 'Weaving', 7),
  (3, 'Performing and Displaying', 'Rounds', 1),
  (3, 'Performing and Displaying', 'Galloping', 2),
  (3, 'Performing and Displaying', 'Sculpture', 3),
  (3, 'Performing and Displaying', 'Forward Roll and V-balance', 4),
  (3, 'Performing and Displaying', 'String Musical Instrument', 5),
  (3, 'Performing and Displaying', 'Modelling and Ornament-Making', 6),
  (3, 'Appreciation', 'The Kenya National Anthem', 1),
  (3, 'Appreciation', 'Water Safety Awareness', 2)
) AS v(grade_number, strand_name, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'creative activities'
JOIN curriculum_strands st
  ON st.subject_id = s.id
 AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
 AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1
  FROM curriculum_sub_strands ss
  WHERE ss.strand_id = st.id
    AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

-- Creative Activities matching source-summary topic anchors.
INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.sub_strand_name,
       'Official KICD Lower Primary Creative Activities revised-2024 source-summary topic anchor; mirrors the exact summary-table sub-strand heading and is not claimed as a verbatim detailed topic.',
       ARRAY[]::text[], 1
FROM (VALUES
  (1, 'Creating and Executing', 'Jumping'), (1, 'Creating and Executing', 'Rhythm'),
  (1, 'Creating and Executing', 'Drawing'), (1, 'Creating and Executing', 'Stretching'),
  (1, 'Creating and Executing', 'Painting and Colouring'), (1, 'Creating and Executing', 'Melody'),
  (1, 'Creating and Executing', 'Pattern Making'), (1, 'Performing and Displaying', 'Singing Games - Kenyan style'),
  (1, 'Performing and Displaying', 'Throwing and Catching'), (1, 'Performing and Displaying', 'Paper Craft'),
  (1, 'Performing and Displaying', 'Log Roll and Balances'), (1, 'Performing and Displaying', 'Songs-Action'),
  (1, 'Performing and Displaying', 'Modelling'), (1, 'Performing and Displaying', 'Percussion Musical Instruments'),
  (1, 'Appreciation', 'Musical Sounds'), (1, 'Appreciation', 'Water Safety Awareness'),
  (2, 'Creating and Executing', 'Hopping'), (2, 'Creating and Executing', 'Drawing and Painting'),
  (2, 'Creating and Executing', 'Rhythm and Pattern Making'), (2, 'Creating and Executing', 'Turning'),
  (2, 'Creating and Executing', 'Mosaic'), (2, 'Creating and Executing', 'Melody'),
  (2, 'Performing and Displaying', 'Singing Games- Western Style'), (2, 'Performing and Displaying', 'Kicking'),
  (2, 'Performing and Displaying', 'Plaited Ornaments'), (2, 'Performing and Displaying', 'Egg Roll and Swan Balance'),
  (2, 'Performing and Displaying', 'Wind Musical Instruments'), (2, 'Performing and Displaying', 'Modelling'),
  (2, 'Performing and Displaying', 'Songs'), (2, 'Appreciation', 'Singing Games - Western'),
  (2, 'Appreciation', 'Water Safety Awareness'), (3, 'Creating and Executing', 'Pushing and Pulling'),
  (3, 'Creating and Executing', 'Drawing and Painting'), (3, 'Creating and Executing', 'Rhythm and Pattern Making'),
  (3, 'Creating and Executing', 'Skipping'), (3, 'Creating and Executing', 'Collage'),
  (3, 'Creating and Executing', 'Melody'), (3, 'Creating and Executing', 'Weaving'),
  (3, 'Performing and Displaying', 'Rounds'), (3, 'Performing and Displaying', 'Galloping'),
  (3, 'Performing and Displaying', 'Sculpture'), (3, 'Performing and Displaying', 'Forward Roll and V-balance'),
  (3, 'Performing and Displaying', 'String Musical Instrument'),
  (3, 'Performing and Displaying', 'Modelling and Ornament-Making'),
  (3, 'Appreciation', 'The Kenya National Anthem'), (3, 'Appreciation', 'Water Safety Awareness')
) AS v(grade_number, strand_name, sub_strand_name)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'creative activities'
JOIN curriculum_strands st
  ON st.subject_id = s.id
 AND lower(trim(st.strand_name)) = lower(trim(v.strand_name))
 AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss
  ON ss.strand_id = st.id
 AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
 AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1
  FROM curriculum_topics t
  WHERE t.sub_strand_id = ss.id
    AND lower(trim(t.topic_name)) = lower(trim(v.sub_strand_name))
    AND t.topic_description ~* 'Official KICD Lower Primary Creative Activities'
);

-- Lower-primary CRE: exact readable Grade 1–3 table headings supported by the official source.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, 'Creation', 'Official KICD Lower Primary Christian Religious Education Activities revised-2024 table-level strand.', 1
FROM curriculum_grades g
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'religious education'
WHERE g.grade_number IN (1, 2, 3)
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_strands st
    WHERE st.subject_id = s.id
      AND lower(trim(st.strand_name)) = 'creation'
      AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
  );

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name,
       'Official KICD Lower Primary Christian Religious Education Activities revised-2024 exact table-level sub-strand.',
       v.sub_strand_order
FROM (VALUES
  (1, 'My Family', 2), (1, 'Creation of Plants and Animals', 3)
) AS v(grade_number, sub_strand_name, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'religious education'
JOIN curriculum_strands st
  ON st.subject_id = s.id
 AND lower(trim(st.strand_name)) = 'creation'
 AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id = st.id
    AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.sub_strand_name,
       'Official KICD Lower Primary Christian Religious Education Activities revised-2024 exact table-level content anchor.',
       ARRAY[]::text[], 1
FROM (VALUES
  (1, 'My Family'), (1, 'Creation of Plants and Animals'),
  (2, 'My Family'),
  (3, 'My Family')
) AS v(grade_number, sub_strand_name)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'religious education'
JOIN curriculum_strands st
  ON st.subject_id = s.id
 AND lower(trim(st.strand_name)) = 'creation'
 AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss
  ON ss.strand_id = st.id
 AND lower(trim(ss.sub_strand_name)) = lower(trim(v.sub_strand_name))
 AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id = ss.id
    AND lower(trim(t.topic_name)) = lower(trim(v.sub_strand_name))
    AND t.topic_description ~* 'Official KICD Lower Primary Christian Religious Education'
);

-- Lower-primary Kiswahili: exact Grade 1 and Grade 2 table-level hierarchy observations.
INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, 'Kusikiliza na Kuzungumza',
       'Official KICD Lower Primary Kiswahili revised-2024 exact table-level strand.', 1
FROM (VALUES (1), (2)) AS v(grade_number)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'kiswahili'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id = s.id
    AND lower(trim(st.strand_name)) = lower(trim('Kusikiliza na Kuzungumza'))
    AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, 'Maamkuzi na Maagano',
       'Official KICD Lower Primary Kiswahili revised-2024 exact table-level sub-strand.', 1
FROM (VALUES (1), (2)) AS v(grade_number)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'kiswahili'
JOIN curriculum_strands st
  ON st.subject_id = s.id
 AND lower(trim(st.strand_name)) = lower(trim('Kusikiliza na Kuzungumza'))
 AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id = st.id
    AND lower(trim(ss.sub_strand_name)) = lower(trim('Maamkuzi na Maagano'))
    AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name,
       'Official KICD Lower Primary Kiswahili revised-2024 exact table-level Mada anchor.',
       ARRAY[]::text[], 1
FROM (VALUES
  (1, 'Darasani'), (2, 'Shuleni')
) AS v(grade_number, topic_name)
JOIN curriculum_grades g ON g.grade_number = v.grade_number
JOIN curriculum_subjects s
  ON s.grade_id = g.id
 AND lower(trim(s.subject_name)) = 'kiswahili'
JOIN curriculum_strands st
  ON st.subject_id = s.id
 AND lower(trim(st.strand_name)) = lower(trim('Kusikiliza na Kuzungumza'))
 AND st.strand_description ~* '(official|source-verified)[[:space:]]+kicd'
JOIN curriculum_sub_strands ss
  ON ss.strand_id = st.id
 AND lower(trim(ss.sub_strand_name)) = lower(trim('Maamkuzi na Maagano'))
 AND ss.sub_strand_description ~* '(official|source-verified)[[:space:]]+kicd'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id = ss.id
    AND lower(trim(t.topic_name)) = lower(trim(v.topic_name))
    AND t.topic_description ~* 'Official KICD Lower Primary Kiswahili'
);

COMMIT;
