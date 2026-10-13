import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { BarChart3, TrendingUp, Users, School } from 'lucide-react';

export default function SuperAdminAnalytics() {
  const [stats, setStats] = useState({ schools: 0, students: 0, teachers: 0, results: 0 });
  const [schoolBreakdown, setSchoolBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ count: sc }, { count: st }, { count: tc }, { count: rc }] = await Promise.all([
      supabaseUntyped.from('schools').select('*', { count: 'exact', head: true }),
      supabaseUntyped.from('students').select('*', { count: 'exact', head: true }).or('is_active.eq.true,is_active.is.null'),
      supabaseUntyped.from('teachers').select('*', { count: 'exact', head: true }),
      supabaseUntyped.from('results').select('*', { count: 'exact', head: true }),
    ]);
    setStats({ schools: sc || 0, students: st || 0, teachers: tc || 0, results: rc || 0 });

    const { data: schools } = await supabaseUntyped.from('schools').select('id, name, subscription_plan, status').order('created_at', { ascending: false });
    if (schools) {
      const breakdown = await Promise.all(schools.map(async (school: any) => {
        const [{ count: sCount }, { count: tCount }] = await Promise.all([
          supabaseUntyped.from('students').select('*', { count: 'exact', head: true }).or('is_active.eq.true,is_active.is.null').eq('school_id', school.id),
          supabaseUntyped.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', school.id),
        ]);
        return { ...school, studentCount: sCount || 0, teacherCount: tCount || 0 };
      }));
      setSchoolBreakdown(breakdown);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#111111]">System Analytics</h1><p className="text-sm text-[#666666]">Platform-wide statistics and insights</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Schools', value: stats.schools, icon: <School className="w-5 h-5" />, color: 'bg-blue-500' },
          { label: 'Total Students', value: stats.students, icon: <Users className="w-5 h-5" />, color: 'bg-green-500' },
          { label: 'Total Teachers', value: stats.teachers, icon: <Users className="w-5 h-5" />, color: 'bg-purple-500' },
          { label: 'Total Results', value: stats.results, icon: <TrendingUp className="w-5 h-5" />, color: 'bg-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-white mb-3`}>{s.icon}</div>
            <div className="text-2xl font-bold text-[#111111]">{loading ? '...' : s.value.toLocaleString()}</div>
            <div className="text-xs text-[#666666] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-[#111111] flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#2563EB]" /> School Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">School</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Plan</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Students</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Teachers</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Status</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="text-center py-8 text-sm text-[#666666]">Loading...</td></tr> :
               schoolBreakdown.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-sm text-[#666666]">No schools found</td></tr> :
               schoolBreakdown.map((s: any) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-[#666666] capitalize">{s.subscription_plan || 'basic'}</td>
                  <td className="px-6 py-4 text-sm">{s.studentCount}</td>
                  <td className="px-6 py-4 text-sm">{s.teacherCount}</td>
                  <td className="px-6 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status || 'active'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
