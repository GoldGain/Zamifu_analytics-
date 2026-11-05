import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Copy, Loader2, Wallet } from 'lucide-react';

type Row = { id: string; amount: number; phone_number: string; status: string; requested_at: string; processed_at: string | null };
type Ref = { school_name: string | null; status: string; commission_amount: number | null; created_at: string };
type Data = { referral_code: string; balance: number; total_earned: number; schools_referred: number; converted: number; withdrawals: Row[]; recent_referrals: Ref[] };

const kes = (n?: number | null) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function ReferAndEarn() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rpc, error } = await (supabase as any).rpc('referral_dashboard');
    if (error) toast.error(error.message); else setData(rpc as Data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const code = data?.referral_code || '';
  const link = useMemo(() => (code ? `${window.location.origin}/auth/register?ref=${code}` : ''), [code]);
  const balance = Number(data?.balance || 0);

  const copy = async (v: string, label: string) => {
    try { await navigator.clipboard.writeText(v); toast.success(`${label} copied.`); }
    catch { toast.error('Copy failed — copy it manually.'); }
  };

  const withdraw = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return toast.error('Enter the amount you want to withdraw.');
    if (phone.replace(/\D/g, '').length < 9) return toast.error('Enter the M-Pesa phone number to pay.');
    setSending(true);
    const { data: res, error } = await (supabase as any).rpc('request_withdrawal', { p_amount: value, p_phone: phone.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    const result = res as any;
    if (!result?.ok) {
      if (result?.reason === 'insufficient_balance') return toast.error('That is more than your available balance.');
      return toast.error('The withdrawal request could not be created.');
    }
    toast.success('Withdrawal requested. It takes up to 6 hours to reach M-Pesa.');
    setAmount('');
    load();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Refer &amp; Earn</h1>
        <p className="text-sm text-gray-500 mt-1">Share your link. When a school you referred pays its subscription, 15% of every payment is credited to your wallet.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Schools referred</p><p className="mt-2 text-3xl font-bold">{loading ? '—' : data?.schools_referred ?? 0}</p><p className="text-xs text-gray-500 mt-1">{data?.converted ?? 0} paying</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Wallet balance</p><p className="mt-2 text-3xl font-bold text-[#2563EB]">{loading ? '—' : kes(balance)}</p><p className="text-xs text-gray-500 mt-1">Available to withdraw</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total earned</p><p className="mt-2 text-3xl font-bold">{loading ? '—' : kes(data?.total_earned)}</p><p className="text-xs text-gray-500 mt-1">At 15% commission</p></div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Your referral link</h2>
        <div className="grid md:grid-cols-[1fr_auto] gap-2">
          <input readOnly value={link || 'Generating your link…'} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
          <button type="button" onClick={() => copy(link, 'Referral link')} disabled={!link} className="flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Copy className="w-4 h-4" /> Copy link</button>
        </div>
        <div className="grid md:grid-cols-[1fr_auto] gap-2">
          <input readOnly value={code || '—'} className="w-full border rounded-lg px-3 py-2 text-sm font-mono bg-gray-50" />
          <button type="button" onClick={() => copy(code, 'Referral code')} disabled={!code} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"><Copy className="w-4 h-4" /> Copy code</button>
        </div>
        <p className="text-xs text-gray-500">A school can also type your code when it registers. Only the first school registered against your code is credited.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Withdraw to M-Pesa</h2>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Withdrawals take up to 6 hours to process. The money is sent manually by the reseller team — nothing is paid instantly.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-600">Amount (KES)<input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-medium text-gray-600">M-Pesa phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={withdraw} disabled={sending || balance <= 0} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Request withdrawal</button>
          <span className="text-xs text-gray-500">Available: {kes(balance)}</span>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Withdrawal history</h2>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50"><tr>{['Requested', 'Amount', 'Phone', 'Status', 'Paid on'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {(data?.withdrawals || []).length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No withdrawals yet.</td></tr>
            : (data?.withdrawals || []).map((row) => <tr key={row.id} className="border-t"><td className="px-3 py-2">{when(row.requested_at)}</td><td className="px-3 py-2 font-medium">{kes(row.amount)}</td><td className="px-3 py-2">{row.phone_number}</td><td className="px-3 py-2 capitalize">{row.status}</td><td className="px-3 py-2">{when(row.processed_at)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Schools you referred</h2>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50"><tr>{['School', 'Referred on', 'Status', 'Commission'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {(data?.recent_referrals || []).length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Share your link to get your first school.</td></tr>
            : (data?.recent_referrals || []).map((row, i) => <tr key={`${row.school_name}-${i}`} className="border-t"><td className="px-3 py-2 font-medium">{row.school_name || 'School'}</td><td className="px-3 py-2">{when(row.created_at)}</td><td className="px-3 py-2 capitalize">{row.status}</td><td className="px-3 py-2">{row.commission_amount ? kes(row.commission_amount) : '—'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
