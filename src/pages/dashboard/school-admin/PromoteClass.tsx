import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle, GraduationCap, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { promoteSchoolToNextTerm } from '@/lib/term-promotion';

type ClassRow = { id: string; name: string; level: number | null; grade_level: number | null; stream: string | null };

function nextTermFor(currentTerm: any) {
  const name = String(currentTerm?.name || 'Term 1');
  const year = Number(currentTerm?.academic_year || new Date().getFullYear());
  if (!currentTerm) return { name: 'Term 1', year };
  if (/term\s*1/i.test(name)) return { name: 'Term 2', year };
  if (/term\s*2/i.test(name)) return { name: 'Term 3', year };
  return { name: 'Term 1', year: year + 1 };
}

const levelOf = (c?: ClassRow) => Number(c?.level ?? c?.grade_level ?? 0);

export default function PromoteClass() {
  const { user } = useAuth();

  // ── Term promotion (calendar only) ─────────────────────────────────────────
  const [currentTerm, setCurrentTerm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // ── Learner promotion (class to class, or graduate the final class) ────────
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [busy, setBusy] = useState(false);
  const [classConfirm, setClassConfirm] = useState<null | 'promote' | 'graduate'>(null);
  const [lastResult, setLastResult] = useState<{ kind: 'promote' | 'graduate'; text: string } | null>(null);
  const [classError, setClassError] = useState('');

  const loadCurrentTerm = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data, error } = await supabaseUntyped.from('terms').select('id, name, academic_year, start_date, end_date').eq('school_id', user.schoolId).eq('is_current', true).maybeSingle();
    if (error) toast.error('Could not load current term: ' + error.message);
    setCurrentTerm(data);
    setLoading(false);
  };

  const loadClasses = async () => {
    if (!user?.schoolId) return;
    const { data, error } = await supabaseUntyped.from('classes')
      .select('id, name, level, grade_level, stream')
      .eq('school_id', user.schoolId)
      .order('level');
    if (error) { setClassError('Could not load classes: ' + error.message); return; }
    setClasses((data || []) as ClassRow[]);
  };

  useEffect(() => { void loadCurrentTerm(); void loadClasses(); }, [user?.schoolId]);

  const promoteTerm = async () => {
    if (!user?.schoolId) return;
    setPromoting(true);
    try {
      const promoted = await promoteSchoolToNextTerm(user.schoolId);
      toast.success(`Moved the school to ${promoted.next_term_name} ${promoted.next_academic_year}. Learners stay in their classes.`);
      setConfirming(false);
      await loadCurrentTerm();
    } catch (error: any) {
      toast.error('Could not promote term: ' + error.message);
    } finally {
      setPromoting(false);
    }
  };

  const from = classes.find((c) => c.id === fromClassId);
  const to = classes.find((c) => c.id === toClassId);
  const topLevel = classes.reduce((max, c) => Math.max(max, levelOf(c)), 0);
  const fromIsFinal = Boolean(from) && levelOf(from) === topLevel && topLevel > 0;
  const canPromote = Boolean(from && to && levelOf(to) > levelOf(from));
  // Grade 9 (CBE) and Form 3 (8-4-4) finish school: no destination class exists.
  const isGraduationClass = (cls: any) => {
    if (!cls) return false;
    const name = String(cls.name || '').toLowerCase();
    const level = Number(cls.level ?? cls.grade_level ?? 0);
    return level === 9 || /\bgrade\s*9\b/.test(name) || /\bform\s*3\b/.test(name) || /\bform\s*three\b/.test(name);
  };
  const fromGraduates = Boolean(from) && (isGraduationClass(from) || fromIsFinal);

  const runClassAction = async (mode: 'promote' | 'graduate') => {
    setBusy(true);
    setClassError('');
    try {
      const { data: { session } } = await supabaseUntyped.auth.getSession();
      const res = await fetch('/api/promote-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ mode, fromClassId, toClassId: mode === 'graduate' ? fromClassId : toClassId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setClassError(`[${res.status}] ${json.error || 'The server did not explain why.'}`); setBusy(false); return; }
      const result = json.result || {};
      if (mode === 'graduate') {
        setLastResult({ kind: 'graduate', text: `${result.graduated} learner(s) graduated from ${result.class_name}.` });
        toast.success(`${result.graduated} learner(s) graduated from ${result.class_name}.`);
      } else {
        setLastResult({ kind: 'promote', text: `${result.moved} learner(s) moved from ${result.from_class} to ${result.to_class}.` });
        toast.success(`${result.moved} learner(s) moved to ${result.to_class}.`);
      }
      setClassConfirm(null);
      await loadClasses();
    } catch (err) {
      setClassError(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBusy(false);
  };

  const next = nextTermFor(currentTerm);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">School Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Promotion</h1>
        <p className="mt-1 text-sm text-gray-500">Move learners to the next class, graduate the final class, or advance the school term.</p>
      </div>

      {/* ── Learners: next class or graduation ─────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Users className="h-5 w-5 text-purple-600" /> Promote learners</h2>
        <p className="mt-1 text-sm text-gray-600">
          Moves <strong>every active learner</strong> in one class in a single action. Each learner keeps their history:
          the old class is stored and the promotion date recorded. Results stay attached to the assessment they were entered for.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Current class</span>
            <select value={fromClassId} onChange={(e) => { setFromClassId(e.target.value); setToClassId(''); setLastResult(null); setClassError(''); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select the class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>
              ))}
            </select>
          </label>
          {!fromGraduates && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Move them to</span>
              <select value={toClassId} onChange={(e) => { setToClassId(e.target.value); setLastResult(null); setClassError(''); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">Select the next class</option>
                {classes.filter((c) => !from || levelOf(c) > levelOf(from)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {fromGraduates && (
          <p className="mt-3 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-900">
            {from?.name} is a graduation class. Learners finish school here, so there is no destination class — they are
            marked as graduated and moved to the Graduated Learners list. Their results stay in the system.
          </p>
        )}
        {from && to && !canPromote && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">The target class must be a higher level than {from.name}.</p>
        )}
        {classError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{classError}</p>
        )}
        {lastResult && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{lastResult.text}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {!fromGraduates && (
            <button type="button" onClick={() => setClassConfirm('promote')} disabled={!canPromote || busy}
              className="rounded-full bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              Promote whole class
            </button>
          )}
          {fromGraduates && (
            <button type="button" onClick={() => setClassConfirm('graduate')} disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              <GraduationCap className="h-4 w-4" /> Graduate learners from {from?.name}
            </button>
          )}
        </div>
      </div>

      {/* ── Term promotion (calendar only) ────────────────────────────────── */}
      {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div> : (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><CalendarDays className="h-5 w-5 text-purple-600" /> Promote next term</h2>
          <div className="mt-3 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <p><strong>Calendar only.</strong> This changes which term is current for fees, results and attendance. It does not move or promote any learner.</p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 rounded-xl border bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Current term</p>
              <p className="text-lg font-bold text-gray-900">{currentTerm?.name || 'No current term'} {currentTerm?.academic_year || ''}</p>
            </div>
            <ArrowRight className="h-6 w-6 flex-shrink-0 text-purple-500" />
            <div className="flex-1 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs text-purple-600">Next term</p>
              <p className="text-lg font-bold text-purple-800">{next.name} {next.year}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle className="mr-2 inline h-4 w-4" /> Learners stay in their current classes.
          </div>
          <button type="button" onClick={() => setConfirming(true)} disabled={promoting}
            className="mt-5 w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50">
            Promote to {next.name} {next.year}
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Confirm term promotion</h2>
            <p className="mt-3 text-sm text-gray-600">This makes <strong>{next.name} {next.year}</strong> the current term. No learner is moved or promoted.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium">Cancel</button>
              <button type="button" onClick={() => void promoteTerm()} disabled={promoting} className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {promoting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm promotion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {classConfirm && from && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">
              {classConfirm === 'graduate' ? `Graduate ${from.name}?` : `Promote ${from.name} to ${to?.name}?`}
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              {classConfirm === 'graduate'
                ? `Every active learner in ${from.name} will be marked as graduated today and removed from the active roll. Their results stay in the system.`
                : `Every active learner in ${from.name} will move to ${to?.name}. Their previous class and promotion date are recorded, and their results are untouched.`}
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setClassConfirm(null)} className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium">Cancel</button>
              <button type="button" onClick={() => void runClassAction(classConfirm)} disabled={busy}
                className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                {busy ? 'Working…' : 'Yes, continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
