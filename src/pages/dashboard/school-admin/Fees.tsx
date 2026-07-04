import { useState, useEffect } from 'react';
import { supabaseUntyped } from "@/lib/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Plus, Loader2, CheckCircle, Clock, AlertTriangle, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SchoolAdminFees() {
  const { user, schoolData } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecord, setShowRecord] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [recording, setRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'structures'>('invoices');

  // Fee structure form: multiple fee types per class/term
  const [structureData, setStructureData] = useState({
    class_id: '', term_id: '',
    tuition_fee: '', activity_fee: '', exam_fee: '', other_fee: '',
    description: '',
  });

  // Invoice form
  const [invoiceData, setInvoiceData] = useState({
    student_id: '', term_id: '', total_amount: '', due_date: '',
  });

  // Payment form
  const [paymentData, setPaymentData] = useState({
    student_id: '', invoice_id: '', amount: '',
    payment_method: 'cash' as 'cash' | 'mpesa' | 'bank' | 'cheque' | 'other',
    mpesa_reference: '', notes: '',
  });

  useEffect(() => { fetchData(); }, [user?.schoolId]);

  const fetchData = async () => {
    setLoading(true);
    const schoolId = user?.schoolId;
    if (!schoolId) { setLoading(false); return; }

    const [{ data: inv }, { data: stds }, { data: cls }, { data: trms }, { data: fs }] = await Promise.all([
      supabaseUntyped.from('fee_invoices')
        .select('*, students(first_name, last_name, admission_number), terms(name, academic_year)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
      supabaseUntyped.from('students')
        .select('id, first_name, last_name, admission_number, class_id')
        .eq('school_id', schoolId).eq('is_active', true),
      supabaseUntyped.from('classes')
        .select('id, name, level').eq('school_id', schoolId).order('level'),
      supabaseUntyped.from('terms')
        .select('id, name, academic_year').eq('school_id', schoolId).order('academic_year', { ascending: false }),
      supabaseUntyped.from('fee_structures')
        .select('*, classes(name), terms(name, academic_year)')
        .eq('school_id', schoolId).order('created_at', { ascending: false }),
    ]);

    setInvoices(inv || []);
    setStudents(stds || []);
    setClasses(cls || []);
    setTerms(trms || []);
    setFeeStructures(fs || []);
    setLoading(false);
  };

  // Add fee structure: insert multiple rows (one per fee type)
  const handleAddStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!structureData.class_id || !structureData.term_id) {
      toast.error('Please select class and term');
      return;
    }

    const feeTypes = [
      { type: 'Tuition', amount: parseFloat(structureData.tuition_fee) || 0 },
      { type: 'Activity', amount: parseFloat(structureData.activity_fee) || 0 },
      { type: 'Exam', amount: parseFloat(structureData.exam_fee) || 0 },
      { type: 'Other', amount: parseFloat(structureData.other_fee) || 0 },
    ].filter(f => f.amount > 0);

    if (feeTypes.length === 0) {
      toast.error('Please enter at least one fee amount');
      return;
    }

    const rows = feeTypes.map(f => ({
      school_id: user?.schoolId,
      class_id: structureData.class_id,
      term_id: structureData.term_id,
      academic_year: new Date().getFullYear().toString(),
      fee_type: f.type,
      amount: f.amount,
      is_mandatory: true,
      description: structureData.description || null,
    }));

    const { error } = await supabaseUntyped.from('fee_structures').insert(rows);
    if (error) { toast.error('Failed to add fee structure: ' + error.message); return; }

    toast.success(`Fee structure added! ${feeTypes.length} fee type(s) saved.`);
    setShowStructure(false);
    setStructureData({ class_id: '', term_id: '', tuition_fee: '', activity_fee: '', exam_fee: '', other_fee: '', description: '' });
    fetchData();
  };

  // Generate invoice for a student
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceData.student_id || !invoiceData.term_id) {
      toast.error('Please select student and term');
      return;
    }

    const totalAmount = parseFloat(invoiceData.total_amount) || 0;
    if (totalAmount <= 0) {
      toast.error('Please enter a valid total amount');
      return;
    }

    const { error } = await supabaseUntyped.from('fee_invoices').insert([{
      student_id: invoiceData.student_id,
      school_id: user?.schoolId,
      term_id: invoiceData.term_id,
      academic_year: new Date().getFullYear().toString(),
      total_amount: totalAmount,
      amount_paid: 0,
      status: 'unpaid',
      due_date: invoiceData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }]);

    if (error) { toast.error('Failed to generate invoice: ' + error.message); return; }
    toast.success('Invoice generated successfully!');
    setShowInvoice(false);
    setInvoiceData({ student_id: '', term_id: '', total_amount: '', due_date: '' });
    fetchData();
  };

  // Record payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.student_id || !paymentData.amount) {
      toast.error('Please select a student and enter amount');
      return;
    }
    setRecording(true);
    try {
      // Find or create invoice
      let invoiceId = paymentData.invoice_id;
      let invoice = invoices.find(i => i.id === invoiceId);

      if (!invoiceId) {
        // Get student's latest unpaid invoice
        const { data: existingInv } = await supabaseUntyped
          .from('fee_invoices')
          .select('*')
          .eq('student_id', paymentData.student_id)
          .eq('school_id', user?.schoolId)
          .neq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingInv) {
          invoiceId = existingInv.id;
          invoice = existingInv;
        } else {
          // Create a quick invoice
          const amount = parseFloat(paymentData.amount);
          const term = terms[0]; // Use latest term
          const { data: newInv, error: invErr } = await supabaseUntyped.from('fee_invoices').insert([{
            student_id: paymentData.student_id,
            school_id: user?.schoolId,
            term_id: term?.id,
            academic_year: new Date().getFullYear().toString(),
            total_amount: amount,
            amount_paid: 0,
            status: 'unpaid',
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }]).select().single();
          if (invErr) throw invErr;
          invoiceId = newInv.id;
          invoice = newInv;
        }
      }

      const amount = parseFloat(paymentData.amount);
      const receiptNumber = `RCP-${Date.now()}`;

      // Insert payment
      const { error: payErr } = await supabaseUntyped.from('fee_payments').insert([{
        student_id: paymentData.student_id,
        invoice_id: invoiceId,
        school_id: user?.schoolId,
        amount,
        payment_method: paymentData.payment_method,
        mpesa_reference: paymentData.mpesa_reference || null,
        receipt_number: receiptNumber,
        payment_date: new Date().toISOString(),
        recorded_by: user?.id,
        notes: paymentData.notes || null,
      }]);
      if (payErr) throw payErr;

      // Update invoice balance
      const currentPaid = (invoice?.amount_paid || 0) + amount;
      const currentTotal = invoice?.total_amount || amount;
      const newBalance = Math.max(0, currentTotal - currentPaid);
      const newStatus = newBalance <= 0 ? 'paid' : currentPaid > 0 ? 'partial' : 'unpaid';

      await supabaseUntyped.from('fee_invoices').update({
        amount_paid: currentPaid,
        status: newStatus,
      }).eq('id', invoiceId);

      toast.success(`✅ Payment of Ksh ${amount.toLocaleString()} recorded! Receipt: ${receiptNumber}`);
      generateReceipt(paymentData.student_id, amount, paymentData.payment_method, paymentData.mpesa_reference, receiptNumber);
      setShowRecord(false);
      setPaymentData({ student_id: '', invoice_id: '', amount: '', payment_method: 'cash', mpesa_reference: '', notes: '' });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to record payment: ' + err.message);
    }
    setRecording(false);
  };

  const generateReceipt = (studentId: string, amount: number, method: string, ref: string, receiptNum: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolData?.name || 'School', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('OFFICIAL PAYMENT RECEIPT', 105, 25, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt No: ${receiptNum}`, 14, 50);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 50);
    doc.text(`Student: ${student.first_name} ${student.last_name}`, 14, 62);
    doc.text(`Admission No: ${student.admission_number}`, 14, 72);
    doc.text(`Amount Paid: Ksh ${amount.toLocaleString()}`, 14, 82);
    doc.text(`Payment Method: ${method.toUpperCase()}`, 14, 92);
    if (ref) doc.text(`Reference: ${ref}`, 14, 102);
    doc.setFillColor(240, 253, 244);
    doc.rect(14, 115, 182, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('PAYMENT CONFIRMED', 105, 128, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Zamifu Analytics School Management System | Thank you for your payment', 105, 280, { align: 'center' });
    doc.save(`receipt_${student.admission_number}_${Date.now()}.pdf`);
  };

  const statusIcon = (status: string) => {
    if (status === 'paid') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'partial') return <Clock className="w-4 h-4 text-yellow-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

  const statusColor = (status: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700';
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  // Group fee structures by class+term for display
  const groupedStructures = feeStructures.reduce((acc: any, fs: any) => {
    const key = `${fs.class_id}_${fs.term_id}`;
    if (!acc[key]) {
      acc[key] = { class: fs.classes?.name, term: `${fs.terms?.name} ${fs.terms?.academic_year}`, fees: [], total: 0 };
    }
    acc[key].fees.push({ type: fs.fee_type, amount: fs.amount });
    acc[key].total += parseFloat(fs.amount) || 0;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Fee Management</h1>
          <p className="text-sm text-[#666666]">Manage fee structures, invoices and payments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowStructure(!showStructure)} className="flex items-center gap-2 border border-[#2563EB] text-[#2563EB] px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-50">
            <FileText className="w-4 h-4" /> Fee Structure
          </button>
          <button onClick={() => setShowInvoice(!showInvoice)} className="flex items-center gap-2 border border-green-600 text-green-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-50">
            <Plus className="w-4 h-4" /> Generate Invoice
          </button>
          <button onClick={() => setShowRecord(!showRecord)} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]">
            <CreditCard className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* Add Fee Structure Form */}
      {showStructure && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Add Fee Structure</h3>
          <form onSubmit={handleAddStructure} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select value={structureData.class_id} onChange={e => setStructureData({...structureData, class_id: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white" required>
              <option value="">Select Class *</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={structureData.term_id} onChange={e => setStructureData({...structureData, term_id: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white" required>
              <option value="">Select Term *</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
            </select>
            <input type="number" placeholder="Tuition Fee (Ksh)" value={structureData.tuition_fee} onChange={e => setStructureData({...structureData, tuition_fee: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" min="0" />
            <input type="number" placeholder="Activity Fee (Ksh)" value={structureData.activity_fee} onChange={e => setStructureData({...structureData, activity_fee: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" min="0" />
            <input type="number" placeholder="Exam Fee (Ksh)" value={structureData.exam_fee} onChange={e => setStructureData({...structureData, exam_fee: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" min="0" />
            <input type="number" placeholder="Other Fee (Ksh)" value={structureData.other_fee} onChange={e => setStructureData({...structureData, other_fee: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" min="0" />
            <input placeholder="Description (optional)" value={structureData.description} onChange={e => setStructureData({...structureData, description: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm md:col-span-2" />
            <div className="flex gap-3 md:col-span-3">
              <button type="submit" className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]">Save Structure</button>
              <button type="button" onClick={() => setShowStructure(false)} className="border px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Generate Invoice Form */}
      {showInvoice && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Generate Invoice for Student</h3>
          <form onSubmit={handleGenerateInvoice} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={invoiceData.student_id} onChange={e => setInvoiceData({...invoiceData, student_id: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white" required>
              <option value="">Select Student *</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>)}
            </select>
            <select value={invoiceData.term_id} onChange={e => setInvoiceData({...invoiceData, term_id: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white" required>
              <option value="">Select Term *</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
            </select>
            <input type="number" placeholder="Total Amount (Ksh) *" value={invoiceData.total_amount} onChange={e => setInvoiceData({...invoiceData, total_amount: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" required min="1" />
            <input type="date" placeholder="Due Date" value={invoiceData.due_date} onChange={e => setInvoiceData({...invoiceData, due_date: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
            <div className="flex gap-3 md:col-span-2">
              <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700">Generate Invoice</button>
              <button type="button" onClick={() => setShowInvoice(false)} className="border px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Record Payment Form */}
      {showRecord && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Record Fee Payment</h3>
          <form onSubmit={handleRecordPayment} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select value={paymentData.student_id} onChange={e => {
              setPaymentData({...paymentData, student_id: e.target.value, invoice_id: ''});
            }} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white" required>
              <option value="">Select Student *</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>)}
            </select>
            <select value={paymentData.invoice_id} onChange={e => setPaymentData({...paymentData, invoice_id: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white">
              <option value="">Latest Unpaid Invoice (auto)</option>
              {invoices.filter(i => i.student_id === paymentData.student_id && i.status !== 'paid').map(i => (
                <option key={i.id} value={i.id}>
                  {i.terms?.name} {i.terms?.academic_year} - Balance: Ksh {(i.balance || i.total_amount - i.amount_paid || 0).toLocaleString()}
                </option>
              ))}
            </select>
            <input type="number" placeholder="Amount (Ksh) *" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" required min="1" />
            <select value={paymentData.payment_method} onChange={e => setPaymentData({...paymentData, payment_method: e.target.value as any})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white">
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
            {paymentData.payment_method === 'mpesa' && (
              <input placeholder="M-Pesa Reference" value={paymentData.mpesa_reference} onChange={e => setPaymentData({...paymentData, mpesa_reference: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
            )}
            <input placeholder="Notes (optional)" value={paymentData.notes} onChange={e => setPaymentData({...paymentData, notes: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
            <div className="flex gap-3 md:col-span-3">
              <button type="submit" disabled={recording} className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                {recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Record & Generate Receipt
              </button>
              <button type="button" onClick={() => setShowRecord(false)} className="border px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'invoices' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Invoices ({invoices.length})
        </button>
        <button onClick={() => setActiveTab('structures')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'structures' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Fee Structures ({Object.keys(groupedStructures).length})
        </button>
      </div>

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Term</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Paid</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-500">Loading...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-500">No invoices found. Generate one above.</td></tr>
                ) : (
                  invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">{inv.students?.first_name} {inv.students?.last_name}</div>
                        <div className="text-xs text-gray-500">{inv.students?.admission_number}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{inv.terms?.name} {inv.terms?.academic_year}</td>
                      <td className="px-6 py-4 text-sm">Ksh {(inv.total_amount || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-green-600">Ksh {(inv.amount_paid || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-red-600 font-medium">
                        Ksh {(inv.balance ?? Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0))).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                          {statusIcon(inv.status)} {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'structures' && (
        <div className="space-y-4">
          {Object.keys(groupedStructures).length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-500 border">
              No fee structures found. Click "Fee Structure" above to add one.
            </div>
          ) : (
            Object.values(groupedStructures).map((group: any, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-[#111111]">{group.class} — {group.term}</h4>
                    <p className="text-xs text-gray-500">{group.fees.length} fee type(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#2563EB]">Total: Ksh {group.total.toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {group.fees.map((f: any, j: number) => (
                    <div key={j} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">{f.type}</p>
                      <p className="text-sm font-semibold">Ksh {parseFloat(f.amount).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
