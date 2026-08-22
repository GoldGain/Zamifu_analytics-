-- Official index: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/
-- Official Drive file: 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v (Integrated Science Grade 8 - July 2024.pdf).
-- Exact source: KICD viewer pages 12–14 and the saved provenance log.
-- This corrected migration adds the exact official parent/sub-strand labels where the existing database has legacy or differently worded rows.
-- Additive/idempotent; no legacy junior rows are deleted, renamed, or relabelled.
BEGIN;

INSERT INTO curriculum_strands (subject_id, strand_name, strand_description, strand_order)
SELECT s.id, v.strand_name, v.strand_description, v.strand_order
FROM (VALUES
  ('Mixtures, Elements and Compounds','Official KICD Grade 8 Integrated Science strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Living Things and the Environment','Official KICD Grade 8 Integrated Science strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',2),
  ('Force and Energy','Official KICD Grade 8 Integrated Science strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',3)
) AS v(strand_name, strand_description, strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='integrated science'
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_strands st
  WHERE st.subject_id=s.id AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
);

INSERT INTO curriculum_sub_strands (strand_id, sub_strand_name, sub_strand_description, sub_strand_order)
SELECT st.id, v.sub_strand_name, v.sub_strand_description, v.sub_strand_order
FROM (VALUES
  ('Mixtures, Elements and Compounds','Elements and Compounds','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Mixtures, Elements and Compounds','Physical and chemical changes','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',2),
  ('Mixtures, Elements and Compounds','Classes of fire','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',3),
  ('Living Things and the Environment','The Cell','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Living Things and the Environment','Movement of materials in and out of the cell','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',2),
  ('Living Things and the Environment','Reproduction in human beings','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',3),
  ('Force and Energy','Transformation of Energy','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Force and Energy','Pressure','Official KICD Grade 8 Integrated Science sub-strand from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',2)
) AS v(strand_name, sub_strand_name, sub_strand_description, sub_strand_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='integrated science'
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_sub_strands ss
  WHERE ss.strand_id=st.id AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
);

INSERT INTO curriculum_topics (sub_strand_id, topic_name, topic_description, learning_objectives, topic_order)
SELECT ss.id, v.topic_name, v.topic_description, ARRAY[]::text[], v.topic_order
FROM (VALUES
  ('Mixtures, Elements and Compounds','Elements and Compounds','Atoms, elements, molecules and compounds','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Mixtures, Elements and Compounds','Elements and Compounds','Symbols of common elements','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',2),
  ('Mixtures, Elements and Compounds','Elements and Compounds','Word equations for reactions of elements to form compounds','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',3),
  ('Mixtures, Elements and Compounds','Elements and Compounds','Uses of some common elements in the society','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',4),
  ('Mixtures, Elements and Compounds','Physical and chemical changes','Physical and chemical changes','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Mixtures, Elements and Compounds','Physical and chemical changes','Kinetic theory of matter','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',2),
  ('Mixtures, Elements and Compounds','Physical and chemical changes','Heating curve','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',3),
  ('Mixtures, Elements and Compounds','Physical and chemical changes','Effects of impurities on boiling point and melting point','Official KICD Grade 8 Integrated Science detailed content heading from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',4),
  ('Mixtures, Elements and Compounds','Classes of fire','Classes of fire','Official KICD Grade 8 Integrated Science source-summary topic anchor from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Living Things and the Environment','The Cell','The Cell','Official KICD Grade 8 Integrated Science source-summary topic anchor from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Living Things and the Environment','Movement of materials in and out of the cell','Movement of materials in and out of the cell','Official KICD Grade 8 Integrated Science source-summary topic anchor from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Living Things and the Environment','Reproduction in human beings','Reproduction in human beings','Official KICD Grade 8 Integrated Science source-summary topic anchor from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Force and Energy','Transformation of Energy','Transformation of Energy','Official KICD Grade 8 Integrated Science source-summary topic anchor from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1),
  ('Force and Energy','Pressure','Pressure','Official KICD Grade 8 Integrated Science source-summary topic anchor from Drive file 1RpqZRmeMywbc1Tya0_x-tNJBs75Gy0-v.',1)
) AS v(strand_name, sub_strand_name, topic_name, topic_description, topic_order)
JOIN curriculum_grades g ON g.grade_number=8
JOIN curriculum_subjects s ON s.grade_id=g.id
  AND lower(trim(s.subject_name))='integrated science'
JOIN curriculum_strands st ON st.subject_id=s.id
  AND lower(trim(st.strand_name))=lower(trim(v.strand_name))
JOIN curriculum_sub_strands ss ON ss.strand_id=st.id
  AND lower(trim(ss.sub_strand_name))=lower(trim(v.sub_strand_name))
WHERE NOT EXISTS (
  SELECT 1 FROM curriculum_topics t
  WHERE t.sub_strand_id=ss.id
    AND lower(trim(t.topic_name))=lower(trim(v.topic_name))
    AND t.topic_description ~* '(official|source-verified)[[:space:]]+kicd'
);

COMMIT;
