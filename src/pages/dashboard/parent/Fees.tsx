import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { CreditCard, AlertTriangle, Receipt, Loader2, CheckCircle, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: Record<string, any>) => { openIframe: () => void };
    };
  }
}

const THEOPHILLUS_OWNER_ID = '7e1a65d1-6443-4ba8-8dc9-c6a91ecd1eb1';

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) { existing.addEventListener('load', () => resolve()); existing.addEventListener('error', () => reject(new Error('Failed to load Paystack.'))); return; }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js'; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Failed to load Paystack.'));
    document.body.appendChild(script);
  });
}

interface FeeStatement {
  term: string;
  academicYear: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: string;
  payments: any[];
}

export default function ParentFees() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [schoolPayment, setSchoolPayment] = useState<any>(null);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [generatingStatement, setGeneratingStatement] = useState(false);
  const [allTerms, setAllTerms] = useState<any[]>([]);

  useEffect(() => { fetchChildren(); }, [user?.id]);

  const fetchChildren = async () => {
    if (!user?.id) return;
    const { data: linked } = await supabaseUntyped.from('parent_student_links').select('*, students(first_name, last_name, id, school_id, admission_number, class_id)').eq('parent_id', user.id);
    if (linked) {
      const kids = linked.map((l: any) => l.students).filter(Boolean);
      setChildren(kids);
      if (kids.length > 0) fetchFees(kids[0].id, kids);
    }
  };

  const fetchSchoolPaymentConfig = async (schoolId?: string) => {
    if (!schoolId) { setSchoolPayment(null); return; }
    const { data, error } = await supabaseUntyped.from('schools').select('id, name, owner_id, paystack_public_key, paystack_enabled, paystack_currency').eq('id', schoolId).single();
    if (error || !data) { setSchoolPayment(null); return; }
    const enabledForTheophillus = data.owner_id === THEOPHILLUS_OWNER_ID && data.paystack_enabled === true && typeof data.paystack_public_key === 'string' && data.paystack_public_key.trim().startsWith('pk_');
    setSchoolPayment({ ...data, enabledForTheophillus });
    setSchoolName(data.name || '');
  };

  const fetchFees = async (childId: string, kidsOverride?: any[]) => {
    const list = kidsOverride || children;
    const child = list.find((c: any) => c.id === childId);
    setSelectedChild(child);
    await fetchSchoolPaymentConfig(child?.school_id);

    const [{ data: invData }, { data: termsData }] = await Promise.all([
      supabaseUntyped.from('fee_invoices').select('*, terms(name, academic_year), fee_payments(*)').eq('student_id', childId).order('created_at', { ascending: false }),
      supabaseUntyped.from('terms').select('*').eq('school_id', child?.school_id).order('academic_year', { ascending: false }),
    ]);
    setInvoices(invData || []);
    setAllTerms(termsData || []);
  };

  const refreshCurrentChild = async () => { if (selectedChild?.id) await fetchFees(selectedChild.id); };

  const handlePaystackPayment = async (invoice: any) => {
    if (!user?.email) { toast.error('Your account email is required.'); return; }
    if (!schoolPayment?.enabledForTheophillus) { toast.error('Online payment is not enabled.'); return; }
    const amount = Number(invoice.balance || 0); if (amount <= 0) { toast.success('Already paid.'); return; }
    setPayingInvoice(invoice.id);
    try {
      await loadPaystackScript();
      const reference = `CBE-${invoice.id.slice(0, 8)}-${Date.now()}`;
      const handler = window.PaystackPop!.setup({
        key: schoolPayment.paystack_public_key, email: user.email,
        amount: Math.round(amount * 100), currency: schoolPayment.paystack_currency || 'KES', ref: reference,
        metadata: { invoice_id: invoice.id, school_id: invoice.school_id, student_id: invoice.student_id, parent_id: user.id, school_name: schoolPayment.name },
        callback: async (response: any) => {
          try {
            const paidAmount = amount;
            const newAmountPaid = Number(invoice.amount_paid || 0) + paidAmount;
            const newBalance = Math.max(0, Number(invoice.total_amount || 0) - newAmountPaid);
            const nextStatus = newBalance <= 0 ? 'paid' : 'partial';
            const { error: paymentError } = await supabaseUntyped.from('fee_payments').insert({
              school_id: invoice.school_id, invoice_id: invoice.id, student_id: invoice.student_id,
              amount: paidAmount, payment_method: 'other', reference_number: response.reference || reference,
              payment_date: new Date().toISOString(), notes: 'Paystack parent payment',
            });
            if (paymentError) throw new Error(paymentError.message);
            await supabaseUntyped.from('fee_invoices').update({ amount_paid: newAmountPaid, balance: newBalance, status: nextStatus }).eq('id', invoice.id);
            toast.success('Payment recorded successfully.'); await refreshCurrentChild();
          } catch (err: any) { toast.error(`Payment succeeded but recording failed: ${err.message}`); }
          finally { setPayingInvoice(null); }
        },
        onClose: () => { setPayingInvoice(null); toast.info('Payment window closed.'); },
      });
      handler.openIframe();
    } catch (err: any) { setPayingInvoice(null); toast.error(err.message || 'Unable to start Paystack.'); }
  };

  const generateFeeStatementPDF = async () => {
    if (!selectedChild || invoices.length === 0) { toast.error('No fee data to generate statement'); return; }
    setGeneratingStatement(true);
    try {
      const doc = new jsPDF();

      // Header
      doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(schoolName || 'School', 105, 15, { align: 'center' });
      doc.setFontSize(12); doc.setFont('helvetica', 'normal');
      doc.text('OFFICIAL FEE STATEMENT', 105, 25, { align: 'center' });

      // Student info
      doc.setTextColor(0, 0, 0); doc.setFontSize(11);
      doc.text(`Student: ${selectedChild.first_name} ${selectedChild.last_name}`, 14, 48);
      doc.text(`Admission No: ${selectedChild.admission_number || 'N/A'}`, 14, 56);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 48);

      doc.setDrawColor(37, 99, 235); doc.line(14, 62, 196, 62);

      // Fee breakdown table
      const tableData = invoices.map((inv: any) => [
        `${inv.terms?.name || ''} ${inv.terms?.academic_year || ''}`,
        `Ksh ${(inv.total_amount || 0).toLocaleString()}`,
        `Ksh ${(inv.amount_paid || 0).toLocaleString()}`,
        `Ksh ${(inv.balance || Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0))).toLocaleString()}`,
        inv.status || 'unpaid',
      ]);

      autoTable(doc, {
        startY: 68,
        head: [['Term', 'Total Amount', 'Amount Paid', 'Balance', 'Status']],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // Payment history
      const allPayments: any[] = [];
      invoices.forEach((inv: any) => {
        if (inv.fee_payments) {
          inv.fee_payments.forEach((p: any) => {
            allPayments.push({
              term: `${inv.terms?.name || ''} ${inv.terms?.academic_year || ''}`,
              date: p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'N/A',
              amount: p.amount || 0,
              method: p.payment_method || 'other',
              reference: p.reference_number || p.mpesa_reference || p.receipt_number || 'N/A',
            });
          });
        }
      });

      if (allPayments.length > 0) {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT HISTORY', 14, finalY);

        autoTable(doc, {
          startY: finalY + 5,
          head: [['Term', 'Date', 'Amount', 'Method', 'Reference']],
          body: allPayments.map(p => [p.term, p.date, `Ksh ${p.amount.toLocaleString()}`, p.method.toUpperCase(), p.reference]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 255] },
        });
      }

      const summaryY = ((doc as any).lastAutoTable?.finalY || finalY) + 15;

      // Summary
      const totalBalance = invoices.reduce((s, i) => s + (i.balance || Math.max(0, (i.total_amount || 0) - (i.amount_paid || 0))), 0);
      const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
      const totalDue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);

      doc.setFillColor(245, 247, 255); doc.rect(14, summaryY, 182, 30, 'F');
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text(`Total Amount Due: Ksh ${totalDue.toLocaleString()}`, 20, summaryY + 10);
      doc.text(`Total Amount Paid: Ksh ${totalPaid.toLocaleString()}`, 100, summaryY + 10);
      doc.text(`Current Outstanding Balance: Ksh ${totalBalance.toLocaleString()}`, 20, summaryY + 22);

      if (totalBalance <= 0) {
        doc.setTextColor(22, 163, 74);
        doc.text('✓ ALL FEES PAID', 140, summaryY + 22);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text('⚠ BALANCE OUTSTANDING', 140, summaryY + 22);
      }

      // Footer
      doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
      doc.text('This is an official fee statement from Zamifu Analytics School Management System.', 105, 285, { align: 'center' });
      doc.text('For inquiries, please contact the school administration.', 105, 290, { align: 'center' });

      doc.save(`fee_statement_${selectedChild.first_name}_${selectedChild.last_name}_${Date.now()}.pdf`);
      toast.success('Fee Statement PDF downloaded!');
    } catch (err: any) {
      toast.error('Failed to generate statement: ' + err.message);
      console.error(err);
    }
    setGeneratingStatement(false);
  };

  const totalBalance = invoices.reduce((s, i) => s + (i.balance || 0), 0);
  const canPayOnline = Boolean(schoolPayment?.enabledForTheophillus);

  const statusColor = (status: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700';
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Fee Balances</h1>
          <p className="text-sm text-[#666666]">View your children's fee status and download statements</p>
        </div>
        {selectedChild && invoices.length > 0 && (
          <button
            onClick={generateFeeStatementPDF}
            disabled={generatingStatement}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {generatingStatement ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generatingStatement ? 'Generating...' : 'Download Fee Statement'}
          </button>
        )}
      </div>

      {canPayOnline ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">Online Paystack Payment Enabled</p>
            <p className="text-xs text-green-600 mt-1">Pay your fees securely online through Paystack.</p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Physical Payment Only</p>
            <p className="text-xs text-yellow-600 mt-1">Contact the school office for cash, bank, or M-Pesa payment instructions.</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {children.map((child, i) => (
          <button key={i} onClick={() => fetchFees(child.id)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${selectedChild?.id === child.id ? 'bg-[#2563EB] text-white' : 'bg-white text-[#111111] shadow-sm hover:bg-gray-50'}`}>
            <span className="text-sm font-medium">{child.first_name} {child.last_name}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><CreditCard className="w-6 h-6 text-red-500" /></div>
          <div>
            <p className="text-sm text-[#666666]">Total Outstanding Balance</p>
            <p className="text-2xl font-bold text-red-500">Ksh {totalBalance.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Term</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Total</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Paid</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Balance</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Status</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Action</th>
            </tr></thead>
            <tbody>
              {invoices.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-sm text-[#666666]">No fee records</td></tr> :
               invoices.map(inv => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><Receipt className="w-4 h-4 text-gray-400" /><span className="text-sm">{inv.terms?.name} {inv.terms?.academic_year}</span></div></td>
                  <td className="px-6 py-4 text-sm">Ksh {inv.total_amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-green-600">Ksh {inv.amount_paid?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-red-500">Ksh {inv.balance?.toLocaleString()}</td>
                  <td className="px-6 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor(inv.status)} capitalize`}>{inv.status}</span></td>
                  <td className="px-6 py-4">
                    {canPayOnline && Number(inv.balance || 0) > 0 ? (
                      <button onClick={() => handlePaystackPayment(inv)} disabled={payingInvoice === inv.id} className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#1d4ed8] disabled:opacity-50">
                        {payingInvoice === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                        Pay with Paystack
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{inv.status === 'paid' ? 'Paid' : 'Office payment'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
