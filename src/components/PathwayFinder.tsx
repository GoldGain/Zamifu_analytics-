import { useState } from 'react';
import { Compass, ChevronRight, ChevronLeft, RotateCcw, GraduationCap, Heart, Target, Star, FlaskConical, Wrench, Leaf, Monitor, Palette, Music, Calculator, BookOpen, Globe, Stethoscope, Briefcase, Gavel, PenTool, Code, Cpu, Database, Atom, Building2, Users, MessageSquare, Landmark, Sprout, UtensilsCrossed, Plane, HeartPulse, Microscope, Shirt, Camera, Volleyball, Theater, Pen, Beaker, HardHat, Wifi, ShieldCheck, DollarSign, TrendingUp, UsersRound, Headphones, BookMarked, School, Baby } from 'lucide-react';

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
  requirements: string[];
  interests: string[];
}

const interestOptions: InterestOption[] = [
  // Core Academic
  { id: 'mathematics', label: 'Mathematics', description: 'Numbers, equations, problem-solving', icon: <Calculator className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'english', label: 'English & Literature', description: 'Reading, writing, communication', icon: <BookOpen className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'kiswahili', label: 'Kiswahili', description: 'Language, culture, communication', icon: <MessageSquare className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'sciences', label: 'Sciences', description: 'Physics, Chemistry, Biology', icon: <Atom className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'social_studies', label: 'Social Studies', description: 'History, Geography, Civics', icon: <Globe className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'religious_ed', label: 'Religious Education', description: 'CRE, IRE, HRE', icon: <Landmark className="w-6 h-6" />, category: 'Core Academic' },
  // STEM
  { id: 'it', label: 'Information Technology', description: 'Computing, software, systems', icon: <Monitor className="w-6 h-6" />, category: 'STEM' },
  { id: 'computer_science', label: 'Computer Science', description: 'Algorithms, data structures', icon: <Code className="w-6 h-6" />, category: 'STEM' },
  { id: 'engineering', label: 'Engineering', description: 'Design, build, innovate', icon: <HardHat className="w-6 h-6" />, category: 'STEM' },
  { id: 'robotics', label: 'Robotics', description: 'Automation, machines, AI', icon: <Cpu className="w-6 h-6" />, category: 'STEM' },
  { id: 'ai', label: 'Artificial Intelligence', description: 'Machine learning, neural networks', icon: <Database className="w-6 h-6" />, category: 'STEM' },
  { id: 'data_science', label: 'Data Science', description: 'Analytics, statistics, insights', icon: <TrendingUp className="w-6 h-6" />, category: 'STEM' },
  { id: 'programming', label: 'Programming', description: 'Coding, development, apps', icon: <Code className="w-6 h-6" />, category: 'STEM' },
  { id: 'networking', label: 'Networking', description: 'Connections, infrastructure', icon: <Wifi className="w-6 h-6" />, category: 'STEM' },
  { id: 'cybersecurity', label: 'Cybersecurity', description: 'Protection, security, defense', icon: <ShieldCheck className="w-6 h-6" />, category: 'STEM' },
  // Business & Commerce
  { id: 'business', label: 'Business Studies', description: 'Management, operations', icon: <Briefcase className="w-6 h-6" />, category: 'Business' },
  { id: 'accounting', label: 'Accounting', description: 'Finance, bookkeeping', icon: <DollarSign className="w-6 h-6" />, category: 'Business' },
  { id: 'economics', label: 'Economics', description: 'Markets, trade, policy', icon: <TrendingUp className="w-6 h-6" />, category: 'Business' },
  { id: 'entrepreneurship', label: 'Entrepreneurship', description: 'Startups, innovation', icon: <Star className="w-6 h-6" />, category: 'Business' },
  { id: 'finance', label: 'Finance', description: 'Investment, banking', icon: <DollarSign className="w-6 h-6" />, category: 'Business' },
  { id: 'marketing', label: 'Marketing', description: 'Branding, promotion', icon: <Target className="w-6 h-6" />, category: 'Business' },
  { id: 'hr', label: 'Human Resources', description: 'People, recruitment', icon: <UsersRound className="w-6 h-6" />, category: 'Business' },
  // Arts & Humanities
  { id: 'creative_arts', label: 'Creative Arts', description: 'Visual arts, crafts', icon: <Palette className="w-6 h-6" />, category: 'Arts' },
  { id: 'music', label: 'Music', description: 'Instruments, composition', icon: <Music className="w-6 h-6" />, category: 'Arts' },
  { id: 'drama', label: 'Drama', description: 'Acting, performance', icon: <Theater className="w-6 h-6" />, category: 'Arts' },
  { id: 'writing', label: 'Writing', description: 'Creative writing, journalism', icon: <Pen className="w-6 h-6" />, category: 'Arts' },
  { id: 'design', label: 'Design', description: 'Graphic, fashion, interior', icon: <PenTool className="w-6 h-6" />, category: 'Arts' },
  { id: 'fine_arts', label: 'Fine Arts', description: 'Painting, sculpture', icon: <Palette className="w-6 h-6" />, category: 'Arts' },
  { id: 'film', label: 'Film & Media', description: 'Video, photography', icon: <Camera className="w-6 h-6" />, category: 'Arts' },
  // Sports & Physical
  { id: 'pe', label: 'Physical Education', description: 'Fitness, health', icon: <Volleyball className="w-6 h-6" />, category: 'Sports' },
  { id: 'sports_mgmt', label: 'Sports Management', description: 'Coaching, administration', icon: <Users className="w-6 h-6" />, category: 'Sports' },
  // Health & Medicine
  { id: 'medicine', label: 'Medicine', description: 'Healthcare, surgery', icon: <Stethoscope className="w-6 h-6" />, category: 'Health' },
  { id: 'nursing', label: 'Nursing', description: 'Patient care, health', icon: <HeartPulse className="w-6 h-6" />, category: 'Health' },
  { id: 'pharmacy', label: 'Pharmacy', description: 'Drugs, prescriptions', icon: <Beaker className="w-6 h-6" />, category: 'Health' },
  { id: 'public_health', label: 'Public Health', description: 'Community wellness', icon: <Users className="w-6 h-6" />, category: 'Health' },
  { id: 'nutrition', label: 'Nutrition', description: 'Diet, wellness', icon: <Sprout className="w-6 h-6" />, category: 'Health' },
  // Agriculture & Environment
  { id: 'agriculture', label: 'Agriculture', description: 'Farming, crops, livestock', icon: <Sprout className="w-6 h-6" />, category: 'Agriculture' },
  { id: 'environment', label: 'Environmental Science', description: 'Conservation, ecology', icon: <Leaf className="w-6 h-6" />, category: 'Agriculture' },
  { id: 'veterinary', label: 'Veterinary Science', description: 'Animal health', icon: <Heart className="w-6 h-6" />, category: 'Agriculture' },
  // Hospitality & Tourism
  { id: 'hospitality', label: 'Hospitality', description: 'Hotels, service', icon: <Building2 className="w-6 h-6" />, category: 'Hospitality' },
  { id: 'tourism', label: 'Tourism', description: 'Travel, culture', icon: <Plane className="w-6 h-6" />, category: 'Hospitality' },
  { id: 'culinary', label: 'Culinary Arts', description: 'Cooking, cuisine', icon: <UtensilsCrossed className="w-6 h-6" />, category: 'Hospitality' },
  // Law & Governance
  { id: 'law', label: 'Law', description: 'Justice, legal', icon: <Gavel className="w-6 h-6" />, category: 'Law' },
  { id: 'political_science', label: 'Political Science', description: 'Governance, policy', icon: <Landmark className="w-6 h-6" />, category: 'Law' },
  { id: 'international_relations', label: 'International Relations', description: 'Diplomacy, global', icon: <Globe className="w-6 h-6" />, category: 'Law' },
  // Education
  { id: 'teaching', label: 'Teaching', description: 'Education, instruction', icon: <School className="w-6 h-6" />, category: 'Education' },
  { id: 'edtech', label: 'Educational Technology', description: 'E-learning, tools', icon: <Monitor className="w-6 h-6" />, category: 'Education' },
  { id: 'special_ed', label: 'Special Education', description: 'Inclusive learning', icon: <Baby className="w-6 h-6" />, category: 'Education' },
  // Research & Innovation
  { id: 'research', label: 'Research', description: 'Discovery, inquiry', icon: <Microscope className="w-6 h-6" />, category: 'Research' },
  { id: 'innovation', label: 'Innovation', description: 'New ideas, creativity', icon: <FlaskConical className="w-6 h-6" />, category: 'Research' },
  // Extra CBE / pathway interests
  { id: 'biology', label: 'Biology', description: 'Living systems, health', icon: <Leaf className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'chemistry', label: 'Chemistry', description: 'Matter, reactions, lab work', icon: <Beaker className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'physics', label: 'Physics', description: 'Energy, motion, forces', icon: <Atom className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'geography', label: 'Geography', description: 'Earth systems, maps', icon: <Globe className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'history', label: 'History & Government', description: 'Past events, civics', icon: <Landmark className="w-6 h-6" />, category: 'Core Academic' },
  { id: 'home_science', label: 'Home Science', description: 'Nutrition, textiles, family', icon: <UtensilsCrossed className="w-6 h-6" />, category: 'Hospitality' },
  { id: 'pre_technical', label: 'Pre-Technical Studies', description: 'Making, tools, design', icon: <Wrench className="w-6 h-6" />, category: 'STEM' },
  { id: 'languages', label: 'Foreign Languages', description: 'French, German, Arabic, etc.', icon: <MessageSquare className="w-6 h-6" />, category: 'Arts' },
  { id: 'psychology', label: 'Psychology', description: 'Mind, behaviour, counselling', icon: <Heart className="w-6 h-6" />, category: 'Health' },
  { id: 'performance', label: 'Performing Arts', description: 'Stage, dance, theatre', icon: <Theater className="w-6 h-6" />, category: 'Arts' },
  { id: 'aviation', label: 'Aviation', description: 'Flying, aircraft systems', icon: <Plane className="w-6 h-6" />, category: 'STEM' },
  { id: 'construction', label: 'Building & Construction', description: 'Masonry, carpentry, sites', icon: <HardHat className="w-6 h-6" />, category: 'STEM' },
];

