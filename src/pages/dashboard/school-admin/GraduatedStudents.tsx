import { useEffect, useMemo, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Loader2, Search, Filter, Users } from 'lucide-react';
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
  classes?: { name?: string } | null;
  previous_class?: { name?: string } | null;
}

export default function GraduatedStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<GraduatedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');

  useEffect(() => {
    if (user?.schoolId) fetchGraduates();
  }, [user?.schoolId]);

  const fetchGraduates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseUntyped
        .from('students')
        .select(
          'id, first_name, last_name, middle_name, admission_number, gender, class_id, previous_class_id, status, learner_status, graduation_year, graduation_date, academic_year, classes:class_id(name)'
        )
        .eq('school_id', user?.schoolId)
        .or('status.eq.graduated,learner_status.ilike.%graduat%,is_active.eq.false')
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
      return true;
    });
  }, [students, search, yearFilter]);

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
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
                  <th className="px-4 py-3 font-semibold text-gray-600">Adm No.</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Gender</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Last class</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Grad year</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Grad date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const year = s.graduation_year || (s.graduation_date ? new Date(s.graduation_date).getFullYear() : '—');
                  return (
                    <tr key={s.id} className="border-t border-gray-50 hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs">{s.admission_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {s.first_name} {s.middle_name ? `${s.middle_name} ` : ''}{s.last_name}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">{s.gender || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{(s.classes as any)?.name || '—'}</td>
                      <td className="px-4 py-3">{year}</td>
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
    </div>
  );
}
