/**
 * KICD / CBE Curriculum Knowledge Base for Zamifu Curriculum Navigator
 * Sources: kicd.ac.ke curriculum designs, schemesofwork.com KICD 9-column format,
 * standard Kenyan junior school paper structure (Section A/B/C + marking scheme).
 * NOTE: Do not store third-party login credentials here.
 */

export const OFFICIAL_LINKS = {
  kicdHome: 'https://kicd.ac.ke/',
  curriculumDesigns: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/',
  cbcMaterials: 'https://kicd.ac.ke/cbc-materials/',
  gradeSeven: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/',
  gradeEight: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/',
  gradeNine: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/',
  kenyaEducationCloud: 'https://www.kec.ac.ke/',
  schemesOfWorkHome: 'https://schemesofwork.com/home',
  schemesOfWork2026: 'https://schemesofwork.com/schemes-of-work-2026',
  schemesOfWorkRoot: 'https://schemesofwork.com/',
} as const;

export const CORE_COMPETENCIES = [
  'Communication and Collaboration',
  'Critical Thinking and Problem Solving',
  'Imagination and Creativity',
  'Citizenship',
  'Digital Literacy',
  'Learning to Learn',
  'Self-efficacy',
] as const;

export const VALUES = [
  'Love', 'Responsibility', 'Respect', 'Unity', 'Peace', 'Patriotism', 'Social Justice', 'Integrity',
] as const;

export const PCIS = [
  'Education for Sustainable Development',
  'Life Skills Education',
  'Health Education',
  'Citizenship Education',
  'Service Learning and Community Service',
  'Parental Engagement',
  'Child Rights and Protection',
  'Financial Literacy',
  'Disaster Risk Reduction',
] as const;

/** Official KICD Grade 9 learning areas (from kicd.ac.ke grade-nine-designs) */
export const GRADE_NINE_SUBJECTS = [
  'Agriculture', 'Arabic', 'Creative Arts and Sports', 'Christian Religious Education',
  'English', 'French', 'German', 'Hindu Religious Education', 'Indigenous Language',
  'Integrated Science', 'Islamic Religious Education', 'Kiswahili', 'Mandarin',
  'Mathematics', 'Pre-Technical Studies', 'Social Studies',
] as const;

export interface KicdStrandPack {
  strand: string;
  subStrands: { name: string; topics: string[]; slos: string[] }[];
}

