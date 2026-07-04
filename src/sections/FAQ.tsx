import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Which curriculum does Zamifu Analytics support?',
    answer: 'Zamifu Analytics fully supports the Competency-Based Education (CBE) and 8-4-4 curricula for PP1 through Grade 12. The system auto-calculates grades according to the CBE grading framework.',
  },
  {
    question: 'How does the CBE grade calculation work?',
    answer: 'When teachers upload marks (0-100), our system automatically calculates the CBE sublevel (EE1, EE2, ME1, ME2, AE1, AE2, BE1, BE2), grade (EE, ME, AE, BE), points (1-4), and descriptor.',
  },
  {
    question: 'Can parents pay school fees through the platform?',
    answer: 'Parent online payments are available only for schools that are explicitly configured for Paystack by an authorized reseller. All other schools continue to record cash, bank, or M-Pesa payments through the school office.',
  },
  {
    question: 'How do teachers upload results?',
    answer: 'Teachers select a class, subject, and term, then download a CSV template pre-filled with student names. They enter marks (0-100) only, save the file, and upload it back. The system shows a preview before submission and auto-calculates all grades.',
  },
  {
    question: 'Is my school\'s data secure?',
    answer: 'Absolutely. We use Row Level Security (RLS) in Supabase, meaning users can only access data for their own school. All connections are encrypted with SSL, and we never share your data with third parties.',
  },
  {
    question: 'How is a school workspace activated?',
    answer: 'A school workspace is activated by registering an account and completing the school setup process. The platform then guides administrators through classes, subjects, users, fees, and reporting configuration.',
  },
  {
    question: 'Does Zamifu Analytics work on mobile devices?',
    answer: 'Yes, Zamifu Analytics is fully responsive and works on smartphones, tablets, and computers. Teachers can mark attendance from their phones, and parents can check results on the go.',
  },
  {
    question: 'How do I get started?',
    answer: 'Simply register your school account, set up your classes and subjects, invite teachers, and start using the platform. Our support team is available to help with onboarding and data migration.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 md:py-20 bg-[#EBE7E0]">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-[#2563EB] mb-2 block">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">Frequently Asked Questions</h2>
          <p className="text-[#666666]">
            Everything you need to know about Zamifu Analytics.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-[#111111] pr-4">{faq.question}</span>
                <ChevronDown 
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`} 
                />
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-[#666666] leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
