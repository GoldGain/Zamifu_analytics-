import { Link } from 'react-router-dom';
import { ArrowRight, Gift } from 'lucide-react';

export default function ReferralProgram() {
  return (
    <section className="bg-[#0f2e26] text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d98f3a]/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#f0b463]"><Gift className="w-3.5 h-3.5" /> Referral programme</span>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Refer a School &amp; Earn 15% Commission</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100">Know a school that still runs on paper? Introduce them to Zamifu Analytics. When they subscribe, 15% of every subscription payment lands in your wallet — tracked automatically, withdrawn to M-Pesa.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/auth/register" className="inline-flex items-center gap-2 rounded-xl bg-[#d98f3a] px-5 py-3 text-sm font-bold text-[#0f2e26] hover:bg-[#e9a34f]">Refer a school <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/auth/login" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Sign in to get my link</Link>
            </div>
          </div>
          <div className="space-y-3">
            {[
              ['Share your link', 'Every school admin, teacher, bursar and DOS gets a personal referral link and code inside the portal.'],
              ['A school signs up', 'The new school enters your code when it registers, or arrives through your link.'],
              ['You earn 15%', 'Every subscription payment that school makes credits 15% to your wallet, withdrawable to M-Pesa.'],
            ].map(([title, copy], index) => (
              <div key={title} className="flex gap-3 rounded-xl border border-white/15 bg-white/5 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d98f3a] text-sm font-bold text-[#0f2e26]">{index + 1}</div>
                <div><div className="text-sm font-semibold">{title}</div><p className="mt-0.5 text-xs leading-5 text-emerald-100">{copy}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
