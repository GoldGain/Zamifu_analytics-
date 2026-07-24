-- Populate CBC curriculum strands and sub-strands for Grades 7-9
-- 9 compulsory subjects per grade: English, Kiswahili, Mathematics, Integrated Science,
-- Social Studies, Religious Education, Pre-Technical Studies, Agriculture and Nutrition,
-- Creative Arts and Sports
-- Total: 9 subjects x 3 grades = 27 combinations, each with multiple strands and sub-strands

-- Disable RLS temporarily for this admin migration
ALTER TABLE public.exam_knowledge_chunks DISABLE ROW LEVEL SECURITY;

-- Grade 7: English
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Listening and Speaking: Conversational skills including self-introduction, introducing others, turn-taking, polite language, oral presentation, listening for information, listening comprehension, and active listening strategies.', 'English', 'Grade 7', 'Listening and Speaking', 'Conversational Skills', true),
('KICD Grade 7 Curriculum Design', 'Listening and Speaking: Oral presentation skills including presenting information, narrating events, describing processes, and using appropriate register and tone.', 'English', 'Grade 7', 'Listening and Speaking', 'Oral Presentation', true),
('KICD Grade 7 Curriculum Design', 'Listening and Speaking: Listening comprehension including identifying main ideas, supporting details, making inferences, and answering factual and inferential questions.', 'English', 'Grade 7', 'Listening and Speaking', 'Listening Comprehension', true),
('KICD Grade 7 Curriculum Design', 'Reading: Intensive reading of trickster narratives, oral narratives, legends, simple poems, and class readers. Reading for information and reading for meaning.', 'English', 'Grade 7', 'Reading', 'Intensive Reading', true),
('KICD Grade 7 Curriculum Design', 'Reading: Study skills including synonyms and antonyms, mind maps, main ideas and supporting details, identifying the topic sentence.', 'English', 'Grade 7', 'Reading', 'Study Skills', true),
('KICD Grade 7 Curriculum Design', 'Reading: Extensive reading and independent reading skills including book reports, reading logs, and personal reading records.', 'English', 'Grade 7', 'Reading', 'Extensive Reading', true),
('KICD Grade 7 Curriculum Design', 'Writing: Narrative paragraphs including introduction, body, and conclusion. Using examples and incidents to develop paragraphs.', 'English', 'Grade 7', 'Writing', 'Narrative Writing', true),
('KICD Grade 7 Curriculum Design', 'Writing: Mechanics of writing including punctuation marks, capitalization, spelling conventions, and sentence construction.', 'English', 'Grade 7', 'Writing', 'Mechanics of Writing', true),
('KICD Grade 7 Curriculum Design', 'Writing: Handwriting focusing on legibility, neatness, speed, and proper formation of letters.', 'English', 'Grade 7', 'Writing', 'Handwriting', true),
('KICD Grade 7 Curriculum Design', 'Grammar: Word classes including nouns (abstract, concrete, count, uncountable), verbs and tense, adjectives (comparatives and superlatives), adverbs, pronouns, prepositions, conjunctions, and interjections.', 'English', 'Grade 7', 'Grammar', 'Word Classes', true),
('KICD Grade 7 Curriculum Design', 'Grammar: Sentence structure including simple sentences, compound sentences, complex sentences, subject-verb agreement, and sentence transformation.', 'English', 'Grade 7', 'Grammar', 'Sentence Structure', true),
('KICD Grade 7 Curriculum Design', 'Literature in English: Prose including short stories, novels, and class readers. Poetry including simple poems, figures of speech, rhyme, and rhythm.', 'English', 'Grade 7', 'Literature in English', 'Prose and Poetry', true),
('KICD Grade 7 Curriculum Design', 'Literature in English: Oral literature including proverbs, riddles, tongue twisters, and oral narratives.', 'English', 'Grade 7', 'Literature in English', 'Oral Literature', true);

-- Grade 7: Kiswahili
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Kusikiliza na Kuzungumza: Uwezo wa kusikiliza na kuzungumza, mazungumzo, mahojiano, mazungumzo rasmi na yasiyo rasmi, na utamaduni wa mazungumzo.', 'Kiswahili', 'Grade 7', 'Kusikiliza na Kuzungumza', 'Mazungumzo', true),
('KICD Grade 7 Curriculum Design', 'Kusikiliza na Kuzungumza: Mazungumzo rasmi ikiwa ni pamoja na mazungumzo ya biashara, mazungumzo ya shuleni, na mazungumzo ya jamii.', 'Kiswahili', 'Grade 7', 'Kusikiliza na Kuzungumza', 'Mazungumzo Rasmi', true),
('KICD Grade 7 Curriculum Design', 'Kusoma: Kusoma kwa uelewa ikiwa ni pamoja na kuelewa mawazo makuu, maelezo, na kufanya maamuzi kutokana na maandishi.', 'Kiswahili', 'Grade 7', 'Kusoma', 'Kusoma kwa Uelewa', true),
('KICD Grade 7 Curriculum Design', 'Kusoma: Ujuzi wa kusoma ikiwa ni pamoja na usomaji wa maneno, usomaji wa misemo, na fahamu.', 'Kiswahili', 'Grade 7', 'Kusoma', 'Ujuzi wa Kusoma', true),
('KICD Grade 7 Curriculum Design', 'Kuandika: Kuandika insha fupi ikiwa ni pamoja na aya, tamko kuu, na maelezo ya kiungo.', 'Kiswahili', 'Grade 7', 'Kuandika', 'Kuandika Insha', true),
('KICD Grade 7 Curriculum Design', 'Kuandika: Fasihi Simulizi ikiwa ni pamoja na hadithi fupi, methali, fumbo, na vitendawili.', 'Kiswahili', 'Grade 7', 'Kuandika', 'Fasihi Simulizi', true),
('KICD Grade 7 Curriculum Design', 'Sarufi: Aina za maneno ikiwa ni pamoja na nomino, kitenzi, kitenzi kisaidizi, vivumishi, vibadala, majina, na viambatisho.', 'Kiswahili', 'Grade 7', 'Sarufi', 'Aina za Maneno', true),
('KICD Grade 7 Curriculum Design', 'Sarufi: Muundo wa sentensi ikiwa ni pamoja na sentensi rahisi, sentensi changamano, na usuluhisho wa sentensi.', 'Kiswahili', 'Grade 7', 'Sarufi', 'Muundo wa Sentensi', true),
('KICD Grade 7 Curriculum Design', 'Fasihi: Hadithi fupi, riwaya fupi, na mashairi ikiwa ni pamoja na vifaa vya lugha, mizani, na kina.', 'Kiswahili', 'Grade 7', 'Fasihi', 'Hadithi na Mashairi', true);

