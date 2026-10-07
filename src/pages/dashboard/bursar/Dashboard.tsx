import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CreditCard, Loader2, WalletCards } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';

type FeeSummary = {
  invoiced: number;
  paid: number;
  outstanding: number;
};

const emptySummary: FeeSummary = { invoiced: 0, paid: 0, outstanding: 0 };
const money = (value: number) => `Ksh ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function BursarDashboard() {
  const { user, schoolData } = useAuth();
  const [summary, setSummary] = useState<FeeSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      const schoolId = user?.schoolId;
      if (!schoolId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      const [{ data: invoices, error: invoiceError }, { data: payments, error: paymentError }] = await Promise.all([
        supabaseUntyped
          .from('fee_invoices')
          .select('id, total_amount, amount_paid, balance')
          .eq('school_id', schoolId)
          .is('deleted_at', null),
        supabaseUntyped
          .from('fee_payments')
          .select('invoice_id, amount')
          .eq('school_id', schoolId),
      ]);
      if (cancelled) return;
      if (invoiceError || paymentError) {
        setError(invoiceError?.message || paymentError?.message || 'Unable to load fee totals.');
        setLoading(false);
        return;
      }

      const paidByInvoice = new Map<string, number>();
      (payments || []).forEach((payment: any) => {
        const invoiceId = String(payment.invoice_id || '');
        if (invoiceId) paidByInvoice.set(invoiceId, (paidByInvoice.get(invoiceId) || 0) + Number(payment.amount || 0));
      });
      const next = (invoices || []).reduce((totals: FeeSummary, invoice: any) => {
        const invoiced = Number(invoice.total_amount || 0);
        const paid = paidByInvoice.has(String(invoice.id))
          ? paidByInvoice.get(String(invoice.id)) || 0
          : Number(invoice.amount_paid || 0);
        const outstanding = Math.max(0, Number(invoice.balance ?? invoiced - paid));
        totals.invoiced += invoiced;
        totals.paid += paid;
        totals.outstanding += outstanding;
        return totals;
      }, { ...emptySummary });
      setSummary(next);
      setLoading(false);
    };
    void loadSummary();
    return () => { cancelled = true; };
  }, [user?.schoolId]);

  const cards = [
    { label: 'Total Invoiced', value: summary.invoiced, icon: <CreditCard className="h-5 w-5" />, color: 'bg-blue-600' },
    { label: 'Total Paid', value: summary.paid, icon: <WalletCards className="h-5 w-5" />, color: 'bg-emerald-600' },
    { label: 'Total Balance', value: summary.outstanding, icon: <AlertCircle className="h-5 w-5" />, color: 'bg-rose-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Bursar Dashboard</h1>
          <p className="mt-1 text-sm text-[#666666]">Fee collection overview for {schoolData?.name || 'your school'}</p>
        </div>
        <Link to="/bursar/fees" className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          Open Fee Management <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white ${card.color}`}>{card.icon}</div>
            <div className="text-2xl font-bold text-[#111111]">{loading ? <Loader2 className="h-6 w-6 animate-spin text-blue-600" /> : money(card.value)}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#666666]">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        <p className="font-semibold">Finance summary</p>
        <p className="mt-1">Use Fee Management to generate invoices, record payments, download receipts, and review learner balances.</p>
      </div>
    </div>
  );
}
