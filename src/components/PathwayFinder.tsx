import { useMemo, useState } from 'react';
import {
  Compass, ChevronRight, ChevronLeft, RotateCcw, GraduationCap, Heart, Target, Star,
  FlaskConical, Wrench, Leaf, Monitor, Palette, Music, Calculator, BookOpen, Globe,
  Briefcase, Gavel, PenTool, Code, Cpu, Database, Atom, Building2, Users, MessageSquare,
  Landmark, Sprout, UtensilsCrossed, Plane, Microscope, Camera, Volleyball, Theater,
  Pen, Beaker, HardHat, Wifi, ShieldCheck, DollarSign, TrendingUp, UsersRound, School,
  Baby, Lock, CreditCard, CheckCircle2, XCircle, Download,
} from 'lucide-react';

/* ── Junior School grading (8-point CBC scale) ─────────────────────────── */
export const JUNIOR_GRADES = [
  { code: 'EE2', description: 'Exceeding Expectations (2)', points: 12 },
  { code: 'EE1', description: 'Exceeding Expectations (1)', points: 11 },
  { code: 'ME2', description: 'Meeting Expectations (2)', points: 10 },
  { code: 'ME1', description: 'Meeting Expectations (1)', points: 9 },
  { code: 'AE2', description: 'Approaching Expectations (2)', points: 8 },
  { code: 'AE1', description: 'Approaching Expectations (1)', points: 7 },
  { code: 'BE2', description: 'Below Expectations (2)', points: 5 },
  { code: 'BE1', description: 'Below Expectations (1)', points: 4 },
] as const;

export type JuniorGradeCode = (typeof JUNIOR_GRADES)[number]['code'];

export function gradeMeta(code?: string) {
  return JUNIOR_GRADES.find((g) => g.code === code);
}

/** 9 Junior School learning areas shown in Step 3 */
export const JUNIOR_LEARNING_AREAS = [
  { name: 'Mathematics', pathway: 'STEM' },
  { name: 'English', pathway: 'Social Sciences' },
  { name: 'Kiswahili', pathway: 'Social Sciences' },
  { name: 'Integrated Science', pathway: 'STEM' },
  { name: 'Pre-Technical Studies', pathway: 'STEM' },
  { name: 'Social Studies', pathway: 'Social Sciences' },
  { name: 'Agriculture and Nutrition', pathway: 'STEM' },
  { name: 'Creative Arts and Sports', pathway: 'Creative Arts and Sports' },
  { name: 'Religious Education', pathway: 'Social Sciences' },
] as const;

/** Pathway display order */
export const PATHWAY_ORDER = [
  'Core Academic',
  'STEM',
  'Creative Arts and Sports',
  'Social Sciences',
  'Research and Innovation',
  'Education',
] as const;

interface InterestOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

interface CareerPath {
  id: string;
  title: string;
  description: string;
  pathway: string;
  requirements: string[];
  interests: string[];
  requiredGrade?: JuniorGradeCode;
}

