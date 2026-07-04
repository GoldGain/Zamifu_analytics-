import { useEffect, useRef } from 'react';
import { School, Upload, FileBarChart } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: <School className="w-8 h-8" />,
    title: 'School Onboarding',
    description: 'Register your school, set up classes, subjects, and term schedules. Invite teachers and administrators.',
    color: 'bg-blue-500',
  },
  {
    number: '02',
    icon: <Upload className="w-8 h-8" />,
    title: 'Upload Results',
    description: 'Teachers download CSV templates, enter student marks, and upload. The system auto-calculates CBE grades.',
    color: 'bg-green-500',
  },
  {
    number: '03',
    icon: <FileBarChart className="w-8 h-8" />,
    title: 'Generate Reports',
    description: 'Students and parents view results, download PDF report cards, track attendance, and manage fee balances.',
    color: 'bg-purple-500',
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const items = entry.target.querySelectorAll('.step-item');
            items.forEach((item, i) => {
              setTimeout(() => {
                (item as HTMLElement).style.opacity = '1';
                (item as HTMLElement).style.transform = 'translateY(0)';
              }, i * 200);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 md:py-20 bg-[#F5F3EF]" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-[#2563EB] mb-2 block">HOW IT WORKS</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">Simple 3-Step Process</h2>
          <p className="text-[#666666] max-w-2xl mx-auto">
            Get your school up and running on Zamifu Analytics in minutes, not days.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className="step-item relative opacity-0 translate-y-10 transition-all duration-600"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gray-200 -translate-x-8 z-0" />
              )}
              
              <div className="relative z-10 bg-white rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-shadow duration-200">
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center text-white`}>
                    {step.icon}
                  </div>
                  <span className="text-5xl font-bold text-gray-100">{step.number}</span>
                </div>
                <h3 className="text-xl font-bold text-[#111111] mb-3">{step.title}</h3>
                <p className="text-sm text-[#666666] leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
