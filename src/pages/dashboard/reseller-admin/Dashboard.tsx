import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { School, Users, DollarSign, RefreshCw, Shield, CreditCard } from 'lucide-react';
import { Link } from 'react-router';
import { getResellerForUser, money, feeOrDefault } from '@/lib/reseller';

export default function ResellerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resellerName, setResellerName] = useState('');
  const [stats, setStats] = useState({
    schools: 0,
    students: 0,
    lockedAdmin: 0,
    lockedDos: 0,
    subRevenue: 0,
    parentRevenue: 0,
  });
  const [recentSchools, setRecentSchools] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const reseller = await getResellerForUser(user.id);
      if (!reseller) {
        setLoading(false);
        return;
      }
      setResellerName(reseller.name || '');

      const { data: schools } = await supabase
        .from('schools')
        .select('*')
        .eq('reseller_id', reseller.id)
        .order('created_at', { ascending: false });

      const schoolRows = schools || [];
      const schoolIds = schoolRows.map((s: any) => s.id);
      let studentsCount = 0;
      if (schoolIds.length) {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .in('school_id', schoolIds);
        studentsCount = count || 0;
      }

      const [{ data: parentPays }, { data: subPays }] = await Promise.all([
        supabase.from('parent_payments').select('amount, status, school_name, created_at, payment_type').eq('reseller_id', reseller.id).order('created_at', { ascending: false }).limit(20),
        (supabase as any).from('school_subscription_payments').select('amount, status, school_name, created_at, learners_count').eq('reseller_id', reseller.id).order('created_at', { ascending: false }).limit(20),
      ]);

      const parentRevenue = (parentPays || []).filter((p: any) => p.status === 'success').reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const subRevenue = (subPays || []).filter((p: any) => p.status === 'success').reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

      const merged = [
        ...(parentPays || []).map((p: any) => ({ ...p, source: 'parent' })),
        ...(subPays || []).map((p: any) => ({ ...p, source: 'subscription' })),
      ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 8);

      setStats({
        schools: schoolRows.length,
        students: studentsCount,
        lockedAdmin: schoolRows.filter((s: any) => s.admin_portal_locked).length,
        lockedDos: schoolRows.filter((s: any) => s.dos_portal_locked).length,
        subRevenue,
        parentRevenue,
      });
      setRecentSchools(schoolRows.slice(0, 5));
      setRecentPayments(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const cards = [
    { label: 'My Schools', value: stats.schools, icon: <School className="w-6 h-6" />, color: 'bg-blue-500', link: '/reseller-admin/schools' },
    { label: 'Learners', value: stats.students, icon: <Users className="w-6 h-6" />, color: 'bg-green-500', link: '/reseller-admin/students' },
    { label: 'Subscription revenue', value: money(stats.subRevenue), icon: <CreditCard className="w-6 h-6" />, color: 'bg-indigo-500', link: '/reseller-admin/payments' },
    { label: 'Parent-pay revenue', value: money(stats.parentRevenue), icon: <DollarSign className="w-6 h-6" />, color: 'bg-yellow-500', link: '/reseller-admin/payments' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {resellerName ? `${resellerName} dashboard` : 'Reseller dashboard'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Schools, pricing, payments, and portal access for your network</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
              <Link key={card.label} to={card.link} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`${card.color} text-white rounded-xl p-3`}>{card.icon}</div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-xl font-bold text-gray-900">{card.value}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Link to="/reseller-admin/access-control" className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold">Access control</h2>
              </div>
              <p className="text-sm text-gray-600">
                {stats.lockedAdmin} school admin portal(s) locked · {stats.lockedDos} DoS portal(s) locked
              </p>
              <p className="text-xs text-blue-600 mt-2">Manage locks →</p>
            </Link>
            <Link to="/reseller-admin/pricing" className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-green-600" />
                <h2 className="font-semibold">Pricing</h2>
              </div>
              <p className="text-sm text-gray-600">Set fee per learner per term for each school. Editable anytime.</p>
              <p className="text-xs text-blue-600 mt-2">Edit pricing →</p>
            </Link>
            <Link to="/reseller-admin/payments" className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold">Payments</h2>
              </div>
              <p className="text-sm text-gray-600">Total successful: {money(stats.subRevenue + stats.parentRevenue)}</p>
              <p className="text-xs text-blue-600 mt-2">View all payments →</p>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">My schools</h2>
                <Link to="/reseller-admin/schools" className="text-sm text-blue-600 hover:underline">View all</Link>
              </div>
              {recentSchools.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">
                  No schools yet. <Link to="/reseller-admin/schools" className="text-blue-600 hover:underline">Add your first school</Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {recentSchools.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-gray-500">
                          {s.county || 'Kenya'} · {money(feeOrDefault(s.fee_per_learner_per_term))}/learner/term
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.status}
                        </span>
                        {(s.admin_portal_locked || s.dos_portal_locked) && (
                          <p className="text-[10px] text-red-600">
                            {s.admin_portal_locked ? 'Admin locked' : ''}
                            {s.admin_portal_locked && s.dos_portal_locked ? ' · ' : ''}
                            {s.dos_portal_locked ? 'DoS locked' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent payments</h2>
                <Link to="/reseller-admin/payments" className="text-sm text-blue-600 hover:underline">View all</Link>
              </div>
              {recentPayments.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No payments yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentPayments.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{p.school_name || 'School'}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {p.source} · {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{money(p.amount)}</p>
                        <p className="text-[10px] text-gray-500">{p.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
