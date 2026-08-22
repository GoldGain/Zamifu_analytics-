-- Source-verified KICD Grade 8 English addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1WmQXD4FTiFrInrCQMu1w-cjmPPaLEvw5
-- The seed is additive and preserves legacy hierarchy rows.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 English revised-2024 strand.', v.strand_order
FROM (VALUES
 ('Listening and Speaking',1),('Reading',2),('Literature',3),('Grammar',4),('Writing',5)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 English revised-2024 sub-strand.', v.sub_strand_order
FROM (VALUES
 ('Listening and Speaking','Polite Language (telephone etiquette)',1),('Listening and Speaking','Oral presentations songs',2),('Listening and Speaking','Listening comprehension',3),('Listening and Speaking','Selective listening',4),('Listening and Speaking','Pronunciation',5),('Listening and Speaking','Conversational skills disagreeing politely',6),('Listening and Speaking','Listening for details-responding appropriately',7),('Listening and Speaking','Narratives myths',8),('Listening and Speaking','Sounds and stress',9),('Listening and Speaking','Presentations',10),('Listening and Speaking','Interviews',11),('Listening and Speaking','Listening to respond attitude',12),('Listening and Speaking','Extensive listening poems',13),('Listening and Speaking','Intonation silent consonant',14),('Listening and Speaking','Reports events',15),
 ('Reading','Independent reading',1),('Reading','Simple poems',2),('Reading','Intensive reading given texts',3),('Reading','Reading strategies',4),('Reading','Study skills-Reference materials',5),('Reading','Reading fluency poem',6),('Reading','Reading with visuals',7),('Reading','Extensive fiction -Characters',8),('Reading','Study skills note making',9),('Reading','Non-fiction comprehension',10),('Reading','Reading comprehension',11),('Reading','Comprehension strategies',12),('Reading','Reading - summary',13),('Reading','Fluency',14),
 ('Literature','Class reader sequencing events',1),('Literature','Class reader setting (time and place)',2),('Literature','Class reader poetry',3),('Literature','Class reader characters',4),('Literature','Class reader style (dialogue and repetition)',5),('Literature','Class reader main idea',6),('Literature','Class reader relationship between characters',7),('Literature','Intensive reading - Similes and Metaphors',8),('Literature','Class reader relating events to real life',9),('Literature','Class reader lessons learnt',10),('Literature','Writing about characters',11),('Literature','Style (personification and flashback)',12),('Literature','Literary ideas',13),('Literature','Poems',14),
 ('Grammar','Word classes – compound Nouns',1),('Grammar','Collective nouns',2),('Grammar','Primary auxiliaries',3),('Grammar','Verbs tenses',4),('Grammar','Adjectives',5),('Grammar','Adverbs',6),('Grammar','Pronouns',7),('Grammar','Simple prepositions',8),('Grammar','Conjunctions',9),('Grammar','Determiners and Quantifiers',10),('Grammar','Compound Sentences',11),('Grammar','Active and Passive voice',12),('Grammar','Interrogative sentences',13),
 ('Writing','Handwriting – Legibility',1),('Writing','Punctuation marks',2),('Writing','Narrative paragraphs',3),('Writing','Paragraphing using examples',4),('Writing','Friendly letter',5),('Writing','Commonly misspelt words',6),('Writing','The writing process narrative composition',7),('Writing','Composition self assessment',8),('Writing','Packing and Shopping lists',9),('Writing','Spelling Antonyms Synonyms Numbers',10),('Writing','Dialogues',11),('Writing','Descriptive composition',12),('Writing','Functional notices posters',13)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 8 English revised-2024 content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Listening and Speaking','Polite Language (telephone etiquette)'),('Reading','Independent reading'),('Literature','Class reader sequencing events'),('Grammar','Determiners and Quantifiers'),('Writing','Narrative paragraphs')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='english'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 8 English%');
COMMIT;