/** Representative Junior School (G7–G9) strand packs used for offline generation */
export const JUNIOR_STRAND_PACKS: Record<string, KicdStrandPack[]> = {
  Mathematics: [
    {
      strand: 'Numbers',
      subStrands: [
        {
          name: 'Whole Numbers',
          topics: ['Place value', 'Operations on whole numbers', 'Factors and multiples', 'Squares and square roots'],
          slos: [
            'read, write and order whole numbers in real-life contexts',
            'perform the four operations on whole numbers accurately',
            'apply factors, multiples and square roots in problem solving',
          ],
        },
        {
          name: 'Fractions, Decimals and Percentages',
          topics: ['Equivalent fractions', 'Operations on fractions', 'Decimals', 'Percentages and applications'],
          slos: [
            'convert between fractions, decimals and percentages',
            'solve real-life problems involving fractions and percentages',
          ],
        },
      ],
    },
    {
      strand: 'Algebra',
      subStrands: [
        {
          name: 'Algebraic Expressions',
          topics: ['Forming expressions', 'Simplifying expressions', 'Substitution', 'Linear equations'],
          slos: [
            'form and simplify algebraic expressions',
            'solve linear equations in one unknown',
            'apply algebra in everyday problem situations',
          ],
        },
      ],
    },
    {
      strand: 'Geometry and Measurement',
      subStrands: [
        {
          name: 'Angles, Shapes and Mensuration',
          topics: ['Angle properties', 'Triangles and quadrilaterals', 'Perimeter and area', 'Volume and capacity'],
          slos: [
            'identify and use properties of angles and plane figures',
            'calculate perimeter, area and volume of common shapes',
          ],
        },
      ],
    },
    {
      strand: 'Data Handling and Probability',
      subStrands: [
        {
          name: 'Statistics and Chance',
          topics: ['Data collection', 'Tables and graphs', 'Mean, median, mode', 'Simple probability'],
          slos: [
            'collect, organise and represent data',
            'interpret statistical measures',
            'determine simple probabilities of everyday events',
          ],
        },
      ],
    },
  ],
  English: [
    {
      strand: 'Listening and Speaking',
      subStrands: [
        {
          name: 'Oral Communication',
          topics: ['Listening for information', 'Oral presentations', 'Debates and discussions', 'Pronunciation'],
          slos: [
            'listen attentively and respond appropriately',
            'use polite language in oral interactions',
            'present ideas clearly and confidently',
          ],
        },
      ],
    },
    {
      strand: 'Reading',
      subStrands: [
        {
          name: 'Comprehension and Intensive Reading',
          topics: ['Reading strategies', 'Comprehension passages', 'Literary texts', 'Summary skills'],
          slos: [
            'apply reading strategies to comprehend texts',
            'infer meaning from context',
            'summarise main ideas accurately',
          ],
        },
      ],
    },
    {
      strand: 'Writing',
      subStrands: [
        {
          name: 'Functional and Creative Writing',
          topics: ['Paragraph writing', 'Letters and emails', 'Narrative composition', 'Descriptive writing'],
          slos: [
            'plan and organise written work',
            'write clear functional and creative texts',
            'edit and proofread own writing',
          ],
        },
      ],
    },
    {
      strand: 'Grammar in Use',
      subStrands: [
        {
          name: 'Language Structures',
          topics: ['Parts of speech', 'Tenses', 'Sentence construction', 'Punctuation'],
          slos: [
            'use correct grammatical structures in speech and writing',
            'construct varied sentence types accurately',
          ],
        },
      ],
    },
  ],
  Kiswahili: [
    {
      strand: 'Kusikiliza na Kuzungumza',
      subStrands: [
        {
          name: 'Mawasiliano ya mdomo',
          topics: ['Mazungumzo', 'Hadithi', 'Majadiliano', 'Matamshi'],
          slos: [
            'kusikiliza kwa makini na kujibu ipasavyo',
            'kutumia lugha heshima katika mazungumzo',
          ],
        },
      ],
    },
    {
      strand: 'Kusoma',
      subStrands: [
        {
          name: 'Ufahamu',
          topics: ['Ufahamu wa kifungu', 'Fasihi', 'Muhtasari'],
          slos: [
            'kufahamu maudhui ya kifungu',
            'kutoa muhtasari wa mawazo makuu',
          ],
        },
      ],
    },
    {
      strand: 'Kuandika',
      subStrands: [
        {
          name: 'Uandishi wa kazi',
          topics: ['Insha', 'Barua', 'Ripoti'],
          slos: [
            'kuandika insha na barua kwa mpangilio mzuri',
            'kuhariri kazi zao za uandishi',
          ],
        },
      ],
    },
  ],
  'Integrated Science': [
    {
      strand: 'Scientific Investigation',
      subStrands: [
        {
          name: 'Scientific Methods',
          topics: ['Laboratory safety', 'Measurements', 'Scientific inquiry', 'Recording results'],
          slos: [
            'observe laboratory safety rules',
            'use basic measuring instruments accurately',
            'design simple scientific investigations',
          ],
        },
      ],
    },
    {
      strand: 'Matter and Materials',
      subStrands: [
        {
          name: 'Properties of Matter',
          topics: ['States of matter', 'Mixtures and separation', 'Elements and compounds', 'Physical and chemical changes'],
          slos: [
            'describe properties of matter',
            'separate mixtures using appropriate methods',
            'distinguish physical and chemical changes',
          ],
        },
      ],
    },
    {
      strand: 'Living Things and Environment',
      subStrands: [
        {
          name: 'Organisms and Ecosystems',
          topics: ['Cell structure', 'Human body systems', 'Nutrition', 'Ecosystems and conservation'],
          slos: [
            'describe basic cell structures',
            'explain functions of major body systems',
            'demonstrate care for the environment',
          ],
        },
      ],
    },
    {
      strand: 'Force, Energy and Motion',
      subStrands: [
        {
          name: 'Energy Transformations',
          topics: ['Types of energy', 'Heat transfer', 'Simple machines', 'Electricity basics'],
          slos: [
            'identify forms of energy and transformations',
            'explain heat transfer methods',
            'apply principles of simple machines',
          ],
        },
      ],
    },
  ],
  'Social Studies': [
    {
      strand: 'Natural and Historic Built Environments',
      subStrands: [
        {
          name: 'People and Environment',
          topics: ['Map reading', 'Weather and climate', 'Natural resources', 'Settlement'],
          slos: [
            'interpret simple maps and diagrams',
            'describe weather and climate elements',
            'explain sustainable use of resources',
          ],
        },
      ],
    },
    {
      strand: 'Political and Economic Systems',
      subStrands: [
        {
          name: 'Citizenship and Governance',
          topics: ['National symbols', 'Human rights', 'Government structure', 'Trade and money'],
          slos: [
            'demonstrate responsible citizenship',
            'describe basic structures of government',
            'explain simple economic activities',
          ],
        },
      ],
    },
    {
      strand: 'Social Relationships and Cultural Diversity',
      subStrands: [
        {
          name: 'Culture and Society',
          topics: ['Family and community', 'Cultural practices', 'Peace and conflict resolution', 'Gender roles'],
          slos: [
            'appreciate cultural diversity',
            'practise peaceful conflict resolution',
            'promote inclusive social relationships',
          ],
        },
      ],
    },
  ],
  Agriculture: [
    {
      strand: 'Crop Production',
      subStrands: [
        {
          name: 'Crop Husbandry',
          topics: ['Soil preparation', 'Planting', 'Crop protection', 'Harvesting and storage'],
          slos: [
            'prepare land for crop production',
            'apply appropriate planting methods',
            'identify common pests and diseases',
          ],
        },
      ],
    },
    {
      strand: 'Animal Production',
      subStrands: [
        {
          name: 'Livestock Management',
          topics: ['Farm animals', 'Feeding', 'Housing', 'Animal health'],
          slos: [
            'identify common farm animals and their products',
            'describe basic animal husbandry practices',
          ],
        },
      ],
    },
    {
      strand: 'Agricultural Economics and Extension',
      subStrands: [
        {
          name: 'Farm Business',
          topics: ['Farm records', 'Marketing', 'Value addition', 'Agripreneurship'],
          slos: [
            'keep simple farm records',
            'explain value addition of farm products',
          ],
        },
      ],
    },
  ],
  'Pre-Technical Studies': [
    {
      strand: 'Technical Drawing and Design',
      subStrands: [
        {
          name: 'Drawing Practice',
          topics: ['Drawing instruments', 'Orthographic projection', 'Isometric drawing', 'Design process'],
          slos: [
            'use drawing instruments safely and accurately',
            'produce simple orthographic and isometric drawings',
          ],
        },
      ],
    },
    {
      strand: 'Materials and Tools',
      subStrands: [
        {
          name: 'Workshop Practice',
          topics: ['Workshop safety', 'Hand tools', 'Materials', 'Basic construction'],
          slos: [
            'observe workshop safety rules',
            'select and use appropriate hand tools',
          ],
        },
      ],
    },
  ],
  'Creative Arts and Sports': [
    {
      strand: 'Visual Arts',
      subStrands: [
        {
          name: 'Drawing and Design',
          topics: ['Elements of art', 'Colour theory', 'Still life', 'Design motifs'],
          slos: [
            'apply elements and principles of art',
            'create original artworks using available materials',
          ],
        },
      ],
    },
    {
      strand: 'Performing Arts and Sports',
      subStrands: [
        {
          name: 'Music, Drama and Games',
          topics: ['Rhythm and melody', 'Drama skills', 'Athletics', 'Ball games'],
          slos: [
            'participate actively in performing arts',
            'demonstrate basic skills in selected games',
          ],
        },
      ],
    },
  ],
};

