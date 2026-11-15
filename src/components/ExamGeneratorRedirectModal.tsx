import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ArrowRight, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createLearnHandoff } from '@/lib/learn-sso';

const PLANS = [
  { label: 'Day pass', price: '39', note: '24 hours' },
  { label: 'Week', price: '199', note: '7 days' },
  { label: 'Month', price: '599', note: '30 days' },
  { label: 'Annual', price: '4,999', note: 'Best value', highlight: true },
];

export default function ExamGeneratorRedirectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, schoolData } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [open, busy, onClose]);

  if (!open) return null;

  const go = async () => {
    if (!user) { toast.error('Please sign in again before continuing.'); return; }
    setBusy(true);
    try {
      const url = await createLearnHandoff({
        userId: user.id, email: user.email,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        schoolName: schoolData?.name || null, role: user.role, classLevel: null,
      });
      window.location.assign(url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not open Zamifu Learn.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-full items-start justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm sm:items-center"
      role="dialog" aria-modal="true" aria-labelledby="exam-generator-title"
      onClick={() => { if (!busy) onClose(); }}>
      <div className="relative my-4 w-full max-w-lg rounded-3xl bg-white shadow-[0_30px_90px_-20px_rgba(2,6,23,0.65)] ring-1 ring-slate-900/5 sm:my-8"
        onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
          <X className="h-5 w-5" />
        </button>
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ExternalLink className="h-5 w-5" />
            </span>
            <div className="pr-8">
              <h2 id="exam-generator-title" className="text-xl font-black tracking-tight text-slate-900">Opening the Exam Generator</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                You are being redirected to <strong className="text-slate-800">Zamifu Smart Learn</strong>, where the generator lives.
                You will arrive signed in — no second password.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">One subscription covers everything</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              The AI tutor, exam-paper generation and marking, revision notes, topical practice, the library and live lessons.
              You are not paying per paper.
            </p>
          </div>
          <div className="mt-5">
            <p className="text-sm font-bold text-slate-900">Choose a plan inside Zamifu Learn</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PLANS.map((plan) => (
                <div key={plan.label}
                  className={plan.highlight ? 'rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-3 text-center' : 'rounded-2xl border border-slate-200 bg-white p-3 text-center'}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{plan.label}</p>
                  <p className="mt-1 text-lg font-black text-slate-900"><span className="text-[11px] font-bold text-slate-500">KES </span>{plan.price}</p>
                  <p className={plan.highlight ? 'mt-1 text-[11px] font-bold text-emerald-700' : 'mt-1 text-[11px] text-slate-500'}>
                    {plan.highlight && <Check className="mr-0.5 inline h-3 w-3" />}{plan.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 rounded-b-3xl border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 sm:py-2.5">Cancel</button>
          <button type="button" onClick={go} disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 sm:py-2.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Continue to Exam Generator
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