const interestOptions: InterestOption[] = [
  // Core Academic — 9 junior learning areas
  { id: 'mathematics', label: 'Mathematics', description: 'Numbers, algebra, geometry, problem-solving', icon: <Calculator className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'english', label: 'English', description: 'Reading, writing, speaking English effectively', icon: <BookOpen className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'kiswahili', label: 'Kiswahili/Kenyan Sign Language', description: 'Language, culture, communication', icon: <MessageSquare className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'integrated_science', label: 'Integrated Science', description: 'Combined science (not separate Bio/Chem/Phys)', icon: <Atom className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'pre_technical', label: 'Pre-Technical Studies', description: 'Computers, business and technical foundations', icon: <Wrench className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'social_studies', label: 'Social Studies', description: 'History, geography, citizenship, life skills', icon: <Globe className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'agriculture_nutrition', label: 'Agriculture and Nutrition', description: 'Farming practices with health and home science', icon: <Sprout className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'creative_arts_sports', label: 'Creative Arts and Sports', description: 'Music, art, crafts and physical education', icon: <Palette className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'religious_ed', label: 'Religious Education (CRE/IRE/HRE)', description: 'Morals, values and faith traditions', icon: <Landmark className="w-6 h-6" />, category: 'Core Academic' },

  // STEM interests (10)
  { id: 'scientific_inquiry', label: 'Scientific Inquiry', description: 'How the natural world works through biology, chemistry and physics', icon: <FlaskConical className="w-6 h-6" />, category: 'STEM' },
  { id: 'technology_enthusiasm', label: 'Technology Enthusiasm', description: 'Computers, software and digital devices', icon: <Monitor className="w-6 h-6" />, category: 'STEM' },
  { id: 'engineering_design', label: 'Engineering Design', description: 'Designing and building structures, machines or systems', icon: <HardHat className="w-6 h-6" />, category: 'STEM' },
  { id: 'mathematical_thinking', label: 'Mathematical Thinking', description: 'Numbers, patterns and complex problem-solving', icon: <Calculator className="w-6 h-6" />, category: 'STEM' },
  { id: 'medical_health', label: 'Medical and Health Sciences', description: 'Human body, diseases and healthcare', icon: <Heart className="w-6 h-6" />, category: 'STEM' },
  { id: 'environmental_science', label: 'Environmental Science', description: 'Climate, conservation and sustainable agriculture', icon: <Leaf className="w-6 h-6" />, category: 'STEM' },
  { id: 'space_astronomy', label: 'Space and Astronomy', description: 'Universe, planets and space exploration', icon: <Star className="w-6 h-6" />, category: 'STEM' },
  { id: 'robotics_automation', label: 'Robotics and Automation', description: 'Machines that perform tasks autonomously', icon: <Cpu className="w-6 h-6" />, category: 'STEM' },
  { id: 'programming_coding', label: 'Programming and Coding', description: 'Websites, apps and software solutions', icon: <Code className="w-6 h-6" />, category: 'STEM' },
  { id: 'data_science_ai', label: 'Data Science and AI', description: 'Data analysis, machine learning and AI', icon: <Database className="w-6 h-6" />, category: 'STEM' },
  // STEM subjects / tracks
  { id: 'physics', label: 'Physics', description: 'Pure Sciences track', icon: <Atom className="w-6 h-6" />, category: 'STEM' },
  { id: 'chemistry', label: 'Chemistry', description: 'Pure Sciences track', icon: <Beaker className="w-6 h-6" />, category: 'STEM' },
  { id: 'biology', label: 'Biology', description: 'Pure Sciences track', icon: <Leaf className="w-6 h-6" />, category: 'STEM' },
  { id: 'computer_studies', label: 'Computer Studies', description: 'Applied Sciences track', icon: <Monitor className="w-6 h-6" />, category: 'STEM' },
  { id: 'home_science', label: 'Home Science', description: 'Applied Sciences track', icon: <UtensilsCrossed className="w-6 h-6" />, category: 'STEM' },
  { id: 'agriculture', label: 'Agriculture', description: 'Applied Sciences track', icon: <Sprout className="w-6 h-6" />, category: 'STEM' },
  { id: 'health', label: 'Health', description: 'Health sciences within STEM', icon: <Heart className="w-6 h-6" />, category: 'STEM' },
  { id: 'gis', label: 'GIS', description: 'Geospatial information systems', icon: <Globe className="w-6 h-6" />, category: 'STEM' },
  { id: 'aviation', label: 'Aviation', description: 'Technical Studies track', icon: <Plane className="w-6 h-6" />, category: 'STEM' },
  { id: 'construction', label: 'Building and Construction', description: 'Technical Studies track', icon: <HardHat className="w-6 h-6" />, category: 'STEM' },
  { id: 'electricity', label: 'Electricity', description: 'Technical Studies track', icon: <Wifi className="w-6 h-6" />, category: 'STEM' },
  { id: 'metal_work', label: 'Metal Work', description: 'Technical Studies track', icon: <Wrench className="w-6 h-6" />, category: 'STEM' },
  { id: 'power_mechanics', label: 'Power Mechanics', description: 'Technical Studies track', icon: <Cpu className="w-6 h-6" />, category: 'STEM' },
  { id: 'woodwork', label: 'Woodwork', description: 'Technical Studies track', icon: <Wrench className="w-6 h-6" />, category: 'STEM' },
  { id: 'media_tech', label: 'Media Technology', description: 'Technical Studies track', icon: <Camera className="w-6 h-6" />, category: 'STEM' },
  { id: 'marine_fisheries', label: 'Marine and Fisheries Technology', description: 'Technical Studies track', icon: <Leaf className="w-6 h-6" />, category: 'STEM' },

  // Creative Arts and Sports interests (10)
  { id: 'athletic_performance', label: 'Athletic Performance', description: 'Competitive sports and physical conditioning', icon: <Volleyball className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'human_anatomy', label: 'Human Anatomy', description: 'Muscles, healing and nutrition for energy', icon: <Heart className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'strategy_coaching', label: 'Strategy and Coaching', description: 'Game tactics, formations and leading peers', icon: <Users className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'outdoor_activity', label: 'Outdoor Activity', description: 'Active, hands-on tasks over desk work', icon: <Sprout className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'stage_expression', label: 'Stage Expression', description: 'Acting, dancing, singing or instruments', icon: <Theater className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'creative_writing', label: 'Creative Writing', description: 'Poetry, scripts, lyrics and stories', icon: <Pen className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'media_consumption', label: 'Media Consumption', description: 'Films, theatre, podcasts and music production', icon: <Camera className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'public_speaking', label: 'Public Speaking', description: 'Spotlight and dynamic presentation', icon: <UsersRound className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'visual_creation', label: 'Visual Creation', description: 'Drawing, painting, sculpting or photography', icon: <Palette className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'digital_design', label: 'Digital Design', description: 'Digital illustration, video editing, layout', icon: <PenTool className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'music', label: 'Music Composition', description: 'Performing Arts track', icon: <Music className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'dance', label: 'Dance Choreography', description: 'Performing Arts track', icon: <Theater className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'fine_arts', label: 'Fine Arts', description: 'Visual Arts track', icon: <Palette className="w-6 h-6" />, category: 'Creative Arts and Sports' },
  { id: 'pe', label: 'Physical Education', description: 'Sports Science track', icon: <Volleyball className="w-6 h-6" />, category: 'Creative Arts and Sports' },

  // Social Sciences interests (10)
  { id: 'analyzing_behavior', label: 'Analyzing Human Behavior', description: 'Why individuals and groups make decisions', icon: <Users className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'solving_social_issues', label: 'Solving Social Issues', description: 'Poverty, crime, inequality and human rights', icon: <Heart className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'debating_laws', label: 'Debating Laws and Politics', description: 'Governance, political systems, international relations', icon: <Gavel className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'history_culture', label: 'Exploring History and Culture', description: 'How past events shape today', icon: <Landmark className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'investigating_economics', label: 'Investigating Economics', description: 'Money, resources, trade and business impact', icon: <DollarSign className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'telling_stories', label: 'Telling Impactful Stories', description: 'Researching and communicating truths about society', icon: <Pen className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'land_management', label: 'Environment and Land Management', description: 'Landforms, earth surface and space', icon: <Globe className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'human_geography', label: 'Human Geography', description: 'Population, migration and urbanization', icon: <UsersRound className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'physical_geography', label: 'Physical Geography', description: 'Natural features, climate and ecosystems', icon: <Leaf className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'global_affairs', label: 'Global Affairs', description: 'International relations, diplomacy and politics', icon: <Globe className="w-6 h-6" />, category: 'Social Sciences' },
  // Social Sciences subjects
  { id: 'business', label: 'Business Studies', description: 'Humanities & Business Studies track', icon: <Briefcase className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'history', label: 'History & Citizenship', description: 'Humanities & Business Studies track', icon: <Landmark className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'geography', label: 'Geography', description: 'Humanities & Business Studies track', icon: <Globe className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'hospitality_tourism', label: 'Hospitality and Tourism', description: 'Service, travel and culture', icon: <Plane className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'law', label: 'Law', description: 'Justice and legal systems', icon: <Gavel className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'quantity_survey', label: 'Quantity Survey', description: 'Construction cost and contracts', icon: <Building2 className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'journalism', label: 'Journalism', description: 'Languages & Literature career link', icon: <Pen className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'literature_english', label: 'Literature in English', description: 'Languages & Literature track', icon: <BookOpen className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'fasihi', label: 'Fasihi ya Kiswahili', description: 'Languages & Literature track', icon: <MessageSquare className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'languages', label: 'Foreign Languages', description: 'Arabic, French, German, Mandarin, Indigenous', icon: <MessageSquare className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'economics', label: 'Economics', description: 'Markets, trade and policy', icon: <TrendingUp className="w-6 h-6" />, category: 'Social Sciences' },

  // Research and Innovation
  { id: 'research', label: 'Research', description: 'Discovery and inquiry', icon: <Microscope className="w-6 h-6" />, category: 'Research and Innovation' },
  { id: 'innovation', label: 'Innovation', description: 'New ideas and creativity', icon: <FlaskConical className="w-6 h-6" />, category: 'Research and Innovation' },
  { id: 'data_analysis', label: 'Data Analysis', description: 'Evidence-based discovery', icon: <TrendingUp className="w-6 h-6" />, category: 'Research and Innovation' },

  // Education
  { id: 'teaching', label: 'Teaching', description: 'Education and instruction', icon: <School className="w-6 h-6" />, category: 'Education' },
  { id: 'edtech', label: 'Educational Technology', description: 'E-learning tools', icon: <Monitor className="w-6 h-6" />, category: 'Education' },
  { id: 'special_ed', label: 'Special Education', description: 'Inclusive learning', icon: <Baby className="w-6 h-6" />, category: 'Education' },
];

