import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Search, Filter, RefreshCw } from 'lucide-react';

interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  school_id: string;
  school_name?: string;
  reseller_name?: string;
  gender: string;
  created_at: string;
}

export default function MasterAdminStudents() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterReseller, setFilterReseller] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [resellers, setResellers] = useState<{ id: string; name: string }[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string; reseller_id: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, schoolsRes, resellersRes] = await Promise.all([
      supabase.from('students').select('*').or('is_active.eq.true,is_active.is.null').order('created_at', { ascending: false }).limit(500),
      supabase.from('schools').select('id, name, reseller_id'),
      supabase.from('resellers').select('id, name'),
    ]);

    const schoolMap: Record<string, { name: string; reseller_id: string }> = {};
    (schoolsRes.data || []).forEach((s: any) => { schoolMap[s.id] = { name: s.name, reseller_id: s.reseller_id }; });

    const resellerMap: Record<string, string> = {};
    (resellersRes.data || []).forEach((r: any) => { resellerMap[r.id] = r.name; });

    setResellers(resellersRes.data || []);
    setSchools(schoolsRes.data || []);

    const enriched = (studentsRes.data || []).map((s: any) => ({
      ...s,
      school_name: schoolMap[s.school_id]?.name || '—',
      reseller_name: resellerMap[schoolMap[s.school_id]?.reseller_id] || 'Platform',
    }));
    setStudents(enriched);
    setLoading(false);
  };

  const filteredSchools = filterReseller ? schools.filter(s => s.reseller_id === filterReseller) : schools;

  const filtered = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchSearch = !search || fullName.includes(search.toLowerCase()) || s.admission_number?.toLowerCase().includes(search.toLowerCase());
    const matchReseller = !filterReseller || s.reseller_name === resellers.find(r => r.id === filterReseller)?.name;
    const matchSchool = !filterSchool || s.school_id === filterSchool;
    return matchSearch && matchReseller && matchSchool;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Students</h1>
          <p className="text-gray-500 text-sm mt-1">View all students across all resellers and schools</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission number..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterReseller} onChange={e => { setFilterReseller(e.target.value); setFilterSchool(''); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Resellers</option>
          {resellers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Schools</option>
          {filteredSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No students found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Admission No.</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Reseller</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.admission_number}</td>
                    <td className="px-4 py-3">{s.school_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{s.reseller_name}</span>
                    </td>
                    <td className="px-4 py-3 capitalize">{s.gender}</td>
                    <td className="px-4 py-3 text-gray-500">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-400 border-t">Showing {filtered.length} of {students.length} students</div>
          </div>
        )}
      </div>
    </div>
  );
}