export function normalizeSubjectKey(subject: string): string {
  const s = (subject || '').toLowerCase().trim();
  if (s.includes('math')) return 'Mathematics';
  if (s.includes('english')) return 'English';
  if (s.includes('kiswahili') || s.includes('swahili')) return 'Kiswahili';
  if (s.includes('integrated') || s.includes('science')) return 'Integrated Science';
  if (s.includes('social')) return 'Social Studies';
  if (s.includes('agric')) return 'Agriculture';
  if (s.includes('pre-tech') || s.includes('pre tech') || s.includes('technical')) return 'Pre-Technical Studies';
  if (s.includes('creative') || s.includes('sport') || s.includes('art')) return 'Creative Arts and Sports';
  if (s.includes('cre') || s.includes('christian')) return 'Christian Religious Education';
  if (s.includes('ire') || s.includes('islamic')) return 'Islamic Religious Education';
  return subject || 'General';
}

export function getStrandPacks(subject: string): KicdStrandPack[] {
  const key = normalizeSubjectKey(subject);
  return JUNIOR_STRAND_PACKS[key] || [
    {
      strand: `${subject || 'Learning Area'} Concepts`,
      subStrands: [
        {
          name: 'Core Content',
          topics: ['Introduction', 'Key concepts', 'Application', 'Review and assessment'],
          slos: [
            `explain key concepts in ${subject || 'the learning area'}`,
            `apply knowledge of ${subject || 'the topic'} in familiar contexts`,
            'demonstrate relevant values and core competencies',
          ],
        },
      ],
    },
  ];
}

