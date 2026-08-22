-- Source-verified KICD Grade 8 Creative Arts and Sports addition.
-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1ji89ZIdF9ZA5d6rkchqJJYa2G5ZQO5zP (Creative Arts and Sports Grade 8, revised design).
-- Additive/idempotent: legacy rows are preserved. Ambiguous OCR fragments are excluded.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, 'Official KICD Grade 8 Creative Arts and Sports revised-design strand.', v.strand_order
FROM (VALUES
 ('Foundations of Creative Arts and Sports',1),('Creating and Performing in Creative Arts and Sports',2),('Appreciation in Creative Arts and Sports',3)
) v(strand_name,strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='creative arts and sports'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_strands st WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, 'Official KICD Grade 8 Creative Arts and Sports revised-design content heading.', v.sub_strand_order
FROM (VALUES
 ('Foundations of Creative Arts and Sports','Roles',1),('Foundations of Creative Arts and Sports','Components',2),
 ('Creating and Performing in Creative Arts and Sports','Drawing and Painting',1),('Creating and Performing in Creative Arts and Sports','Rhythm',2),('Creating and Performing in Creative Arts and Sports','Middle Distance Races Montage',3),('Creating and Performing in Creative Arts and Sports','Melody',4),('Creating and Performing in Creative Arts and Sports','Netball',5),('Creating and Performing in Creative Arts and Sports','Fabric Decoration',6),('Creating and Performing in Creative Arts and Sports','Descant Recorder',7),('Creating and Performing in Creative Arts and Sports','Verse',8),('Creating and Performing in Creative Arts and Sports','Volleyball',9),('Creating and Performing in Creative Arts and Sports','Kenyan Folk Dance',10),('Creating and Performing in Creative Arts and Sports','Indigenous Kenyan Craft (Basketry)',11),('Creating and Performing in Creative Arts and Sports','Swimming (Optional)',12),('Creating and Performing in Creative Arts and Sports','Kenyan Indigenous Games (Optional)',13),
 ('Appreciation in Creative Arts and Sports','Analysis of Sports',1)
) v(strand_name,sub_strand_name,sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='creative arts and sports'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_sub_strands ss WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name)) AND ss.sub_strand_description ILIKE '%official%kicd%');

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, 'Official KICD Grade 8 Creative Arts and Sports revised-design content anchor.', ARRAY[]::text[], 1
FROM (VALUES
 ('Foundations of Creative Arts and Sports','Roles'),('Foundations of Creative Arts and Sports','Components'),
 ('Creating and Performing in Creative Arts and Sports','Drawing and Painting'),('Creating and Performing in Creative Arts and Sports','Rhythm'),('Creating and Performing in Creative Arts and Sports','Middle Distance Races Montage'),('Creating and Performing in Creative Arts and Sports','Melody'),('Creating and Performing in Creative Arts and Sports','Netball'),('Creating and Performing in Creative Arts and Sports','Fabric Decoration'),('Creating and Performing in Creative Arts and Sports','Descant Recorder'),('Creating and Performing in Creative Arts and Sports','Verse'),('Creating and Performing in Creative Arts and Sports','Volleyball'),('Creating and Performing in Creative Arts and Sports','Kenyan Folk Dance'),('Creating and Performing in Creative Arts and Sports','Indigenous Kenyan Craft (Basketry)'),('Creating and Performing in Creative Arts and Sports','Swimming (Optional)'),('Creating and Performing in Creative Arts and Sports','Kenyan Indigenous Games (Optional)'),
 ('Appreciation in Creative Arts and Sports','Analysis of Sports')
) v(strand_name,topic_name)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id AND lower(trim(s.subject_name))='creative arts and sports'
JOIN curriculum_strands st ON st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name)) AND st.strand_description ILIKE '%official%kicd%'
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.topic_name)) AND ss.sub_strand_description ILIKE '%official%kicd%'
WHERE NOT EXISTS (SELECT 1 FROM curriculum_topics t WHERE t.sub_strand_id=ss.id AND lower(trim(t.topic_name))=lower(trim(v.topic_name)) AND t.topic_description ILIKE '%Official KICD Grade 8 Creative Arts%');
COMMIT;
