import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Users, School, TrendingUp, DollarSign, BarChart3, RefreshCw } from 'lucide-react';

interface PlatformStats {
  totalResellers: number;
  totalSchools: number;
  totalStudents: number;
  totalRevenue: number;
}

export default function MasterAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats>({
    totalResellers: 0,
    totalSchools: 0,
    totalStudents: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [resellersRes, schoolsRes, studentsRes, paymentsRes] = await Promise.all([
        supabase.from('resellers').select('*', { count: 'exact', head: true }),
        supabase.from('schools').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('parent_payments').select('amount').eq('status', 'success'),
      ]);

      const totalRevenue = (paymentsRes.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      setStats({
        totalResellers: resellersRes.count || 0,
        totalSchools: schoolsRes.count || 0,
        totalStudents: studentsRes.count || 0,
        totalRevenue,
      });

      const { data: recent } = await supabase
        .from('parent_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentPayments(recent || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Resellers', value: stats.totalResellers, icon: <Users className="w-6 h-6" />, color: 'bg-purple-500' },
    { label: 'Total Schools', value: stats.totalSchools, icon: <School className="w-6 h-6" />, color: 'bg-blue-500' },
    { label: 'Total Students', value: stats.totalStudents, icon: <Users className="w-6 h-6" />, color: 'bg-green-500' },
    { label: 'Total Revenue (KES)', value: `${stats.totalRevenue.toLocaleString()}`, icon: <DollarSign className="w-6 h-6" />, color: 'bg-yellow-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Platform-wide overview — Zamifu Analytics</p>
        </div>
        <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 border border-gray-100">
                <div className={`${card.color} text-white rounded-xl p-3`}>{card.icon}</div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
            </div>
            {recentPayments.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No payments yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 pr-4">Parent</th>
                      <th className="pb-2 pr-4">Student</th>
                      <th className="pb-2 pr-4">School</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-4">{p.parent_name || '—'}</td>
                        <td className="py-2 pr-4">{p.student_name || '—'}</td>
                        <td className="py-2 pr-4">{p.school_name || '—'}</td>
                        <td className="py-2 pr-4">KES {p.amount}</td>
                        <td className="py-2 pr-4 capitalize">{p.payment_type?.replace('_', ' ')}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'success' ? 'bg-green-100 text-green-700' :
                            p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