export function findStrandContext(subject: string, topicName: string): {
  strand: string;
  subStrand: string;
  slos: string[];
  relatedTopics: string[];
} {
  const packs = getStrandPacks(subject);
  const t = (topicName || '').toLowerCase();
  for (const pack of packs) {
    for (const ss of pack.subStrands) {
      if (
        ss.name.toLowerCase().includes(t) ||
        t.includes(ss.name.toLowerCase()) ||
        ss.topics.some((x) => x.toLowerCase().includes(t) || t.includes(x.toLowerCase()))
      ) {
        return {
          strand: pack.strand,
          subStrand: ss.name,
          slos: ss.slos,
          relatedTopics: ss.topics,
        };
      }
    }
  }
  const first = packs[0];
  const ss = first.subStrands[0];
  return {
    strand: first.strand,
    subStrand: ss.name,
    slos: ss.slos,
    relatedTopics: ss.topics,
  };
}

export interface SchemeRow {
  week_number: number;
  lesson_number: number;
  strand: string;
  sub_strand: string;
  learning_objective: string;
  key_inquiry_questions: string;
  learning_activities: string;
  learning_resources: string;
  assessment_methods: string;
  reflection: string;
  core_competencies: string;
  values: string;
  pci: string;
  topic_name?: string;
}

export function buildSchemeRow(params: {
  subject: string;
  grade: string;
  topic: string;
  week?: number;
  lesson?: number;
  term?: string;
  learningObjectives?: string[];
  strand?: string;
  subStrand?: string;
}): SchemeRow {
  const ctx = findStrandContext(params.subject, params.topic);
  const strand = params.strand || ctx.strand;
  const sub = params.subStrand || ctx.subStrand;
  const slos = (params.learningObjectives && params.learningObjectives.length
    ? params.learningObjectives
    : ctx.slos
  ).slice(0, 3);
  const sloText = slos
    .map((s, i) => `${String.fromCharCode(97 + i)}) ${s.startsWith('By') ? s : `By the end of the lesson, the learner should be able to ${s}`}`)
    .join('\n');

  return {
    week_number: params.week || 1,
    lesson_number: params.lesson || 1,
    strand,
    sub_strand: sub,
    learning_objective: sloText,
    key_inquiry_questions: `How does ${params.topic} help the learner solve real-life problems in the community?`,
    learning_activities:
      `1. Introduction (5–8 min): Review prior knowledge; present key inquiry question on ${params.topic}.\n` +
      `2. Development (20–25 min): Teacher demonstration; guided practice; group investigation; peer feedback.\n` +
      `3. Conclusion (5–10 min): Plenary summary of SLOs; formative check; assign extended activity.`,
    learning_resources:
      `KICD Curriculum Design (${params.grade}); Approved course book; Charts/flashcards; Worksheets; Realia/manipulatives; Digital resources where available; schemesofwork.com sample structures for format reference`,
    assessment_methods:
      'Observation checklist; Oral questioning; Written exercise; Group presentation; Portfolio entry; Peer/self assessment aligned to SLOs',
    reflection:
      'Were the SLOs achieved? Which learners need remediation or enrichment? What will I improve in the next lesson? (TPAD)',
    core_competencies: CORE_COMPETENCIES.slice(0, 3).join('; '),
    values: 'Responsibility; Respect; Integrity',
    pci: 'Education for Sustainable Development; Life Skills Education',
    topic_name: params.topic,
  };
}

