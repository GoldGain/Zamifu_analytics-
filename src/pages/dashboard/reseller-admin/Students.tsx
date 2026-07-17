import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Users } from 'lucide-react';
import { getResellerForUser } from '@/lib/reseller';

export default function ResellerStudents() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('all');
  const [q, setQ] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const reseller = await getResellerForUser(user.id);
    if (reseller) {
      const { data: schoolRows } = await supabase
        .from('schools')
        .select('id, name')
        .eq('reseller_id', reseller.id)
        .order('name');
      const list = schoolRows || [];
      setSchools(list);
      const ids = list.map((s: any) => s.id);
      if (ids.length) {
        const { data: st } = await (supabase as any)
          .from('students')
          .select('id, first_name, last_name, admission_number, school_id, status, class_id, classes(name)')
          .in('school_id', ids)
          .order('created_at', { ascending: false })
          .limit(500);
        setStudents(st || []);
      } else {
        setStudents([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name || '—';

  const rows = useMemo(() => {
    return students.filter((s) => {
      if (schoolId !== 'all' && s.school_id !== schoolId) return false;
      if (!q.trim()) return true;
      const hay = `${s.first_name || ''} ${s.last_name || ''} ${s.admission_number || ''}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [students, schoolId, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Learners
          </h1>
          <p className="text-gray-500 text-sm mt-1">Learners across all schools under your reseller account</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or admission number"
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No learners found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Adm No</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.admission_number || '—'}</td>
                  <td className="px-4 py-3">{schoolName(s.school_id)}</td>
                  <td className="px-4 py-3">{s.classes?.name || '—'}</td>
                  <td className="px-4 py-3 capitalize">{s.status || 'active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
