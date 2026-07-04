import { Link } from 'react-router';
import { ArrowRight, Sparkles, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePWA } from '@/hooks/usePWA';

const CAROUSEL_IMAGES = [
  { src: '/images/students1.jpg', caption: 'Empowering Learners Across Kenya' },
  { src: '/images/students2.jpg', caption: 'Smart Analytics for Every School' },
  { src: '/images/students3.jpg', caption: 'Real-Time Progress Tracking' },
  { src: '/images/students4.jpg', caption: 'Celebrating Academic Excellence' },
  { src: '/images/students5.jpg', caption: 'Technology-Enhanced Learning' },
  { src: '/images/students6.jpg', caption: 'Connecting Teachers, Parents & Learners' },
];

function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % CAROUSEL_IMAGES.length);
        setFade(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const img = CAROUSEL_IMAGES[current];
  return (
    <div className="relative w-full h-full" style={{ minHeight: '200px' }}>
      <img
        src={img.src}
        alt={img.caption}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transition: 'opacity 0.4s ease', opacity: fade ? 1 : 0 }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-4 left-4 right-4">
        <p
          className="text-white text-sm font-semibold drop-shadow"
          style={{ transition: 'opacity 0.4s ease', opacity: fade ? 1 : 0 }}
        >{img.caption}</p>
        <div className="flex gap-1.5 mt-2">
          {CAROUSEL_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => { setFade(false); setTimeout(() => { setCurrent(i); setFade(true); }, 400); }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? 'bg-white scale-125' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DownloadAppButton() {
  const { isInstallable, isInstalled, install } = usePWA();

  const handleDownload = async () => {
    if (isInstalled) {
      alert('Zamifu Analytics is already installed on your device!');
      return;
    }
    const installed = await install();
    if (!installed) {
      // Fallback for browsers that do not support beforeinstallprompt (e.g. Safari iOS)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('To install on iOS: Tap the Share button (📤) at the bottom of Safari → then tap "Add to Home Screen"');
      } else {
        alert('To install: Open this site in Chrome or Edge, then tap the browser menu (⋮) → "Install App" or "Add to Home Screen"');
      }
    }
  };

  // Only show button if installable or installed (don't show if not installable and not installed)
  if (!isInstallable && !isInstalled) return null;

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-green-700 transition-colors"
    >
      <Smartphone className="w-4 h-4" /> {isInstalled ? 'App Installed ✓' : 'Download App'}
    </button>
  );
}

export default function Hero() {
  const cardsRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formatDate = (d: Date) => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  const today = currentTime.getDate();
  const daysInMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  useEffect(() => {
    const cards = cardsRef.current?.querySelectorAll('.hero-card');
    cards?.forEach((card, i) => {
      const el = card as HTMLElement;
      el.style.opacity = '0';
      el.style.transform = 'translateY(40px)';
      setTimeout(() => {
        el.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 100 + i * 100);
    });
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#F5F3EF]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-auto">
          {/* Main Hero Card - Dark */}
          <div className="hero-card md:col-span-7 md:row-span-2 bg-[#1A1A1A] rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] transition-shadow duration-200">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#E6F24B]" />
                <span className="text-sm text-gray-400">Kenya&apos;s #1 School Platform</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2">
                An Intelligent School
              </h1>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-[#E6F24B]">
                Management System
              </h1>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm text-gray-300">Smart System and Workflow</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
                  <span className="text-sm text-gray-300">Flexible System and Workflow</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" style={{ animationDelay: '0.6s' }} />
                  <span className="text-sm text-gray-300">Real Time Collaboration</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mb-6">
                <Link to="/auth/register" className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-[#1d4ed8] transition-colors">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/auth/login" className="inline-flex items-center gap-2 border border-gray-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
                  Login
                </Link>
                <a 
                  href="https://wa.me/254712644205"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-green-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Chat on WhatsApp
                </a>
                <DownloadAppButton />
              </div>
            </div>
            {/* Mini Dashboard Preview */}
            <div className="relative mt-4 bg-[#2A2A2A] rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="ml-auto text-xs text-gray-500">Dashboard Preview</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#E6F24B]/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-[#E6F24B]">2,000+</div>
                  <div className="text-[10px] text-gray-400">Schools</div>
                </div>
                <div className="bg-blue-500/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">500K+</div>
                  <div className="text-[10px] text-gray-400">Students</div>
                </div>
                <div className="bg-orange-500/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-orange-400">50K+</div>
                  <div className="text-[10px] text-gray-400">Teachers</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <div className="flex-1 h-8 bg-gray-700/50 rounded flex items-end p-1 gap-1">
                  {[40, 65, 45, 80, 55, 70, 60].map((h, i) => (
                    <div key={i} className="flex-1 bg-[#2563EB] rounded-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Image Carousel Card */}
          <div className="hero-card md:col-span-5 rounded-2xl relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] transition-shadow duration-200" style={{ minHeight: '200px' }}>
            <HeroCarousel />
          </div>

          {/* Stats Card */}
          <div className="hero-card md:col-span-3 bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] transition-shadow duration-200">
            <div className="text-xs text-gray-500 mb-1">Performance</div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-[#111111]">32%</span>
              <span className="text-xs text-green-500 font-medium">More</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '32%' }} />
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-2xl font-bold text-[#111111]">28%</span>
              <span className="text-xs text-blue-500 font-medium">Faster</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '28%' }} />
            </div>
          </div>

          {/* Chart Card */}
          <div className="hero-card md:col-span-5 bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#111111]">Revenue Growth</span>
              <span className="text-xs text-green-500 font-medium">+24.5%</span>
            </div>
            <div className="flex items-end gap-1 h-20">
              {[30, 45, 35, 60, 50, 75, 65, 80, 70, 85, 78, 90].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div 
                    className="w-full bg-[#2563EB] rounded-t-sm transition-all duration-500" 
                    style={{ height: `${h}%`, opacity: 0.3 + (i / 20) }} 
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>Jan</span>
              <span>Jun</span>
              <span>Dec</span>
            </div>
          </div>

          {/* Big Number Card */}
          <div className="hero-card md:col-span-4 md:row-span-2 bg-white rounded-2xl p-6 border-4 border-[#1A1A1A] relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] transition-shadow duration-200">
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold text-[#1A1A1A] mb-2">2,000+</div>
              <p className="text-sm text-gray-500 mb-4">Schools Using Zamifu Analytics</p>
            </div>
            <div className="flex justify-center gap-2 mb-4">
              {['CBE', '8-4-4'].map((tag, i) => (
                <span key={i} className="text-xs bg-[#E6F24B] px-3 py-1 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
            <div className="bg-[#E6F24B]/30 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-[#1A1A1A]">All-in-one</div>
              <p className="text-xs text-gray-600">School operations, analytics, and communication</p>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#E6F24B] rounded-full opacity-20" />
          </div>

          {/* Calendar Card */}
          <div className="hero-card md:col-span-4 bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] transition-shadow duration-200">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#2563EB] font-mono tabular-nums">{formatTime(currentTime)}</div>
              <div className="text-sm text-gray-500 mb-3">{formatDate(currentTime)}</div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <div key={i} className="text-gray-400 font-medium">{d}</div>
                ))}
                {Array.from({ length: adjustedFirstDay }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <div 
                    key={i} 
                    className={`py-1 rounded ${i + 1 === today ? 'bg-[#2563EB] text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
