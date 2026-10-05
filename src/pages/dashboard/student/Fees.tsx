import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { AlertTriangle, Receipt, Download } from 'lucide-react';
import { formatClassStream } from '@/lib/class-label';
import { calculateReceiptBalance, downloadFeeReceiptPdf } from '@/lib/feeReceiptPdf';

export default function StudentFees() {
  const { user, schoolData } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receiptInvoices, setReceiptInvoices] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [studentRecord, setStudentRecord] = useState<any | null>(null);
  const [studentClass, setStudentClass] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    const { data: student } = await supabaseUntyped.from('students')
      .select('id, school_id, first_name, last_name, admission_number, assessment_number, class_id, stream_id')
      .eq('profile_id', user?.id).eq('school_id', user?.schoolId).single();
    if (student) {
      const [{ data: invoiceRows }, { data: allInvoiceRows }, { data: paymentRows }, { data: classRow }] = await Promise.all([
        supabaseUntyped.from('fee_invoices').select('*, terms(name)').eq('student_id', student.id).eq('school_id', student.school_id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabaseUntyped.from('fee_invoices').select('id, total_amount, academic_year, term_id, terms(name, academic_year)').eq('student_id', student.id).eq('school_id', student.school_id),
        supabaseUntyped.from('fee_payments').select('id, invoice_id, student_id, amount, payment_method, mpesa_reference, receipt_number, payment_date, notes').eq('student_id', student.id).eq('school_id', student.school_id).order('payment_date', { ascending: false }),
        student.stream_id || student.class_id
          ? supabaseUntyped.from('classes').select('id, name, stream, stream_name').eq('id', student.stream_id || student.class_id).eq('school_id', student.school_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setStudentRecord(student);
      setStudentClass(classRow || null);
      setInvoices(invoiceRows || []);
      setReceiptInvoices(allInvoiceRows || []);
      setPaymentHistory(paymentRows || []);
    } else {
      setStudentRecord(null);
      setStudentClass(null);
      setInvoices([]);
      setReceiptInvoices([]);
      setPaymentHistory([]);
    }
    setLoading(false);
  }, [user?.id, user?.schoolId]);

  useEffect(() => { void fetchFees(); }, [fetchFees]);

  const downloadPaymentReceipt = (payment: any) => {
    if (!studentRecord) return;
    const invoice = receiptInvoices.find((item: any) => item.id === payment.invoice_id);
    const sameInvoicePayments = paymentHistory.filter((item: any) => item.invoice_id === payment.invoice_id);
    const balance = calculateReceiptBalance(payment, Number(invoice?.total_amount || 0), sameInvoicePayments);
    const term = invoice?.terms;
    downloadFeeReceiptPdf({
      schoolName: schoolData?.name,
      learnerName: `${studentRecord.first_name || ''} ${studentRecord.last_name || ''}`.trim(),
      admissionNumber: studentRecord.admission_number,
      className: studentClass ? formatClassStream(studentClass) : '—',
      termName: term?.name,
      academicYear: term?.academic_year || invoice?.academic_year,
      amountPaid: Number(payment.amount || 0),
      paymentDate: payment.payment_date,
      receiptNumber: payment.receipt_number || `RCP-${String(payment.id || '').slice(0, 8)}`,
      paymentMethod: payment.payment_method,
      reference: payment.mpesa_reference || payment.reference || payment.notes,
      previousBalance: balance.previousBalance,
      newBalance: balance.newBalance,
    });
  };

  const totalBalance = invoices.reduce((s, i) => s + Number(i.balance ?? Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0))), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
  const totalDue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);

  const statusColor = (status: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700';
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#111111]">My Fees</h1><p className="text-sm text-[#666666]">View your fee statement</p></div>

      {/* Fee Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-lg font-bold text-blue-600">Ksh {totalDue.toLocaleString()}</div>
            <div className="text-xs text-blue-400 mt-1">Total Due</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="text-lg font-bold text-green-600">Ksh {totalPaid.toLocaleString()}</div>
            <div className="text-xs text-green-400 mt-1">Amount Paid</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="text-lg font-bold text-red-600">Ksh {totalBalance.toLocaleString()}</div>
            <div className="text-xs text-red-400 mt-1">Balance</div>
          </div>
        </div>
      </div>

      {/* Important Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800">Payment Information</p>
          <p className="text-xs text-yellow-600 mt-1">Fees are paid physically at school (cash, bank, or M-Pesa directly to the school). This page is for viewing only. Contact the school admin for payment.</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Term</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Total</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Paid</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Balance</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Status</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="text-center py-8 text-sm text-[#666666]">Loading...</td></tr> :
               invoices.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-sm text-[#666666]">No fee records</td></tr> :
               invoices.map(inv => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4"><div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{inv.terms?.name} {inv.academic_year}</span>
                  </div></td>
                  <td className="px-6 py-4 text-sm">Ksh {inv.total_amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-green-600">Ksh {inv.amount_paid?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-red-500">Ksh {inv.balance?.toLocaleString()}</td>
                  <td className="px-6 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor(inv.status)} capitalize`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History & Receipts */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-[#111111]">Payment History & Receipts</h2>
          <p className="mt-1 text-xs text-[#666666]">Download a receipt for any payment recorded by the school.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Date</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Receipt</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Term</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Method</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Amount</th>
              <th className="text-right text-xs font-medium text-[#666666] uppercase px-6 py-4">Action</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center py-8 text-sm text-[#666666]">Loading payment history…</td></tr> :
               paymentHistory.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-sm text-[#666666]">No payment history</td></tr> :
               paymentHistory.map((payment: any) => {
                 const invoice = receiptInvoices.find((item: any) => item.id === payment.invoice_id);
                 return <tr key={payment.id} className="border-b border-gray-50 hover:bg-gray-50">
                   <td className="px-6 py-4 text-sm">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}</td>
                   <td className="px-6 py-4 text-sm">{payment.receipt_number || `RCP-${String(payment.id || '').slice(0, 8)}`}</td>
                   <td className="px-6 py-4 text-sm">{invoice?.terms?.name || '—'} {invoice?.terms?.academic_year || invoice?.academic_year || ''}</td>
                   <td className="px-6 py-4 text-sm capitalize">{payment.payment_method || '—'}</td>
                   <td className="px-6 py-4 text-sm font-semibold text-green-600">Ksh {Number(payment.amount || 0).toLocaleString()}</td>
                   <td className="px-6 py-4 text-right"><button type="button" onClick={() => downloadPaymentReceipt(payment)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Download className="h-3.5 w-3.5" /> Download receipt</button></td>
                 </tr>;
               })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
