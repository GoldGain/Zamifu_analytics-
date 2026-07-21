import { useState } from 'react';
import {
  Calculator, BookOpen, MessageSquare, Atom, Globe, Landmark,
  Monitor, Code, HardHat, Cpu, Database, TrendingUp, Wifi,
  Briefcase, DollarSign, UsersRound,
  Palette, Music, Theater, Pen, PenTool, Camera,
  Volleyball, Users,
  Beaker, Sprout,
  Leaf, Heart,
  Building2, Plane, UtensilsCrossed,
  Gavel, Baby,
  FlaskConical, Microscope, School, Wrench,
  ChevronDown, ChevronUp, Compass, Star,
} from 'lucide-react';

interface InterestCategory {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  interests: { name: string; icon: React.ReactNode }[];
}

const categories: InterestCategory[] = [
  {
    name: 'Core Academic',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    interests: [
      { name: 'Mathematics', icon: <Calculator className="w-4 h-4" /> },
      { name: 'English', icon: <BookOpen className="w-4 h-4" /> },
      { name: 'Kiswahili/Kenyan Sign Language', icon: <MessageSquare className="w-4 h-4" /> },
      { name: 'Integrated Science', icon: <Atom className="w-4 h-4" /> },
      { name: 'Pre-Technical Studies', icon: <Wrench className="w-4 h-4" /> },
      { name: 'Social Studies', icon: <Globe className="w-4 h-4" /> },
      { name: 'Agriculture and Nutrition', icon: <Sprout className="w-4 h-4" /> },
      { name: 'Creative Arts and Sports', icon: <Palette className="w-4 h-4" /> },
      { name: 'Religious Education (CRE/IRE/HRE)', icon: <Landmark className="w-4 h-4" /> },
    ],
  },
  {
    name: 'STEM',
    icon: <Cpu className="w-6 h-6" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    interests: [
      { name: 'Scientific Inquiry', icon: <FlaskConical className="w-4 h-4" /> },
      { name: 'Technology Enthusiasm', icon: <Monitor className="w-4 h-4" /> },
      { name: 'Engineering Design', icon: <HardHat className="w-4 h-4" /> },
      { name: 'Mathematical Thinking', icon: <Calculator className="w-4 h-4" /> },
      { name: 'Medical and Health Sciences', icon: <Heart className="w-4 h-4" /> },
      { name: 'Environmental Science', icon: <Leaf className="w-4 h-4" /> },
      { name: 'Space and Astronomy', icon: <Star className="w-4 h-4" /> },
      { name: 'Robotics and Automation', icon: <Cpu className="w-4 h-4" /> },
      { name: 'Programming and Coding', icon: <Code className="w-4 h-4" /> },
      { name: 'Data Science and AI', icon: <Database className="w-4 h-4" /> },
      { name: 'Health', icon: <Heart className="w-4 h-4" /> },
      { name: 'Agriculture', icon: <Sprout className="w-4 h-4" /> },
      { name: 'Mathematics', icon: <Calculator className="w-4 h-4" /> },
      { name: 'GIS', icon: <Globe className="w-4 h-4" /> },
      { name: 'Home Science', icon: <UtensilsCrossed className="w-4 h-4" /> },
      { name: 'Physics / Chemistry / Biology', icon: <Beaker className="w-4 h-4" /> },
      { name: 'Computer Studies', icon: <Monitor className="w-4 h-4" /> },
      { name: 'Technical Studies (Aviation, Construction, Electricity…)', icon: <Wrench className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Creative Arts and Sports',
    icon: <Palette className="w-6 h-6" />,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
    interests: [
      { name: 'Athletic Performance', icon: <Volleyball className="w-4 h-4" /> },
      { name: 'Human Anatomy', icon: <Heart className="w-4 h-4" /> },
      { name: 'Strategy and Coaching', icon: <Users className="w-4 h-4" /> },
      { name: 'Outdoor Activity', icon: <Sprout className="w-4 h-4" /> },
      { name: 'Stage Expression', icon: <Theater className="w-4 h-4" /> },
      { name: 'Creative Writing', icon: <Pen className="w-4 h-4" /> },
      { name: 'Media Consumption', icon: <Camera className="w-4 h-4" /> },
      { name: 'Public Speaking', icon: <UsersRound className="w-4 h-4" /> },
      { name: 'Visual Creation', icon: <Palette className="w-4 h-4" /> },
      { name: 'Digital Design', icon: <PenTool className="w-4 h-4" /> },
      { name: 'Music / Dance / Theatre', icon: <Music className="w-4 h-4" /> },
      { name: 'Fine Arts & Design', icon: <Palette className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Social Sciences',
    icon: <Briefcase className="w-6 h-6" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    interests: [
      { name: 'Analyzing Human Behavior', icon: <Users className="w-4 h-4" /> },
      { name: 'Solving Social Issues', icon: <Heart className="w-4 h-4" /> },
      { name: 'Debating Laws and Politics', icon: <Gavel className="w-4 h-4" /> },
      { name: 'Exploring History and Culture', icon: <Landmark className="w-4 h-4" /> },
      { name: 'Investigating Economics', icon: <DollarSign className="w-4 h-4" /> },
      { name: 'Telling Impactful Stories', icon: <Pen className="w-4 h-4" /> },
      { name: 'Environment and Land Management', icon: <Globe className="w-4 h-4" /> },
      { name: 'Human Geography', icon: <UsersRound className="w-4 h-4" /> },
      { name: 'Physical Geography', icon: <Leaf className="w-4 h-4" /> },
      { name: 'Global Affairs', icon: <Globe className="w-4 h-4" /> },
      { name: 'Business Studies', icon: <Briefcase className="w-4 h-4" /> },
      { name: 'Hospitality and Tourism', icon: <Plane className="w-4 h-4" /> },
      { name: 'Law', icon: <Gavel className="w-4 h-4" /> },
      { name: 'Quantity Survey', icon: <Building2 className="w-4 h-4" /> },
      { name: 'Journalism & Languages', icon: <MessageSquare className="w-4 h-4" /> },
      { name: 'GIS (Social Sciences applications)', icon: <Wifi className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Research and Innovation',
    icon: <FlaskConical className="w-6 h-6" />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
    interests: [
      { name: 'Research', icon: <Microscope className="w-4 h-4" /> },
      { name: 'Innovation', icon: <FlaskConical className="w-4 h-4" /> },
      { name: 'Data Analysis', icon: <TrendingUp className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Education',
    icon: <School className="w-6 h-6" />,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 hover:bg-violet-100 border-violet-200',
    interests: [
      { name: 'Teaching', icon: <School className="w-4 h-4" /> },
      { name: 'Educational Technology', icon: <Monitor className="w-4 h-4" /> },
      { name: 'Special Education', icon: <Baby className="w-4 h-4" /> },
    ],
  },
];

export default function InterestsSection() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <section className="py-16 bg-white" id="interests">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#2563EB]/10 text-[#2563EB] px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Compass className="w-4 h-4" />
            Explore Your Options
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#111111] mb-3">
            Learning Areas & Career Interests
          </h2>
          <p className="text-[#666666] max-w-2xl mx-auto">
            Explore the six pathways: Core Academic, STEM, Creative Arts and Sports, Social Sciences,
            Research and Innovation, and Education.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const isExpanded = expandedCategory === category.name;
            return (
              <div
                key={category.name}
                className={`rounded-2xl border-2 transition-all duration-300 ${category.bgColor} ${
                  isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''
                }`}
              >
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.name)}
                  className="w-full p-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`${category.color}`}>{category.icon}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      <p className="text-xs text-gray-500">{category.interests.length} interests</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {category.interests.map((interest) => (
                        <div
                          key={interest.name}
                          className="flex items-center gap-2 bg-white/70 border border-white rounded-xl px-3 py-2"
                        >
                          <span className="text-gray-500">{interest.icon}</span>
                          <span className="text-sm font-medium text-gray-700">{interest.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-4">
            Not sure which path to take? Try our Pathway Finder tool below!
          </p>
          <a
            href="#pathway-finder"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            <Compass className="w-5 h-5" />
            Try Pathway Finder
          </a>
        </div>
      </div>
    </section>
  );
}
