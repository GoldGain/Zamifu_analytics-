import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

type Row = { id: string; user_name: string | null; user_email: string | null; phone_number: string; amount: number; requested_at: string };
const kes = (n?: number | null) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (v?: string | null) => (v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function ReferralPayouts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [refs, setRefs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('list_pending_withdrawals');
    if (error) toast.error(error.message); else setRows((data || []) as Row[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const markPaid = async (row: Row) => {
    setBusy(row.id);
    const { data, error } = await (supabase as any).rpc('mark_withdrawal_paid', { p_request_id: row.id, p_reference: (refs[row.id] || '').trim() || null });
    setBusy('');
    if (error) return toast.error(error.message);
    const result = data as any;
    if (!result?.ok) {
      if (result?.reason === 'insufficient_balance') return toast.error('This wallet no longer covers the amount.');
      if (result?.reason === 'not_allowed') return toast.error('Only a reseller admin can release payouts.');
      return toast.error('That payout could not be completed.');
    }
    toast.success('Marked as paid. The amount has been deducted from the wallet.');
    load();
  };

  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Referral Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">Send the money by M-Pesa first, then mark the request as paid. Marking it paid clears the amount from the user&apos;s referral wallet.</p>
        </div>
        <button type="button" onClick={load} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pending requests</p><p className="mt-2 text-3xl font-bold">{loading ? '—' : rows.length}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total to send</p><p className="mt-2 text-3xl font-bold text-[#2563EB]">{loading ? '—' : kes(total)}</p></div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50"><tr>{['User', 'Phone number', 'Amount', 'Requested', 'M-Pesa code', 'Action'].map((h) => <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-3 py-8 text-center"><Loader2 className="mx-auto w-5 h-5 animate-spin" /></td></tr>
            : rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">No pending withdrawal requests.</td></tr>
            : rows.map((row) => (
              <tr key={row.id} className="border-t align-middle">
                <td className="px-3 py-3"><div className="font-medium">{row.user_name || 'User'}</div><div className="text-xs text-gray-500">{row.user_email || ''}</div></td>
                <td className="px-3 py-3 whitespace-nowrap">{row.phone_number}</td>
                <td className="px-3 py-3 font-semibold whitespace-nowrap">{kes(row.amount)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{when(row.requested_at)}</td>
                <td className="px-3 py-3"><input value={refs[row.id] || ''} onChange={(e) => setRefs((c) => ({ ...c, [row.id]: e.target.value }))} placeholder="QJ72XXXX" className="w-36 border rounded-lg px-2 py-1.5 text-xs" /></td>
                <td className="px-3 py-3"><button type="button" onClick={() => markPaid(row)} disabled={busy === row.id} className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Mark as Paid</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
