import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { School, Users, DollarSign, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

interface ResellerStats {
  totalSchools: number;
  totalStudents: number;
  totalRevenue: number;
  resellerName: string;
  parentPayEnabled: boolean;
}

export default function ResellerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ResellerStats>({
    totalSchools: 0,
    totalStudents: 0,
    totalRevenue: 0,
    resellerName: '',
    parentPayEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [recentSchools, setRecentSchools] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get reseller record for this user
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!resellerData) {
        setLoading(false);
        return;
      }

      setResellerId(resellerData.id);

      // Get schools for this reseller only
      const { data: schools, count: schoolsCount } = await supabase
        .from('schools')
        .select('*', { count: 'exact' })
        .eq('reseller_id', resellerData.id);

      // Get students for this reseller's schools
      const schoolIds = (schools || []).map((s: any) => s.id);
      let studentsCount = 0;
      if (schoolIds.length > 0) {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .in('school_id', schoolIds);
        studentsCount = count || 0;
      }

      // Get revenue for this reseller
      const { data: payments } = await supabase
        .from('parent_payments')
        .select('amount')
        .eq('reseller_id', resellerData.id)
        .eq('status', 'success');
      const totalRevenue = (payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      setStats({
        totalSchools: schoolsCount || 0,
        totalStudents: studentsCount,
        totalRevenue,
        resellerName: resellerData.name,
        parentPayEnabled: resellerData.parent_pay_enabled,
      });
      setRecentSchools((schools || []).slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'My Schools', value: stats.totalSchools, icon: <School className="w-6 h-6" />, color: 'bg-blue-500', link: '/reseller-admin/schools' },
    { label: 'My Students', value: stats.totalStudents, icon: <Users className="w-6 h-6" />, color: 'bg-green-500', link: '/reseller-admin/students' },
    { label: 'My Revenue (KES)', value: stats.totalRevenue.toLocaleString(), icon: <DollarSign className="w-6 h-6" />, color: 'bg-yellow-500', link: '/reseller-admin/payments' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {stats.resellerName ? `${stats.resellerName}'s Dashboard` : 'Reseller Dashboard'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Zamifu Analytics — Your schools only</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>


      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <Link key={card.label} to={card.link} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`${card.color} text-white rounded-xl p-3`}>{card.icon}</div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent Schools */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">My Schools</h2>
              <Link to="/reseller-admin/schools" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
            {recentSchools.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No schools yet. <Link to="/reseller-admin/schools" className="text-blue-600 hover:underline">Add your first school</Link></p>
            ) : (
              <div className="space-y-2">
                {recentSchools.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.county || 'Kenya'} · {s.subscription_plan}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
