-- Current revised-2024 Grade 9 hierarchy promotion.
-- Legacy rows are retained for historical references; the application already prefers
-- rows whose strand_description is marked Official KICD/source-verified.
-- Sources: KICD revised-2024 Grade 9 designs and the audit report in research/.
DO $$
DECLARE
  subject_id uuid;
  strand_id uuid;
  item jsonb;
  subject_name text;
  source_url text := 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/';
  curriculum jsonb := $data$
  [
    {"subject":"Mathematics","strands":[
      {"name":"Numbers","subs":["Integers","Cubes and Cube Roots","Indices and Logarithms","Compound Proportions and Rates of Work"]},
      {"name":"Algebra","subs":["Matrices","Equation of a Straight Line","Linear Inequalities"]},
      {"name":"Measurements","subs":["Area","Volume of Solids","Mass, Volume, Weight, and Density","Time, Distance, and Speed","Money","Approximations and Errors"]},
      {"name":"Geometry","subs":["Coordinates and Graphs","Scale Drawing","Similarity and Enlargement","Trigonometry"]},
      {"name":"Data Handling and Probability","subs":["Data Interpretation (Grouped Data)","Probability"]}
    ]},
    {"subject":"English","strands":[
      {"name":"Listening and Speaking","subs":["Polite Language - Euphemism","Oral Literature - Short Forms","Listening Comprehension - Grade Appropriate Texts (Main Idea and Specific Details)","Selective Listening","Pronunciation","Conversational Skills - Negotiation Skills","Listening for Details","Oral Poetry","Diphthongs and Sentence Stress","Impromptu Speeches","Conversation Skills - Job Interviews","Listening to Respond - Expressing Feelings","Extensive Listening - Speeches","Intonation in Sentences - Question Tags","Oral Reports - News (Role Play)"]},
      {"name":"Reading","subs":["Independent Reading - Grade Appropriate Texts","Intensive Reading - Simple Poems","Reading for Information and Meaning","Intensive Reading - Key Events","Reference Materials","Reading Fluency","Intensive Reading - Interpretation and Evaluation","Reading for Interpretation","Extensive Reading - Grade Appropriate Fiction","Study Skills - Note Making","Extensive Reading - Fiction","Intensive Reading - Comprehension Strategies","Intensive Reading - Visualising and Summarising","Summarising - Argumentative Texts","Reading Fluency","Class Reader - Structure and Setting","Class Reader - Plot","Poems - Structure","Class Reader - Characters","Class Reader - Style","Class Reader - Themes","Class Reader - Intensive Reading Characters","Poetry - Characters","Class Reader - Style","Class Reader - Play (Project)","Class Reader - Lessons Learnt","Class Reader - Characterisation","Class Reader - Style","Class Reader - Relating Characters and Themes to Real Life","Intensive Reading - Poems"]},
      {"name":"Grammar","subs":["Gender Neutral Language","Nouns and Quantifiers","Modal Auxiliaries","Present and Past Perfect Aspect","Order of Adjectives","Comparison of Adverbs","Relative and Interrogative Pronouns","Complex Prepositions","Correlative Conjunctions","Determiners - Numerals and Ordinals","Nouns","Phrasal Verbs","Complex Sentences","Direct and Indirect Speech","Imperatives and Exclamatory Sentences"]},
      {"name":"Writing","subs":["Legibility and Neatness","Punctuation Marks","Structure of a Paragraph","Descriptive and Narrative Paragraphs","Letter of Application","Spelling","The Writing Process - Steps","Assessing Writing","Narrative Composition","Filling Forms - Application Forms","Mechanics of Writing - Abbreviations and Acronyms","The Writing Process","Creative Writing - Idioms","Descriptive Writing","Emails"]}
    ]},
    {"subject":"Integrated Science","strands":[
      {"name":"Mixtures, Elements, and Compounds","subs":["The Atom","The Periodic Table","Chemical Bonding","Chemical Reactions"]},
      {"name":"Living Things and their Environment","subs":["The Human Reproductive System","The Human Excretory System","The Human Nervous System","The Human Endocrine System"]},
      {"name":"Force and Energy","subs":["Curved Mirrors","Waves","Pressure"]}
    ]},
    {"subject":"Social Studies","strands":[
      {"name":"Social Studies and Career Development","subs":["Pathway Choices","Pre-career Support Systems"]},
      {"name":"Community Service-Learning","subs":["Community Service-Learning Project"]},
      {"name":"People and Relationships","subs":["Socio-economic Practices of Early Humans","Indigenous Knowledge Systems in African Societies","Poverty Reduction","Population Structure","Peaceful Conflict Resolution","Healthy Relationships"]},
      {"name":"Natural and Historic Built Environments","subs":["Topographical Maps","Internal Land Forming Processes","Multipurpose River Projects in Africa","Management and Conservation of the Environment","World Heritage Sites in Africa"]},
      {"name":"Political Developments and Governance","subs":["The Constitution of Kenya","Civic Engagement in Governance","Kenya’s Bill of Rights","Cultural Globalisation"]}
    ]},
    {"subject":"Pre-Technical Studies","strands":[
      {"name":"Foundations of Pre-Technical Studies","subs":["Safety on Raised Platforms","Handling Hazardous Substances","Self-Exploration and Career Development"]},
      {"name":"Communication in Pre-Technical Studies","subs":["Oblique Projection","Visual Programming"]},
      {"name":"Materials for Production","subs":["Wood","Handling Waste Materials"]},
      {"name":"Tools and Production","subs":["Holding Tools","Driving Tools","Project"]},
      {"name":"Entrepreneurship","subs":["Financial Services","Government and Business","Business Plan"]}
    ]},
    {"subject":"Christian Religious Education","strands":[
      {"name":"Creation","subs":["Work (God Worked)"]},
      {"name":"The Bible","subs":["Christian Moral Values","Kings David and Solomon"]},
      {"name":"The Life and Ministry of Jesus Christ","subs":["Raising the Widow’s Son","Healing the 10 Lepers","Parable on Prayer","Nicodemus Encounter with Jesus Christ","Jesus Ministry in Jerusalem"]},
      {"name":"The Church","subs":["The Early Church","The Gifts of the Holy Spirit"]},
      {"name":"Christian Living Today","subs":["Courtship and Marriage","Responsible Parenthood","Leisure","Wealth Money and Poverty"]}
    ]},
    {"subject":"Islamic Religious Education","strands":[
      {"name":"Qur’an","subs":["Ulum al-Qur’an","Selected Chapter Surah Al-Hujurat (Q 49)"]},
      {"name":"Hadith","subs":["Ulum al-Hadith","Selected Hadith"]},
      {"name":"Pillars of Iman","subs":["Belief in the Last Day (Day of Judgement)","Belief in Qadar"]},
      {"name":"Devotional Acts","subs":["Shariah (Islamic law)","Tawbah (Repentance)"]},
      {"name":"Akhlaq (Moral Teachings)","subs":["Virtues in Islam","Significance of Islamic Morality","Prohibitions in Islam"]},
      {"name":"Muamalat (Social Relations)","subs":["Domestic violence","Iddah","Child custody","Polygamy in Islam","Trade and Finance in Islam","Contemporary Issues"]},
      {"name":"Islamic Heritage and Civilisation","subs":["Islam in Kenya","Unity of Muslims","Muslim Institutions"]}
    ]}
  ]$data$::jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(curriculum) LOOP
    subject_name := item->>'subject';
    SELECT s.id INTO subject_id
      FROM public.curriculum_subjects s
      JOIN public.curriculum_grades g ON g.id=s.grade_id
     WHERE g.grade_number=9 AND lower(trim(s.subject_name))=lower(trim(subject_name))
     ORDER BY s.id LIMIT 1;
    IF subject_id IS NULL THEN CONTINUE; END IF;

    FOR strand_id IN SELECT st.id FROM public.curriculum_strands st WHERE st.subject_id=subject_id AND st.strand_description ILIKE '%Current revised-2024 KICD Grade 9%' LOOP
      UPDATE public.curriculum_strands SET strand_description=NULL WHERE id=strand_id;
    END LOOP;

    FOR strand_id IN SELECT st.id FROM public.curriculum_strands st WHERE st.subject_id=subject_id AND st.strand_description ILIKE '%Official KICD Grade 9%' LOOP
      UPDATE public.curriculum_strands SET strand_description=NULL WHERE id=strand_id;
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(item->'strands') LOOP
      INSERT INTO public.curriculum_strands(subject_id,strand_name,strand_description,strand_order)
      SELECT subject_id, item->>'name', 'Official KICD Grade 9 revised-2024 current hierarchy; source: ' || source_url, (row_number() over())::int
      WHERE NOT EXISTS (
        SELECT 1 FROM public.curriculum_strands st
         WHERE st.subject_id=subject_id
           AND lower(trim(st.strand_name))=lower(trim(item->>'name'))
           AND st.strand_description ILIKE '%Official KICD Grade 9 revised-2024%'
      );
      SELECT st.id INTO strand_id FROM public.curriculum_strands st
       WHERE st.subject_id=subject_id AND lower(trim(st.strand_name))=lower(trim(item->>'name'))
         AND st.strand_description ILIKE '%Official KICD Grade 9 revised-2024%'
       ORDER BY st.id DESC LIMIT 1;
      FOR item IN SELECT * FROM jsonb_array_elements(item->'subs') LOOP
        INSERT INTO public.curriculum_sub_strands(strand_id,sub_strand_name,sub_strand_description,sub_strand_order)
        SELECT strand_id, item#>>'{}', 'Official KICD Grade 9 revised-2024 current hierarchy; source: ' || source_url, (row_number() over())::int
        WHERE NOT EXISTS (SELECT 1 FROM public.curriculum_sub_strands ss WHERE ss.strand_id=strand_id AND lower(trim(ss.sub_strand_name))=lower(trim(item#>>'{}')) AND ss.sub_strand_description ILIKE '%Official KICD Grade 9 revised-2024%');
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Keep the current paper defaults aligned with the 2026 KJSEA timetable.
UPDATE public.exam_paper_defaults SET duration_minutes=60, source='KNEC 2026 KJSEA Regulations and Timetable'
 WHERE subject_name='Integrated Science' AND grade_number=9 AND paper_type='Paper 2';
UPDATE public.exam_paper_defaults SET duration_minutes=NULL, source='KNEC 2026 KJSEA Regulations and Timetable (project window)'
 WHERE subject_name IN ('Agriculture and Nutrition','Creative Arts and Sports','Pre-Technical Studies') AND grade_number=9 AND paper_type IN ('Paper 1','Paper 2')
   AND subject_name <> 'Integrated Science' AND (subject_name <> 'Creative Arts and Sports' OR paper_type='Paper 1') AND (subject_name <> 'Agriculture and Nutrition' OR paper_type='Paper 2') AND (subject_name <> 'Pre-Technical Studies' OR paper_type='Paper 2');
