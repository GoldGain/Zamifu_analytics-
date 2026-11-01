import { useEffect, useState } from 'react';
import { Loader2, Printer, Sparkles } from 'lucide-react';

type Paper = {
  title?: string;
  instructions?: string;
  questions?: { question_number?: number; question_text?: string; marks?: number; answer?: string }[];
};

const GRADES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies', 'Agriculture and Nutrition', 'Pre-Technical Studies', 'Creative Arts and Sports', 'Christian Religious Education'];

declare global {
  interface Window { PaystackPop?: { setup: (options: Record<string, unknown>) => { openIframe: () => void } } }
}

/** Public exam paper: KES 20, paid with Paystack, no account needed. */
export default function PublicPaperGate() {
  const [gradeLevel, setGradeLevel] = useState('Grade 9');
  const [subject, setSubject] = useState('Mathematics');
  const [marks, setMarks] = useState(50);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [paper, setPaper] = useState<Paper | null>(null);

  useEffect(() => {
    if (document.getElementById('paystack-inline')) return;
    const script = document.createElement('script');
    script.id = 'paystack-inline';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const start = async () => {
    setError('');
    setBusy('Starting your paper…');
    try {
      const initRes = await fetch('/api/public-exam-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, gradeLevel, marks, email, format: 'cbe', term: 'Term 1' }),
      });
      const init = await initRes.json();
      if (!initRes.ok) throw new Error(init.error || 'Could not start that purchase.');

      const publicKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey || !window.PaystackPop) throw new Error('Card payment is not available right now. Please try again shortly.');

      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: email || 'learner@zamifu.company',
        amount: init.amountKobo,
        currency: 'KES',
        ref: init.reference,
        callback: async () => {
          try {
            setBusy('Confirming your payment…');
            const verifyRes = await fetch('/api/verify-public-exam-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: init.reference }),
            });
            const verified = await verifyRes.json();
            if (!verifyRes.ok || !verified.ticketToken) throw new Error(verified.error || 'Payment not confirmed yet.');

            setBusy('Writing your paper… this takes about 20 seconds.');
            const genRes = await fetch('/api/public-generate-paper', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticketToken: verified.ticketToken }),
            });
            const generated = await genRes.json();
            if (!genRes.ok || !generated.paper) throw new Error(generated.error || 'The paper could not be written.');
            setPaper(generated.paper);
            setBusy('');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong after payment.');
            setBusy('');
          }
        },
        onClose: () => { setBusy(''); setError('Payment window closed before it completed.'); },
      });
      handler.openIframe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start that purchase.');
      setBusy('');
    }
  };

  return (
    <section className="bg-white py-14">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Exam generator</p>
          <h2 className="mt-2 text-2xl font-bold text-emerald-950 md:text-3xl">Generate a full exam paper — KES 20</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-900/80">
            No account needed. Choose the class and learning area, pay with M-Pesa or card, and the paper is written for you
            with a marking scheme. Keep it, print it, share it with your class.
          </p>

          {!paper && (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-emerald-950">Class</span>
                <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-emerald-950">Learning area</span>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-emerald-950">Marks</span>
                <select value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  {[30, 50, 70, 100].map((m) => <option key={m} value={m}>{m} marks</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-emerald-950">Email (for the receipt)</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2" />
              </label>
            </div>
          )}

          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {!paper && (
            <button onClick={start} disabled={Boolean(busy)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60 md:w-auto">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {busy}</> : <><Sparkles className="h-4 w-4" /> Generate my paper — KES 20</>}
            </button>
          )}

          {paper && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-emerald-950">{paper.title || `${gradeLevel} ${subject}`}</h3>
                <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white">
                  <Printer className="h-3.5 w-3.5" /> Print / save as PDF
                </button>
              </div>
              {paper.instructions && <p className="mt-2 text-xs italic text-gray-600">{paper.instructions}</p>}
              <ol className="mt-4 space-y-3">
                {(paper.questions || []).map((q, i) => (
                  <li key={i} className="text-sm leading-6 text-gray-800">
                    <span className="font-semibold">{q.question_number ?? i + 1}.</span> {q.question_text}
                    <span className="ml-2 text-xs font-semibold text-emerald-700">({q.marks ?? 1} mark{(q.marks ?? 1) === 1 ? '' : 's'})</span>
                  </li>
                ))}
              </ol>
              <button onClick={() => setPaper(null)} className="mt-5 text-xs font-semibold text-emerald-700 underline">
                Generate another paper
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