-- Grade 7: Mathematics
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Numbers: Integers including directed numbers, number lines, ordering integers, and operations with positive and negative numbers.', 'Mathematics', 'Grade 7', 'Numbers', 'Integers', true),
('KICD Grade 7 Curriculum Design', 'Numbers: Fractions including equivalent fractions, operations with fractions (addition, subtraction, multiplication, division), mixed numbers, and word problems.', 'Mathematics', 'Grade 7', 'Numbers', 'Fractions', true),
('KICD Grade 7 Curriculum Design', 'Numbers: Decimals including place value, conversion between fractions and decimals, operations with decimals, and rounding.', 'Mathematics', 'Grade 7', 'Numbers', 'Decimals', true),
('KICD Grade 7 Curriculum Design', 'Numbers: Squares, Square Roots, Cubes and Cube Roots including computation and real-world applications.', 'Mathematics', 'Grade 7', 'Numbers', 'Squares Square Roots Cubes and Cube Roots', true),
('KICD Grade 7 Curriculum Design', 'Numbers: Indices including laws of indices, scientific notation, and application of index notation.', 'Mathematics', 'Grade 7', 'Numbers', 'Indices', true),
('KICD Grade 7 Curriculum Design', 'Numbers: Ratio and Proportion including sharing in given ratios, direct proportion, and inverse proportion.', 'Mathematics', 'Grade 7', 'Numbers', 'Ratio and Proportion', true),
('KICD Grade 7 Curriculum Design', 'Numbers: Percentages including percentage of quantities, profit, loss, discount, VAT, simple interest, and percentage change.', 'Mathematics', 'Grade 7', 'Numbers', 'Percentages', true),
('KICD Grade 7 Curriculum Design', 'Algebra: Algebraic Expressions including simplifying expressions, expanding brackets, collecting like terms, and factorisation.', 'Mathematics', 'Grade 7', 'Algebra', 'Algebraic Expressions', true),
('KICD Grade 7 Curriculum Design', 'Algebra: Linear Equations including solving one-variable equations, forming equations from word problems, and substitution.', 'Mathematics', 'Grade 7', 'Algebra', 'Linear Equations', true),
('KICD Grade 7 Curriculum Design', 'Algebra: Linear Inequalities including representing inequalities on number lines, solving simple inequalities, and compound inequalities.', 'Mathematics', 'Grade 7', 'Algebra', 'Linear Inequalities', true),
('KICD Grade 7 Curriculum Design', 'Algebra: Sequences and Patterns including finding the nth term, arithmetic sequences, and geometric patterns.', 'Mathematics', 'Grade 7', 'Algebra', 'Sequences and Patterns', true),
('KICD Grade 7 Curriculum Design', 'Geometry: Angles and Lines including types of angles, parallel lines and transversals, angle sums, and properties of angles.', 'Mathematics', 'Grade 7', 'Geometry', 'Angles and Lines', true),
('KICD Grade 7 Curriculum Design', 'Geometry: Triangles including classification of triangles, Pythagoras theorem, congruence, and properties of triangles.', 'Mathematics', 'Grade 7', 'Geometry', 'Triangles', true),
('KICD Grade 7 Curriculum Design', 'Geometry: Quadrilaterals and Polygons including properties, angle sums, area calculations, and regular polygons.', 'Mathematics', 'Grade 7', 'Geometry', 'Quadrilaterals and Polygons', true),
('KICD Grade 7 Curriculum Design', 'Geometry: Circles including parts of a circle, circumference, area of a circle, arcs, and sectors.', 'Mathematics', 'Grade 7', 'Geometry', 'Circles', true),
('KICD Grade 7 Curriculum Design', 'Geometry: Transformations including reflection, rotation, translation, and enlargement on a grid.', 'Mathematics', 'Grade 7', 'Geometry', 'Transformations', true),
('KICD Grade 7 Curriculum Design', 'Geometry: Construction using compasses and ruler to construct angles, triangles, perpendicular bisectors, and angle bisectors.', 'Mathematics', 'Grade 7', 'Geometry', 'Construction', true),
('KICD Grade 7 Curriculum Design', 'Measurements: Length, Mass and Capacity including units of measurement, conversions, and practical calculations.', 'Mathematics', 'Grade 7', 'Measurements', 'Length Mass and Capacity', true),
('KICD Grade 7 Curriculum Design', 'Measurements: Area and Perimeter including composite shapes, rectangles, triangles, circles, and real-world applications.', 'Mathematics', 'Grade 7', 'Measurements', 'Area and Perimeter', true),
('KICD Grade 7 Curriculum Design', 'Measurements: Volume and Surface Area including cuboids, cylinders, and practical applications.', 'Mathematics', 'Grade 7', 'Measurements', 'Volume and Surface Area', true),
('KICD Grade 7 Curriculum Design', 'Measurements: Time and Speed including average speed, distance-time calculations, and unit conversions.', 'Mathematics', 'Grade 7', 'Measurements', 'Time and Speed', true),
('KICD Grade 7 Curriculum Design', 'Measurements: Money and Financial Literacy including budgeting, simple interest, currency conversion, and financial planning.', 'Mathematics', 'Grade 7', 'Measurements', 'Money and Financial Literacy', true),
('KICD Grade 7 Curriculum Design', 'Data Handling and Probability: Data Collection and Presentation including frequency tables, bar charts, line graphs, pie charts, and histograms.', 'Mathematics', 'Grade 7', 'Data Handling and Probability', 'Data Collection and Presentation', true),
('KICD Grade 7 Curriculum Design', 'Data Handling and Probability: Measures of Central Tendency including mean, median, mode, and range.', 'Mathematics', 'Grade 7', 'Data Handling and Probability', 'Measures of Central Tendency', true),
('KICD Grade 7 Curriculum Design', 'Data Handling and Probability: Probability including simple events, experimental probability, theoretical probability, and probability scales.', 'Mathematics', 'Grade 7', 'Data Handling and Probability', 'Probability', true);

-- Grade 7: Integrated Science
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Introduction to Science: Nature of science, scientific method, laboratory safety, and scientific equipment.', 'Integrated Science', 'Grade 7', 'Introduction to Science', 'Nature of Science', true),
('KICD Grade 7 Curriculum Design', 'Introduction to Science: Measurement and SI units including length, mass, time, temperature, and derived quantities.', 'Integrated Science', 'Grade 7', 'Introduction to Science', 'Measurement', true),
('KICD Grade 7 Curriculum Design', 'Living Things: Classification of living organisms including plants, animals, microorganisms, and key features.', 'Integrated Science', 'Grade 7', 'Living Things', 'Classification of Living Things', true),
('KICD Grade 7 Curriculum Design', 'Living Things: Cell structure including plant and animal cells, cell organelles, and cell functions.', 'Integrated Science', 'Grade 7', 'Living Things', 'Cell Structure and Functions', true),
('KICD Grade 7 Curriculum Design', 'Living Things: Human body systems including digestive, respiratory, circulatory, and excretory systems.', 'Integrated Science', 'Grade 7', 'Living Things', 'Human Body Systems', true),
('KICD Grade 7 Curriculum Design', 'Living Things: Reproduction in plants and animals including pollination, fertilisation, and life cycles.', 'Integrated Science', 'Grade 7', 'Living Things', 'Reproduction', true),
('KICD Grade 7 Curriculum Design', 'Living Things: Nutrition including balanced diet, food groups, digestion, and absorption.', 'Integrated Science', 'Grade 7', 'Living Things', 'Nutrition', true),
('KICD Grade 7 Curriculum Design', 'Materials: Properties of materials including solids, liquids, gases, density, and states of matter.', 'Integrated Science', 'Grade 7', 'Materials', 'Properties of Materials', true),
('KICD Grade 7 Curriculum Design', 'Materials: Mixtures and separation techniques including filtration, evaporation, distillation, chromatography, and decantation.', 'Integrated Science', 'Grade 7', 'Materials', 'Mixtures and Separation', true),
('KICD Grade 7 Curriculum Design', 'Materials: Acids, bases and salts including pH scale, indicators, neutralisation, and practical applications.', 'Integrated Science', 'Grade 7', 'Materials', 'Acids Bases and Salts', true),
('KICD Grade 7 Curriculum Design', 'Energy: Forms of energy including heat, light, sound, electrical, and chemical energy.', 'Integrated Science', 'Grade 7', 'Energy', 'Forms of Energy', true),
('KICD Grade 7 Curriculum Design', 'Energy: Heat transfer including conduction, convection, radiation, and practical applications.', 'Integrated Science', 'Grade 7', 'Energy', 'Heat Transfer', true),
('KICD Grade 7 Curriculum Design', 'Energy: Light including reflection, refraction, dispersion, and optical instruments.', 'Integrated Science', 'Grade 7', 'Energy', 'Light', true),
('KICD Grade 7 Curriculum Design', 'Energy: Electrical energy including circuits, conductors, insulators, series and parallel circuits, and electrical safety.', 'Integrated Science', 'Grade 7', 'Energy', 'Electrical Energy', true),
('KICD Grade 7 Curriculum Design', 'Earth and Space: The Earth in the solar system including planets, orbits, rotation, and revolution.', 'Integrated Science', 'Grade 7', 'Earth and Space', 'The Earth and Solar System', true),
('KICD Grade 7 Curriculum Design', 'Earth and Space: Weather and climate including weather elements, weather instruments, and climate change.', 'Integrated Science', 'Grade 7', 'Earth and Space', 'Weather and Climate', true),
('KICD Grade 7 Curriculum Design', 'Earth and Space: Rocks and minerals including types of rocks, rock cycle, and uses of rocks and minerals.', 'Integrated Science', 'Grade 7', 'Earth and Space', 'Rocks and Minerals', true),
('KICD Grade 7 Curriculum Design', 'Environment: Environmental conservation including pollution, conservation methods, and sustainable resource use.', 'Integrated Science', 'Grade 7', 'Environment', 'Environmental Conservation', true);

-- Grade 7: Social Studies
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'History: Early human development including origins of mankind, migration of early humans, and early societies.', 'Social Studies', 'Grade 7', 'History', 'Early Human Development', true),
('KICD Grade 7 Curriculum Design', 'History: African civilisations including ancient Egypt, Great Zimbabwe, and other early African states.', 'Social Studies', 'Grade 7', 'History', 'African Civilisations', true),
('KICD Grade 7 Curriculum Design', 'History: Colonial history of East Africa including European exploration, colonisation, and resistance movements.', 'Social Studies', 'Grade 7', 'History', 'Colonial History of East Africa', true),
('KICD Grade 7 Curriculum Design', 'History: Independence movements including the struggle for independence in East Africa, key leaders, and the journey to independence.', 'Social Studies', 'Grade 7', 'History', 'Independence Movements', true),
('KICD Grade 7 Curriculum Design', 'Geography: Physical geography including landforms, rivers, lakes, mountains, and climate zones of Africa.', 'Social Studies', 'Grade 7', 'Geography', 'Physical Geography', true),
('KICD Grade 7 Curriculum Design', 'Geography: Map work including reading maps, map symbols, grid references, scale, and direction.', 'Social Studies', 'Grade 7', 'Geography', 'Map Work', true),
('KICD Grade 7 Curriculum Design', 'Geography: Weather and climate including weather elements, climate types, and factors affecting climate.', 'Social Studies', 'Grade 7', 'Geography', 'Weather and Climate', true),
('KICD Grade 7 Curriculum Design', 'Geography: Natural resources including mineral resources, water resources, and sustainable use of resources.', 'Social Studies', 'Grade 7', 'Geography', 'Natural Resources', true),
('KICD Grade 7 Curriculum Design', 'Geography: Population and settlement including population distribution, urban and rural settlements, and migration.', 'Social Studies', 'Grade 7', 'Geography', 'Population and Settlement', true),
('KICD Grade 7 Curriculum Design', 'Civics: Governance including types of government, democracy, and the structure of government in Kenya.', 'Social Studies', 'Grade 7', 'Civics', 'Governance', true),
('KICD Grade 7 Curriculum Design', 'Civics: Rights and responsibilities including human rights, children rights, and civic responsibilities.', 'Social Studies', 'Grade 7', 'Civics', 'Rights and Responsibilities', true),
('KICD Grade 7 Curriculum Design', 'Civics: The Kenyan Constitution including the constitution of Kenya 2010, bill of rights, and devolution.', 'Social Studies', 'Grade 7', 'Civics', 'The Kenyan Constitution', true),
('KICD Grade 7 Curriculum Design', 'Community Service Learning: Community projects, civic engagement, and social responsibility.', 'Social Studies', 'Grade 7', 'Community Service Learning', 'Civic Engagement', true);

