import { useEffect, useMemo, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, GraduationCap, Loader2, Search, Filter, Undo2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface GraduatedStudent {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  admission_number: string;
  gender?: string;
  class_id?: string;
  previous_class_id?: string;
  status?: string;
  learner_status?: string;
  graduation_year?: number | null;
  graduation_date?: string | null;
  academic_year?: string;
  kjsea_score?: string | null;
  kcse_score?: string | null;
  classes?: { name?: string; level?: number } | null;
  previous_class?: { name?: string } | null;
}

export default function GraduatedStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<GraduatedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (user?.schoolId) fetchGraduates();
  }, [user?.schoolId]);

  const fetchGraduates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseUntyped
        .from('students')
        .select(
          'id, first_name, last_name, middle_name, admission_number, gender, class_id, previous_class_id, status, learner_status, graduation_year, graduation_date, academic_year, kjsea_score, kcse_score, classes:class_id(name, level)'
        )
        .eq('school_id', user?.schoolId)
        // Graduates are is_active = false by definition, so filtering on is_active
        // here hid every graduate. One .or() only: PostgREST accepts a single one.
        .or('status.eq.graduated,learner_status.ilike.%graduat%')
        .order('graduation_date', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Keep only true graduates (status graduated or learner_status contains graduate)
      const rows = (data || []).filter((s: any) => {
        const status = (s.status || '').toLowerCase();
        const learner = (s.learner_status || '').toLowerCase();
        return status === 'graduated' || learner.includes('graduat');
      });
      setStudents(rows);
    } catch (err: any) {
      toast.error('Failed to load graduated students: ' + err.message);
    }
    setLoading(false);
  };

  const years = useMemo(() => {
    const set = new Set<number>();
    students.forEach((s) => {
      if (s.graduation_year) set.add(s.graduation_year);
      else if (s.graduation_date) set.add(new Date(s.graduation_date).getFullYear());
    });
    return [...set].sort((a, b) => b - a);
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const hay = `${s.first_name} ${s.last_name} ${s.admission_number}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return false;
      if (yearFilter !== 'all') {
        const y = s.graduation_year || (s.graduation_date ? new Date(s.graduation_date).getFullYear() : null);
        if (String(y) !== yearFilter) return false;
      }
      if (levelFilter !== 'all') {
        const level = (s.classes as any)?.level;
        if (levelFilter === 'primary' && level > 9) return false;
        if (levelFilter === 'secondary' && level <= 9) return false;
      }
      return true;
    });
  }, [students, search, yearFilter, levelFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) filtered.forEach((s) => next.delete(s.id));
    else filtered.forEach((s) => next.add(s.id));
    return next;
  });
  const performUndo = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setUndoing(true);
    try {
      const { data: { session } } = await supabaseUntyped.auth.getSession();
      const res = await fetch('/api/promote-class', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ mode: 'undo', studentIds: ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'The server did not explain why.');
      const restored = Number(json.result?.restored || 0);
      toast.success(`${restored} learner(s) moved back to their active class.`);
      setSelected(new Set());
      setConfirmOpen(false);
      await fetchGraduates();
    } catch (err: any) {
      toast.error('Could not undo graduation: ' + (err?.message || 'Unknown error'));
    } finally { setUndoing(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GraduationCap className="w-7 h-7 text-indigo-600" /> Graduated Students
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Alumni who exited at Grade 9 or Grade 12 / Form 4. Filter by graduation year.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Total graduates</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" /> {students.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600">Search</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or admission number"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Graduation year
            </label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div className="sm:w-48">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Level
            </label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">All levels</option>
              <option value="primary">Primary (Grade 9)</option>
              <option value="secondary">Secondary (Form 4)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-600">{selected.size > 0 ? `${selected.size} learner(s) selected` : 'Select a learner to undo their graduation'}</p>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Clear</button>
            )}
            <button type="button" onClick={() => setConfirmOpen(true)} disabled={selected.size === 0 || undoing}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Undo2 className="h-4 w-4" /> Undo Graduation
            </button>
          </div>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No graduated students found. Use <strong>Promote Grade</strong> on Grade 9 or Grade 12 / Form 4 to graduate a class.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" aria-label="Select all visible learners" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Adm No.</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Gender</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Last class</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Grad year</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">KJSEA</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">KCSE</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Grad date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const year = s.graduation_year || (s.graduation_date ? new Date(s.graduation_date).getFullYear() : '—');
                  return (
                    <tr key={s.id} className={selected.has(s.id) ? 'border-t border-gray-50 bg-amber-50/60' : 'border-t border-gray-50 hover:bg-slate-50/70'}>
                      <td className="px-4 py-3">
                        <input type="checkbox" aria-label={`Select ${s.first_name} ${s.last_name}`} checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.admission_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {s.first_name} {s.middle_name ? `${s.middle_name} ` : ''}{s.last_name}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">{s.gender || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{(s.classes as any)?.name || '—'}</td>
                      <td className="px-4 py-3">{year}</td>
                      <td className="px-4 py-3 text-center">
                        {s.kjsea_score ? <span className="font-bold text-indigo-600">{s.kjsea_score}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.kcse_score ? <span className="font-bold text-indigo-600">{s.kcse_score}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.graduation_date ? new Date(s.graduation_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
            </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-5 w-5" /></span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Undo graduation?</h2>
                <p className="mt-2 text-sm text-gray-600">Are you sure you want to revert this graduation? The learner will be moved back to their active class.</p>
                <p className="mt-2 text-xs text-gray-500">{selected.size} learner(s) will return to their last class and appear on the active roll again. Their results are not touched.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={undoing} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void performUndo()} disabled={undoing} className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{undoing ? 'Reverting…' : 'Yes, undo graduation'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