/** Generate a multi-week term scheme (default 10 teaching weeks × 1–2 lessons) */
export function buildTermScheme(params: {
  subject: string;
  grade: string;
  term?: string;
  weeks?: number;
  lessonsPerWeek?: number;
  topics?: string[];
}): SchemeRow[] {
  const weeks = params.weeks || 10;
  const lpw = params.lessonsPerWeek || 1;
  const packs = getStrandPacks(params.subject);
  const topicPool: { topic: string; strand: string; sub: string; slos: string[] }[] = [];
  for (const p of packs) {
    for (const ss of p.subStrands) {
      for (const t of ss.topics) {
        topicPool.push({ topic: t, strand: p.strand, sub: ss.name, slos: ss.slos });
      }
    }
  }
  if (params.topics?.length) {
    params.topics.forEach((t) => {
      const ctx = findStrandContext(params.subject, t);
      topicPool.unshift({ topic: t, strand: ctx.strand, sub: ctx.subStrand, slos: ctx.slos });
    });
  }
  if (!topicPool.length) {
    topicPool.push({
      topic: params.subject || 'Core topic',
      strand: 'Core',
      sub: 'Introduction',
      slos: ['explain key ideas', 'apply knowledge', 'demonstrate values'],
    });
  }

  const rows: SchemeRow[] = [];
  let idx = 0;
  for (let w = 1; w <= weeks; w++) {
    for (let l = 1; l <= lpw; l++) {
      const item = topicPool[idx % topicPool.length];
      idx++;
      rows.push(
        buildSchemeRow({
          subject: params.subject,
          grade: params.grade,
          topic: item.topic,
          week: w,
          lesson: l,
          term: params.term,
          learningObjectives: item.slos,
          strand: item.strand,
          subStrand: item.sub,
        })
      );
    }
  }
  return rows;
}

export interface FullLessonPlan {
  lesson_objective: string;
  strand: string;
  sub_strand: string;
  key_inquiry_question: string;
  specific_learning_outcomes: string[];
  core_competencies: string[];
  values: string[];
  pci: string[];
  learning_resources: string[];
  organization_of_learning: string;
  introduction: string;
  development: string;
  conclusion: string;
  teaching_aids: string[];
  competency_outcomes: string[];
  assessment: string;
  extended_activities: string;
  homework: string;
  teacher_self_evaluation: string;
  reflection: string;
  duration_minutes: number;
}

export function buildFullLessonPlan(params: {
  subject: string;
  grade: string;
  topic: string;
  duration?: number;
  learningObjectives?: string[];
  strand?: string;
  subStrand?: string;
}): FullLessonPlan {
  const ctx = findStrandContext(params.subject, params.topic);
  const duration = params.duration || (/pp|pre/i.test(params.grade) ? 25 : /1|2|3/.test(params.grade) ? 30 : 40);
  const slos = (params.learningObjectives?.length ? params.learningObjectives : ctx.slos).slice(0, 3);

  return {
    lesson_objective: `By the end of the lesson, the learner should be able to demonstrate understanding of ${params.topic} as outlined in the KICD design.`,
    strand: params.strand || ctx.strand,
    sub_strand: params.subStrand || ctx.subStrand,
    key_inquiry_question: `In what ways is ${params.topic} important in the learner's daily life?`,
    specific_learning_outcomes: slos.map((s) =>
      s.toLowerCase().startsWith('by the end') ? s : `By the end of the lesson, the learner should be able to ${s}`
    ),
    core_competencies: [...CORE_COMPETENCIES.slice(0, 3)],
    values: ['Responsibility', 'Respect', 'Integrity'],
    pci: ['Life Skills Education', 'Education for Sustainable Development'],
    learning_resources: [
      'KICD Curriculum Design',
      'Approved course book',
      'Charts / flashcards',
      'Worksheets',
      'Locally available materials',
      'Digital device (optional)',
    ],
    organization_of_learning:
      'Arrange seats for whole-class introduction then mixed-ability groups of 4–5. Prepare board work and distribute worksheets before the lesson. Ensure inclusive participation of all learners.',
    introduction: `Review previous lesson (2 min). Present the key inquiry question on ${params.topic}. Use a short story, picture, or real object to spark curiosity (3–5 min).`,
    development:
      `Step 1: Teacher explains and demonstrates key ideas of ${params.topic}.\n` +
      `Step 2: Guided practice with examples on the board.\n` +
      `Step 3: Group task — learners apply the concept and present findings.\n` +
      `Step 4: Individual practice / written exercise with teacher circulating for support.`,
    conclusion: `Recap SLOs with learners. Random oral check. Clarify misconceptions. Give homework and preview next lesson.`,
    teaching_aids: ['Chalkboard/whiteboard', 'Charts', 'Worksheets', 'Real objects', 'Course book'],
    competency_outcomes: [...CORE_COMPETENCIES.slice(0, 4)],
    assessment:
      'Formative: oral questions, observation checklist during group work, exit ticket (2 questions). Summative: short written exercise on the topic.',
    extended_activities: `Fast finishers research one real-life application of ${params.topic} and share with the class.`,
    homework: `Complete practice exercise on ${params.topic} and prepare one question for the next lesson.`,
    teacher_self_evaluation:
      'Did all learners achieve the SLOs? Was time well managed? Which strategies worked best for struggling learners?',
    reflection:
      'Note learner engagement, resources that worked, and adjustments for the next lesson (TPAD reflection).',
    duration_minutes: duration,
  };
}