-- Grade 7: Religious Education (CRE/IRE/HRE)
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Religious Education: Sacred texts and scriptures including the Bible, Quran, or other sacred texts depending on faith tradition.', 'Religious Education', 'Grade 7', 'Sacred Texts', 'Introduction to Sacred Texts', true),
('KICD Grade 7 Curriculum Design', 'Religious Education: Creation and origins including creation narratives, the beginning of life, and the relationship between humans and the creator.', 'Religious Education', 'Grade 7', 'Creation and Origins', 'Creation Narratives', true),
('KICD Grade 7 Curriculum Design', 'Religious Education: Prophets and messengers including the role of prophets, key prophetic figures, and their teachings.', 'Religious Education', 'Grade 7', 'Prophets and Messengers', 'Prophetic Figures', true),
('KICD Grade 7 Curriculum Design', 'Religious Education: Worship and prayer including types of worship, prayer practices, places of worship, and the importance of prayer.', 'Religious Education', 'Grade 7', 'Worship and Prayer', 'Types of Worship', true),
('KICD Grade 7 Curriculum Design', 'Religious Education: Morals and values including moral teachings, virtues, character building, and ethical decision making.', 'Religious Education', 'Grade 7', 'Morals and Values', 'Moral Teachings', true),
('KICD Grade 7 Curriculum Design', 'Religious Education: Social responsibility including caring for others, community service, environmental stewardship, and justice.', 'Religious Education', 'Grade 7', 'Social Responsibility', 'Community Care', true),
('KICD Grade 7 Curriculum Design', 'Religious Education: Religious festivals and celebrations including major religious festivals, their significance, and observance.', 'Religious Education', 'Grade 7', 'Festivals and Celebrations', 'Religious Festivals', true);

-- Grade 7: Pre-Technical Studies
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Introduction to Pre-Technical Studies: Safety in the workshop, tools identification, and basic workshop practices.', 'Pre-Technical Studies', 'Grade 7', 'Introduction to Pre-Technical Studies', 'Workshop Safety', true),
('KICD Grade 7 Curriculum Design', 'Technical Drawing: Drawing instruments, geometric construction, orthographic projection, and pictorial drawing.', 'Pre-Technical Studies', 'Grade 7', 'Technical Drawing', 'Drawing Fundamentals', true),
('KICD Grade 7 Curriculum Design', 'Technical Drawing: Scales, dimensioning, and freehand sketching including isometric and oblique drawings.', 'Pre-Technical Studies', 'Grade 7', 'Technical Drawing', 'Scales and Dimensioning', true),
('KICD Grade 7 Curriculum Design', 'Woodwork: Properties of wood, woodwork tools, woodwork joints, and basic woodwork projects.', 'Pre-Technical Studies', 'Grade 7', 'Woodwork', 'Properties of Wood', true),
('KICD Grade 7 Curriculum Design', 'Woodwork: Woodwork joints including butt joint, lap joint, dovetail joint, mortise and tenon joint.', 'Pre-Technical Studies', 'Grade 7', 'Woodwork', 'Woodwork Joints', true),
('KICD Grade 7 Curriculum Design', 'Metalwork: Properties of metals, metalwork tools, basic metalwork processes, and safety in metalwork.', 'Pre-Technical Studies', 'Grade 7', 'Metalwork', 'Properties of Metals', true),
('KICD Grade 7 Curriculum Design', 'Metalwork: Metalwork processes including cutting, filing, drilling, bending, and basic fabrication.', 'Pre-Technical Studies', 'Grade 7', 'Metalwork', 'Metalwork Processes', true),
('KICD Grade 7 Curriculum Design', 'Electrical: Basic electrical circuits, conductors and insulators, simple switches, bulbs, and electrical safety.', 'Pre-Technical Studies', 'Grade 7', 'Electrical', 'Basic Electrical Circuits', true),
('KICD Grade 7 Curriculum Design', 'Agriculture: Simple farming tools, land preparation, planting, and care of crops.', 'Pre-Technical Studies', 'Grade 7', 'Agriculture', 'Farming Tools and Practices', true),
('KICD Grade 7 Curriculum Design', 'Agriculture: Animal husbandry basics including care of domestic animals, feeding, and housing.', 'Pre-Technical Studies', 'Grade 7', 'Agriculture', 'Animal Husbandry', true),
('KICD Grade 7 Curriculum Design', 'Building Construction: Building materials, basic structures, and simple construction practices.', 'Pre-Technical Studies', 'Grade 7', 'Building Construction', 'Building Materials', true);

-- Grade 7: Agriculture and Nutrition
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Introduction to Agriculture: Importance of agriculture, types of farming, and agricultural practices in Kenya.', 'Agriculture and Nutrition', 'Grade 7', 'Introduction to Agriculture', 'Importance of Agriculture', true),
('KICD Grade 7 Curriculum Design', 'Crop Production: Land preparation including clearing, ploughing, harrowing, and ridging.', 'Agriculture and Nutrition', 'Grade 7', 'Crop Production', 'Land Preparation', true),
('KICD Grade 7 Curriculum Design', 'Crop Production: Planting methods including broadcasting, drilling, dibbling, and transplanting.', 'Agriculture and Nutrition', 'Grade 7', 'Crop Production', 'Planting Methods', true),
('KICD Grade 7 Curriculum Design', 'Crop Production: Crop care including weeding, watering, mulching, earthing up, and application of manure.', 'Agriculture and Nutrition', 'Grade 7', 'Crop Production', 'Crop Care', true),
('KICD Grade 7 Curriculum Design', 'Crop Production: Crop pests and diseases including identification, effects, and control measures.', 'Agriculture and Nutrition', 'Grade 7', 'Crop Production', 'Crop Pests and Diseases', true),
('KICD Grade 7 Curriculum Design', 'Animal Production: Types of livestock, livestock management, feeding, and housing.', 'Agriculture and Nutrition', 'Grade 7', 'Animal Production', 'Livestock Management', true),
('KICD Grade 7 Curriculum Design', 'Animal Production: Common livestock diseases including identification, prevention, and treatment.', 'Agriculture and Nutrition', 'Grade 7', 'Animal Production', 'Livestock Diseases', true),
('KICD Grade 7 Curriculum Design', 'Animal Production: Breeding and reproduction in animals including artificial insemination and natural breeding.', 'Agriculture and Nutrition', 'Grade 7', 'Animal Production', 'Breeding and Reproduction', true),
('KICD Grade 7 Curriculum Design', 'Soil and Water Conservation: Soil erosion types and causes, soil conservation methods, and water conservation.', 'Agriculture and Nutrition', 'Grade 7', 'Soil and Water Conservation', 'Soil Conservation', true),
('KICD Grade 7 Curriculum Design', 'Soil and Water Conservation: Irrigation methods, water harvesting, and efficient water use.', 'Agriculture and Nutrition', 'Grade 7', 'Soil and Water Conservation', 'Water Conservation', true),
('KICD Grade 7 Curriculum Design', 'Nutrition: Food groups and balanced diet including carbohydrates, proteins, fats, vitamins, minerals, and water.', 'Agriculture and Nutrition', 'Grade 7', 'Nutrition', 'Food Groups and Balanced Diet', true),
('KICD Grade 7 Curriculum Design', 'Nutrition: Food preparation, preservation, and storage methods.', 'Agriculture and Nutrition', 'Grade 7', 'Nutrition', 'Food Preparation and Preservation', true),
('KICD Grade 7 Curriculum Design', 'Nutrition: Hygiene and sanitation including personal hygiene, food hygiene, and environmental hygiene.', 'Agriculture and Nutrition', 'Grade 7', 'Nutrition', 'Hygiene and Sanitation', true),
('KICD Grade 7 Curriculum Design', 'Farm Business: Record keeping, farm planning, and basic agricultural economics.', 'Agriculture and Nutrition', 'Grade 7', 'Farm Business', 'Record Keeping and Planning', true);