const careerPaths: CareerPath[] = [
  {
    id: 'stem_pure',
    title: 'STEM — Pure Sciences',
    description: 'Physics, Chemistry, Biology and Mathematics for medicine, engineering and research.',
    pathway: 'STEM',
    requirements: ['Mathematics', 'Integrated Science', 'Pre-Technical Studies', 'English'],
    interests: ['scientific_inquiry', 'mathematical_thinking', 'medical_health', 'physics', 'chemistry', 'biology', 'space_astronomy'],
    requiredGrade: 'ME2',
  },
  {
    id: 'stem_applied',
    title: 'STEM — Applied Sciences',
    description: 'General Science, Computer Studies, Home Science and Agriculture.',
    pathway: 'STEM',
    requirements: ['Mathematics', 'Integrated Science', 'Agriculture and Nutrition', 'Pre-Technical Studies'],
    interests: ['technology_enthusiasm', 'programming_coding', 'environmental_science', 'computer_studies', 'home_science', 'agriculture', 'health', 'gis'],
    requiredGrade: 'ME1',
  },
  {
    id: 'stem_technical',
    title: 'STEM — Technical Studies',
    description: 'Aviation, construction, electricity, metal work, power mechanics, woodwork, media and marine tech.',
    pathway: 'STEM',
    requirements: ['Mathematics', 'Pre-Technical Studies', 'Integrated Science', 'English'],
    interests: ['engineering_design', 'robotics_automation', 'aviation', 'construction', 'electricity', 'metal_work', 'power_mechanics', 'woodwork', 'media_tech', 'marine_fisheries'],
    requiredGrade: 'ME1',
  },
  {
    id: 'social_humanities',
    title: 'Social Sciences — Humanities & Business',
    description: 'Business Studies, History & Citizenship, Geography, Religious Studies and related careers.',
    pathway: 'Social Sciences',
    requirements: ['English', 'Kiswahili', 'Social Studies', 'Mathematics', 'Religious Education'],
    interests: ['business', 'history', 'geography', 'law', 'hospitality_tourism', 'quantity_survey', 'investigating_economics', 'debating_laws', 'economics', 'analyzing_behavior'],
    requiredGrade: 'ME1',
  },
  {
    id: 'social_languages',
    title: 'Social Sciences — Languages & Literature',
    description: 'Literature, Fasihi, foreign languages, journalism and diplomacy.',
    pathway: 'Social Sciences',
    requirements: ['English', 'Kiswahili', 'Social Studies', 'Religious Education'],
    interests: ['literature_english', 'fasihi', 'languages', 'journalism', 'telling_stories', 'global_affairs', 'history_culture'],
    requiredGrade: 'ME1',
  },
  {
    id: 'arts_sports_science',
    title: 'Creative Arts and Sports — Sports Science',
    description: 'Physical Education, sports training, kinesiology and related careers.',
    pathway: 'Creative Arts and Sports',
    requirements: ['Creative Arts and Sports', 'Integrated Science', 'English', 'Agriculture and Nutrition'],
    interests: ['athletic_performance', 'human_anatomy', 'strategy_coaching', 'outdoor_activity', 'pe'],
    requiredGrade: 'ME1',
  },
  {
    id: 'arts_performing',
    title: 'Creative Arts and Sports — Performing Arts',
    description: 'Music, dance, theatre, film and media production.',
    pathway: 'Creative Arts and Sports',
    requirements: ['Creative Arts and Sports', 'English', 'Kiswahili'],
    interests: ['stage_expression', 'creative_writing', 'media_consumption', 'public_speaking', 'music', 'dance'],
    requiredGrade: 'AE2',
  },
  {
    id: 'arts_visual',
    title: 'Creative Arts and Sports — Visual Arts',
    description: 'Fine arts, design, fashion, digital media and photography.',
    pathway: 'Creative Arts and Sports',
    requirements: ['Creative Arts and Sports', 'English', 'Pre-Technical Studies'],
    interests: ['visual_creation', 'digital_design', 'fine_arts'],
    requiredGrade: 'AE2',
  },
  {
    id: 'research_innovation',
    title: 'Research and Innovation',
    description: 'Inquiry-driven pathways for discovery, data and invention.',
    pathway: 'Research and Innovation',
    requirements: ['Mathematics', 'Integrated Science', 'English', 'Pre-Technical Studies'],
    interests: ['research', 'innovation', 'data_analysis', 'scientific_inquiry', 'data_science_ai'],
    requiredGrade: 'ME2',
  },
  {
    id: 'education_path',
    title: 'Education Pathway',
    description: 'Teaching, educational technology and special needs education.',
    pathway: 'Education',
    requirements: ['English', 'Kiswahili', 'Social Studies', 'Religious Education'],
    interests: ['teaching', 'edtech', 'special_ed', 'public_speaking'],
    requiredGrade: 'ME1',
  },
  {
    id: 'core_academic_path',
    title: 'Core Academic Foundation',
    description: 'Strong foundation across all 9 junior learning areas before specializing.',
    pathway: 'Core Academic',
    requirements: JUNIOR_LEARNING_AREAS.map((s) => s.name),
    interests: ['mathematics', 'english', 'kiswahili', 'integrated_science', 'pre_technical', 'social_studies', 'agriculture_nutrition', 'creative_arts_sports', 'religious_ed'],
    requiredGrade: 'ME1',
  },
];

