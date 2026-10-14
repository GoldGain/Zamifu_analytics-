/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react';
import { Download, Receipt, RefreshCw, CreditCard, BadgeCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DEFAULT_ANNUAL_FEE_PER_LEARNER, feeOrDefault } from '@/lib/reseller';

type Payment = {
  id: string;
  school_name: string | null;
  learners_count: number | null;
  fee_per_learner: number | null;
  amount: number;
  currency: string | null;
  term_label: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  status: string | null;
  paid_by_email: string | null;
  paid_by_name: string | null;
  created_at: string | null;
};

type SchoolPricing = {
  fee_per_learner_per_term: number | null;
  fee_per_learner_per_year: number | null;
  currency: string | null;
};

export default function SubscriptionReceipts() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [schoolPricing, setSchoolPricing] = useState<SchoolPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const [paymentsResponse, pricingResponse] = await Promise.all([
      supabase
        .from('school_subscription_payments')
        .select('id, school_name, learners_count, fee_per_learner, amount, currency, term_label, payment_reference, payment_method, status, paid_by_email, paid_by_name, created_at')
        .eq('school_id', user.schoolId)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseUntyped
        .from('schools')
        .select('fee_per_learner_per_term, fee_per_learner_per_year, currency')
        .eq('id', user.schoolId)
        .maybeSingle(),
    ]);
    const { data, error } = paymentsResponse;
    if (pricingResponse.error) toast.error(pricingResponse.error.message || 'Could not load current subscription pricing');
    if (error) toast.error(error.message || 'Could not load payment receipts');
    setPayments((data || []) as Payment[]);
    setSchoolPricing(pricingResponse.data as SchoolPricing | null);
    setLoading(false);
  }, [user?.schoolId]);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  const downloadReceipt = async (payment: Payment) => {
    setDownloadingId(payment.id);
    try {
      const pdf = new jsPDF();
      const currency = payment.currency || 'KES';
      pdf.setFontSize(20);
      pdf.setTextColor(37, 99, 235);
      pdf.text('Zamifu Analytics', 20, 24);
      pdf.setFontSize(14);
      pdf.setTextColor(17, 24, 39);
      pdf.text('Subscription Payment Receipt', 20, 36);
      pdf.setFontSize(10);
      pdf.setTextColor(75, 85, 99);
      pdf.text(`Receipt date: ${payment.created_at ? new Date(payment.created_at).toLocaleString() : '—'}`, 20, 48);
      pdf.text(`Payment reference: ${payment.payment_reference || '—'}`, 20, 55);
      pdf.line(20, 62, 190, 62);
      pdf.setFontSize(11);
      pdf.setTextColor(17, 24, 39);
      const rows = [
        ['School', payment.school_name || '—'],
        ['Plan / period', payment.term_label || 'Subscription'],
        ['Learners billed', String(payment.learners_count ?? '—')],
        ['Fee per learner', `${currency} ${(payment.fee_per_learner || 0).toLocaleString()}`],
        ['Payment method', payment.payment_method || '—'],
        ['Paid by', payment.paid_by_name || payment.paid_by_email || '—'],
        ['Status', 'Successful'],
        ['Total paid', `${currency} ${Number(payment.amount || 0).toLocaleString()}`],
      ];
      rows.forEach(([label, value], index) => {
        const y = 76 + index * 12;
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(value, 75, y);
      });
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text('Thank you for subscribing to Zamifu Analytics.', 20, 190);
      pdf.save(`zamifu-receipt-${payment.payment_reference || payment.id}.pdf`);
      toast.success('Receipt downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Receipt className="w-6 h-6 text-blue-600" /> Subscription & Receipts</h1>
          <p className="text-sm text-gray-500 mt-1">View your school’s successful subscription payments and download official receipts.</p>
        </div>
        <button type="button" onClick={() => void loadPayments()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 flex items-start gap-3"><CreditCard className="w-5 h-5 mt-0.5" /><p>Receipts become available after Paystack successfully verifies a subscription payment.</p></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-emerald-950">Your school’s current subscription rate</h2>
            <p className="mt-1 text-sm text-emerald-800">The fee is set by your reseller and is used to calculate the platform subscription at checkout. It is separate from fees your school charges learners.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Per learner · per term</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{schoolPricing ? `${schoolPricing.currency || 'KES'} ${feeOrDefault(schoolPricing.fee_per_learner_per_term).toLocaleString()}` : 'Loading…'}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Per learner · per year</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{schoolPricing ? `${schoolPricing.currency || 'KES'} ${feeOrDefault(schoolPricing.fee_per_learner_per_year, DEFAULT_ANNUAL_FEE_PER_LEARNER).toLocaleString()}` : 'Loading…'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? <div className="p-10 text-center text-gray-500">Loading receipts…</div> : payments.length === 0 ? <div className="p-10 text-center text-gray-500">No successful subscription payments have been recorded yet.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr className="text-left text-gray-500"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Receipt</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b last:border-0"><td className="px-4 py-3">{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</td><td className="px-4 py-3 font-mono text-xs">{payment.payment_reference || '—'}</td><td className="px-4 py-3">{payment.term_label || 'Subscription'}<div className="text-xs text-gray-500">{payment.learners_count ?? '—'} learners</div></td><td className="px-4 py-3 text-right font-semibold">{payment.currency || 'KES'} {Number(payment.amount || 0).toLocaleString()}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => void downloadReceipt(payment)} disabled={downloadingId === payment.id} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Download className="w-3.5 h-3.5" />{downloadingId === payment.id ? 'Preparing…' : 'Download'}</button></td></tr>)}</tbody></table></div>
        )}
      </div>
    </div>
  );
}