-- Grade 7: Creative Arts and Sports
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 7 Curriculum Design', 'Visual Arts: Elements of art including line, shape, colour, texture, form, and space.', 'Creative Arts and Sports', 'Grade 7', 'Visual Arts', 'Elements of Art', true),
('KICD Grade 7 Curriculum Design', 'Visual Arts: Art techniques including drawing, painting, printmaking, sculpture, and collage.', 'Creative Arts and Sports', 'Grade 7', 'Visual Arts', 'Art Techniques', true),
('KICD Grade 7 Curriculum Design', 'Visual Arts: Colour theory including primary, secondary, and tertiary colours, colour mixing, and colour wheels.', 'Creative Arts and Sports', 'Grade 7', 'Visual Arts', 'Colour Theory', true),
('KICD Grade 7 Curriculum Design', 'Music: Elements of music including rhythm, melody, harmony, tempo, dynamics, and timbre.', 'Creative Arts and Sports', 'Grade 7', 'Music', 'Elements of Music', true),
('KICD Grade 7 Curriculum Design', 'Music: Musical instruments including classification, playing techniques, and instrument care.', 'Creative Arts and Sports', 'Grade 7', 'Music', 'Musical Instruments', true),
('KICD Grade 7 Curriculum Design', 'Music: Singing and choral music including vocal techniques, folk songs, and national songs.', 'Creative Arts and Sports', 'Grade 7', 'Music', 'Singing and Choral Music', true),
('KICD Grade 7 Curriculum Design', 'Performing Arts: Drama including role play, improvisation, and theatrical performance.', 'Creative Arts and Sports', 'Grade 7', 'Performing Arts', 'Drama', true),
('KICD Grade 7 Curriculum Design', 'Performing Arts: Dance including folk dance, contemporary dance, and dance composition.', 'Creative Arts and Sports', 'Grade 7', 'Performing Arts', 'Dance', true),
('KICD Grade 7 Curriculum Design', 'Sports: Athletics including running, jumping, throwing, and relay events.', 'Creative Arts and Sports', 'Grade 7', 'Sports', 'Athletics', true),
('KICD Grade 7 Curriculum Design', 'Sports: Team sports including football, basketball, volleyball, handball, and rugby.', 'Creative Arts and Sports', 'Grade 7', 'Sports', 'Team Sports', true),
('KICD Grade 7 Curriculum Design', 'Sports: Individual sports including badminton, table tennis, and swimming.', 'Creative Arts and Sports', 'Grade 7', 'Sports', 'Individual Sports', true),
('KICD Grade 7 Curriculum Design', 'Physical Education: Fitness, flexibility, strength, and endurance training.', 'Creative Arts and Sports', 'Grade 7', 'Physical Education', 'Fitness Training', true),
('KICD Grade 7 Curriculum Design', 'Physical Education: Health and safety in sports including first aid, injury prevention, and sports nutrition.', 'Creative Arts and Sports', 'Grade 7', 'Physical Education', 'Health and Safety in Sports', true);


-- Grade 8: English
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Listening and Speaking: Debates, discussions, group discussions, panel discussions, and formal presentations.', 'English', 'Grade 8', 'Listening and Speaking', 'Debates and Discussions', true),
('KICD Grade 8 Curriculum Design', 'Listening and Speaking: Public speaking including speech delivery, audience engagement, and persuasive speaking.', 'English', 'Grade 8', 'Listening and Speaking', 'Public Speaking', true),
('KICD Grade 8 Curriculum Design', 'Listening and Speaking: Active listening including note-taking, summarising, paraphrasing, and critical listening.', 'English', 'Grade 8', 'Listening and Speaking', 'Active Listening', true),
('KICD Grade 8 Curriculum Design', 'Reading: Reading comprehension including inference, deduction, evaluation, and critical analysis of texts.', 'English', 'Grade 8', 'Reading', 'Reading Comprehension', true),
('KICD Grade 8 Curriculum Design', 'Reading: Literature study including novels, short stories, poetry analysis, and dramatic texts.', 'English', 'Grade 8', 'Reading', 'Literature Study', true),
('KICD Grade 8 Curriculum Design', 'Reading: Media literacy including evaluating news sources, identifying bias, and digital reading.', 'English', 'Grade 8', 'Reading', 'Media Literacy', true),
('KICD Grade 8 Curriculum Design', 'Writing: Descriptive writing including sensory details, figurative language, and vivid descriptions.', 'English', 'Grade 8', 'Writing', 'Descriptive Writing', true),
('KICD Grade 8 Curriculum Design', 'Writing: Persuasive writing including argumentative essays, letters, and opinion pieces.', 'English', 'Grade 8', 'Writing', 'Persuasive Writing', true),
('KICD Grade 8 Curriculum Design', 'Writing: Report writing including formal reports, research reports, and factual writing.', 'English', 'Grade 8', 'Writing', 'Report Writing', true),
('KICD Grade 8 Curriculum Design', 'Grammar: Advanced word classes including conditional clauses, relative clauses, and complex sentence structures.', 'English', 'Grade 8', 'Grammar', 'Advanced Sentence Structures', true),
('KICD Grade 8 Curriculum Design', 'Grammar: Active and passive voice, direct and indirect speech, and sentence transformation.', 'English', 'Grade 8', 'Grammar', 'Voice and Speech', true),
('KICD Grade 8 Curriculum Design', 'Grammar: Figures of speech including simile, metaphor, personification, alliteration, hyperbole, and irony.', 'English', 'Grade 8', 'Grammar', 'Figures of Speech', true),
('KICD Grade 8 Curriculum Design', 'Literature in English: Drama including dramatic techniques, character analysis, and theme development.', 'English', 'Grade 8', 'Literature in English', 'Drama', true),
('KICD Grade 8 Curriculum Design', 'Literature in English: Poetry analysis including rhyme schemes, rhythm, imagery, and thematic analysis.', 'English', 'Grade 8', 'Literature in English', 'Poetry Analysis', true);

-- Grade 8: Kiswahili
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Kusikiliza na Kuzungumza: Mazungumzo ya kitaaluma, majadiliano, na utamaduni wa hotuba rasmi.', 'Kiswahili', 'Grade 8', 'Kusikiliza na Kuzungumza', 'Majadiliano na Hotuba', true),
('KICD Grade 8 Curriculum Design', 'Kusikiliza na Kuzungumza: Uwasilishaji wa hoja na majadiliano ya vikundi.', 'Kiswahili', 'Grade 8', 'Kusikiliza na Kuzungumza', 'Uwasilishaji wa Hoja', true),
('KICD Grade 8 Curriculum Design', 'Kusoma: Kusoma kwa ufahamu na uchambuzi wa maandishi ikiwa ni pamoja na uandishi wa tamko kuu na maelezo.', 'Kiswahili', 'Grade 8', 'Kusoma', 'Kusoma kwa Ufahamu', true),
('KICD Grade 8 Curriculum Design', 'Kusoma: Fasihi maandishi ikiwa ni pamoja na riwaya, hadithi fupi, na mashairi.', 'Kiswahili', 'Grade 8', 'Kusoma', 'Fasihi Maandishi', true),
('KICD Grade 8 Curriculum Design', 'Kuandika: Uandishi wa hoja na insha za kubuni ikiwa ni pamoja na maelezo ya kina na uwasilishaji wa hoja.', 'Kiswahili', 'Grade 8', 'Kuandika', 'Uandishi wa Hoja', true),
('KICD Grade 8 Curriculum Design', 'Kuandika: Uandishi wa ripoti na maandishi rasmi.', 'Kiswahili', 'Grade 8', 'Kuandika', 'Uandishi wa Ripoti', true),
('KICD Grade 8 Curriculum Design', 'Sarufi: Mofolojia ikiwa ni pamoja na viambishi, mabadiliko ya maneno, na uundaji wa maneno mapya.', 'Kiswahili', 'Grade 8', 'Sarufi', 'Mofolojia', true),
('KICD Grade 8 Curriculum Design', 'Sarufi: Sintaksisi ikiwa ni pamoja na muundo wa sentensi changamano, vifungu, na uhusiano wa maneno.', 'Kiswahili', 'Grade 8', 'Sarufi', 'Sintaksisi', true),
('KICD Grade 8 Curriculum Design', 'Fasihi: Drama na mchezo wa jukwaa, uchambuzi wa mashairi, na fasihi simulizi ya kina.', 'Kiswahili', 'Grade 8', 'Fasihi', 'Drama na Uchambuzi', true);

