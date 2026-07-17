import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Download, Filter } from 'lucide-react';
import { getResellerForUser, money } from '@/lib/reseller';

type Tab = 'all' | 'subscription' | 'parent';

export default function ResellerPayments() {
  const { user } = useAuth();
  const [parentPayments, setParentPayments] = useState<any[]>([]);
  const [subPayments, setSubPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [schoolFilter, setSchoolFilter] = useState('all');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const reseller = await getResellerForUser(user!.id);
    if (reseller) {
      const [{ data: parent }, { data: subs }] = await Promise.all([
        supabase
          .from('parent_payments')
          .select('*')
          .eq('reseller_id', reseller.id)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('school_subscription_payments')
          .select('*')
          .eq('reseller_id', reseller.id)
          .order('created_at', { ascending: false }),
      ]);
      setParentPayments(parent || []);
      setSubPayments(subs || []);
    }
    setLoading(false);
  };

  const unified = useMemo(() => {
    const a = parentPayments.map((p) => ({
      id: `p-${p.id}`,
      source: 'parent' as const,
      school_name: p.school_name || '—',
      party: p.parent_name || p.student_name || '—',
      detail: p.payment_type?.replace(/_/g, ' ') || 'parent pay',
      amount: Number(p.amount || 0),
      status: p.status || '—',
      created_at: p.created_at,
      reference: p.payment_reference || p.reference || '',
    }));
    const b = subPayments.map((p) => ({
      id: `s-${p.id}`,
      source: 'subscription' as const,
      school_name: p.school_name || '—',
      party: p.paid_by_name || p.paid_by_email || 'School',
      detail: `Subscription · ${p.learners_count || 0} learners · ${money(p.fee_per_learner)}/learner`,
      amount: Number(p.amount || 0),
      status: p.status || '—',
      created_at: p.created_at,
      reference: p.payment_reference || '',
    }));
    return [...a, ...b].sort((x, y) => new Date(y.created_at || 0).getTime() - new Date(x.created_at || 0).getTime());
  }, [parentPayments, subPayments]);

  const schools = useMemo(() => {
    const set = new Set<string>();
    unified.forEach((r) => {
      if (r.school_name && r.school_name !== '—') set.add(r.school_name);
    });
    return Array.from(set).sort();
  }, [unified]);

  const rows = unified.filter((r) => {
    if (tab === 'parent' && r.source !== 'parent') return false;
    if (tab === 'subscription' && r.source !== 'subscription') return false;
    if (schoolFilter !== 'all' && r.school_name !== schoolFilter) return false;
    return true;
  });

  const successTotal = rows.filter((r) => r.status === 'success').reduce((s, r) => s + r.amount, 0);
  const subTotal = subPayments.filter((p) => p.status === 'success').reduce((s, p) => s + Number(p.amount || 0), 0);
  const parentTotal = parentPayments.filter((p) => p.status === 'success').reduce((s, p) => s + Number(p.amount || 0), 0);

  const exportCSV = () => {
    const headers = ['Source', 'School', 'Party', 'Detail', 'Amount', 'Status', 'Reference', 'Date'];
    const body = rows.map((r) => [
      r.source,
      r.school_name,
      r.party,
      r.detail,
      r.amount,
      r.status,
      r.reference,
      r.created_at ? new Date(r.created_at).toLocaleString() : '',
    ]);
    const csv = [headers, ...body].map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reseller-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-1">All payments for your schools: platform subscriptions and parent-pay</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700">Total successful</p>
          <p className="text-2xl font-bold text-green-800">{money(successTotal)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700">Subscription payments</p>
          <p className="text-2xl font-bold text-blue-800">{money(subTotal)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">Parent-pay</p>
          <p className="text-2xl font-bold text-amber-800">{money(parentTotal)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'subscription', 'parent'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-sm border ${tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {t === 'all' ? 'All' : t === 'subscription' ? 'Subscriptions' : 'Parent-pay'}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-2 py-1.5 bg-white">
            <option value="all">All schools</option>
            {schools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No payments yet for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 capitalize">{r.source}</td>
                    <td className="px-4 py-3">{r.school_name}</td>
                    <td className="px-4 py-3">{r.party}</td>
                    <td className="px-4 py-3 text-gray-600">{r.detail}</td>
                    <td className="px-4 py-3 font-medium">{money(r.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : r.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
