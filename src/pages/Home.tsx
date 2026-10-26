import Features from '@/sections/Features';
import HowItWorks from '@/sections/HowItWorks';
import Testimonials from '@/sections/Testimonials';
import FAQ from '@/sections/FAQ';
import CTA from '@/sections/CTA';
import { usePWA } from '@/hooks/usePWA';
import { Smartphone, Phone, Mail, ArrowUpRight } from 'lucide-react';
import SEO from '@/components/SEO';
import StudentCarousel from '@/components/StudentCarousel';
import PathwayFinder from '@/components/PathwayFinder';
import InterestsSection from '@/components/InterestsSection';
import ZamifuLearnLink from '@/components/ZamifuLearnLink';

export default function Home() {
  const { isInstallable, isInstalled, install } = usePWA();
  const handleInstallClick = async () => {
    if (isInstalled) { alert('Zamifu Analytics is already installed on your device!'); return; }
    await install();
  };
  return <>
    <SEO title="Zamifu Analytics - Intelligent School Management System" description="Zamifu Analytics is Kenya's intelligent school management system for learners, assessments, fees and report cards." path="/" structuredData={{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Zamifu Analytics', url: 'https://zamifu.company', description: 'Intelligent school management for Kenyan schools.', applicationCategory: 'EducationApplication', operatingSystem: 'Web', inLanguage: 'en-KE', offers: { '@type': 'Offer', price: '0', priceCurrency: 'KES' }, author: { '@type': 'Organization', name: 'Zamifu Analytics', url: 'https://zamifu.company' } }} />
    {isInstallable && <button onClick={handleInstallClick} className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 font-medium hover:bg-green-700"><Smartphone className="w-4 h-4" /> Download App</button>}
    <StudentCarousel />
    <section className="bg-emerald-950 text-white"><div className="container mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Learn, revise and practise</p><h2 className="mt-2 text-2xl md:text-3xl font-bold">Zamifu Learn is ready for every learner.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">AI tutoring, source-aligned revision notes, live lessons, games and printable examinations in one learner and teacher workspace.</p></div><ZamifuLearnLink className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-50" /><ArrowUpRight className="hidden" /></div></section>
    <InterestsSection /><PathwayFinder /><Features /><HowItWorks /><Testimonials /><FAQ />
    <section className="py-12 bg-gray-50"><div className="container mx-auto px-4 text-center"><h2 className="text-2xl font-bold mb-4">Contact Us</h2><div className="flex flex-col items-center gap-2 mb-4"><p className="text-gray-600 flex items-center gap-2"><Phone className="w-4 h-4" /> <strong>Phone:</strong> 0712644205</p><p className="text-gray-600 flex items-center gap-2"><Mail className="w-4 h-4" /> <strong>Email:</strong> tutorsultimate@gmail.com</p></div><a href="https://wa.me/254712644205" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600">Chat on WhatsApp</a></div></section>
    <CTA />
  </>;
}