-- Grade 8: Mathematics
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Numbers: Advanced operations with integers, rational numbers, irrational numbers, and real numbers.', 'Mathematics', 'Grade 8', 'Numbers', 'Real Numbers', true),
('KICD Grade 8 Curriculum Design', 'Numbers: Indices and logarithms including laws of indices, zero and negative indices, fractional indices, and introduction to logarithms.', 'Mathematics', 'Grade 8', 'Numbers', 'Indices and Logarithms', true),
('KICD Grade 8 Curriculum Design', 'Numbers: Standard form and significant figures including scientific notation, rounding, and estimation.', 'Mathematics', 'Grade 8', 'Numbers', 'Standard Form', true),
('KICD Grade 8 Curriculum Design', 'Algebra: Expanding and factorising expressions including binomial expansion, difference of two squares, and trinomials.', 'Mathematics', 'Grade 8', 'Algebra', 'Expansion and Factorisation', true),
('KICD Grade 8 Curriculum Design', 'Algebra: Quadratic equations including solving by factorisation, completing the square, and the quadratic formula.', 'Mathematics', 'Grade 8', 'Algebra', 'Quadratic Equations', true),
('KICD Grade 8 Curriculum Design', 'Algebra: Simultaneous equations including solving by substitution, elimination, and graphical methods.', 'Mathematics', 'Grade 8', 'Algebra', 'Simultaneous Equations', true),
('KICD Grade 8 Curriculum Design', 'Algebra: Inequalities including linear inequalities, compound inequalities, and quadratic inequalities.', 'Mathematics', 'Grade 8', 'Algebra', 'Inequalities', true),
('KICD Grade 8 Curriculum Design', 'Algebra: Variation including direct variation, inverse variation, joint variation, and partial variation.', 'Mathematics', 'Grade 8', 'Algebra', 'Variation', true),
('KICD Grade 8 Curriculum Design', 'Geometry: Angles in circles including angle at centre, angle at circumference, angles in the same segment, and cyclic quadrilaterals.', 'Mathematics', 'Grade 8', 'Geometry', 'Angles in Circles', true),
('KICD Grade 8 Curriculum Design', 'Geometry: Trigonometry including sine, cosine, tangent, right-angled triangles, and trigonometric ratios.', 'Mathematics', 'Grade 8', 'Geometry', 'Trigonometry', true),
('KICD Grade 8 Curriculum Design', 'Geometry: Coordinate geometry including midpoint, gradient, equation of a straight line, and parallel and perpendicular lines.', 'Mathematics', 'Grade 8', 'Geometry', 'Coordinate Geometry', true),
('KICD Grade 8 Curriculum Design', 'Geometry: Similarity and congruence including similar triangles, congruent triangles, and scale factors.', 'Mathematics', 'Grade 8', 'Geometry', 'Similarity and Congruence', true),
('KICD Grade 8 Curriculum Design', 'Measurements: Advanced area and volume calculations including sectors, segments, frustums, and composite solids.', 'Mathematics', 'Grade 8', 'Measurements', 'Advanced Area and Volume', true),
('KICD Grade 8 Curriculum Design', 'Measurements: Speed, distance and time including relative speed, average speed, and problems involving multiple objects.', 'Mathematics', 'Grade 8', 'Measurements', 'Speed Distance and Time', true),
('KICD Grade 8 Curriculum Design', 'Measurements: Compound interest, depreciation, and appreciation including exponential growth and decay.', 'Mathematics', 'Grade 8', 'Measurements', 'Compound Interest and Depreciation', true),
('KICD Grade 8 Curriculum Design', 'Data Handling and Probability: Statistical measures including quartiles, interquartile range, standard deviation, and cumulative frequency.', 'Mathematics', 'Grade 8', 'Data Handling and Probability', 'Statistical Measures', true),
('KICD Grade 8 Curriculum Design', 'Data Handling and Probability: Probability including combined events, tree diagrams, conditional probability, and probability rules.', 'Mathematics', 'Grade 8', 'Data Handling and Probability', 'Combined Probability', true),
('KICD Grade 8 Curriculum Design', 'Data Handling and Probability: Graphical representation including scatter diagrams, correlation, line of best fit, and histograms with unequal class widths.', 'Mathematics', 'Grade 8', 'Data Handling and Probability', 'Graphical Representation', true);

-- Grade 8: Integrated Science
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Living Things: Genetics and heredity including DNA, chromosomes, genes, inheritance, and genetic disorders.', 'Integrated Science', 'Grade 8', 'Living Things', 'Genetics and Heredity', true),
('KICD Grade 8 Curriculum Design', 'Living Things: Human body systems including reproductive system, endocrine system, nervous system, and immune system.', 'Integrated Science', 'Grade 8', 'Living Things', 'Advanced Body Systems', true),
('KICD Grade 8 Curriculum Design', 'Living Things: Ecology including ecosystems, food chains, food webs, energy flow, and biogeochemical cycles.', 'Integrated Science', 'Grade 8', 'Living Things', 'Ecology', true),
('KICD Grade 8 Curriculum Design', 'Living Things: Adaptation and evolution including natural selection, survival of the fittest, and evidence for evolution.', 'Integrated Science', 'Grade 8', 'Living Things', 'Adaptation and Evolution', true),
('KICD Grade 8 Curriculum Design', 'Materials: Chemical reactions including types of reactions, chemical equations, and stoichiometry.', 'Integrated Science', 'Grade 8', 'Materials', 'Chemical Reactions', true),
('KICD Grade 8 Curriculum Design', 'Materials: Metals and non-metals including properties, reactivity series, extraction of metals, and corrosion.', 'Integrated Science', 'Grade 8', 'Materials', 'Metals and Non-metals', true),
('KICD Grade 8 Curriculum Design', 'Materials: Organic chemistry basics including hydrocarbons, alcohols, and simple organic compounds.', 'Integrated Science', 'Grade 8', 'Materials', 'Organic Chemistry Basics', true),
('KICD Grade 8 Curriculum Design', 'Energy: Forces and motion including Newton laws, types of forces, friction, and momentum.', 'Integrated Science', 'Grade 8', 'Energy', 'Forces and Motion', true),
('KICD Grade 8 Curriculum Design', 'Energy: Work, energy and power including kinetic energy, potential energy, energy conservation, and power calculations.', 'Integrated Science', 'Grade 8', 'Energy', 'Work Energy and Power', true),
('KICD Grade 8 Curriculum Design', 'Energy: Magnetism including magnetic fields, electromagnetism, and electromagnetic induction.', 'Integrated Science', 'Grade 8', 'Energy', 'Magnetism', true),
('KICD Grade 8 Curriculum Design', 'Energy: Waves including types of waves, wave properties, sound waves, and electromagnetic spectrum.', 'Integrated Science', 'Grade 8', 'Energy', 'Waves', true),
('KICD Grade 8 Curriculum Design', 'Earth and Space: Plate tectonics including earthquakes, volcanoes, mountain building, and continental drift.', 'Integrated Science', 'Grade 8', 'Earth and Space', 'Plate Tectonics', true),
('KICD Grade 8 Curriculum Design', 'Earth and Space: The water cycle, carbon cycle, and nitrogen cycle.', 'Integrated Science', 'Grade 8', 'Earth and Space', 'Earth Cycles', true),
('KICD Grade 8 Curriculum Design', 'Environment: Renewable and non-renewable energy sources, environmental impact assessment, and sustainable development.', 'Integrated Science', 'Grade 8', 'Environment', 'Energy Resources', true);

-- Grade 8: Social Studies
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'History: World Wars and their impact on East Africa including WWI, WWII, and post-war changes.', 'Social Studies', 'Grade 8', 'History', 'World Wars and East Africa', true),
('KICD Grade 8 Curriculum Design', 'History: Post-independence Kenya including the Kenyatta era, Moi era, and the transition to multiparty democracy.', 'Social Studies', 'Grade 8', 'History', 'Post-Independence Kenya', true),
('KICD Grade 8 Curriculum Design', 'History: East African Community including EAC formation, achievements, challenges, and the role of Kenya.', 'Social Studies', 'Grade 8', 'History', 'East African Community', true),
('KICD Grade 8 Curriculum Design', 'Geography: Economic geography including agriculture, industry, trade, and transport in Kenya and East Africa.', 'Social Studies', 'Grade 8', 'Geography', 'Economic Geography', true),
('KICD Grade 8 Curriculum Design', 'Geography: Tourism including tourist attractions in Kenya, impact of tourism, and sustainable tourism.', 'Social Studies', 'Grade 8', 'Geography', 'Tourism', true),
('KICD Grade 8 Curriculum Design', 'Geography: Environment and climate change including causes of climate change, effects, and mitigation strategies.', 'Social Studies', 'Grade 8', 'Geography', 'Climate Change', true),
('KICD Grade 8 Curriculum Design', 'Civics: Electoral process including elections in Kenya, electoral bodies, voting rights, and democratic processes.', 'Social Studies', 'Grade 8', 'Civics', 'Electoral Process', true),
('KICD Grade 8 Curriculum Design', 'Civics: Human rights and justice including equality, justice, rule of law, and the judiciary in Kenya.', 'Social Studies', 'Grade 8', 'Civics', 'Human Rights and Justice', true),
('KICD Grade 8 Curriculum Design', 'Civics: County government including devolution, county functions, and intergovernmental relations.', 'Social Studies', 'Grade 8', 'Civics', 'County Government', true),
('KICD Grade 8 Curriculum Design', 'Community Service Learning: Community development projects, volunteerism, and civic participation.', 'Social Studies', 'Grade 8', 'Community Service Learning', 'Community Development', true);

