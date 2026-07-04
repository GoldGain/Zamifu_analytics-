import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Dr. James Mwangi',
    role: 'Principal, Greenfield Academy',
    image: 'JM',
    color: 'bg-blue-500',
    content: 'Zamifu Analytics has transformed how we manage our school. The CBE grading automation alone saves our teachers hours of work every term. The fee management system is intuitive and parents love being able to check balances instantly.',
    rating: 5,
  },
  {
    name: 'Mrs. Grace Wanjiku',
    role: 'Head Teacher, Sunrise Primary',
    image: 'GW',
    color: 'bg-green-500',
    content: 'We switched from manual record-keeping to Zamifu Analytics and the difference is night and day. Our report cards are generated instantly, and the attendance tracking has improved our student retention significantly.',
    rating: 5,
  },
  {
    name: 'Fr. Patrick Ochieng',
    role: 'Director, St. Mary\'s High School',
    image: 'PO',
    color: 'bg-purple-500',
    content: 'As a CBE institution, we needed a system that understood the Kenyan education system. Zamifu Analytics delivers perfectly. The analytics dashboard gives us insights we never had before.',
    rating: 5,
  },
  {
    name: 'Mr. Peter Kimani',
    role: 'Teacher, Junior School',
    image: 'PK',
    color: 'bg-orange-500',
    content: 'The result upload feature is a game-changer. I just download the template, fill in marks, and upload. The grades calculate automatically. What used to take days now takes minutes.',
    rating: 5,
  },
  {
    name: 'Mrs. Ann Muthoni',
    role: 'Parent, Greenfield Academy',
    image: 'AM',
    color: 'bg-pink-500',
    content: 'I can check my child\'s results, attendance, and fee balance all from my phone. The AI chatbot answers my questions instantly. It feels like the school is always within reach.',
    rating: 5,
  },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((c) => (c + 1) % testimonials.length);
  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);

  return (
    <section id="testimonials" className="py-16 md:py-20 bg-[#F5F3EF]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-[#2563EB] mb-2 block">TESTIMONIALS</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">Loved by Schools Across Kenya</h2>
          <p className="text-[#666666] max-w-2xl mx-auto">
            Hear from educators, administrators, and parents who trust Zamifu Analytics.
          </p>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          {testimonials.slice(0, 3).map((t, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] transition-all duration-200"
            >
              <Quote className="w-8 h-8 text-[#E6F24B] mb-4" />
              <p className="text-sm text-[#666666] leading-relaxed mb-6">{t.content}</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                  {t.image}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{t.name}</p>
                  <p className="text-xs text-[#666666]">{t.role}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-3">
                {Array.from({ length: t.rating }, (_, ri) => (
                  <Star key={ri} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="md:hidden">
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <Quote className="w-8 h-8 text-[#E6F24B] mb-4" />
            <p className="text-sm text-[#666666] leading-relaxed mb-6">{testimonials[current].content}</p>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${testimonials[current].color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                {testimonials[current].image}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">{testimonials[current].name}</p>
                <p className="text-xs text-[#666666]">{testimonials[current].role}</p>
              </div>
            </div>
            <div className="flex gap-1 mt-3">
              {Array.from({ length: testimonials[current].rating }, (_, ri) => (
                <Star key={ri} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={prev} className="p-2 bg-white rounded-full shadow hover:bg-gray-50">
              <ChevronLeft className="w-5 h-5" />
            </button>
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-[#2563EB] w-6' : 'bg-gray-300'}`}
              />
            ))}
            <button onClick={next} className="p-2 bg-white rounded-full shadow hover:bg-gray-50">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