export interface ExamBlueprint {
  title: string;
  instructions: string[];
  sections: {
    name: string;
    description: string;
    questions: {
      number: number;
      text: string;
      type: 'multiple_choice' | 'short_answer' | 'essay';
      options?: string[];
      answer: string;
      marks: number;
      difficulty: string;
      topic?: string;
    }[];
  }[];
  totalMarks: number;
}

export function buildExamBlueprint(params: {
  subject: string;
  grade: string;
  topics: string[];
  title?: string;
  totalMarks?: number;
  difficulty?: string;
}): ExamBlueprint {
  const total = params.totalMarks || 50;
  const topics = params.topics.length ? params.topics : getStrandPacks(params.subject).flatMap((p) => p.subStrands.flatMap((s) => s.topics)).slice(0, 5);
  const diff = params.difficulty || 'Medium';
  const subj = normalizeSubjectKey(params.subject);

  // Mark split: 40% MCQ, 40% structured, 20% essay (approx)
  const mcqMarks = Math.max(10, Math.round(total * 0.4));
  const structuredMarks = Math.max(10, Math.round(total * 0.4));
  const essayMarks = Math.max(5, total - mcqMarks - structuredMarks);

  const mcqCount = Math.min(10, Math.max(5, Math.round(mcqMarks / 1)));
  const eachMcq = Math.max(1, Math.round(mcqMarks / mcqCount));
  const structuredCount = Math.min(5, Math.max(3, Math.round(structuredMarks / 4)));
  const eachStruct = Math.max(2, Math.round(structuredMarks / structuredCount));

  const mcqs = Array.from({ length: mcqCount }, (_, i) => {
    const topic = topics[i % topics.length];
    return makeMcq(subj, topic, i + 1, eachMcq, diff);
  });

  const structured = Array.from({ length: structuredCount }, (_, i) => {
    const topic = topics[i % topics.length];
    return {
      number: i + 1,
      text: makeStructuredStem(subj, topic, i + 1),
      type: 'short_answer' as const,
      answer: makeStructuredAnswer(subj, topic),
      marks: eachStruct,
      difficulty: diff,
      topic,
    };
  });

  const essays = [
    {
      number: 1,
      text: makeEssayStem(subj, topics[0] || params.subject, params.grade),
      type: 'essay' as const,
      answer: makeEssayAnswer(subj, topics[0] || params.subject),
      marks: essayMarks,
      difficulty: diff,
      topic: topics[0],
    },
  ];

  return {
    title: params.title || `${params.subject} — ${params.grade} Assessment`,
    instructions: [
      'Answer ALL questions in Sections A and B.',
      'Answer the question in Section C.',
      'Write your name, class and admission number on every sheet.',
      'Show working clearly where necessary.',
      `Time allowed: ${Math.ceil(total * 1.5)} minutes.`,
      'Silent examination conditions apply.',
    ],
    sections: [
      {
        name: `SECTION A: Multiple Choice (${mcqs.reduce((s, q) => s + q.marks, 0)} marks)`,
        description: 'Choose the correct answer from the options given.',
        questions: mcqs,
      },
      {
        name: `SECTION B: Structured Questions (${structured.reduce((s, q) => s + q.marks, 0)} marks)`,
        description: 'Answer all questions. Show your working.',
        questions: structured,
      },
      {
        name: `SECTION C: Extended Response (${essays.reduce((s, q) => s + q.marks, 0)} marks)`,
        description: 'Write a well-organised response.',
        questions: essays,
      },
    ],
    totalMarks: total,
  };
}