-- Grade 8: Religious Education
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Religious Education: Religious teachings on social issues including poverty, injustice, peace, and conflict resolution.', 'Religious Education', 'Grade 8', 'Social Teachings', 'Teachings on Social Issues', true),
('KICD Grade 8 Curriculum Design', 'Religious Education: Religious leadership including types of leadership, qualities of religious leaders, and leadership models.', 'Religious Education', 'Grade 8', 'Religious Leadership', 'Leadership Models', true),
('KICD Grade 8 Curriculum Design', 'Religious Education: Religious practices and rituals including baptism, confirmation, communion, and other sacraments or rites.', 'Religious Education', 'Grade 8', 'Religious Practices', 'Rituals and Sacraments', true),
('KICD Grade 8 Curriculum Design', 'Religious Education: Religious diversity and interfaith dialogue including respect for other faiths, common values, and peaceful coexistence.', 'Religious Education', 'Grade 8', 'Religious Diversity', 'Interfaith Dialogue', true),
('KICD Grade 8 Curriculum Design', 'Religious Education: Ethics and morality including moral dilemmas, ethical frameworks, and decision making in daily life.', 'Religious Education', 'Grade 8', 'Ethics and Morality', 'Moral Dilemmas', true),
('KICD Grade 8 Curriculum Design', 'Religious Education: Environmental stewardship including religious teachings on caring for creation and sustainable living.', 'Religious Education', 'Grade 8', 'Environmental Stewardship', 'Caring for Creation', true);

-- Grade 8: Pre-Technical Studies
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Technical Drawing: Advanced projection including first angle and third angle projection, sectional views, and assembly drawings.', 'Pre-Technical Studies', 'Grade 8', 'Technical Drawing', 'Advanced Projection', true),
('KICD Grade 8 Curriculum Design', 'Technical Drawing: Computer-aided design basics including introduction to CAD software and digital drawing.', 'Pre-Technical Studies', 'Grade 8', 'Technical Drawing', 'CAD Basics', true),
('KICD Grade 8 Curriculum Design', 'Woodwork: Advanced woodwork including furniture making, lathe work, and veneering.', 'Pre-Technical Studies', 'Grade 8', 'Woodwork', 'Advanced Woodwork', true),
('KICD Grade 8 Curriculum Design', 'Metalwork: Advanced metalwork including welding, soldering, brazing, and lathe operations.', 'Pre-Technical Studies', 'Grade 8', 'Metalwork', 'Advanced Metalwork', true),
('KICD Grade 8 Curriculum Design', 'Electrical: Advanced electrical circuits including resistors, capacitors, diodes, and basic electronic components.', 'Pre-Technical Studies', 'Grade 8', 'Electrical', 'Electronic Components', true),
('KICD Grade 8 Curriculum Design', 'Electrical: Power supply and distribution including transformers, generators, and domestic wiring.', 'Pre-Technical Studies', 'Grade 8', 'Electrical', 'Power Supply and Distribution', true),
('KICD Grade 8 Curriculum Design', 'Mechanical Systems: Simple machines including levers, pulleys, inclined planes, gears, and mechanical advantage.', 'Pre-Technical Studies', 'Grade 8', 'Mechanical Systems', 'Simple Machines', true),
('KICD Grade 8 Curriculum Design', 'Building Construction: Advanced building techniques including foundations, walls, roofs, and finishing.', 'Pre-Technical Studies', 'Grade 8', 'Building Construction', 'Advanced Building Techniques', true);

-- Grade 8: Agriculture and Nutrition
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Crop Production: Advanced crop production including crop rotation, intercropping, mixed farming, and crop protection.', 'Agriculture and Nutrition', 'Grade 8', 'Crop Production', 'Advanced Crop Production', true),
('KICD Grade 8 Curriculum Design', 'Crop Production: Post-harvest handling including harvesting, threshing, drying, storage, and marketing.', 'Agriculture and Nutrition', 'Grade 8', 'Crop Production', 'Post-Harvest Handling', true),
('KICD Grade 8 Curriculum Design', 'Animal Production: Dairy farming including dairy cattle management, milk production, and dairy processing.', 'Agriculture and Nutrition', 'Grade 8', 'Animal Production', 'Dairy Farming', true),
('KICD Grade 8 Curriculum Design', 'Animal Production: Poultry farming including chicken breeds, housing, feeding, disease management, and egg production.', 'Agriculture and Nutrition', 'Grade 8', 'Animal Production', 'Poultry Farming', true),
('KICD Grade 8 Curriculum Design', 'Animal Production: Fish farming including pond construction, stocking, feeding, and fish harvesting.', 'Agriculture and Nutrition', 'Grade 8', 'Animal Production', 'Fish Farming', true),
('KICD Grade 8 Curriculum Design', 'Agricultural Economics: Agricultural marketing including market channels, pricing, value addition, and agribusiness.', 'Agriculture and Nutrition', 'Grade 8', 'Agricultural Economics', 'Agricultural Marketing', true),
('KICD Grade 8 Curriculum Design', 'Agricultural Economics: Farm records and accounts including income and expenditure, profit and loss, and balance sheets.', 'Agriculture and Nutrition', 'Grade 8', 'Agricultural Economics', 'Farm Records', true),
('KICD Grade 8 Curriculum Design', 'Nutrition: Advanced nutrition including malnutrition, food security, food safety, and dietary requirements for different age groups.', 'Agriculture and Nutrition', 'Grade 8', 'Nutrition', 'Advanced Nutrition', true),
('KICD Grade 8 Curriculum Design', 'Nutrition: Food processing and preservation including canning, freezing, drying, fermentation, and smoking.', 'Agriculture and Nutrition', 'Grade 8', 'Nutrition', 'Food Processing', true);

-- Grade 8: Creative Arts and Sports
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 8 Curriculum Design', 'Visual Arts: Advanced art techniques including mixed media, batik, mosaic, and digital art.', 'Creative Arts and Sports', 'Grade 8', 'Visual Arts', 'Advanced Art Techniques', true),
('KICD Grade 8 Curriculum Design', 'Visual Arts: Art appreciation including art history, art criticism, and analysis of African art.', 'Creative Arts and Sports', 'Grade 8', 'Visual Arts', 'Art Appreciation', true),
('KICD Grade 8 Curriculum Design', 'Music: Music theory including notation, scales, keys, time signatures, and music composition.', 'Creative Arts and Sports', 'Grade 8', 'Music', 'Music Theory', true),
('KICD Grade 8 Curriculum Design', 'Music: Ensemble performance including band, orchestra, and choir performance and management.', 'Creative Arts and Sports', 'Grade 8', 'Music', 'Ensemble Performance', true),
('KICD Grade 8 Curriculum Design', 'Performing Arts: Advanced drama including script writing, directing, and stage management.', 'Creative Arts and Sports', 'Grade 8', 'Performing Arts', 'Advanced Drama', true),
('KICD Grade 8 Curriculum Design', 'Performing Arts: Dance choreography including movement composition, spatial awareness, and performance.', 'Creative Arts and Sports', 'Grade 8', 'Performing Arts', 'Dance Choreography', true),
('KICD Grade 8 Curriculum Design', 'Sports: Advanced athletics including track and field events, rules, and competition management.', 'Creative Arts and Sports', 'Grade 8', 'Sports', 'Advanced Athletics', true),
('KICD Grade 8 Curriculum Design', 'Sports: Sports management including organisation of sports events, rules and regulations, and sports officiating.', 'Creative Arts and Sports', 'Grade 8', 'Sports', 'Sports Management', true);


-- Grade 9: English
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Listening and Speaking: Advanced debates, formal arguments, negotiations, and diplomatic communication.', 'English', 'Grade 9', 'Listening and Speaking', 'Advanced Debates', true),
('KICD Grade 9 Curriculum Design', 'Listening and Speaking: Media analysis including analysing speeches, advertisements, and broadcast media.', 'English', 'Grade 9', 'Listening and Speaking', 'Media Analysis', true),
('KICD Grade 9 Curriculum Design', 'Reading: Critical reading including analysing author purpose, tone, bias, and evaluating arguments.', 'English', 'Grade 9', 'Reading', 'Critical Reading', true),
('KICD Grade 9 Curriculum Design', 'Reading: Research skills including source evaluation, citation, paraphrasing, and academic writing conventions.', 'English', 'Grade 9', 'Reading', 'Research Skills', true),
('KICD Grade 9 Curriculum Design', 'Writing: Advanced essay writing including thesis statements, argumentative essays, discursive essays, and literary analysis.', 'English', 'Grade 9', 'Writing', 'Advanced Essay Writing', true),
('KICD Grade 9 Curriculum Design', 'Writing: Creative writing including short stories, poetry composition, and creative non-fiction.', 'English', 'Grade 9', 'Writing', 'Creative Writing', true),
('KICD Grade 9 Curriculum Design', 'Writing: Business communication including formal letters, emails, memos, and proposals.', 'English', 'Grade 9', 'Writing', 'Business Communication', true),
('KICD Grade 9 Curriculum Design', 'Grammar: Advanced grammar including complex and compound-complex sentences, conditional sentences, and subjunctive mood.', 'English', 'Grade 9', 'Grammar', 'Advanced Grammar', true),
('KICD Grade 9 Curriculum Design', 'Grammar: Stylistic devices including rhetoric, irony, satire, oxymoron, and advanced figurative language.', 'English', 'Grade 9', 'Grammar', 'Stylistic Devices', true),
('KICD Grade 9 Curriculum Design', 'Literature in English: Extended literature study including novel analysis, thematic analysis, character development, and critical evaluation.', 'English', 'Grade 9', 'Literature in English', 'Extended Literature Study', true),
('KICD Grade 9 Curriculum Design', 'Literature in English: Comparative literature including comparing texts across genres, cultures, and time periods.', 'English', 'Grade 9', 'Literature in English', 'Comparative Literature', true);

