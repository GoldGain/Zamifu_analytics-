import { useMemo, useState } from 'react';
import {
  Compass, ChevronRight, ChevronLeft, RotateCcw, GraduationCap, Heart, Target, Star,
  FlaskConical, Wrench, Leaf, Monitor, Palette, Music, Calculator, BookOpen, Globe,
  Briefcase, Gavel, PenTool, Code, Cpu, Database, Atom, Building2, Users, MessageSquare,
  Landmark, Sprout, UtensilsCrossed, Plane, Microscope, Camera, Volleyball, Theater,
  Pen, Beaker, HardHat, Wifi, ShieldCheck, DollarSign, TrendingUp, UsersRound, School,
  Baby, Lock, CreditCard, CheckCircle2, XCircle, Download,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Junior School grading (8-point CBC scale) ─────────────────────────── */
export const JUNIOR_GRADES = [
  { code: 'EE1', description: 'Exceeding Expectations (1)', points: 8 },
  { code: 'EE2', description: 'Exceeding Expectations (2)', points: 7 },
  { code: 'ME1', description: 'Meeting Expectations (1)', points: 6 },
  { code: 'ME2', description: 'Meeting Expectations (2)', points: 5 },
  { code: 'AE1', description: 'Approaching Expectations (1)', points: 4 },
  { code: 'AE2', description: 'Approaching Expectations (2)', points: 3 },
  { code: 'BE1', description: 'Below Expectations (1)', points: 2 },
  { code: 'BE2', description: 'Below Expectations (2)', points: 1 },
] as const;

export type JuniorGradeCode = (typeof JUNIOR_GRADES)[number]['code'];

export function gradeMeta(code?: string) {
  return JUNIOR_GRADES.find((g) => g.code === code);
}

export function pointsRank(code: JuniorGradeCode | '') {
  return gradeMeta(code)?.points || 0;
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

/* ── CBE Pathways and Tracks ───────────────────────────────────────────── */
export const CBE_PATHWAYS = [
  { id: 'STEM', name: 'STEM Pathway', description: 'Focuses on science, technology, engineering, and mathematics.' },
  { id: 'Social Sciences', name: 'Social Sciences Pathway', description: 'Focuses on humanities, business, and social studies.' },
  { id: 'Arts and Sports Science', name: 'Arts and Sports Science Pathway', description: 'Focuses on creative arts, performing arts, and sports.' },
] as const;

export const CBE_TRACKS = [
  // STEM Tracks
  { id: 'Pure Sciences', name: 'Pure Sciences', pathwayId: 'STEM', description: 'In-depth study of Biology, Chemistry, Physics, and Mathematics.' },
  { id: 'Applied Sciences', name: 'Applied Sciences', pathwayId: 'STEM', description: 'Practical application of scientific knowledge in fields like Agriculture, Home Science, and Computer Studies.' },
  { id: 'Technical Studies', name: 'Technical Studies', pathwayId: 'STEM', description: 'Focus on vocational skills such as Aviation, Construction, and Metal Work.' },
  // Social Sciences Tracks
  { id: 'Business Studies', name: 'Business Studies', pathwayId: 'Social Sciences', description: 'Covers economics, entrepreneurship, and financial management.' },
  { id: 'Humanities and Social Sciences', name: 'Humanities and Social Sciences', pathwayId: 'Social Sciences', description: 'Explores history, geography, religious education, and social issues.' },
  { id: 'Languages and Literature', name: 'Languages and Literature', pathwayId: 'Social Sciences', description: 'Develops proficiency in English, Kiswahili, and foreign languages, alongside literary analysis.' },
  // Arts and Sports Science Tracks
  { id: 'Visual Arts', name: 'Visual Arts', pathwayId: 'Arts and Sports Science', description: 'Focuses on drawing, painting, sculpture, and digital art.' },
  { id: 'Performing Arts', name: 'Performing Arts', pathwayId: 'Arts and Sports Science', description: 'Includes music, dance, and drama.' },
  { id: 'Sports Science', name: 'Sports Science', pathwayId: 'Arts and Sports Science', description: 'Studies human movement, exercise, and sports management.' },
] as const;

interface InterestOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string; // This will now map to Pathway ID
}

interface CareerPath {
  id: string;
  title: string;
  description: string;
  pathwayId: string; // Link to CBE_PATHWAYS
  trackId: string; // Link to CBE_TRACKS
  supportingSubjects: string[]; // Subjects that strengthen this path
  professionalAreas: string[]; // Example professional areas
  exampleCareers: string[]; // Example careers
  requirements: string[]; // Junior School subjects required
  interests: string[]; // Interests that align
  requiredGrade?: JuniorGradeCode; // Minimum grade for required subjects
}

const interestOptions: InterestOption[] = [
  // Core Academic — 9 junior learning areas (now mapped to relevant pathways)
  { id: 'mathematics', label: 'Mathematics', description: 'Numbers, algebra, geometry, problem-solving', icon: <Calculator className="w-6 h-6" />, category: 'STEM' },
  { id: 'english', label: 'English', description: 'Reading, writing, speaking English effectively', icon: <BookOpen className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'kiswahili', label: 'Kiswahili/Kenyan Sign Language', description: 'Language, culture, communication', icon: <MessageSquare className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'integrated_science', label: 'Integrated Science', description: 'Combined science (not separate Bio/Chem/Phys)', icon: <Atom className="w-6 h-6" />, category: 'STEM' },
  { id: 'pre_technical', label: 'Pre-Technical Studies', description: 'Computers, business and technical foundations', icon: <Wrench className="w-6 h-6" />, category: 'STEM' },
  { id: 'social_studies', label: 'Social Studies', description: 'History, geography, citizenship, life skills', icon: <Globe className="w-6 h-6" />, category: 'Social Sciences' },
  { id: 'agriculture_nutrition', label: 'Agriculture and Nutrition', description: 'Farming practices with health and home science', icon: <Sprout className="w-6 h-6" />, category: 'STEM' },
  { id: 'creative_arts_sports', label: 'Creative Arts and Sports', description: 'Music, art, crafts and physical education', icon: <Palette className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'religious_ed', label: 'Religious Education (CRE/IRE/HRE)', description: 'Morals, values and faith traditions', icon: <Landmark className="w-6 h-6" />, category: 'Social Sciences' },

  // STEM interests
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

  // Creative Arts and Sports interests
  { id: 'athletic_performance', label: 'Athletic Performance', description: 'Competitive sports and physical conditioning', icon: <Volleyball className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'human_anatomy', label: 'Human Anatomy', description: 'Muscles, healing and nutrition for energy', icon: <Heart className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'strategy_coaching', label: 'Strategy and Coaching', description: 'Game tactics, formations and leading peers', icon: <Users className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'outdoor_activity', label: 'Outdoor Activity', description: 'Active, hands-on tasks over desk work', icon: <Sprout className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'stage_expression', label: 'Stage Expression', description: 'Acting, dancing, singing or instruments', icon: <Theater className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'creative_writing', label: 'Creative Writing', description: 'Poetry, scripts, lyrics and stories', icon: <Pen className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'media_consumption', label: 'Media Consumption', description: 'Films, theatre, podcasts and music production', icon: <Camera className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'public_speaking', label: 'Public Speaking', description: 'Spotlight and dynamic presentation', icon: <UsersRound className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'visual_creation', label: 'Visual Creation', description: 'Drawing, painting, sculpting or photography', icon: <Palette className="w-6 h-6" />, category: 'Arts and Sports Science' },
  { id: 'digital_design', label: 'Digital Design', description: 'Digital illustration, video editing, layout', icon: <PenTool className="w-6 h-6" />, category: 'Arts and Sports Science' },

  // Social Sciences interests
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
];

const careerPaths: CareerPath[] = [
  // STEM Pathway
  {
    id: 'stem_pure_science_medicine',
    title: 'Medicine & Health Sciences',
    description: 'Focus on understanding the human body, diseases, and medical treatments.',
    pathwayId: 'STEM',
    trackId: 'Pure Sciences',
    supportingSubjects: ['Biology', 'Chemistry', 'Physics', 'Mathematics'],
    professionalAreas: ['Healthcare', 'Research', 'Biotechnology'],
    exampleCareers: ['Doctor', 'Pharmacist', 'Biomedical Engineer', 'Medical Researcher'],
    requirements: ['Integrated Science', 'Mathematics'],
    requiredGrade: 'ME1',
  },
  {
    id: 'stem_pure_science_engineering',
    title: 'Engineering & Technology',
    description: 'Designing, building, and maintaining structures, machines, and systems.',
    pathwayId: 'STEM',
    trackId: 'Pure Sciences',
    supportingSubjects: ['Physics', 'Mathematics', 'Chemistry', 'Pre-Technical Studies'],
    professionalAreas: ['Engineering', 'Technology Development', 'Manufacturing'],
    exampleCareers: ['Civil Engineer', 'Software Engineer', 'Electrical Engineer', 'Mechanical Engineer'],
    requirements: ['Integrated Science', 'Mathematics', 'Pre-Technical Studies'],
    requiredGrade: 'ME1',
  },
  {
    id: 'stem_applied_science_agriculture',
    title: 'Agriculture & Environmental Science',
    description: 'Sustainable food production, natural resource management, and environmental protection.',
    pathwayId: 'STEM',
    trackId: 'Applied Sciences',
    supportingSubjects: ['Agriculture and Nutrition', 'Integrated Science', 'Social Studies'],
    professionalAreas: ['Agriculture', 'Conservation', 'Environmental Management'],
    exampleCareers: ['Agronomist', 'Environmental Scientist', 'Horticulturist', 'Agricultural Extension Officer'],
    requirements: ['Agriculture and Nutrition', 'Integrated Science'],
    requiredGrade: 'ME2',
  },
  {
    id: 'stem_applied_science_computer',
    title: 'Computer Science & IT',
    description: 'Developing software, managing networks, and innovating digital solutions.',
    pathwayId: 'STEM',
    trackId: 'Applied Sciences',
    supportingSubjects: ['Pre-Technical Studies', 'Mathematics', 'Integrated Science'],
    professionalAreas: ['Software Development', 'Cybersecurity', 'Data Analysis'],
    exampleCareers: ['Software Developer', 'Network Administrator', 'Data Scientist', 'Cybersecurity Analyst'],
    requirements: ['Pre-Technical Studies', 'Mathematics'],
    requiredGrade: 'ME2',
  },
  {
    id: 'stem_technical_studies_aviation',
    title: 'Aviation & Logistics',
    description: 'Operating and maintaining aircraft, and managing supply chains.',
    pathwayId: 'STEM',
    trackId: 'Technical Studies',
    supportingSubjects: ['Pre-Technical Studies', 'Physics', 'Mathematics'],
    professionalAreas: ['Aviation', 'Logistics', 'Transportation'],
    exampleCareers: ['Pilot', 'Aircraft Maintenance Engineer', 'Air Traffic Controller', 'Logistics Manager'],
    requirements: ['Pre-Technical Studies', 'Integrated Science'],
    requiredGrade: 'AE1',
  },

  // Social Sciences Pathway
  {
    id: 'social_business_finance',
    title: 'Business & Finance',
    description: 'Managing organizations, investments, and economic systems.',
    pathwayId: 'Social Sciences',
    trackId: 'Business Studies',
    supportingSubjects: ['Mathematics', 'Social Studies', 'English'],
    professionalAreas: ['Management', 'Finance', 'Entrepreneurship'],
    exampleCareers: ['Accountant', 'Financial Analyst', 'Marketing Manager', 'Entrepreneur'],
    requirements: ['Mathematics', 'Social Studies'],
    requiredGrade: 'ME2',
  },
  {
    id: 'social_humanities_law',
    title: 'Law & Public Service',
    description: 'Upholding justice, creating policies, and serving the community.',
    pathwayId: 'Social Sciences',
    trackId: 'Humanities and Social Sciences',
    supportingSubjects: ['English', 'Social Studies', 'Religious Education'],
    professionalAreas: ['Legal', 'Government', 'Non-profit'],
    exampleCareers: ['Lawyer', 'Judge', 'Social Worker', 'Diplomat'],
    requirements: ['English', 'Social Studies'],
    requiredGrade: 'ME1',
  },
  {
    id: 'social_languages_communication',
    title: 'Languages & Communication',
    description: 'Mastering languages, effective communication, and media production.',
    pathwayId: 'Social Sciences',
    trackId: 'Languages and Literature',
    supportingSubjects: ['English', 'Kiswahili', 'Social Studies'],
    professionalAreas: ['Journalism', 'Translation', 'Public Relations'],
    exampleCareers: ['Journalist', 'Translator', 'Author', 'Communications Specialist'],
    requirements: ['English', 'Kiswahili'],
    requiredGrade: 'ME1',
  },

  // Arts and Sports Science Pathway
  {
    id: 'arts_visual_design',
    title: 'Visual Arts & Design',
    description: 'Creating visual content through various artistic mediums.',
    pathwayId: 'Arts and Sports Science',
    trackId: 'Visual Arts',
    supportingSubjects: ['Creative Arts and Sports', 'English'],
    professionalAreas: ['Graphic Design', 'Fine Art', 'Animation'],
    exampleCareers: ['Graphic Designer', 'Illustrator', 'Animator', 'Fine Artist'],
    requirements: ['Creative Arts and Sports'],
    requiredGrade: 'ME2',
  },
  {
    id: 'arts_performing_music',
    title: 'Performing Arts & Music',
    description: 'Expressing creativity through music, dance, and drama.',
    pathwayId: 'Arts and Sports Science',
    trackId: 'Performing Arts',
    supportingSubjects: ['Creative Arts and Sports', 'English', 'Kiswahili'],
    professionalAreas: ['Entertainment', 'Education', 'Cultural Preservation'],
    exampleCareers: ['Musician', 'Dancer', 'Actor', 'Choreographer'],
    requirements: ['Creative Arts and Sports'],
    requiredGrade: 'ME2',
  },
  {
    id: 'arts_sports_science',
    title: 'Sports Science & Management',
    description: 'Understanding human performance, fitness, and sports administration.',
    pathwayId: 'Arts and Sports Science',
    trackId: 'Sports Science',
    supportingSubjects: ['Creative Arts and Sports', 'Integrated Science', 'Mathematics'],
    professionalAreas: ['Sports Coaching', 'Fitness Training', 'Sports Administration'],
    exampleCareers: ['Sports Coach', 'Fitness Trainer', 'Sports Administrator', 'Physical Therapist'],
    requirements: ['Creative Arts and Sports', 'Integrated Science'],
    requiredGrade: 'ME2',
  },
];

const PATHWAY_ORDER = CBE_PATHWAYS.map(p => p.id);

interface RecommendationFeedback {
  label: string;
  status: string;
  icon: React.ReactNode;
  colorClass: string;
  description: string;
}

const RECOMMENDATION_FEEDBACK: Record<string, RecommendationFeedback> = {
  '⭐⭐⭐⭐⭐': {
    label: 'Highly Recommended',
    status: 'Excellent Match',
    icon: <Star className="w-4 h-4" />, // Using Star for consistency
    colorClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    description: 'Congratulations! Your academic performance strongly matches the requirements for this pathway. You have demonstrated excellent readiness and are highly likely to succeed if you choose this pathway.',
  },
  '⭐⭐⭐⭐': {
    label: 'Recommended',
    status: 'Strong Match',
    icon: <CheckCircle2 className="w-4 h-4" />, // Using CheckCircle2
    colorClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    description: 'Well done! Your performance meets the key requirements for this pathway. You have a strong foundation and are well prepared to pursue it successfully.',
  },
  '⭐⭐⭐': {
    label: 'Recommended with Support',
    status: 'Good Match, Needs Support',
    icon: <ShieldCheck className="w-4 h-4" />, // Using ShieldCheck
    colorClass: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
    description: 'You are recommended for this pathway, but you may need additional support in one or more learning areas. With extra effort, guidance, and consistent improvement, you can succeed in this pathway.',
  },
  '⭐⭐': {
    label: 'Conditionally Recommended',
    status: 'Conditional Match',
    icon: <Lock className="w-4 h-4" />, // Using Lock
    colorClass: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    description: 'You may be considered for this pathway if specific conditions are met, such as improving performance in certain subjects or receiving approval based on your school\'s placement criteria. Strengthening your weak areas is encouraged.',
  },
  '⭐': {
    label: 'Consider Alternative Pathway',
    status: 'Weak Match',
    icon: <XCircle className="w-4 h-4" />, // Using XCircle
    colorClass: 'bg-red-500/15 text-red-300 border border-red-500/30',
    description: 'This pathway is currently not the best match for your academic profile. Consider exploring other pathways that better align with your strengths and interests, while continuing to develop your skills for future opportunities.',
  },
};

export default function PathwayFinder() {
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null);
  const [subjectGrades, setSubjectGrades] = useState<Record<string, JuniorGradeCode | ''>>({});
  const [showResults, setShowResults] = useState(false);
  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const [paying, setPaying] = useState(false);

  const orderedCategories = useMemo(() => {
    const categories = new Set<string>();
    interestOptions.forEach((i) => categories.add(i.category));
    return Array.from(categories).sort((a, b) => {
      const orderA = PATHWAY_ORDER.indexOf(a);
      const orderB = PATHWAY_ORDER.indexOf(b);
      return (orderA === -1 ? Infinity : orderA) - (orderB === -1 ? Infinity : orderB);
    });
  }, []);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const getRecommendedCareers = useMemo(() => {
    return careerPaths
      .map((career) => {
        const matchScore = career.interests.filter((interest) =>
          selectedInterests.includes(interest),
        ).length;
        return { ...career, matchScore };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [selectedInterests]);

  const selectedCareerObj = () => {
    return careerPaths.find((c) => c.id === selectedCareer);
  };

  const pathwayName = selectedCareerObj()?.title || 'Selected Pathway';

  const evaluatePathway = () => {
    const career = selectedCareerObj();
    if (!career) return null;

    let totalPoints = 0;
    let metRequirementsCount = 0;
    const reqs = [];
    const strongSubjects = [];
    const weakSubjects = [];
    const missingSubjects = [];

    for (const reqSubject of career.requirements) {
      const currentGradeCode = subjectGrades[reqSubject];
      const requiredGradeCode = career.requiredGrade || 'ME2'; // Default if not specified

      const currentPoints = pointsRank(currentGradeCode);
      const requiredPoints = pointsRank(requiredGradeCode);

      const met = currentPoints >= requiredPoints;

      reqs.push({
        subj: reqSubject,
        current: currentGradeCode,
        required: requiredGradeCode,
        met,
      });

      if (currentGradeCode) {
        if (met) {
          metRequirementsCount++;
          strongSubjects.push(reqSubject);
        } else {
          weakSubjects.push(reqSubject);
        }
        totalPoints += currentPoints;
      } else {
        missingSubjects.push(reqSubject);
      }
    }

    const totalRequiredSubjects = career.requirements.length;
    let finalCode: JuniorGradeCode = 'BE2'; // Default to lowest
    let recommendPreferred = false;

    if (missingSubjects.length > 0) {
      // If any required subjects are missing, it's a weak recommendation
      finalCode = 'BE2';
    } else if (metRequirementsCount === totalRequiredSubjects) {
      // All requirements met
      if (weakSubjects.length === 0) {
        // All subjects met or exceeded
        if (totalPoints / totalRequiredSubjects >= pointsRank('EE2')) {
          finalCode = '⭐⭐⭐⭐⭐'; // Highly Recommended
        } else if (totalPoints / totalRequiredSubjects >= pointsRank('ME1')) {
          finalCode = '⭐⭐⭐⭐'; // Recommended
        } else {
          finalCode = '⭐⭐⭐'; // Recommended with Support
        }
        recommendPreferred = true;
      } else {
        // Some met, some weak but still met minimum
        finalCode = '⭐⭐⭐'; // Recommended with Support
        recommendPreferred = true;
      }
    } else if (metRequirementsCount > 0) {
      // Some requirements met, but not all
      finalCode = '⭐⭐'; // Conditionally Recommended
    } else {
      // No requirements met
      finalCode = '⭐'; // Consider Alternative Pathway
    }

    const finalRec = RECOMMENDATION_FEEDBACK[finalCode];

    // Suggest alternative pathways based on strong subjects
    const suggestedAlts = careerPaths
      .filter((cp) => cp.id !== career.id)
      .map((cp) => {
        const commonStrongSubjects = cp.requirements.filter((subj) =>
          strongSubjects.includes(subj),
        );
        return { ...cp, commonStrongSubjectsCount: commonStrongSubjects.length };
      })
      .sort((a, b) => b.commonStrongSubjectsCount - a.commonStrongSubjectsCount)
      .slice(0, 2) // Top 2 alternatives
      .map((cp) => `${cp.title} (${CBE_PATHWAYS.find(p => p.id === cp.pathwayId)?.name} - ${CBE_TRACKS.find(t => t.id === cp.trackId)?.name})`);

    return {
      finalCode,
      finalRec,
      recommendPreferred,
      reqs,
      strongSubjects,
      weakSubjects,
      missingSubjects,
      suggestedAlts,
    };
  };

  const buildGuidance = () => {
    const career = selectedCareerObj();
    const ev = evaluatePathway();
    if (!career || !ev || !ev.finalRec) return '';

    const { finalRec, recommendPreferred, strongSubjects, weakSubjects, missingSubjects, suggestedAlts } = ev;

    let guidanceText = `🎯 **Recommended Pathway: ${career.title}**\n`;
    guidanceText += `Track: ${CBE_TRACKS.find(t => t.id === career.trackId)?.name} (${CBE_PATHWAYS.find(p => p.id === career.pathwayId)?.name})\n`;
    if (career.supportingSubjects.length > 0) {
      guidanceText += `Supporting Subjects: ${career.supportingSubjects.join(', ')}\n`;
    }
    if (career.professionalAreas.length > 0) {
      guidanceText += `Professional Areas: ${career.professionalAreas.join(', ')}\n`;
    }
    if (career.exampleCareers.length > 0) {
      guidanceText += `Example Careers: ${career.exampleCareers.join(', ')}\n`;
    }
    guidanceText += `Recommendation Level: ${finalRec.label} ${finalRec.icon ? '⭐'.repeat(Object.keys(RECOMMENDATION_FEEDBACK).indexOf(ev.finalCode) + 1) : ''}\n\n`;
    guidanceText += `**Guidance:** ${finalRec.description}\n\n`;

    if (missingSubjects.length > 0) {
      guidanceText += `**Action Required:** You have not entered grades for the following required subjects: ${missingSubjects.join(', ')}. Please enter these to get a complete evaluation.\n\n`;
    }

    if (weakSubjects.length > 0) {
      guidanceText += `**Areas for Improvement:** Your performance in ${weakSubjects.join(', ')} is currently below the recommended level for this pathway. Focused revision and additional support in these subjects are highly encouraged.\n\n`;
    }

    if (!recommendPreferred && suggestedAlts.length > 0) {
      guidanceText += `**Consider Alternatives:** Based on your current strengths, you might also consider exploring pathways such as: ${suggestedAlts.join('; ')}. These pathways may align better with your current academic profile.\n\n`;
    }

    guidanceText += `**Next Steps:**\n`;
    if (finalRec.label === 'Highly Recommended' || finalRec.label === 'Recommended') {
      guidanceText += `- Proceed with placement in this pathway.\n`;
      guidanceText += `- Explore advanced topics and leadership opportunities within your chosen track.\n`;
    } else if (finalRec.label === 'Recommended with Support') {
      guidanceText += `- Seek additional support and guidance in identified weaker subjects.\n`;
      guidanceText += `- Engage in mentoring or bridging sessions before senior pathway specialization.\n`;
    } else if (finalRec.label === 'Conditionally Recommended') {
      guidanceText += `- Focus on strengthening your performance in identified weak areas.\n`;
      guidanceText += `- Consult with your school's career guidance counselor to develop an improvement plan.\n`;
    } else if (finalRec.label === 'Consider Alternative Pathway') {
      guidanceText += `- Research and explore the suggested alternative pathways.\n`;
      guidanceText += `- Discuss your options with teachers, parents, and career counselors.\n`;
    }

    guidanceText += `\nFor a comprehensive understanding, download the full PDF report.`;

    return guidanceText;
  };

  const handleReset = () => {
    setStep(1);
    setSelectedInterests([]);
    setSelectedCareer(null);
    setSubjectGrades({});
    setShowResults(false);
    setPaymentUnlocked(false);
  };

  const setSubjectGrade = (subject: string, value: string) => {
    setSubjectGrades((prev) => ({ ...prev, [subject]: value as JuniorGradeCode | '' }));
  };

  const canSeeResults = () => {
    const career = selectedCareerObj();
    if (!career) return false;
    // Ensure all required subjects have a grade entered
    return career.requirements.every((s) => !!subjectGrades[s]);
  };

  const loadPaystackScript = () => {
    return new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  };

  const handlePay = async () => {
    try {
      setPaying(true);
      await loadPaystackScript();
      const reference = `pathway_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      // @ts-ignore Paystack global
      const handler = window.PaystackPop?.setup({
        key: 'pk_live_c15b4c6c95f06f7408326b14395eb727147a8935',
        email: 'pathway@zamifu.company',
        amount: 20 * 100, // KES 20
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
          toast.success('Payment successful! Your full guidance is now unlocked.');
        },
        onClose: () => {
          setPaying(false);
          toast.info('Payment cancelled.');
        },
      });
      if (handler) handler.openIframe();
      else {
        setError('Payment gateway not available. Please try again later.');
        setPaying(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to initiate payment. Please try again.');
      setPaying(false);
    }
  };

  const downloadGuidance = async () => {
    const career = selectedCareerObj();
    const ev = evaluatePathway();
    if (!career || !ev) return;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureSpace = (need = 18) => {
      if (y + need > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const write = (line: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
      const size = opts?.size ?? 11;
      doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      if (opts?.color) doc.setTextColor(...opts.color);
      else doc.setTextColor(30, 30, 30);
      const parts = doc.splitTextToSize(line || ' ', maxWidth);
      for (const part of parts) {
        ensureSpace(size + 6);
        doc.text(part, margin, y);
        y += size + 5;
      }
    };

    write('Zamifu Pathway Finder Results', { bold: true, size: 16, color: [37, 99, 235] });
    write(`Generated: ${new Date().toLocaleString()}`, { size: 9, color: [100, 100, 100] });
    y += 8;
    write(`Selected Pathway: ${career.title}`, { bold: true, size: 12 });
    write(`Track: ${CBE_TRACKS.find(t => t.id === career.trackId)?.name} (${CBE_PATHWAYS.find(p => p.id === career.pathwayId)?.name})`, { size: 11 });
    if (ev.finalRec) {
      write(`Recommendation Level: ${ev.finalRec.label}`, { bold: true, size: 12, color: [16, 185, 129] });
      write(`Status: ${ev.finalRec.status}`, { size: 11 });
    }
    y += 10;
    write('Part A — Current Performance (Junior School)', { bold: true, size: 12 });
    for (const s of JUNIOR_LEARNING_AREAS) {
      const g = subjectGrades[s.name];
      const m = gradeMeta(g || undefined);
      write(
        g
          ? `${s.name}: ${g} — ${m?.description} (${m?.points} pts)`
          : `${s.name}: not entered`,
        { size: 10 },
      );
    }
    y += 8;
    write('Part B — Required Performance', { bold: true, size: 12 });
    for (const r of ev.reqs || []) {
      write(
        r.current
          ? `${r.subj}: current ${r.current} / required ${r.required} — ${r.met ? 'Met Requirement' : 'Below Requirement'}`
          : `${r.subj}: required ${r.required} — not entered`,
        { size: 10 },
      );
    }
    y += 8;
    write('Part C — Pathway Recommendation', { bold: true, size: 12 });
    for (const line of buildGuidance().split('\n')) {
      write(line, { size: 10 });
    }
    y += 12;
    write('Zamifu Analytics · https://zamifu.company', { size: 9, color: [120, 120, 120] });
    doc.save(`zamifu-pathway-${(career?.id || 'results').replace(/\s+/g, '-')}.pdf`);
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
            Pathways: {CBE_PATHWAYS.map(p => p.name).join(' · ')}
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
                Pick up to 5 interests across the different CBE Pathways.
              </p>
              <p className="text-[#60a5fa] text-sm mt-2 font-medium">{selectedInterests.length} of 5 selected</p>
            </div>

            {CBE_PATHWAYS.map((pathway) => {
              const categoryInterests = interestOptions.filter((i) => i.category === pathway.id);
              if (!categoryInterests.length) return null;
              return (
                <div key={pathway.id} className="mb-6">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-3 uppercase tracking-wide">{pathway.name}</h4>
                  <p className="text-gray-400 text-xs mb-3">{pathway.description}</p>
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
                Based on your interests, select the specific track that best aligns with your aspirations.
              </p>
            </div>

            {CBE_PATHWAYS.map((pathway) => {
              const pathwayTracks = CBE_TRACKS.filter(t => t.pathwayId === pathway.id);
              if (!pathwayTracks.length) return null;
              return (
                <div key={pathway.id} className="mb-6">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-3 uppercase tracking-wide">{pathway.name}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {pathwayTracks.map((track) => {
                      const careersInTrack = getRecommendedCareers.filter(c => c.trackId === track.id);
                      if (!careersInTrack.length) return null;
                      return (
                        <div key={track.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                          <h5 className="font-semibold text-white mb-2">{track.name}</h5>
                          <p className="text-gray-400 text-sm mb-3">{track.description}</p>
                          <div className="space-y-3">
                            {careersInTrack.map((career) => (
                              <button
                                key={career.id}
                                onClick={() => setSelectedCareer(career.id)}
                                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                  selectedCareer === career.id
                                    ? 'border-[#2563EB] bg-[#2563EB]/20'
                                    : 'border-gray-700 bg-gray-900/50 hover:border-gray-500'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-1 gap-2">
                                  <h6 className="font-medium text-white text-sm">{career.title}</h6>
                                  <span className="text-xs bg-[#2563EB]/30 text-[#60a5fa] px-2 py-1 rounded-full whitespace-nowrap">
                                    {career.matchScore} match{career.matchScore === 1 ? '' : 'es'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400">{career.exampleCareers.slice(0, 2).join(', ')}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

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

        {step === 3 && (
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
                    <tr className="text-left text-gray-400">
                      <th className="py-2 px-3">Subject</th>
                      <th className="py-2 px-3">Your Grade</th>
                      <th className="py-2 px-3">Required</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCareerObj()?.requirements.map((subj) => {
                      const currentGrade = subjectGrades[subj] || '';
                      const requiredGrade = selectedCareerObj()?.requiredGrade || 'ME2';
                      const met = currentGrade ? pointsRank(currentGrade) >= pointsRank(requiredGrade) : false;
                      return (
                        <tr key={subj} className="border-t border-gray-700">
                          <td className="py-2 px-3 font-medium text-white">{subj}</td>
                          <td className="py-2 px-3">
                            <select
                              value={currentGrade}
                              onChange={(e) => setSubjectGrade(subj, e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                            >
                              <option value="">Select Grade</option>
                              {JUNIOR_GRADES.map((g) => (
                                <option key={g.code} value={g.code}>
                                  {g.code} - {g.description}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-gray-300">{requiredGrade}</td>
                          <td className="py-2 px-3">
                            {currentGrade ? (
                              met ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="w-3 h-3" /> Met</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-300 text-xs"><XCircle className="w-3 h-3" /> Below</span>
                              )
                            ) : (
                              <span className="text-gray-500 text-xs">Not entered</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Pathway Decision</h4>
                  <p className="text-white font-semibold text-lg">{selectedCareerObj()?.title}</p>
                  <p className="text-gray-400 text-sm mt-1">{selectedCareerObj()?.description}</p>
                  {(() => {
                    const ev = evaluatePathway();
                    if (!ev?.finalRec) return null;
                    return (
                      <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${ev.finalRec.colorClass}`}>
                        <div className="font-semibold flex items-center gap-2">
                          {ev.finalRec.icon} {ev.finalRec.label}
                        </div>
                        <div className="text-xs opacity-90 mt-0.5">{ev.finalRec.status}</div>
                      </div>
                    );
                  })()}
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
                        <Download className="w-4 h-4" /> Download PDF Results
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