function makeMcq(subject: string, topic: string, n: number, marks: number, difficulty: string) {
  const banks: Record<string, { q: string; opts: string[]; a: string }[]> = {
    Mathematics: [
      { q: `What is the place value of 7 in 3,752?`, opts: ['Ones', 'Tens', 'Hundreds', 'Thousands'], a: 'Hundreds' },
      { q: `Simplify: 3x + 5x − 2x`, opts: ['6x', '5x', '10x', 'x'], a: '6x' },
      { q: `Convert 0.25 to a percentage.`, opts: ['2.5%', '25%', '250%', '0.25%'], a: '25%' },
      { q: `The perimeter of a square of side 6 cm is:`, opts: ['12 cm', '24 cm', '36 cm', '18 cm'], a: '24 cm' },
      { q: `Mean of 4, 6, 8, 10 is:`, opts: ['6', '7', '8', '28'], a: '7' },
    ],
    English: [
      { q: `Choose the correctly punctuated sentence.`, opts: ["Its raining outside.", "It's raining outside.", "Its' raining outside.", "It raining outside."], a: "It's raining outside." },
      { q: `The synonym of "rapid" is:`, opts: ['slow', 'quick', 'lazy', 'weak'], a: 'quick' },
      { q: `Identify the noun in: "The learners wrote neatly."`, opts: ['wrote', 'neatly', 'learners', 'The'], a: 'learners' },
      { q: `A story that is not true is called a:`, opts: ['biography', 'fiction', 'diary', 'report'], a: 'fiction' },
      { q: `Choose the correct tense: She ____ to school every day.`, opts: ['go', 'goes', 'going', 'gone'], a: 'goes' },
    ],
    'Integrated Science': [
      { q: `Which state of matter has a definite shape and volume?`, opts: ['Gas', 'Liquid', 'Solid', 'Plasma'], a: 'Solid' },
      { q: `The process by which plants make food is:`, opts: ['Respiration', 'Photosynthesis', 'Transpiration', 'Digestion'], a: 'Photosynthesis' },
      { q: `A force that opposes motion between surfaces is:`, opts: ['Gravity', 'Friction', 'Magnetism', 'Tension'], a: 'Friction' },
      { q: `The basic unit of life is the:`, opts: ['Tissue', 'Organ', 'Cell', 'System'], a: 'Cell' },
      { q: `Which instrument measures temperature?`, opts: ['Ruler', 'Thermometer', 'Ammeter', 'Barometer'], a: 'Thermometer' },
    ],
    'Social Studies': [
      { q: `A map key is also called a:`, opts: ['Scale', 'Legend', 'Compass', 'Grid'], a: 'Legend' },
      { q: `Kenya's capital city is:`, opts: ['Mombasa', 'Kisumu', 'Nairobi', 'Nakuru'], a: 'Nairobi' },
      { q: `Which is a renewable resource?`, opts: ['Coal', 'Petroleum', 'Solar energy', 'Natural gas'], a: 'Solar energy' },
      { q: `The three arms of government include the Executive, Legislature and:`, opts: ['Police', 'Judiciary', 'Army', 'Cabinet'], a: 'Judiciary' },
      { q: `Culture refers to:`, opts: ['Only language', 'People’s way of life', 'Weather only', 'School rules only'], a: 'People’s way of life' },
    ],
  };
  const list = banks[subject] || banks['Integrated Science'];
  const item = list[(n - 1) % list.length];
  // Personalize with topic when generic bank used
  const text = subject === 'Mathematics' || subject === 'English' || subject === 'Integrated Science' || subject === 'Social Studies'
    ? `${n}. ${item.q} (Topic focus: ${topic})`
    : `${n}. Which statement best relates to ${topic}?`;
  const opts = item.opts || ['Option A', 'Option B', 'Option C', 'Option D'];
  return {
    number: n,
    text,
    type: 'multiple_choice' as const,
    options: opts,
    answer: item.a,
    marks,
    difficulty,
    topic,
  };
}

