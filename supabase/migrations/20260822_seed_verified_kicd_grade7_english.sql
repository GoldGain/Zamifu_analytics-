-- Source-verified KICD Grade 7 English addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/
-- Official Drive file: 1HAU_WMYmdmfWmr4kAvZxjcgG0lizPHZv
-- The seed is additive and preserves legacy hierarchy rows.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 7 English revised-2024 strand.', v.strand_order
FROM (VALUES
 ('Listening and Speaking',1),('Reading',2),('Literature',3),('Grammar',4),('Writing',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 7 English revised-2024 sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Listening and Speaking','Oral skills – polite language',1),('Listening and Speaking','Presentations – oral narratives',2),('Listening and Speaking','Listening for Main Idea',3),('Listening and Speaking','Selective listening',4),('Listening and Speaking','Sounds and word stress',5),('Listening and Speaking','Conversational skills',6),('Listening and Speaking','Listening for details',7),('Listening and Speaking','Explanatory Narratives',8),('Listening and Speaking','Consonant and vowel sounds',9),('Listening and Speaking','Delivering speeches',10),('Listening and Speaking','Interviews',11),('Listening and Speaking','Views and Opinions',12),('Listening and Speaking','Extensive listening',13),('Listening and Speaking','Intonation',14),('Listening and Speaking','Reports',15),
 ('Reading','Independent reading',1),('Reading','Simple poems',2),('Reading','Information and meaning',3),('Reading','Intensive reading',4),('Reading','Synonyms and antonyms',5),('Reading','Reading fluency',6),('Reading','Independent reading-Visuals',7),('Reading','Main idea from supporting details',8),('Reading','Grade appropriate fiction materials',9),('Reading','Study skills – note making',10),('Reading','Non-fiction comprehension',11),('Reading','Comprehension strategies',12),('Reading','Reading – summary',13),('Reading','Fluency',14),
 ('Literature','Intensive reading - trickster narrative',1),('Literature','Class reader – Previewing text',2),('Literature','Class reader - poetry',3),('Literature','Class reader – Main characters',4),('Literature','Intensive reading – Oral narratives',5),('Literature','Oral literature - songs',6),('Literature','Intensive reading - Characters',7),('Literature','Intensive reading - Poetry',8),('Literature','Class reader - sequence of events',9),('Literature','Intensive reading - Character traits - Monster Narratives',10),('Literature','Intensive reading - Dilemma',11),('Literature','Praise songs - Purpose and occasion',12),('Literature','Features of style - Identification and use',13),('Literature','Poetry',14),
 ('Grammar','Word classes - Nouns',1),('Grammar','Verbs tense - regular and irregular verbs',2),('Grammar','Tense - simple present and past',3),('Grammar','Comparative and superlative adjectives',4),('Grammar','Adverbs',5),('Grammar','Personal and possessive Pronouns',6),('Grammar','Simple prepositions',7),('Grammar','Conjunctions',8),('Grammar','Determiners',9),('Grammar','Formation of Adjectives',10),('Grammar','Phrasal structures',11),('Grammar','Sentences',12),('Grammar','Subject-verb agreement',13),('Grammar','Affirmative and Negative Sentences',14),
 ('Writing','Handwriting – Legibility',1),('Writing','Punctuation marks',2),('Writing','Narrative paragraphs',3),('Writing','Paragraphing using examples',4),('Writing','Friendly letter',5),('Writing','Commonly misspelt words',6),('Writing','The writing process-Narrative composition',7),('Writing','Composition-Self assessment',8),('Writing','Composition',9),('Writing','Packing and Shopping lists',10),('Writing','Spelling Antonyms, Synonyms Numbers',11),('Writing','Writing process-Dialogues',12),('Writing','Descriptive composition',13),('Writing','Functional – Notices and Posters',14)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 7 English revised-2024 content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Listening and Speaking','Oral skills – polite language'),('Reading','Independent reading'),('Literature','Intensive reading - trickster narrative'),('Grammar','Determiners'),('Writing','Narrative paragraphs')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=7
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 7 English%');
COMMIT;
