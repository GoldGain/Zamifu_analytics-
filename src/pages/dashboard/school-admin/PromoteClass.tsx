import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Loader2, CheckCircle, CalendarDays, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

function nextTermFor(currentTerm: any) {
  const name = String(currentTerm?.name || 'Term 1');
  const year = Number(currentTerm?.academic_year || new Date().getFullYear());
  if (/term\s*1/i.test(name)) return { name: 'Term 2', year };
  if (/term\s*2/i.test(name)) return { name: 'Term 3', year };
  return { name: 'Term 1', year: year + 1 };
}

export default function PromoteClass() {
  const { user } = useAuth();
  const [currentTerm, setCurrentTerm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadCurrentTerm = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data, error } = await supabaseUntyped.from('terms').select('id, name, academic_year, start_date, end_date').eq('school_id', user.schoolId).eq('is_current', true).maybeSingle();
    if (error) toast.error('Could not load current term: ' + error.message);
    setCurrentTerm(data);
    setLoading(false);
  };

  useEffect(() => { void loadCurrentTerm(); }, [user?.schoolId]);

  const promoteTerm = async () => {
    if (!user?.schoolId) return;
    setPromoting(true);
    try {
      const next = nextTermFor(currentTerm);
      const { data: terms, error: termsError } = await supabaseUntyped.from('terms').select('id, name, academic_year').eq('school_id', user.schoolId);
      if (termsError) throw termsError;

      const existing = (terms || []).find((term: any) => term.name === next.name && String(term.academic_year) === String(next.year));
      const { error: deactivateError } = await supabaseUntyped.from('terms').update({ is_current: false }).eq('school_id', user.schoolId).eq('is_current', true);
      if (deactivateError) throw deactivateError;

      if (existing) {
        const { error } = await supabaseUntyped.from('terms').update({ is_current: true }).eq('id', existing.id).eq('school_id', user.schoolId);
        if (error) throw error;
      } else {
        const start = new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + 90);
        const { error } = await supabaseUntyped.from('terms').insert({
          school_id: user.schoolId,
          name: next.name,
          academic_year: String(next.year),
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          is_current: true,
        });
        if (error) throw error;
      }
      toast.success(`Successfully moved the school from ${currentTerm?.name || 'the current term'} to ${next.name} ${next.year}. Students remain in their classes.`);
      setConfirming(false);
      await loadCurrentTerm();
    } catch (error: any) {
      toast.error('Could not promote term: ' + error.message);
    } finally {
      setPromoting(false);
    }
  };

  const next = nextTermFor(currentTerm);
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">School Admin</p><h1 className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2"><CalendarDays className="w-7 h-7 text-purple-600" /> Promote Next Term</h1><p className="text-sm text-gray-500 mt-1">Advance the school calendar to the next academic term. This does not move, promote, or change any students.</p></div>
      {loading ? <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div> : <>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-3 text-sm text-blue-900"><AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" /><div><p className="font-bold mb-1">Term promotion only</p><p>Promoting next term changes which term is current for fees, results, attendance, and other school records. Students remain in their existing classes and their student profiles are not changed.</p></div></div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"><p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Term transition</p><div className="mt-4 flex items-center gap-3"><div className="flex-1 rounded-xl bg-gray-50 border p-4"><p className="text-xs text-gray-500">Current term</p><p className="text-lg font-bold text-gray-900">{currentTerm?.name || 'No current term'} {currentTerm?.academic_year || ''}</p></div><ArrowRight className="w-6 h-6 text-purple-500 flex-shrink-0" /><div className="flex-1 rounded-xl bg-purple-50 border border-purple-200 p-4"><p className="text-xs text-purple-600">Next term</p><p className="text-lg font-bold text-purple-800">{next.name} {next.year}</p></div></div><div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800"><CheckCircle className="inline w-4 h-4 mr-2" /> Students will remain in their current classes.</div><button type="button" onClick={() => setConfirming(true)} disabled={promoting || !currentTerm} className="mt-6 w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50">Promote to {next.name} {next.year}</button></div>
      </>}
      {confirming && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"><h2 className="text-lg font-bold text-gray-900">Confirm term promotion</h2><p className="mt-3 text-sm text-gray-600">This will make <strong>{next.name} {next.year}</strong> the current term. It will not promote students or change their classes.</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium">Cancel</button><button type="button" onClick={() => void promoteTerm()} disabled={promoting} className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{promoting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm promotion'}</button></div></div></div>}
    </div>
  );
}