function makeStructuredStem(subject: string, topic: string, n: number): string {
  if (subject === 'Mathematics') {
    return `${n}. (a) Define or state a key fact about ${topic}. (2 marks)\n(b) Work out a problem involving ${topic}. Show all steps. (3 marks)\n(c) Give one real-life application of ${topic}. (1 mark)`;
  }
  if (subject === 'English' || subject === 'Kiswahili') {
    return `${n}. Read the short context on ${topic} and:\n(a) Explain the main idea. (2 marks)\n(b) Give the meaning of two key words in context. (2 marks)\n(c) Write two sentences using the target structure. (2 marks)`;
  }
  return `${n}. (a) Explain the meaning of ${topic}. (2 marks)\n(b) Describe two important points a learner should know about ${topic}. (4 marks)\n(c) State one way ${topic} is useful in daily life. (2 marks)`;
}

function makeStructuredAnswer(subject: string, topic: string): string {
  return `(a) Correct definition/explanation of ${topic}.\n(b) Accurate worked steps or two valid points with examples.\n(c) Relevant real-life application.\nAward marks for clarity, accuracy and use of subject vocabulary.`;
}

function makeEssayStem(subject: string, topic: string, grade: string): string {
  return `Discuss ${topic} as studied in ${grade} ${subject}. In your answer:\n• Explain the meaning/key ideas\n• Give examples\n• Show importance to the learner and community\n• Conclude clearly`;
}

function makeEssayAnswer(subject: string, topic: string): string {
  return `Introduction defining ${topic}; body with 3–4 well-explained points and examples; conclusion linking to values/competencies. Award for content, organisation, language and relevance.`;
}

export const SCHEME_COLUMNS = [
  'Week', 'Lesson', 'Strand', 'Sub-Strand', 'Specific Learning Outcomes',
  'Key Inquiry Questions', 'Learning Experiences', 'Learning Resources', 'Assessment', 'Reflection',
] as const;

export const LESSON_PLAN_SECTIONS = [
  'Header (School, Teacher, Grade, Term, Enrolment)',
  'Strand / Sub-Strand',
  'Specific Learning Outcomes (a/b/c)',
  'Key Inquiry Question',
  'Core Competencies',
  'Values',
  'PCIs',
  'Learning Resources',
  'Organisation of Learning',
  'Introduction / Development / Conclusion',
  'Assessment',
  'Extended Activities',
  'Reflection / Teacher Self-Evaluation',
] as const;

export function gradeDesignUrl(gradeName: string): string {
  const g = (gradeName || '').toLowerCase();
  if (g.includes('7') || g.includes('seven')) return OFFICIAL_LINKS.gradeSeven;
  if (g.includes('8') || g.includes('eight')) return OFFICIAL_LINKS.gradeEight;
  if (g.includes('9') || g.includes('nine')) return OFFICIAL_LINKS.gradeNine;
  return OFFICIAL_LINKS.curriculumDesigns;
}

export const SAMPLE_PAPER_LIBRARY = [
  {
    id: 'js-math-opener',
    title: 'Junior School Mathematics — Opener Sample',
    subject: 'Mathematics',
    description: 'Section A MCQ, Section B structured, Section C problem-solving. KICD-aligned topics.',
    format: '50 marks · 1 hr 15 min',
  },
  {
    id: 'js-eng-midterm',
    title: 'Junior School English — Midterm Sample',
    subject: 'English',
    description: 'Grammar, comprehension-style MCQs, structured language use, composition prompt.',
    format: '50 marks · 1 hr 30 min',
  },
  {
    id: 'js-intsci-endterm',
    title: 'Integrated Science — End of Term Sample',
    subject: 'Integrated Science',
    description: 'Theory paper with practical-context questions and extended response.',
    format: '50 marks · 1 hr 30 min',
  },
  {
    id: 'js-sst-assessment',
    title: 'Social Studies — Continuous Assessment Sample',
    subject: 'Social Studies',
    description: 'Citizenship, environment and economic activities assessment blueprint.',
    format: '30 marks · 45 min',
  },
  {
    id: 'js-agric-cat',
    title: 'Agriculture — CAT Sample',
    subject: 'Agriculture',
    description: 'Crop and animal production short items + farm records application.',
    format: '30 marks · 45 min',
  },
] as const;