-- Grade 9: Kiswahili
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Kusikiliza na Kuzungumza: Majadiliano ya kina, mazungumzo ya kitaaluma, na uwasilishaji wa hoja za kisasa.', 'Kiswahili', 'Grade 9', 'Kusikiliza na Kuzungumza', 'Majadiliano ya Kina', true),
('KICD Grade 9 Curriculum Design', 'Kusikiliza na Kuzungumza: Uchambuzi wa maandishi ya kisasa na utafsiri.', 'Kiswahili', 'Grade 9', 'Kusikiliza na Kuzungumza', 'Uchambuzi wa Maandishi', true),
('KICD Grade 9 Curriculum Design', 'Kusoma: Kusoma kwa uchambuzi wa kina ikiwa ni pamoja na tamthiliya, riwaya, na insha.', 'Kiswahili', 'Grade 9', 'Kusoma', 'Kusoma kwa Uchambuzi', true),
('KICD Grade 9 Curriculum Design', 'Kusoma: Utafiti na kurejelea vyanzo ikiwa ni pamoja na utafsiri wa maandishi.', 'Kiswahili', 'Grade 9', 'Kusoma', 'Utafiti na Vyanzo', true),
('KICD Grade 9 Curriculum Design', 'Kuandika: Uandishi wa kina ikiwa ni pamoja na insha za kubuni, ripoti za utafiti, na uandishi wa kitaaluma.', 'Kiswahili', 'Grade 9', 'Kuandika', 'Uandishi wa Kina', true),
('KICD Grade 9 Curriculum Design', 'Kuandika: Uandishi wa shairi na fasihi ya kisasa.', 'Kiswahili', 'Grade 9', 'Kuandika', 'Uandishi wa Kisasa', true),
('KICD Grade 9 Curriculum Design', 'Sarufi: Sarufi ya kina ikiwa ni pamoja na sintaksisi changamano, mofolojia ya maneno, na uundaji wa sentensi.', 'Kiswahili', 'Grade 9', 'Sarufi', 'Sarufi ya Kina', true),
('KICD Grade 9 Curriculum Design', 'Fasihi: Uchambuzi wa fasihi ya kisasa, tamthiliya, riwaya, na mashairi.', 'Kiswahili', 'Grade 9', 'Fasihi', 'Fasihi ya Kisasa', true);

-- Grade 9: Mathematics
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Numbers: Number systems including real numbers, rational and irrational numbers, surds, and number bases.', 'Mathematics', 'Grade 9', 'Numbers', 'Number Systems', true),
('KICD Grade 9 Curriculum Design', 'Numbers: Sequences and series including arithmetic progression, geometric progression, sum of series, and sigma notation.', 'Mathematics', 'Grade 9', 'Numbers', 'Sequences and Series', true),
('KICD Grade 9 Curriculum Design', 'Numbers: Matrices and determinants including matrix operations, 2x2 and 3x3 matrices, and solving equations using matrices.', 'Mathematics', 'Grade 9', 'Numbers', 'Matrices', true),
('KICD Grade 9 Curriculum Design', 'Algebra: Quadratic functions including graphs of quadratic functions, turning points, and applications.', 'Mathematics', 'Grade 9', 'Algebra', 'Quadratic Functions', true),
('KICD Grade 9 Curriculum Design', 'Algebra: Polynomials including polynomial division, remainder theorem, factor theorem, and rational expressions.', 'Mathematics', 'Grade 9', 'Algebra', 'Polynomials', true),
('KICD Grade 9 Curriculum Design', 'Algebra: Exponential and logarithmic functions including laws of logarithms, solving exponential and logarithmic equations.', 'Mathematics', 'Grade 9', 'Algebra', 'Exponential and Logarithmic Functions', true),
('KICD Grade 9 Curriculum Design', 'Algebra: Graphs of functions including linear, quadratic, cubic, reciprocal, and exponential graphs.', 'Mathematics', 'Grade 9', 'Algebra', 'Graphs of Functions', true),
('KICD Grade 9 Curriculum Design', 'Geometry: Trigonometry including sine rule, cosine rule, area of triangles, and 3D trigonometry.', 'Mathematics', 'Grade 9', 'Geometry', 'Advanced Trigonometry', true),
('KICD Grade 9 Curriculum Design', 'Geometry: Circle theorems including angle at centre, angle in semicircle, tangents, and intersecting chords.', 'Mathematics', 'Grade 9', 'Geometry', 'Circle Theorems', true),
('KICD Grade 9 Curriculum Design', 'Geometry: Transformations including combined transformations, matrix transformations, and transformation matrices.', 'Mathematics', 'Grade 9', 'Geometry', 'Advanced Transformations', true),
('KICD Grade 9 Curriculum Design', 'Geometry: Vectors including vector notation, vector addition, scalar multiplication, and position vectors.', 'Mathematics', 'Grade 9', 'Geometry', 'Vectors', true),
('KICD Grade 9 Curriculum Design', 'Measurements: Advanced volume calculations including spheres, cones, pyramids, frustums, and composite solids.', 'Mathematics', 'Grade 9', 'Measurements', 'Advanced Volume', true),
('KICD Grade 9 Curriculum Design', 'Measurements: Bearings and navigation including true bearings, compass bearings, and distance calculations.', 'Mathematics', 'Grade 9', 'Measurements', 'Bearings and Navigation', true),
('KICD Grade 9 Curriculum Design', 'Measurements: Rates of change including gradients, rates, and introduction to differentiation concepts.', 'Mathematics', 'Grade 9', 'Measurements', 'Rates of Change', true),
('KICD Grade 9 Curriculum Design', 'Data Handling and Probability: Statistical analysis including standard deviation, normal distribution, and probability distributions.', 'Mathematics', 'Grade 9', 'Data Handling and Probability', 'Statistical Analysis', true),
('KICD Grade 9 Curriculum Design', 'Data Handling and Probability: Advanced probability including permutations, combinations, and binomial probability.', 'Mathematics', 'Grade 9', 'Data Handling and Probability', 'Advanced Probability', true),
('KICD Grade 9 Curriculum Design', 'Data Handling and Probability: Data analysis and interpretation including regression, correlation, and predictive analysis.', 'Mathematics', 'Grade 9', 'Data Handling and Probability', 'Data Analysis', true);

-- Grade 9: Integrated Science
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Living Things: Biotechnology including genetic engineering, cloning, GMOs, and ethical considerations.', 'Integrated Science', 'Grade 9', 'Living Things', 'Biotechnology', true),
('KICD Grade 9 Curriculum Design', 'Living Things: Human health and disease including pathogens, immunity, vaccination, and common diseases in Kenya.', 'Integrated Science', 'Grade 9', 'Living Things', 'Human Health and Disease', true),
('KICD Grade 9 Curriculum Design', 'Living Things: Biodiversity and conservation including endangered species, conservation strategies, and biodiversity loss.', 'Integrated Science', 'Grade 9', 'Living Things', 'Biodiversity', true),
('KICD Grade 9 Curriculum Design', 'Materials: Advanced chemistry including periodic table, chemical bonding, types of bonds, and molecular structures.', 'Integrated Science', 'Grade 9', 'Materials', 'Chemical Bonding', true),
('KICD Grade 9 Curriculum Design', 'Materials: Quantitative chemistry including moles, molar mass, percentage composition, and empirical formulas.', 'Integrated Science', 'Grade 9', 'Materials', 'Quantitative Chemistry', true),
('KICD Grade 9 Curriculum Design', 'Materials: Electrochemistry including electrolysis, electroplating, galvanic cells, and applications.', 'Integrated Science', 'Grade 9', 'Materials', 'Electrochemistry', true),
('KICD Grade 9 Curriculum Design', 'Energy: Advanced mechanics including projectile motion, circular motion, and energy transformations.', 'Integrated Science', 'Grade 9', 'Energy', 'Advanced Mechanics', true),
('KICD Grade 9 Curriculum Design', 'Energy: Nuclear physics including radioactivity, half-life, nuclear reactions, and applications of nuclear energy.', 'Integrated Science', 'Grade 9', 'Energy', 'Nuclear Physics', true),
('KICD Grade 9 Curriculum Design', 'Energy: Electronics including semiconductors, transistors, logic gates, and digital circuits.', 'Integrated Science', 'Grade 9', 'Energy', 'Electronics', true),
('KICD Grade 9 Curriculum Design', 'Earth and Space: Astronomy including stars, galaxies, the universe, space exploration, and Kenya space programme.', 'Integrated Science', 'Grade 9', 'Earth and Space', 'Astronomy', true),
('KICD Grade 9 Curriculum Design', 'Earth and Space: Geology including mineral resources in Kenya, mining, and environmental impact of mining.', 'Integrated Science', 'Grade 9', 'Earth and Space', 'Geology', true),
('KICD Grade 9 Curriculum Design', 'Environment: Environmental management including waste management, recycling, environmental policies, and Kenya environmental laws.', 'Integrated Science', 'Grade 9', 'Environment', 'Environmental Management', true);

