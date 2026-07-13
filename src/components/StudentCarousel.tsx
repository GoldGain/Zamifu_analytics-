import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';

interface Slide {
  image: string;
  title: string;
  subtitle: string;
}

const slides: Slide[] = [
  {
    image: '/school-hero.jpg',
    title: 'Empowering Kenyan Schools',
    subtitle: 'Modern tools for CBE and 8-4-4 curriculum management',
  },
  {
    image: '/students-classroom.jpg',
    title: 'Digital Learning Environment',
    subtitle: 'Supporting students with technology-enabled education',
  },
  {
    image: '/students-success.jpg',
    title: 'Celebrating Academic Excellence',
    subtitle: 'Track, analyze, and celebrate student achievements',
  },
  {
    image: '/teacher-lab.jpg',
    title: 'Practical Science Education',
    subtitle: 'Hands-on learning for the next generation of scientists',
  },
  {
    image: '/students-library.jpg',
    title: 'Knowledge Without Bounds',
    subtitle: 'Resources and tools for comprehensive student development',
  },
];

export default function StudentCarousel() {
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, next]);

  return (
    <section className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] overflow-hidden bg-gray-900">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        </div>
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex items-end">
        <div className="container mx-auto px-4 pb-16 sm:pb-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-[#2563EB]/90 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <GraduationCap className="w-4 h-4" />
              Zamifu Analytics
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 transition-all duration-500">
              {slides[current].title}
            </h2>
            <p className="text-gray-300 text-lg sm:text-xl transition-all duration-500">
              {slides[current].subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => { prev(); setIsAutoPlaying(false); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all border border-white/20"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={() => { next(); setIsAutoPlaying(false); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all border border-white/20"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => { setCurrent(index); setIsAutoPlaying(false); }}
            className={`transition-all rounded-full ${
              index === current
                ? 'w-8 h-3 bg-[#2563EB]'
                : 'w-3 h-3 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
