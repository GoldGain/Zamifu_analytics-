import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';

type UsageRow = {
  id: string;
  school_id: string;
  transaction_type: string;
  credits: number;
  sms_segments: number | null;
  status: string;
  recipient_phone: string | null;
  message: string | null;
  created_at: string;
  schools?: { name?: string | null } | null;
};

const formatNumber = (value: number) => value.toLocaleString('en-KE');

export default function ResellerSmsUsage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsage = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: reseller, error: resellerError } = await supabaseUntyped
        .from('resellers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (resellerError) throw resellerError;
      if (!reseller?.id) throw new Error('Reseller account not found.');

      const { data, error } = await supabaseUntyped
        .from('school_sms_transactions')
        .select('id, school_id, transaction_type, credits, sms_segments, status, recipient_phone, message, created_at, schools(name)')
        .eq('transaction_type', 'debit')
        .eq('metadata->>sponsored_by', 'reseller')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data || []) as UsageRow[]);
    } catch (error: any) {
      console.error('[reseller-sms-usage]', error);
      toast.error(error?.message || 'Unable to load SMS usage.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsage(); }, [user]);

  const totalUsed = useMemo(() => rows.reduce((sum, row) => sum + Number(row.sms_segments || Math.abs(row.credits || 0)), 0), [rows]);
  const successful = useMemo(() => rows.filter((row) => row.status === 'success').length, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><MessageSquare className="text-blue-600" /> SMS Usage</h1>
          <p className="mt-1 text-sm text-slate-500">Review SMS sent to schools in your reseller portfolio and the number of SMS segments used.</p>
        </div>
        <button type="button" onClick={() => void loadUsage()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-medium text-blue-700">SMS used</p><p className="mt-2 text-3xl font-bold text-blue-950">{formatNumber(totalUsed)}</p><p className="mt-1 text-xs text-blue-700">Message segments sent</p></div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-sm font-medium text-emerald-700">Successful messages</p><p className="mt-2 text-3xl font-bold text-emerald-950">{formatNumber(successful)}</p><p className="mt-1 text-xs text-emerald-700">Delivered or accepted by provider</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-500">Usage records</p><p className="mt-2 text-3xl font-bold text-slate-950">{formatNumber(rows.length)}</p><p className="mt-1 text-xs text-slate-500">Sponsored audit records</p></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><BarChart3 className="h-5 w-5 text-blue-600" /><h2 className="font-semibold text-slate-900">Sent SMS log</h2></div>
        {loading ? <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading usage…</div> : rows.length === 0 ? <p className="px-6 py-14 text-center text-sm text-slate-500">No reseller SMS usage has been recorded yet.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">School</th><th className="px-5 py-3">Recipient</th><th className="px-5 py-3">Message</th><th className="px-5 py-3">SMS used</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 align-top"><td className="whitespace-nowrap px-5 py-3 text-slate-500">{new Date(row.created_at).toLocaleString()}</td><td className="px-5 py-3 font-medium text-slate-800">{row.schools?.name || 'School'}</td><td className="px-5 py-3 text-slate-600">{row.recipient_phone || '—'}</td><td className="max-w-sm px-5 py-3 text-slate-600">{row.message || '—'}</td><td className="px-5 py-3 font-semibold text-slate-800">{row.sms_segments || Math.abs(row.credits || 0)}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{row.status}</span></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
