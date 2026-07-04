import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Search, Filter, RefreshCw, Download } from 'lucide-react';
import type { ParentPayment } from '@/types/database';

export default function MasterAdminPayments() {
  const [payments, setPayments] = useState<ParentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterReseller, setFilterReseller] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [resellers, setResellers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [paymentsRes, resellersRes] = await Promise.all([
      supabase.from('parent_payments').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('resellers').select('id, name'),
    ]);
    setPayments((paymentsRes.data || []) as ParentPayment[]);
    setResellers(resellersRes.data || []);
    setLoading(false);
  };

  const filtered = payments.filter(p => {
    const matchSearch = !search || p.parent_name?.toLowerCase().includes(search.toLowerCase()) || p.student_name?.toLowerCase().includes(search.toLowerCase());
    const matchReseller = !filterReseller || p.reseller_id === filterReseller;
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchFrom = !filterFrom || new Date(p.created_at) >= new Date(filterFrom);
    const matchTo = !filterTo || new Date(p.created_at) <= new Date(filterTo + 'T23:59:59');
    return matchSearch && matchReseller && matchStatus && matchFrom && matchTo;
  });

  const totalRevenue = filtered.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0);

  const exportCSV = () => {
    const headers = ['Parent Name', 'Student Name', 'School', 'Reseller', 'Amount (KES)', 'Type', 'Status', 'Date'];
    const rows = filtered.map(p => [
      p.parent_name || '', p.student_name || '', p.school_name || '', p.reseller_name || '',
      p.amount, p.payment_type?.replace('_', ' ') || '', p.status,
      p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zamifu-analytics-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Payments</h1>
          <p className="text-gray-500 text-sm mt-1">Platform-wide parent payment records</p>
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

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
        <div className="text-blue-700">
          <p className="text-sm">Total Revenue (filtered)</p>
          <p className="text-2xl font-bold">KES {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="text-blue-600 text-sm ml-auto">
          {filtered.filter(p => p.status === 'success').length} successful payments
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by parent or student..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterReseller} onChange={e => setFilterReseller(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Resellers</option>
          {resellers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No payments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Reseller</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">{p.parent_name || '—'}</td>
                    <td className="px-4 py-3">{p.student_name || '—'}</td>
                    <td className="px-4 py-3">{p.school_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{p.reseller_name || '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">KES {p.amount}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'success' ? 'bg-green-100 text-green-700' :
                        p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-400 border-t">Showing {filtered.length} payments</div>
          </div>
        )}
      </div>
    </div>
  );
}
