import { useEffect, useRef } from 'react';
import { Users, FileText, CreditCard, BarChart3, Bell, Calendar, BookOpen, Shield } from 'lucide-react';

const features = [
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Student Management',
    description: 'Complete student records with admission numbers, parent contacts, medical info, and academic history.',
    color: 'bg-blue-500',
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: 'Result Management',
    description: 'Auto-calculate CBE grades (EE, ME, AE, BE) from raw marks. Generate report cards instantly.',
    color: 'bg-green-500',
  },
  {
    icon: <CreditCard className="w-6 h-6" />,
    title: 'Fee Management',
    description: 'Track fee invoices, record payments, generate receipts. Parents view balances, no online payments.',
    color: 'bg-purple-500',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Analytics & Reports',
    description: 'Visual dashboards showing attendance trends, fee collection rates, and academic performance.',
    color: 'bg-orange-500',
  },
  {
    icon: <Bell className="w-6 h-6" />,
    title: 'Announcements',
    description: 'Publish school announcements, fee reminders, exam schedules, and emergency alerts.',
    color: 'bg-red-500',
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Timetable & Scheduling',
    description: 'Create class timetables, exam schedules, and manage teacher-subject assignments.',
    color: 'bg-teal-500',
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: 'Homework & Assignments',
    description: 'Teachers post homework with due dates. Students submit and track assignments.',
    color: 'bg-indigo-500',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Role-Based Access',
    description: 'Secure portals for Super Admin, School Admin, Teacher, Student, and Parent with appropriate permissions.',
    color: 'bg-pink-500',
  },
];

export default function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = entry.target.querySelectorAll('.feature-card');
            cards.forEach((card, i) => {
              setTimeout(() => {
                (card as HTMLElement).style.opacity = '1';
                (card as HTMLElement).style.transform = 'translateY(0)';
              }, i * 100);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-16 md:py-20 bg-[#1A1A1A]" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-[#E6F24B] mb-2 block">FEATURES</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything Your School Needs</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            A comprehensive suite of tools designed specifically for Kenyan schools, supporting CBE and 8-4-4 curricula.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="feature-card bg-[#2A2A2A] rounded-2xl p-6 border border-gray-800 opacity-0 translate-y-10 transition-all duration-500 hover:border-gray-600 hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]"
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center text-white mb-4`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