type Step = 1 | 2 | 3;

function pointsRank(code?: string) {
  return gradeMeta(code)?.points ?? 0;
}

function isStrong(code?: string) {
  return !!code && (code.startsWith('EE') || code.startsWith('ME'));
}

function isWeak(code?: string) {
  return !!code && (code.startsWith('AE') || code.startsWith('BE'));
}

function isCritical(code?: string) {
  return !!code && code.startsWith('BE');
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('paystack-script')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.body.appendChild(script);
  });
}

export default function PathwayFinder() {
  const [step, setStep] = useState<Step>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedCareer, setSelectedCareer] = useState('');
  const [subjectGrades, setSubjectGrades] = useState<Record<string, JuniorGradeCode | ''>>({});
  const [showResults, setShowResults] = useState(false);
  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const [paying, setPaying] = useState(false);

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== id));
    } else if (selectedInterests.length < 5) {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const getRecommendedCareers = (): (CareerPath & { matchScore: number })[] => {
    const scored = careerPaths
      .map((career) => {
        const matchCount = career.interests.filter((i) => selectedInterests.includes(i)).length;
        return { ...career, matchScore: matchCount };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
    const matched = scored.filter((c) => c.matchScore > 0);
    return (matched.length >= 4 ? matched : scored).slice(0, 12);
  };

  const selectedCareerObj = () => careerPaths.find((c) => c.id === selectedCareer);
  const pathwayName = selectedCareerObj()?.pathway || 'your pathway';

  const orderedCategories = useMemo(() => {
    const present = Array.from(new Set(interestOptions.map((i) => i.category)));
    return [
      ...PATHWAY_ORDER.filter((c) => present.includes(c)),
      ...present.filter((c) => !(PATHWAY_ORDER as readonly string[]).includes(c)),
    ];
  }, []);

  const buildGuidance = () => {
    const career = selectedCareerObj();
    if (!career) return '';

    const entered = JUNIOR_LEARNING_AREAS.map((s) => ({
      name: s.name,
      code: subjectGrades[s.name] || '',
    })).filter((s) => s.code);

    const strong = entered.filter((s) => isStrong(s.code)).map((s) => s.name);
    const improve = entered.filter((s) => isWeak(s.code)).map((s) => s.name);
    const critical = entered.filter((s) => isCritical(s.code)).map((s) => s.name);

    const reqStatus = career.requirements.map((subj) => {
      const current = subjectGrades[subj] || '';
      const required = career.requiredGrade || 'ME1';
      const met = current ? pointsRank(current) >= pointsRank(required) : false;
      return { subj, current, required, met };
    });
    const below = reqStatus.filter((r) => r.current && !r.met).map((r) => r.subj);
    const aligned = reqStatus.filter((r) => r.met).map((r) => r.subj);

    const lines = [
      'Based on your current performance, here is your academic guidance:',
      '',
      '1. Your current grades show that you are:',
      `   · Strong in: ${strong.length ? strong.join(', ') : 'none selected yet'}`,
      `   · Need improvement in: ${improve.length ? improve.join(', ') : 'none flagged'}`,
      `   · Critical areas: ${critical.length ? critical.join(', ') : 'none'}`,
      '2. Academic Recommendations:',
      ...entered.slice(0, 5).map((s) => {
        if (isCritical(s.code)) {
          return `   · For ${s.name}: Schedule focused revision twice a week and practise past CBC tasks until you reach at least AE2.`;
        }
        if (isWeak(s.code)) {
          return `   · For ${s.name}: Review strand notes weekly and complete short quizzes to move toward ME1.`;
        }
        return `   · For ${s.name}: Maintain your strength with spaced practice and peer teaching.`;
      }),
      '3. Pathway Alignment:',
      `   · Your performance in ${aligned.length ? aligned.join(', ') : 'selected strengths'} aligns well with ${career.title}`,
      `   · However, you need to improve in ${below.length ? below.join(', ') : 'any remaining required subjects'} for ${career.pathway}`,
      '4. Action Plan:',
      `   · Week 1-2: Focus on ${critical[0] || improve[0] || 'Mathematics'} by rewriting notes and solving 10 practice items daily`,
      `   · Week 3-4: Focus on ${improve[1] || aligned[0] || 'English'} by timed practice and teacher feedback`,
      '   · Week 5-6: Review all junior learning areas and practise with Zamifu Curriculum Navigator exams',
      '5. Additional Support:',
      `   · Tutoring available for: ${critical.concat(improve).slice(0, 3).join(', ') || 'subjects below ME'}`,
      '   · Recommended resources: KICD designs, Curriculum Navigator schemes, junior school past papers',
      '   · Study groups: form a small group for Integrated Science and Mathematics problem sets',
    ];
    return lines.join('\n');
  };

  const handleReset = () => {
    setStep(1);
    setSelectedInterests([]);
    setSelectedCareer('');
    setSubjectGrades({});
    setShowResults(false);
    setPaymentUnlocked(false);
  };

  const setSubjectGrade = (subject: string, value: string) => {
    setSubjectGrades((prev) => ({ ...prev, [subject]: value as JuniorGradeCode | '' }));
  };

  const canSeeResults = () =>
    JUNIOR_LEARNING_AREAS.some((s) => !!subjectGrades[s.name]);

  const handlePay = async () => {
    try {
      setPaying(true);
      await loadPaystackScript();
      const reference = `pathway_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      // @ts-expect-error Paystack global
      const handler = window.PaystackPop?.setup({
        key: 'pk_live_c15b4c6c95f06f7408326b14395eb727147a8935',
        email: 'pathway@zamifu.company',
        amount: 20 * 100,
        currency: 'KES',
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: 'pathway_finder_results' },
            { display_name: 'Pathway', variable_name: 'pathway', value: pathwayName },
          ],
        },
        callback: () => {
          setPaymentUnlocked(true);
          setPaying(false);
        },
        onClose: () => setPaying(false),
      });
      if (handler) handler.openIframe();
      else {
        // Demo unlock if Paystack is unavailable in this environment
        setPaymentUnlocked(true);
        setPaying(false);
      }
    } catch {
      // Allow local unlock so guidance remains usable offline
      setPaymentUnlocked(true);
      setPaying(false);
    }
  };

  const downloadGuidance = () => {
    const career = selectedCareerObj();
    const body = [
      'Zamifu Pathway Finder Results',
      `Pathway: ${career?.title || ''}`,
      `Track: ${career?.pathway || ''}`,
      '',
      'Current Performance:',
      ...JUNIOR_LEARNING_AREAS.map((s) => {
        const g = subjectGrades[s.name];
        const m = gradeMeta(g || undefined);
        return g ? `${s.name}: ${g} — ${m?.description} (${m?.points} pts)` : `${s.name}: not entered`;
      }),
      '',
      buildGuidance(),
    ].join('\n');
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zamifu-pathway-results.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="py-16 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white" id="pathway-finder">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#2563EB]/20 text-[#60a5fa] px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Compass className="w-4 h-4" />
            Career Guidance Tool
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Pathway Finder</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Discover your ideal educational pathway based on interests and Junior School performance across the 9 core learning areas.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Pathways: {PATHWAY_ORDER.join(' · ')}
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-10">
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    step >= s ? 'bg-[#2563EB] text-white' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {step > s ? <CheckIcon /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-16 sm:w-24 h-1 rounded-full transition-all ${step > s ? 'bg-[#2563EB]' : 'bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 mt-3">
            <span className={`text-xs ${step >= 1 ? 'text-[#60a5fa]' : 'text-gray-500'}`}>Interests</span>
            <span className={`text-xs ${step >= 2 ? 'text-[#60a5fa]' : 'text-gray-500'}`}>Pathway</span>
            <span className={`text-xs ${step >= 3 ? 'text-[#60a5fa]' : 'text-gray-500'}`}>Results</span>
          </div>
        </div>

        {step === 1 && (
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">What excites you?</h3>
              <p className="text-gray-400 text-sm">
                Pick up to 5 interests across Core Academic, STEM, Creative Arts and Sports, Social Sciences, Research and Innovation, and Education.
              </p>
              <p className="text-[#60a5fa] text-sm mt-2 font-medium">{selectedInterests.length} of 5 selected</p>
            </div>

            {orderedCategories.map((category) => {
              const categoryInterests = interestOptions.filter((i) => i.category === category);
              if (!categoryInterests.length) return null;
              return (
                <div key={category} className="mb-6">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-3 uppercase tracking-wide">{category}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {categoryInterests.map((interest) => {
                      const isSelected = selectedInterests.includes(interest.id);
                      return (
                        <button
                          key={interest.id}
                          onClick={() => toggleInterest(interest.id)}
                          disabled={!isSelected && selectedInterests.length >= 5}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-[#2563EB] bg-[#2563EB]/20 text-white'
                              : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50 disabled:opacity-30 disabled:cursor-not-allowed'
                          }`}
                        >
                          <div className={`mb-2 ${isSelected ? 'text-[#60a5fa]' : 'text-gray-500'}`}>{interest.icon}</div>
                          <div className="font-medium text-sm">{interest.label}</div>
                          <div className="text-xs opacity-60 mt-1">{interest.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end mt-8">
              <button
                onClick={() => selectedInterests.length > 0 && setStep(2)}
                disabled={selectedInterests.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Choose Your Pathway Track</h3>
              <p className="text-gray-400 text-sm">
                Based on your interests, explore STEM, Social Sciences, Creative Arts and Sports, Research and Innovation, Education, and Core Academic.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {getRecommendedCareers().map((career) => (
                <button
                  key={career.id}
                  onClick={() => setSelectedCareer(career.id)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    selectedCareer === career.id
                      ? 'border-[#2563EB] bg-[#2563EB]/20'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h4 className="font-semibold text-white">{career.title}</h4>
                    <span className="text-xs bg-[#2563EB]/30 text-[#60a5fa] px-2 py-1 rounded-full whitespace-nowrap">
                      {career.matchScore} match{career.matchScore === 1 ? '' : 'es'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300 mb-2">{career.pathway}</p>
                  <p className="text-gray-400 text-sm mb-3">{career.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {career.requirements.slice(0, 6).map((req) => (
                      <span key={req} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                        {req}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => selectedCareer && setStep(3)}
                disabled={!selectedCareer}
                className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && !showResults && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold mb-2">Enter Current Results</h3>
              <p className="text-gray-400 text-sm">
                Enter your recent performance for each of the required subjects of{' '}
                <span className="text-[#60a5fa] font-medium">{selectedCareerObj()?.title}</span>. Only Junior School learning areas are shown.
              </p>
            </div>

            {/* PART A */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-6 space-y-4">
              <h4 className="text-sm font-medium text-[#60a5fa]">Part A: Current Performance on Required Subjects and Grades</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="py-2 pr-2">Learning Area</th>
                      <th className="py-2 pr-2">Grade</th>
                      <th className="py-2 pr-2">Description</th>
                      <th className="py-2">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {JUNIOR_LEARNING_AREAS.map((area) => {
                      const code = subjectGrades[area.name] || '';
                      const meta = gradeMeta(code);
                      return (
                        <tr key={area.name} className="border-b border-gray-800">
                          <td className="py-3 pr-2 text-gray-200">
                            <div>{area.name}</div>
                            <div className="text-[10px] text-gray-500">{area.pathway}</div>
                          </td>
                          <td className="py-3 pr-2">
                            <select
                              value={code}
                              onChange={(e) => setSubjectGrade(area.name, e.target.value)}
                              className="w-full min-w-[88px] px-2 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                            >
                              <option value="">Select</option>
                              {JUNIOR_GRADES.map((g) => (
                                <option key={g.code} value={g.code}>
                                  {g.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 pr-2 text-gray-300">{meta?.description || '—'}</td>
                          <td className="py-3 text-[#60a5fa] font-semibold">{meta ? meta.points : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">Description and points populate automatically when you select a grade. Overall average is not used.</p>
            </div>

            {/* PART B preview */}
            <div className="bg-gray-800/40 rounded-2xl p-6 border border-gray-700 mb-8">
              <h4 className="text-sm font-medium text-[#60a5fa] mb-3">Part B: Required Performance (preview)</h4>
              <div className="space-y-2">
                {(selectedCareerObj()?.requirements || []).map((subj) => {
                  const current = subjectGrades[subj] || '';
                  const required = selectedCareerObj()?.requiredGrade || 'ME1';
                  const met = current ? pointsRank(current) >= pointsRank(required) : false;
                  return (
                    <div key={subj} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-gray-900/40 rounded-lg px-3 py-2">
                      <span className="text-gray-200">{subj}</span>
                      <span className="text-gray-400">Required: {required}</span>
                      <span className="text-gray-300">Current: {current || '—'}</span>
                      <span className={met ? 'text-emerald-400' : 'text-amber-300'}>
                        {current ? (met ? 'Met Requirement' : 'Below Requirement') : 'Not entered'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => canSeeResults() && setShowResults(true)}
                disabled={!canSeeResults()}
                className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                See Results <Target className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && showResults && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-[#2563EB]/20 to-[#1e40af]/20 rounded-2xl p-8 border border-[#2563EB]/30 mb-8">
              <div className="text-center mb-6">
                <GraduationCap className="w-12 h-12 text-[#60a5fa] mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-white mb-1">Your Pathway Results</h3>
                <p className="text-[#60a5fa]">Personalized Junior School guidance</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Selected Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInterests.map((id) => {
                      const interest = interestOptions.find((i) => i.id === id);
                      return (
                        <span key={id} className="text-xs bg-[#2563EB]/30 text-white px-3 py-1 rounded-full">
                          {interest?.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Recommended Pathway</h4>
                  <p className="text-white font-semibold text-lg">{selectedCareerObj()?.title}</p>
                  <p className="text-gray-400 text-sm mt-1">{selectedCareerObj()?.description}</p>
                </div>

                {/* PART A summary */}
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Part A: Current Performance</h4>
                  <div className="space-y-2">
                    {JUNIOR_LEARNING_AREAS.filter((s) => subjectGrades[s.name]).map((s) => {
                      const code = subjectGrades[s.name] as string;
                      const meta = gradeMeta(code);
                      return (
                        <div key={s.name} className="flex flex-wrap justify-between gap-2 text-sm border-b border-gray-800 py-1">
                          <span>{s.name}</span>
                          <span className="text-[#60a5fa]">{code}</span>
                          <span className="text-gray-400">{meta?.description}</span>
                          <span>{meta?.points} pts</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PART B */}
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Part B: Required Performance</h4>
                  <div className="space-y-2">
                    {(selectedCareerObj()?.requirements || []).map((subj) => {
                      const current = subjectGrades[subj] || '';
                      const required = selectedCareerObj()?.requiredGrade || 'ME1';
                      const met = current ? pointsRank(current) >= pointsRank(required) : false;
                      return (
                        <div key={subj} className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="text-gray-200 min-w-[140px]">{subj}</span>
                          <span className="text-gray-400">Req {required}</span>
                          <span>Now {current || '—'}</span>
                          {current ? (
                            met ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Met Requirement</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-300"><XCircle className="w-3.5 h-3.5" /> Below Requirement</span>
                            )
                          ) : (
                            <span className="text-gray-500">Not entered</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PART C + payment gate */}
                <div className="bg-gray-900/50 rounded-xl p-4 relative overflow-hidden">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Part C: Academic Guidance</h4>
                  {!paymentUnlocked ? (
                    <div className="space-y-4">
                      <p className="text-gray-300 text-sm line-clamp-3 whitespace-pre-line opacity-70">
                        {buildGuidance().split('\n').slice(0, 4).join('\n')}
                      </p>
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                        <div className="flex items-center gap-2 text-amber-200 font-medium mb-2">
                          <Lock className="w-4 h-4" />
                          Pay KSH 20 to View Full Results and Download PDF
                        </div>
                        <p className="text-xs text-gray-400 mb-3">Payment methods: M-Pesa / card via Paystack. Unlocks full guidance and download.</p>
                        <button
                          onClick={handlePay}
                          disabled={paying}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
                        >
                          <CreditCard className="w-4 h-4" />
                          {paying ? 'Opening payment…' : 'Pay KSH 20'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">{buildGuidance()}</pre>
                      <button
                        onClick={downloadGuidance}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium"
                      >
                        <Download className="w-4 h-4" /> Download Results
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                <RotateCcw className="w-4 h-4" /> Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