const careerPaths: CareerPath[] = [
  {
    id: 'doctor',
    title: 'Medical Doctor',
    description: 'Diagnose and treat illnesses, save lives',
    requirements: ['Biology', 'Chemistry', 'Physics', 'Mathematics'],
    interests: ['medicine', 'sciences', 'biology', 'chemistry'],
  },
  {
    id: 'engineer',
    title: 'Engineer',
    description: 'Design and build structures, machines, systems',
    requirements: ['Mathematics', 'Physics', 'Chemistry'],
    interests: ['engineering', 'sciences', 'mathematics', 'programming'],
  },
  {
    id: 'software_dev',
    title: 'Software Developer',
    description: 'Build applications, websites, and systems',
    requirements: ['Mathematics', 'Computer Science'],
    interests: ['programming', 'computer_science', 'it', 'data_science'],
  },
  {
    id: 'teacher',
    title: 'Teacher/Educator',
    description: 'Inspire and educate the next generation',
    requirements: ['Any subject specialization'],
    interests: ['teaching', 'education', 'english', 'kiswahili', 'social_studies'],
  },
  {
    id: 'lawyer',
    title: 'Lawyer',
    description: 'Practice law, defend justice',
    requirements: ['English', 'History', 'Kiswahili'],
    interests: ['law', 'political_science', 'international_relations', 'english'],
  },
  {
    id: 'business_owner',
    title: 'Business Owner/Entrepreneur',
    description: 'Start and run your own business',
    requirements: ['Business Studies', 'Mathematics', 'Economics'],
    interests: ['entrepreneurship', 'business', 'economics', 'finance'],
  },
  {
    id: 'accountant',
    title: 'Accountant',
    description: 'Manage finances for organizations',
    requirements: ['Mathematics', 'Business Studies', 'Economics'],
    interests: ['accounting', 'finance', 'business', 'mathematics'],
  },
  {
    id: 'data_scientist',
    title: 'Data Scientist',
    description: 'Analyze data to find insights and solutions',
    requirements: ['Mathematics', 'Computer Science', 'Statistics'],
    interests: ['data_science', 'programming', 'mathematics', 'ai'],
  },
  {
    id: 'nurse',
    title: 'Nurse',
    description: 'Provide patient care and support',
    requirements: ['Biology', 'Chemistry'],
    interests: ['nursing', 'medicine', 'sciences', 'public_health'],
  },
  {
    id: 'pharmacist',
    title: 'Pharmacist',
    description: 'Dispense medications, advise on drug use',
    requirements: ['Chemistry', 'Biology', 'Mathematics'],
    interests: ['pharmacy', 'sciences', 'chemistry', 'medicine'],
  },
  {
    id: 'architect',
    title: 'Architect',
    description: 'Design buildings and spaces',
    requirements: ['Mathematics', 'Physics', 'Art/Design'],
    interests: ['engineering', 'design', 'mathematics', 'creative_arts'],
  },
  {
    id: 'journalist',
    title: 'Journalist',
    description: 'Report news, tell stories',
    requirements: ['English', 'Kiswahili', 'Social Studies'],
    interests: ['writing', 'english', 'kiswahili', 'film'],
  },
  {
    id: 'artist',
    title: 'Artist/Designer',
    description: 'Create visual art and designs',
    requirements: ['Art/Design', 'Creative Arts'],
    interests: ['creative_arts', 'design', 'fine_arts', 'music'],
  },
  {
    id: 'pilot',
    title: 'Pilot',
    description: 'Fly aircraft, travel the world',
    requirements: ['Mathematics', 'Physics', 'Geography', 'English'],
    interests: ['tourism', 'travel', 'geography', 'physics'],
  },
  {
    id: 'chef',
    title: 'Chef/Culinarian',
    description: 'Create culinary masterpieces',
    requirements: ['Chemistry', 'Biology', 'Creative Arts'],
    interests: ['culinary', 'creative_arts', 'chemistry'],
  },
  {
    id: 'farmer',
    title: 'Agricultural Scientist',
    description: 'Improve farming, feed the nation',
    requirements: ['Biology', 'Chemistry', 'Geography'],
    interests: ['agriculture', 'sciences', 'environment', 'biology'],
  },
  {
    id: 'it_specialist',
    title: 'IT Specialist',
    description: 'Manage technology infrastructure',
    requirements: ['Mathematics', 'Computer Science'],
    interests: ['it', 'computer_science', 'programming', 'networking'],
  },
  {
    id: 'social_worker',
    title: 'Social Worker',
    description: 'Help communities, support vulnerable people',
    requirements: ['Social Studies', 'English', 'Kiswahili'],
    interests: ['social_studies', 'religious_ed', 'public_health', 'psychology'],
  },
  {
    id: 'dentist',
    title: 'Dentist',
    description: 'Oral health care, dental surgery and hygiene',
    requirements: ['Biology', 'Chemistry', 'Physics', 'Mathematics'],
    interests: ['medicine', 'sciences', 'biology', 'chemistry'],
  },
  {
    id: 'clinical_officer',
    title: 'Clinical Officer',
    description: 'Diagnose and treat common illnesses in clinics',
    requirements: ['Biology', 'Chemistry', 'English'],
    interests: ['medicine', 'nursing', 'public_health', 'sciences'],
  },
  {
    id: 'lab_technologist',
    title: 'Laboratory Technologist',
    description: 'Run medical and scientific laboratory tests',
    requirements: ['Biology', 'Chemistry', 'Mathematics'],
    interests: ['research', 'sciences', 'pharmacy', 'medicine'],
  },
  {
    id: 'physiotherapist',
    title: 'Physiotherapist',
    description: 'Help patients recover movement and manage pain',
    requirements: ['Biology', 'Chemistry', 'Physical Education'],
    interests: ['medicine', 'pe', 'nursing', 'public_health'],
  },
  {
    id: 'veterinarian',
    title: 'Veterinarian',
    description: 'Animal health, livestock and wildlife care',
    requirements: ['Biology', 'Chemistry', 'Agriculture'],
    interests: ['veterinary', 'agriculture', 'sciences', 'biology'],
  },
  {
    id: 'agribusiness',
    title: 'Agribusiness Manager',
    description: 'Run profitable farms and agro-enterprises',
    requirements: ['Agriculture', 'Business Studies', 'Mathematics'],
    interests: ['agriculture', 'business', 'entrepreneurship', 'economics'],
  },
  {
    id: 'environmental_scientist',
    title: 'Environmental Scientist',
    description: 'Protect ecosystems and manage natural resources',
    requirements: ['Biology', 'Geography', 'Chemistry'],
    interests: ['environment', 'agriculture', 'sciences', 'research'],
  },
  {
    id: 'civil_engineer',
    title: 'Civil Engineer',
    description: 'Design roads, bridges, water and buildings',
    requirements: ['Mathematics', 'Physics', 'Geography'],
    interests: ['engineering', 'mathematics', 'sciences', 'design'],
  },
  {
    id: 'electrical_engineer',
    title: 'Electrical / Electronics Engineer',
    description: 'Power systems, electronics and automation',
    requirements: ['Mathematics', 'Physics', 'Computer Science'],
    interests: ['engineering', 'robotics', 'programming', 'mathematics'],
  },
  {
    id: 'cybersecurity_analyst',
    title: 'Cybersecurity Analyst',
    description: 'Protect systems, networks and data from threats',
    requirements: ['Computer Science', 'Mathematics', 'English'],
    interests: ['cybersecurity', 'networking', 'programming', 'it'],
  },
  {
    id: 'ai_engineer',
    title: 'AI / Machine Learning Engineer',
    description: 'Build intelligent systems and models',
    requirements: ['Mathematics', 'Computer Science', 'Physics'],
    interests: ['ai', 'data_science', 'programming', 'computer_science'],
  },
  {
    id: 'actuary',
    title: 'Actuary',
    description: 'Assess risk using statistics and finance',
    requirements: ['Mathematics', 'Economics', 'Business Studies'],
    interests: ['mathematics', 'finance', 'economics', 'data_science'],
  },
  {
    id: 'economist',
    title: 'Economist',
    description: 'Analyze markets, policy and economic trends',
    requirements: ['Mathematics', 'Economics', 'English'],
    interests: ['economics', 'finance', 'business', 'political_science'],
  },
  {
    id: 'banker',
    title: 'Banker / Financial Analyst',
    description: 'Banking services, investments and credit',
    requirements: ['Mathematics', 'Business Studies', 'Economics'],
    interests: ['finance', 'accounting', 'business', 'economics'],
  },
  {
    id: 'marketer',
    title: 'Marketing Specialist',
    description: 'Brand strategy, digital marketing and sales',
    requirements: ['English', 'Business Studies', 'Creative Arts'],
    interests: ['marketing', 'business', 'writing', 'film'],
  },
  {
    id: 'hr_manager',
    title: 'Human Resource Manager',
    description: 'Recruit, develop and support people at work',
    requirements: ['English', 'Business Studies', 'Social Studies'],
    interests: ['hr', 'business', 'teaching', 'psychology'],
  },
  {
    id: 'lawyer_corporate',
    title: 'Corporate / Human Rights Lawyer',
    description: 'Advise on business law or defend rights',
    requirements: ['English', 'History', 'Kiswahili'],
    interests: ['law', 'political_science', 'international_relations', 'writing'],
  },
  {
    id: 'diplomat',
    title: 'Diplomat / Foreign Service Officer',
    description: 'Represent Kenya in international affairs',
    requirements: ['English', 'History', 'Geography', 'Kiswahili'],
    interests: ['international_relations', 'political_science', 'law', 'languages'],
  },
  {
    id: 'psychologist',
    title: 'Psychologist / Counselor',
    description: 'Support mental health and human behaviour',
    requirements: ['Biology', 'English', 'Social Studies'],
    interests: ['public_health', 'teaching', 'social_studies', 'research'],
  },
  {
    id: 'journalist_broadcast',
    title: 'Broadcast Journalist / Media Producer',
    description: 'TV, radio and digital storytelling',
    requirements: ['English', 'Kiswahili', 'Creative Arts'],
    interests: ['film', 'writing', 'english', 'music'],
  },
  {
    id: 'graphic_designer',
    title: 'Graphic / UI Designer',
    description: 'Visual design for brands, apps and media',
    requirements: ['Art/Design', 'Computer Studies', 'English'],
    interests: ['design', 'creative_arts', 'film', 'it'],
  },
  {
    id: 'musician',
    title: 'Musician / Sound Producer',
    description: 'Perform, compose or produce music',
    requirements: ['Music', 'Creative Arts', 'English'],
    interests: ['music', 'creative_arts', 'film', 'performance'],
  },
  {
    id: 'fashion_designer',
    title: 'Fashion Designer',
    description: 'Design clothing and textile products',
    requirements: ['Art/Design', 'Home Science', 'Business Studies'],
    interests: ['design', 'creative_arts', 'entrepreneurship', 'fine_arts'],
  },
  {
    id: 'hotel_manager',
    title: 'Hotel / Hospitality Manager',
    description: 'Run hotels, lodges and guest experiences',
    requirements: ['Business Studies', 'English', 'Home Science'],
    interests: ['hospitality', 'tourism', 'business', 'culinary'],
  },
  {
    id: 'tour_guide',
    title: 'Tour Guide / Travel Consultant',
    description: 'Lead tours and plan travel experiences',
    requirements: ['Geography', 'English', 'History', 'Kiswahili'],
    interests: ['tourism', 'hospitality', 'social_studies', 'languages'],
  },
  {
    id: 'pilot_atc',
    title: 'Air Traffic Controller',
    description: 'Direct aircraft safely in airspace',
    requirements: ['Mathematics', 'Physics', 'English', 'Geography'],
    interests: ['tourism', 'mathematics', 'sciences', 'networking'],
  },
  {
    id: 'quantity_surveyor',
    title: 'Quantity Surveyor',
    description: 'Cost construction projects and contracts',
    requirements: ['Mathematics', 'Physics', 'Business Studies'],
    interests: ['engineering', 'mathematics', 'business', 'design'],
  },
  {
    id: 'surveyor',
    title: 'Land Surveyor / Geospatial Expert',
    description: 'Map land and manage spatial data',
    requirements: ['Mathematics', 'Geography', 'Physics'],
    interests: ['environment', 'engineering', 'mathematics', 'it'],
  },
  {
    id: 'pharmacist_tech',
    title: 'Pharmaceutical Technologist',
    description: 'Support pharmacy services and drug supply',
    requirements: ['Chemistry', 'Biology', 'Mathematics'],
    interests: ['pharmacy', 'chemistry', 'medicine', 'sciences'],
  },
  {
    id: 'nutritionist',
    title: 'Nutritionist / Dietitian',
    description: 'Plan healthy diets and community nutrition',
    requirements: ['Biology', 'Chemistry', 'Home Science'],
    interests: ['nutrition', 'public_health', 'sciences', 'culinary'],
  },
  {
    id: 'sports_coach',
    title: 'Sports Coach / PE Teacher',
    description: 'Train athletes and teach physical education',
    requirements: ['Physical Education', 'Biology', 'English'],
    interests: ['pe', 'sports_mgmt', 'teaching', 'public_health'],
  },
  {
    id: 'early_childhood',
    title: 'Early Childhood Educator',
    description: 'Teach and care for young learners (PP1–Grade 3)',
    requirements: ['English', 'Kiswahili', 'Creative Arts'],
    interests: ['teaching', 'special_ed', 'creative_arts', 'edtech'],
  },
  {
    id: 'special_needs_teacher',
    title: 'Special Needs Teacher',
    description: 'Support learners with diverse learning needs',
    requirements: ['English', 'Any subject specialization'],
    interests: ['special_ed', 'teaching', 'public_health', 'psychology'],
  },
  {
    id: 'tv_et_path',
    title: 'TVET Artisan / Technician',
    description: 'Hands-on technical and vocational careers',
    requirements: ['Mathematics', 'Pre-Technical Studies', 'English'],
    interests: ['engineering', 'programming', 'agriculture', 'design'],
  },
  {
    id: 'entrepreneur_tech',
    title: 'Tech Entrepreneur',
    description: 'Build startups solving local problems with tech',
    requirements: ['Mathematics', 'Computer Science', 'Business Studies'],
    interests: ['entrepreneurship', 'programming', 'innovation', 'business'],
  },
  {
    id: 'data_analyst',
    title: 'Data Analyst',
    description: 'Turn data into decisions for organizations',
    requirements: ['Mathematics', 'Computer Science', 'English'],
    interests: ['data_science', 'mathematics', 'it', 'business'],
  },
  {
    id: 'network_engineer',
    title: 'Network Engineer',
    description: 'Design and maintain computer networks',
    requirements: ['Mathematics', 'Computer Science', 'Physics'],
    interests: ['networking', 'it', 'cybersecurity', 'programming'],
  },
  {
    id: 'content_creator',
    title: 'Digital Content Creator',
    description: 'Create online video, audio and written content',
    requirements: ['English', 'Creative Arts', 'Computer Studies'],
    interests: ['film', 'writing', 'music', 'marketing'],
  },
  {
    id: 'urban_planner',
    title: 'Urban / Regional Planner',
    description: 'Plan towns, housing and sustainable cities',
    requirements: ['Geography', 'Mathematics', 'English'],
    interests: ['environment', 'engineering', 'political_science', 'design'],
  },
  {
    id: 'marine_biologist',
    title: 'Marine Biologist / Fisheries Officer',
    description: 'Study aquatic life and manage fisheries',
    requirements: ['Biology', 'Chemistry', 'Geography'],
    interests: ['environment', 'sciences', 'agriculture', 'research'],
  },
];

