import { useState } from 'react';
import {
  Calculator, BookOpen, MessageSquare, Atom, Globe, Landmark,
  Monitor, Code, HardHat, Cpu, Database, TrendingUp, Wifi, ShieldCheck,
  Briefcase, DollarSign, Star, UsersRound,
  Palette, Music, Theater, Pen, PenTool, Camera,
  Volleyball, Users,
  Stethoscope, HeartPulse, Beaker, Sprout,
  Leaf, Heart,
  Building2, Plane, UtensilsCrossed,
  Gavel, GraduationCap, Baby,
  FlaskConical, Microscope, School,
  ChevronDown, ChevronUp, Compass
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
      { name: 'English Language & Literature', icon: <BookOpen className="w-4 h-4" /> },
      { name: 'Kiswahili', icon: <MessageSquare className="w-4 h-4" /> },
      { name: 'Sciences (Physics, Chemistry, Biology)', icon: <Atom className="w-4 h-4" /> },
      { name: 'Social Studies', icon: <Globe className="w-4 h-4" /> },
      { name: 'Religious Education', icon: <Landmark className="w-4 h-4" /> },
    ],
  },
  {
    name: 'STEM',
    icon: <Cpu className="w-6 h-6" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    interests: [
      { name: 'Information Technology', icon: <Monitor className="w-4 h-4" /> },
      { name: 'Computer Science', icon: <Code className="w-4 h-4" /> },
      { name: 'Engineering', icon: <HardHat className="w-4 h-4" /> },
      { name: 'Robotics', icon: <Cpu className="w-4 h-4" /> },
      { name: 'Artificial Intelligence', icon: <Database className="w-4 h-4" /> },
      { name: 'Data Science', icon: <TrendingUp className="w-4 h-4" /> },
      { name: 'Programming', icon: <Code className="w-4 h-4" /> },
      { name: 'Networking', icon: <Wifi className="w-4 h-4" /> },
      { name: 'Cybersecurity', icon: <ShieldCheck className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Business & Commerce',
    icon: <Briefcase className="w-6 h-6" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    interests: [
      { name: 'Business Studies', icon: <Briefcase className="w-4 h-4" /> },
      { name: 'Accounting', icon: <DollarSign className="w-4 h-4" /> },
      { name: 'Economics', icon: <TrendingUp className="w-4 h-4" /> },
      { name: 'Entrepreneurship', icon: <Star className="w-4 h-4" /> },
      { name: 'Finance', icon: <DollarSign className="w-4 h-4" /> },
      { name: 'Marketing', icon: <UsersRound className="w-4 h-4" /> },
      { name: 'Human Resources', icon: <Users className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Arts & Humanities',
    icon: <Palette className="w-6 h-6" />,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
    interests: [
      { name: 'Creative Arts', icon: <Palette className="w-4 h-4" /> },
      { name: 'Music', icon: <Music className="w-4 h-4" /> },
      { name: 'Drama', icon: <Theater className="w-4 h-4" /> },
      { name: 'Writing', icon: <Pen className="w-4 h-4" /> },
      { name: 'Design', icon: <PenTool className="w-4 h-4" /> },
      { name: 'Fine Arts', icon: <Palette className="w-4 h-4" /> },
      { name: 'Film & Media', icon: <Camera className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Sports & Physical',
    icon: <Volleyball className="w-6 h-6" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    interests: [
      { name: 'Physical Education', icon: <Volleyball className="w-4 h-4" /> },
      { name: 'Sports Management', icon: <Users className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Health & Medicine',
    icon: <Stethoscope className="w-6 h-6" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50 hover:bg-red-100 border-red-200',
    interests: [
      { name: 'Medicine', icon: <Stethoscope className="w-4 h-4" /> },
      { name: 'Nursing', icon: <HeartPulse className="w-4 h-4" /> },
      { name: 'Pharmacy', icon: <Beaker className="w-4 h-4" /> },
      { name: 'Public Health', icon: <Users className="w-4 h-4" /> },
      { name: 'Nutrition', icon: <Sprout className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Agriculture & Environment',
    icon: <Leaf className="w-6 h-6" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
    interests: [
      { name: 'Agriculture', icon: <Sprout className="w-4 h-4" /> },
      { name: 'Environmental Science', icon: <Leaf className="w-4 h-4" /> },
      { name: 'Veterinary Science', icon: <Heart className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Hospitality & Tourism',
    icon: <Plane className="w-6 h-6" />,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50 hover:bg-sky-100 border-sky-200',
    interests: [
      { name: 'Hospitality Management', icon: <Building2 className="w-4 h-4" /> },
      { name: 'Tourism', icon: <Plane className="w-4 h-4" /> },
      { name: 'Culinary Arts', icon: <UtensilsCrossed className="w-4 h-4" /> },
    ],
  },
  {
    name: 'Law & Governance',
    icon: <Gavel className="w-6 h-6" />,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50 hover:bg-slate-100 border-slate-200',
    interests: [
      { name: 'Law', icon: <Gavel className="w-4 h-4" /> },
      { name: 'Political Science', icon: <Landmark className="w-4 h-4" /> },
      { name: 'International Relations', icon: <Globe className="w-4 h-4" /> },
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
  {
    name: 'Research & Innovation',
    icon: <FlaskConical className="w-6 h-6" />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
    interests: [
      { name: 'Research', icon: <Microscope className="w-4 h-4" /> },
      { name: 'Innovation', icon: <FlaskConical className="w-4 h-4" /> },
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
            Explore the wide range of subjects and career paths available to students. 
            From STEM to Arts, from Agriculture to Law — find your passion.
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
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`${category.color}`}>{category.icon}</div>
                    <div>
                      <h3 className={`font-semibold ${category.color}`}>{category.name}</h3>
                      <p className="text-xs text-gray-500">{category.interests.length} options</p>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {category.interests.map((interest) => (
                        <div
                          key={interest.name}
                          className="flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-100 shadow-sm"
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
