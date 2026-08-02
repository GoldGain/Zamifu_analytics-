import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Compass, LogIn } from 'lucide-react';
import { Link } from 'react-router';

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
    <section
      className="relative w-full overflow-hidden bg-[#0F1729]"
      style={{ height: '100vh', minHeight: '600px' }}
    >
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
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.style.background = 'linear-gradient(135deg, #1A365D 0%, #2D4A7C 50%, #1A365D 100%)';
              }
            }}
          />
        </div>
      ))}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/60 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/30 z-[1]" />

      {/* Content — centered like Kimatu */}
      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div className="text-center max-w-3xl mx-auto w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="text-[#E6F24B]">✦</span>
            <span>Kenya&apos;s #1 School Platform</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-3 tracking-tight leading-none drop-shadow-lg">
            Zamifu Analytics
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl md:text-3xl font-bold mb-5 drop-shadow-md text-[#E6F24B]">
            {slides[current].subtitle}
          </p>

          <p className="text-base md:text-lg text-white/90 mb-8 max-w-xl mx-auto leading-relaxed drop-shadow-md">
            School Analytics Simplified. Manage learners, learning areas, assessments, fees, and report cards all in one place.
          </p>

          {/* Primary action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Link to="/auth/login">
              <span
                className="relative inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-bold shadow-2xl cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #2563EB 100%)',
                  color: '#ffffff',
                  boxShadow: '0 0 30px rgba(37, 99, 235, 0.5), 0 10px 40px rgba(0, 0, 0, 0.3)',
                }}
              >
                <LogIn className="w-5 h-5" />
                Login to Your School
              </span>
            </Link>
            <Link to="/register-school">
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border-2 border-white/40 text-white px-7 py-4 rounded-full text-base font-bold hover:bg-white/20 transition-colors cursor-pointer">
                Get Started <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
          </div>

          {/* Pathway Finder — prominent button */}
          <div className="flex justify-center mb-8">
            <Link to="/pathway-finder">
              <span className="inline-flex items-center gap-2 bg-[#E6F24B] text-[#1A1A1A] px-7 py-3 rounded-full text-sm font-bold hover:bg-yellow-300 transition-colors cursor-pointer shadow-lg">
                <Compass className="w-4 h-4" />
                Pathway Finder — Discover Your Career Path
              </span>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {[
              ['2,000+', 'Schools'],
              ['500K+', 'Learners'],
              ['50K+', 'Teachers'],
              ['98%', 'Satisfaction'],
            ].map(([v, l]) => (
              <span key={l} className="text-white text-center drop-shadow-md">
                <span className="block text-xl md:text-2xl font-bold">{v}</span>
                <span className="text-xs text-gray-200">{l}</span>
              </span>
            ))}
          </div>

          {/* Slide dots */}
          <div className="flex justify-center gap-2 mt-8">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => { setCurrent(index); setIsAutoPlaying(false); }}
                className={`transition-all duration-300 rounded-full ${
                  index === current ? 'w-8 h-2 bg-[#E6F24B]' : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => { prev(); setIsAutoPlaying(false); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all border border-white/20 z-10"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => { next(); setIsAutoPlaying(false); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all border border-white/20 z-10"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </section>
  );
}
