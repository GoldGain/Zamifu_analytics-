import { Link } from 'react-router';
import { ArrowRight, GraduationCap } from 'lucide-react';

export default function CTA() {
  return (
    <section className="py-16 md:py-20 bg-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="bg-[#2563EB] rounded-3xl p-8 md:p-16 text-center relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-[#E6F24B]/30 rounded-full" />
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Ready to Transform Your School?
            </h2>
            <p className="text-white/80 max-w-2xl mx-auto mb-8 text-lg">
              Join 2,000+ schools across Kenya already using Zamifu Analytics to streamline management, improve communication, and enhance learning outcomes.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/register-school"
                className="inline-flex items-center gap-2 bg-white text-[#2563EB] px-8 py-3.5 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                Register Your School <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 border-2 border-white text-white px-8 py-3.5 rounded-full text-sm font-bold hover:bg-white/10 transition-colors"
              >
                Login to Your School
              </Link>
            </div>
            <p className="text-white/60 text-sm mt-4">Create an account to configure your school workspace.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