type Step = 1 | 2 | 3;

export default function PathwayFinder() {
  const [step, setStep] = useState<Step>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<string>('');
  const [averageGrade, setAverageGrade] = useState('');
  const [subjectGrades, setSubjectGrades] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter(i => i !== id));
    } else if (selectedInterests.length < 5) {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const getRecommendedCareers = (): CareerPath[] => {
    const scored = careerPaths
      .map(career => {
        const matchCount = career.interests.filter(i => selectedInterests.includes(i)).length;
        return { ...career, matchScore: matchCount };
      })
      .sort((a: any, b: any) => b.matchScore - a.matchScore);
    const matched = scored.filter((c: any) => c.matchScore > 0);
    // Always surface a broad set of pathways so none are "missing"
    const top = (matched.length >= 8 ? matched : scored).slice(0, 24);
    return top as CareerPath[];
  };

  const selectedCareerObj = () => careerPaths.find(c => c.id === selectedCareer);

  const requiredSubjects = selectedCareerObj()?.requirements || [];

  const computedAverageFromSubjects = () => {
    const vals = requiredSubjects
      .map((s) => parseFloat(subjectGrades[s] || ''))
      .filter((n) => !isNaN(n));
    if (vals.length === 0) return NaN;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const effectiveAverage = () => {
    const fromSubjects = computedAverageFromSubjects();
    if (!isNaN(fromSubjects)) return fromSubjects;
    return parseFloat(averageGrade);
  };

  const getGradeRecommendation = () => {
    const grade = effectiveAverage();
    if (isNaN(grade)) return 'Please enter grades for your selected pathway subjects (or an overall average).';
    const weak = requiredSubjects.filter((s) => {
      const g = parseFloat(subjectGrades[s] || '');
      return !isNaN(g) && g < 50;
    });
    let base = '';
    if (grade >= 80) base = 'Excellent! With your strong academic performance, you are well-positioned for competitive courses like Medicine, Engineering, Law, or Data Science.';
    else if (grade >= 65) base = 'Good performance! You have many options including Business, IT, Education, Nursing, and Social Sciences.';
    else if (grade >= 50) base = 'Fair performance. Consider vocational courses, certificate programs, or diploma courses that align with your interests.';
    else base = 'Consider bridging courses, vocational training, or craft certificate programs. Your skills and interests matter more than grades!';
    if (weak.length) {
      base += ` Focus on improving: ${weak.join(', ')} — these are key for your chosen pathway.`;
    }
    const strong = requiredSubjects.filter((s) => {
      const g = parseFloat(subjectGrades[s] || '');
      return !isNaN(g) && g >= 75;
    });
    if (strong.length) {
      base += ` Your strengths in ${strong.join(', ')} support this pathway.`;
    }
    return base;
  };

  const handleReset = () => {
    setStep(1);
    setSelectedInterests([]);
    setSelectedCareer('');
    setAverageGrade('');
    setSubjectGrades({});
    setShowResults(false);
  };

  const setSubjectGrade = (subject: string, value: string) => {
    setSubjectGrades((prev) => ({ ...prev, [subject]: value }));
  };

  const canSeeResults = () => {
    const hasSubjectGrades = requiredSubjects.some((s) => subjectGrades[s] !== undefined && subjectGrades[s] !== '');
    return hasSubjectGrades || !!averageGrade;
  };

  const getCareerById = (id: string) => careerPaths.find(c => c.id === id);

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
            Discover your ideal career path based on your interests and academic performance. 
            This tool helps Kenyan students explore opportunities aligned with their passions.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step >= s ? 'bg-[#2563EB] text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  {step > s ? <CheckIcon /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-16 sm:w-24 h-1 rounded-full transition-all ${
                    step > s ? 'bg-[#2563EB]' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 mt-3">
            <span className={`text-xs ${step >= 1 ? 'text-[#60a5fa]' : 'text-gray-500'}`}>Interests</span>
            <span className={`text-xs ${step >= 2 ? 'text-[#60a5fa]' : 'text-gray-500'}`}>Career</span>
            <span className={`text-xs ${step >= 3 ? 'text-[#60a5fa]' : 'text-gray-500'}`}>Grades</span>
          </div>
        </div>

        {/* Step 1: Interests */}
        {step === 1 && (
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">What excites you?</h3>
              <p className="text-gray-400 text-sm">
                Pick up to 5 interests — choose the ones that excite you most. This helps us tailor your pathway.
              </p>
              <p className="text-[#60a5fa] text-sm mt-2 font-medium">
                {selectedInterests.length} of 5 selected
              </p>
            </div>

            {/* Group by category */}
            {Array.from(new Set(interestOptions.map(i => i.category))).map(category => {
              const categoryInterests = interestOptions.filter(i => i.category === category);
              if (categoryInterests.length === 0) return null;
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
                          <div className={`mb-2 ${isSelected ? 'text-[#60a5fa]' : 'text-gray-500'}`}>
                            {interest.icon}
                          </div>
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

        {/* Step 2: Career Selection */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Choose Your Career Path</h3>
              <p className="text-gray-400 text-sm">
                Based on your interests, explore matching pathways — scroll to see the full list of careers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {getRecommendedCareers().map((career: any) => (
                <button
                  key={career.id}
                  onClick={() => setSelectedCareer(career.id)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    selectedCareer === career.id
                      ? 'border-[#2563EB] bg-[#2563EB]/20'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-white">{career.title}</h4>
                    <span className="text-xs bg-[#2563EB]/30 text-[#60a5fa] px-2 py-1 rounded-full">
                      {career.matchScore} match{career.matchScore > 1 ? 'es' : ''}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{career.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {career.requirements.map((req: string, i: number) => (
                      <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
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

        {/* Step 3: Grades — per required subject + overall fallback */}
        {step === 3 && !showResults && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold mb-2">Configure Grades for Pathway Subjects</h3>
              <p className="text-gray-400 text-sm">
                Enter a grade (%) for each required subject of <span className="text-[#60a5fa] font-medium">{selectedCareerObj()?.title}</span>.
                You can also set an overall average as a fallback.
              </p>
            </div>

            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-6 space-y-4">
              <h4 className="text-sm font-medium text-[#60a5fa]">Required subjects</h4>
              {requiredSubjects.length === 0 ? (
                <p className="text-sm text-gray-400">Select a career path first.</p>
              ) : (
                requiredSubjects.map((subject) => (
                  <div key={subject} className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2 items-center">
                    <label className="text-sm text-gray-200">{subject}</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={subjectGrades[subject] || ''}
                      onChange={(e) => setSubjectGrade(subject, e.target.value)}
                      placeholder="e.g. 72"
                      className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-white text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                ))
              )}
              {!isNaN(computedAverageFromSubjects()) && (
                <p className="text-xs text-emerald-400 pt-1">
                  Subject average: {computedAverageFromSubjects().toFixed(1)}%
                </p>
              )}
            </div>

            <div className="bg-gray-800/40 rounded-2xl p-6 border border-gray-700 mb-8">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Overall average (%) — optional fallback
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={averageGrade}
                onChange={(e) => setAverageGrade(e.target.value)}
                placeholder="e.g., 75"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl text-white text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={averageGrade || 0}
                onChange={(e) => setAverageGrade(e.target.value)}
                className="w-full mt-3 accent-[#2563EB]"
              />
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

        {/* Results */}
        {step === 3 && showResults && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-[#2563EB]/20 to-[#1e40af]/20 rounded-2xl p-8 border border-[#2563EB]/30 mb-8">
              <div className="text-center mb-6">
                <GraduationCap className="w-12 h-12 text-[#60a5fa] mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-white mb-1">Your Pathway Results</h3>
                <p className="text-[#60a5fa]">Personalized career guidance</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Selected Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInterests.map(id => {
                      const interest = interestOptions.find(i => i.id === id);
                      return (
                        <span key={id} className="text-xs bg-[#2563EB]/30 text-white px-3 py-1 rounded-full">
                          {interest?.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Recommended Career</h4>
                  <p className="text-white font-semibold text-lg">
                    {getCareerById(selectedCareer)?.title}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {getCareerById(selectedCareer)?.description}
                  </p>
                </div>

                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Academic Guidance</h4>
                  <p className="text-gray-300 text-sm">
                    {getGradeRecommendation()}
                  </p>
                </div>

                <div className="bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-[#60a5fa] mb-2">Required Subjects & Grades</h4>
                  <div className="flex flex-wrap gap-2">
                    {getCareerById(selectedCareer)?.requirements.map((req, i) => (
                      <span key={i} className="text-xs bg-green-900/50 text-green-300 px-3 py-1 rounded-full">
                        {req}{subjectGrades[req] ? ` — ${subjectGrades[req]}%` : ''}
                      </span>
                    ))}
                  </div>
                  {!isNaN(effectiveAverage()) && (
                    <p className="text-xs text-gray-400 mt-3">
                      Effective average used: {effectiveAverage().toFixed(1)}%
                    </p>
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
