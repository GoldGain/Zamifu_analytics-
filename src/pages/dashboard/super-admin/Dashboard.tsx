import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { School, Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface Stats {
  totalSchools: number;
  activeSchools: number;
  totalStudents: number;
  totalTeachers: number;
}

interface SchoolRecord {
  id: string;
  name: string;
  code: string;
  subscription_plan: string;
  status: string;
  county: string;
  principal_name: string;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalSchools: 0, activeSchools: 0, totalStudents: 0, totalTeachers: 0 });
  const [loading, setLoading] = useState(true);
  const [recentSchools, setRecentSchools] = useState<SchoolRecord[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { count: schoolsCount } = await supabase.from('schools').select('*', { count: 'exact', head: true });
      const { count: activeCount } = await supabase.from('schools').select('*', { count: 'exact', head: true }).eq('status', 'active');
      const { count: studentsCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).or('is_active.eq.true,is_active.is.null');
      const { count: teachersCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
      
      setStats({
        totalSchools: schoolsCount || 0,
        activeSchools: activeCount || 0,
        totalStudents: studentsCount || 0,
        totalTeachers: teachersCount || 0,
      });

      const { data: schools } = await supabase.from('schools').select('*').order('created_at', { ascending: false }).limit(5);
      setRecentSchools((schools || []) as unknown as SchoolRecord[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Schools', value: stats.totalSchools, icon: <School className="w-5 h-5" />, color: 'bg-blue-500', trend: '+12%' },
    { label: 'Active Schools', value: stats.activeSchools, icon: <CheckCircle className="w-5 h-5" />, color: 'bg-green-500', trend: '+8%' },
    { label: 'Total Students', value: stats.totalStudents, icon: <Users className="w-5 h-5" />, color: 'bg-purple-500', trend: '+15%' },
    { label: 'Total Teachers', value: stats.totalTeachers, icon: <Users className="w-5 h-5" />, color: 'bg-orange-500', trend: '+10%' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Super Admin Dashboard</h1>
          <p className="text-sm text-[#666666]">Platform overview and analytics</p>
        </div>
        <div className="text-sm text-[#666666]">
          Welcome, <span className="font-medium text-[#111111]">{user?.firstName} {user?.lastName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center text-white`}>
                {card.icon}
              </div>
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <TrendingUp className="w-3 h-3" /> {card.trend}
              </span>
            </div>
            <div className="text-2xl font-bold text-[#111111]">{loading ? '...' : card.value.toLocaleString()}</div>
            <div className="text-xs text-[#666666] mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="text-lg font-semibold text-[#111111] mb-4">Platform Growth</h3>
          <div className="flex items-end gap-2 h-48">
            {[20, 35, 25, 45, 40, 60, 55, 70, 65, 80, 75, 90].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-[#2563EB] rounded-t-lg transition-all duration-500 hover:bg-[#1d4ed8]"
                  style={{ height: `${h}%`, opacity: 0.4 + (i * 0.05) }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-[#666666]">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="text-lg font-semibold text-[#111111] mb-4">Subscription Plans</h3>
          <div className="space-y-4">
            {[
              { plan: 'Basic', count: 15, color: 'bg-gray-400', width: '30%' },
              { plan: 'Pro', count: 28, color: 'bg-[#2563EB]', width: '56%' },
              { plan: 'Premium', count: 8, color: 'bg-[#E6F24B]', width: '16%' },
              { plan: 'Trial', count: 12, color: 'bg-orange-400', width: '24%' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-[#111111]">{item.plan}</span>
                  <span className="text-[#666666]">{item.count} schools</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: item.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#111111]">Recent Schools</h3>
          <Link to="/super-admin/schools" className="text-sm text-[#2563EB] hover:underline">View All</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-[#666666] uppercase pb-3">School</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase pb-3">Code</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase pb-3">Plan</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase pb-3">Status</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase pb-3">County</th>
              </tr>
            </thead>
            <tbody>
              {recentSchools.map((school) => (
                <tr key={school.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center text-white text-xs font-bold">
                        {school.name?.[0]}
                      </div>
                      <span className="text-sm font-medium text-[#111111]">{school.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-sm text-[#666666]">{school.code}</td>
                  <td className="py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      school.subscription_plan === 'premium' ? 'bg-purple-100 text-purple-700' :
                      school.subscription_plan === 'pro' ? 'bg-blue-100 text-blue-700' :
                      school.subscription_plan === 'basic' ? 'bg-gray-100 text-gray-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {school.subscription_plan}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`flex items-center gap-1 text-xs font-medium ${
                      school.status === 'active' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {school.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {school.status}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-[#666666]">{school.county}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