-- Grade 9: Social Studies
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'History: Globalisation and its impact on Kenya including economic globalisation, cultural exchange, and technological advancement.', 'Social Studies', 'Grade 9', 'History', 'Globalisation', true),
('KICD Grade 9 Curriculum Design', 'History: Kenya Vision 2030 including pillars of Vision 2030, achievements, and challenges.', 'Social Studies', 'Grade 9', 'History', 'Kenya Vision 2030', true),
('KICD Grade 9 Curriculum Design', 'Geography: Global geography including continents, oceans, major global features, and international relations.', 'Social Studies', 'Grade 9', 'Geography', 'Global Geography', true),
('KICD Grade 9 Curriculum Design', 'Geography: Sustainable development including sustainable agriculture, sustainable industry, and green economy.', 'Social Studies', 'Grade 9', 'Geography', 'Sustainable Development', true),
('KICD Grade 9 Curriculum Design', 'Civics: International organisations including United Nations, African Union, and East African Community.', 'Social Studies', 'Grade 9', 'Civics', 'International Organisations', true),
('KICD Grade 9 Curriculum Design', 'Civics: Citizenship and national identity including patriotism, national values, and civic duty.', 'Social Studies', 'Grade 9', 'Civics', 'Citizenship and National Identity', true),
('KICD Grade 9 Curriculum Design', 'Civics: Technology and governance including e-governance, digital citizenship, and technology in public service.', 'Social Studies', 'Grade 9', 'Civics', 'Technology and Governance', true),
('KICD Grade 9 Curriculum Design', 'Community Service Learning: National development projects, entrepreneurship, and innovation for community development.', 'Social Studies', 'Grade 9', 'Community Service Learning', 'National Development', true);

-- Grade 9: Religious Education
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Religious Education: Religion and science including the relationship between faith and reason, evolution and creation, and ethical implications of scientific advancement.', 'Religious Education', 'Grade 9', 'Religion and Science', 'Faith and Reason', true),
('KICD Grade 9 Curriculum Design', 'Religious Education: Religious ethics in the modern world including bioethics, environmental ethics, and social justice.', 'Religious Education', 'Grade 9', 'Religious Ethics', 'Modern Ethics', true),
('KICD Grade 9 Curriculum Design', 'Religious Education: World religions including major world religions, comparative religion, and religious dialogue.', 'Religious Education', 'Grade 9', 'World Religions', 'Comparative Religion', true),
('KICD Grade 9 Curriculum Design', 'Religious Education: Religious contribution to society including education, healthcare, charity, and social welfare.', 'Religious Education', 'Grade 9', 'Religious Contribution', 'Social Contribution', true),
('KICD Grade 9 Curriculum Design', 'Religious Education: Religious festivals and cultural heritage including national days, religious holidays, and cultural celebrations.', 'Religious Education', 'Grade 9', 'Festivals and Heritage', 'Cultural Heritage', true);

-- Grade 9: Pre-Technical Studies
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Technical Drawing: Advanced CAD including 3D modelling, dimensioning, and engineering drawings.', 'Pre-Technical Studies', 'Grade 9', 'Technical Drawing', 'Advanced CAD', true),
('KICD Grade 9 Curriculum Design', 'Woodwork: Furniture design and manufacture including design process, material selection, and finishing.', 'Pre-Technical Studies', 'Grade 9', 'Woodwork', 'Furniture Design', true),
('KICD Grade 9 Curriculum Design', 'Metalwork: Fabrication and welding including arc welding, gas welding, and quality control.', 'Pre-Technical Studies', 'Grade 9', 'Metalwork', 'Fabrication and Welding', true),
('KICD Grade 9 Curriculum Design', 'Electrical: Electronics and control systems including transistors, operational amplifiers, and basic control circuits.', 'Pre-Technical Studies', 'Grade 9', 'Electrical', 'Electronics and Control', true),
('KICD Grade 9 Curriculum Design', 'Electrical: Renewable energy systems including solar panels, wind turbines, and energy storage.', 'Pre-Technical Studies', 'Grade 9', 'Electrical', 'Renewable Energy Systems', true),
('KICD Grade 9 Curriculum Design', 'Mechanical Systems: Advanced mechanisms including gear trains, belt drives, and pneumatic systems.', 'Pre-Technical Studies', 'Grade 9', 'Mechanical Systems', 'Advanced Mechanisms', true),
('KICD Grade 9 Curriculum Design', 'Building Construction: Architectural drawing including floor plans, elevations, sections, and building regulations.', 'Pre-Technical Studies', 'Grade 9', 'Building Construction', 'Architectural Drawing', true),
('KICD Grade 9 Curriculum Design', 'Building Construction: Quantity surveying basics including material estimation, cost estimation, and project planning.', 'Pre-Technical Studies', 'Grade 9', 'Building Construction', 'Quantity Surveying', true);

-- Grade 9: Agriculture and Nutrition
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Crop Production: Horticulture including greenhouse farming, irrigation systems, and high-value crop production.', 'Agriculture and Nutrition', 'Grade 9', 'Crop Production', 'Horticulture', true),
('KICD Grade 9 Curriculum Design', 'Crop Production: Agroforestry including tree farming, benefits of agroforestry, and agroforestry systems.', 'Agriculture and Nutrition', 'Grade 9', 'Crop Production', 'Agroforestry', true),
('KICD Grade 9 Curriculum Design', 'Animal Production: Advanced animal production including artificial insemination, embryo transfer, and advanced breeding techniques.', 'Agriculture and Nutrition', 'Grade 9', 'Animal Production', 'Advanced Animal Production', true),
('KICD Grade 9 Curriculum Design', 'Animal Production: Animal products and by-products including meat processing, leather production, and wool production.', 'Agriculture and Nutrition', 'Grade 9', 'Animal Production', 'Animal Products', true),
('KICD Grade 9 Curriculum Design', 'Agricultural Economics: Agribusiness management including business planning, financial management, and value chain analysis.', 'Agriculture and Nutrition', 'Grade 9', 'Agricultural Economics', 'Agribusiness Management', true),
('KICD Grade 9 Curriculum Design', 'Agricultural Economics: Agricultural policy including Kenya agricultural policies, subsidies, and trade agreements.', 'Agriculture and Nutrition', 'Grade 9', 'Agricultural Economics', 'Agricultural Policy', true),
('KICD Grade 9 Curriculum Design', 'Nutrition: Advanced nutrition science including nutrition and disease, therapeutic diets, and nutrition assessment.', 'Agriculture and Nutrition', 'Grade 9', 'Nutrition', 'Nutrition Science', true),
('KICD Grade 9 Curriculum Design', 'Nutrition: Food technology including food processing technology, quality control, and food safety standards.', 'Agriculture and Nutrition', 'Grade 9', 'Nutrition', 'Food Technology', true);

-- Grade 9: Creative Arts and Sports
INSERT INTO public.exam_knowledge_chunks (source_name, content_summary, subject, grade_level, strand, sub_strand, is_approved) VALUES
('KICD Grade 9 Curriculum Design', 'Visual Arts: Professional art practices including portfolio development, art exhibition, and professional art careers.', 'Creative Arts and Sports', 'Grade 9', 'Visual Arts', 'Professional Art Practices', true),
('KICD Grade 9 Curriculum Design', 'Visual Arts: Digital media and art including digital illustration, photography, and multimedia art.', 'Creative Arts and Sports', 'Grade 9', 'Visual Arts', 'Digital Media Art', true),
('KICD Grade 9 Curriculum Design', 'Music: Music production including recording, mixing, music technology, and music business.', 'Creative Arts and Sports', 'Grade 9', 'Music', 'Music Production', true),
('KICD Grade 9 Curriculum Design', 'Music: World music including African music traditions, global music influences, and music fusion.', 'Creative Arts and Sports', 'Grade 9', 'Music', 'World Music', true),
('KICD Grade 9 Curriculum Design', 'Performing Arts: Theatre production including set design, lighting, sound, and full production management.', 'Creative Arts and Sports', 'Grade 9', 'Performing Arts', 'Theatre Production', true),
('KICD Grade 9 Curriculum Design', 'Performing Arts: Film and media including film production basics, video editing, and media literacy.', 'Creative Arts and Sports', 'Grade 9', 'Performing Arts', 'Film and Media', true),
('KICD Grade 9 Curriculum Design', 'Sports: Sports science including sports psychology, sports nutrition, injury management, and performance enhancement.', 'Creative Arts and Sports', 'Grade 9', 'Sports', 'Sports Science', true),
('KICD Grade 9 Curriculum Design', 'Sports: Career pathways in sports and arts including professional sports, arts careers, and entrepreneurship in creative industries.', 'Creative Arts and Sports', 'Grade 9', 'Sports', 'Career Pathways', true);

-- Re-enable RLS
ALTER TABLE public.exam_knowledge_chunks ENABLE ROW LEVEL SECURITY;
