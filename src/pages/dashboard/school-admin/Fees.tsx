import { useState, useEffect } from 'react';
import { supabaseUntyped } from "@/lib/supabase/client";
import { sendSMS } from '@/lib/sms';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Plus, Loader2, CheckCircle, Clock, AlertTriangle, Download, FileText, Trash2, Pencil } from 'lucide-react';
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
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'structures' | 'class-balances'>('invoices');
  const [selectedFeeClass, setSelectedFeeClass] = useState('');
  const [bulkSending, setBulkSending] = useState(false);

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
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabaseUntyped.from('students')
        .select('id, first_name, last_name, admission_number, class_id, parent_name, parent_phone, parent2_name, parent2_phone')
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

  const invoiceBalance = (invoice: any) => Number(invoice.balance ?? Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0)));

  const classBalanceRows = (classId: string) => {
    const classStudents = students.filter((student: any) => student.class_id === classId);
    return classStudents.map((student: any) => {
      const studentInvoices = invoices.filter((invoice: any) => invoice.student_id === student.id);
      return {
        student,
        total: studentInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.total_amount || 0), 0),
        paid: studentInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount_paid || 0), 0),
        balance: studentInvoices.reduce((sum: number, invoice: any) => sum + invoiceBalance(invoice), 0),
      };
    });
  };

  const downloadClassFeeBalances = (classId: string) => {
    const className = classes.find((item: any) => item.id === classId)?.name || 'Class';
    const rows = classBalanceRows(classId);
    if (rows.length === 0) { toast.info('No learners found in this class.'); return; }
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`${schoolData?.name || 'School'} - Fee Balances`, 14, 16);
    doc.setFontSize(11); doc.text(`${className} | Generated ${new Date().toLocaleDateString()}`, 14, 24);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Admission No.', 'Learner', 'Total Due', 'Paid', 'Outstanding']],
      body: rows.map((row: any, index: number) => [index + 1, row.student.admission_number || '-', `${row.student.first_name} ${row.student.last_name}`, `Ksh ${row.total.toLocaleString()}`, `Ksh ${row.paid.toLocaleString()}`, `Ksh ${row.balance.toLocaleString()}`]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`fee_balances_${className.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
    toast.success(`Downloaded fee balances for ${className}.`);
  };

  const sendClassFeeBalances = async () => {
    if (!selectedFeeClass || !user?.schoolId) { toast.error('Select a class first.'); return; }
    const className = classes.find((item: any) => item.id === selectedFeeClass)?.name || 'your child’s class';
    const recipients = classBalanceRows(selectedFeeClass).flatMap((row: any) => {
      const message = `Dear ${row.student.parent_name || 'Parent'}, ${row.student.first_name} ${row.student.last_name}'s outstanding fee balance at ${schoolData?.name || 'school'} is Ksh ${row.balance.toLocaleString()} (${className}). Please contact the school office for assistance.`;
      return [row.student.parent_phone, row.student.parent2_phone].filter(Boolean).map((phone) => ({ phone, message }));
    });
    if (recipients.length === 0) { toast.info('No parent phone numbers found for this class.'); return; }
    setBulkSending(true);
    let sent = 0;
    try {
      for (const recipient of recipients) {
        const result = await sendSMS(recipient.phone, recipient.message, undefined, user.schoolId);
        if (result.success) sent += 1;
      }
      toast.success(`Fee balance messages sent: ${sent} of ${recipients.length}.`);
    } finally { setBulkSending(false); }
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

    if (editingStructureId) {
      if (feeTypes.length !== 1) {
        toast.error('Edit one fee type at a time. Enter only the amount you want to change.');
        return;
      }
      const { error } = await supabaseUntyped
        .from('fee_structures')
        .update({
          class_id: structureData.class_id,
          term_id: structureData.term_id,
          fee_type: feeTypes[0].type,
          amount: feeTypes[0].amount,
          description: structureData.description || null,
        })
        .eq('id', editingStructureId)
        .eq('school_id', user?.schoolId);
      if (error) { toast.error('Failed to update fee structure: ' + error.message); return; }
      toast.success('Fee structure updated successfully.');
    } else {
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
    }
    setEditingStructureId(null);
    setShowStructure(false);
    setStructureData({ class_id: '', term_id: '', tuition_fee: '', activity_fee: '', exam_fee: '', other_fee: '', description: '' });
    fetchData();
  };

  const handleEditStructure = (fee: any, group: any) => {
    const fieldByType: Record<string, 'tuition_fee' | 'activity_fee' | 'exam_fee' | 'other_fee'> = {
      Tuition: 'tuition_fee', Activity: 'activity_fee', Exam: 'exam_fee', Other: 'other_fee',
    };
    const field = fieldByType[fee.type];
    setEditingStructureId(fee.id);
    setStructureData({
      class_id: group.class_id,
      term_id: group.term_id,
      tuition_fee: field === 'tuition_fee' ? String(fee.amount) : '',
      activity_fee: field === 'activity_fee' ? String(fee.amount) : '',
      exam_fee: field === 'exam_fee' ? String(fee.amount) : '',
      other_fee: field === 'other_fee' ? String(fee.amount) : '',
      description: fee.description || '',
    });
    setShowStructure(true);
  };

  const handleDeleteStructure = async (fee: any) => {
    if (!fee?.id || !user?.schoolId) return;
    if (!window.confirm(`Delete the ${fee.type} fee structure? This does not delete invoices or payment history.`)) return;
    const { error } = await supabaseUntyped
      .from('fee_structures')
      .delete()
      .eq('id', fee.id)
      .eq('school_id', user.schoolId);
    if (error) { toast.error('Could not delete fee structure: ' + error.message); return; }
    toast.success('Fee structure deleted.');
    await fetchData();
  };

  // Generate invoice for a student
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceData.student_id || !invoiceData.term_id || !user?.schoolId) {
      toast.error('Please select student and term');
      return;
    }

    const totalAmount = parseFloat(invoiceData.total_amount) || 0;
    if (totalAmount <= 0) {
      toast.error('Please enter a valid total amount');
      return;
    }

    const selectedTerm = terms.find((term: any) => term.id === invoiceData.term_id);
    const academicYear = String(selectedTerm?.academic_year || new Date().getFullYear());
    const dueDate = invoiceData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const invoicePayload = {
      student_id: invoiceData.student_id,
      school_id: user.schoolId,
      term_id: invoiceData.term_id,
      academic_year: academicYear,
      total_amount: totalAmount,
      due_date: dueDate,
    };

    // The database key is one invoice per learner, term and academic year.
    // Update an existing active invoice rather than issuing a duplicate INSERT.
    const { data: existingInvoice, error: lookupError } = await supabaseUntyped
      .from('fee_invoices')
      .select('id, amount_paid')
      .eq('student_id', invoicePayload.student_id)
      .eq('school_id', invoicePayload.school_id)
      .eq('term_id', invoicePayload.term_id)
      .eq('academic_year', invoicePayload.academic_year)
      .is('deleted_at', null)
      .maybeSingle();
    if (lookupError) { toast.error('Could not check existing invoice: ' + lookupError.message); return; }

    const { error } = existingInvoice
      ? await supabaseUntyped.from('fee_invoices').update({
          total_amount: totalAmount,
          due_date: dueDate,
          balance: Math.max(0, totalAmount - Number(existingInvoice.amount_paid || 0)),
          status: Number(existingInvoice.amount_paid || 0) >= totalAmount ? 'paid' : Number(existingInvoice.amount_paid || 0) > 0 ? 'partial' : 'unpaid',
        }).eq('id', existingInvoice.id).eq('school_id', user.schoolId)
      : await supabaseUntyped.from('fee_invoices').insert([{ ...invoicePayload, amount_paid: 0, balance: totalAmount, status: 'unpaid' }]);

    if (error) { toast.error('Failed to save invoice: ' + error.message); return; }
    toast.success(existingInvoice ? 'Existing invoice updated successfully!' : 'Invoice generated successfully!');
    setShowInvoice(false);
    setInvoiceData({ student_id: '', term_id: '', total_amount: '', due_date: '' });
    fetchData();
  };

  const handleDeleteInvoice = async (invoice: any) => {
    if (!user?.schoolId || !invoice?.id) return;
    const studentName = `${invoice.students?.first_name || ''} ${invoice.students?.last_name || ''}`.trim() || 'this learner';
    const confirmed = window.confirm(`Delete the invoice for ${studentName}? This permanently deletes the invoice and all payments attached to it.`);
    if (!confirmed) return;
    try {
      // Delete child payments first so the invoice cannot leave orphaned history.
      const { error: paymentsError } = await supabaseUntyped
        .from('fee_payments')
        .delete()
        .eq('invoice_id', invoice.id)
        .eq('school_id', user.schoolId);
      if (paymentsError) throw paymentsError;

      const { error: invoiceError } = await supabaseUntyped
        .from('fee_invoices')
        .delete()
        .eq('id', invoice.id)
        .eq('school_id', user.schoolId);
      if (invoiceError) throw invoiceError;
      toast.success('Invoice and all attached payment records were permanently deleted.');
      await fetchData();
    } catch (error: any) {
      toast.error(`Could not delete invoice: ${error.message}`);
    }
  };

  // Record payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.student_id || !paymentData.amount) {
      toast.error('Please select a student and enter amount');
      return;
    }
    const amount = parseFloat(paymentData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }
    const schoolId = user?.schoolId;
    if (!schoolId) {
      toast.error('Your school account is not fully loaded. Please sign in again.');
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
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .neq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingInv) {
          invoiceId = existingInv.id;
          invoice = existingInv;
        } else {
          // Create a quick invoice
          const term = terms[0]; // Use latest term
          if (!term?.id) {
            throw new Error('No active term is configured for this school. Create a term before recording a payment.');
          }
          const { data: newInv, error: invErr } = await supabaseUntyped.from('fee_invoices').insert([{
            student_id: paymentData.student_id,
            school_id: schoolId,
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

      const { error: invoiceUpdateError } = await supabaseUntyped.from('fee_invoices').update({
        amount_paid: currentPaid,
        balance: newBalance,
        status: newStatus,
      }).eq('id', invoiceId).eq('school_id', schoolId).is('deleted_at', null);
      if (invoiceUpdateError) throw invoiceUpdateError;

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
      acc[key] = { class_id: fs.class_id, term_id: fs.term_id, class: fs.classes?.name, term: `${fs.terms?.name} ${fs.terms?.academic_year}`, fees: [], total: 0 };
    }
    acc[key].fees.push({ id: fs.id, type: fs.fee_type, amount: fs.amount, description: fs.description });
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
          <h3 className="text-lg font-semibold mb-4">{editingStructureId ? 'Edit Fee Structure' : 'Add Fee Structure'}</h3>
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
              <button type="submit" className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]">{editingStructureId ? 'Update Structure' : 'Save Structure'}</button>
              <button type="button" onClick={() => { setShowStructure(false); setEditingStructureId(null); }} className="border px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
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
        <button onClick={() => setActiveTab('class-balances')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'class-balances' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Class Fee Balances
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
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-gray-500">Loading...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-gray-500">No invoices found. Generate one above.</td></tr>
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
                      <td className="px-6 py-4"><button onClick={() => handleDeleteInvoice(inv)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100" title="Delete invoice"><Trash2 className="w-3.5 h-3.5" /> Delete</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'class-balances' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex flex-col md:flex-row md:items-center gap-3">
            <select value={selectedFeeClass} onChange={e => setSelectedFeeClass(e.target.value)} className="flex-1 px-4 py-2.5 border rounded-xl text-sm bg-white">
              <option value="">Select a class</option>
              {classes.map((classItem: any) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
            </select>
            <button type="button" onClick={() => selectedFeeClass && downloadClassFeeBalances(selectedFeeClass)} disabled={!selectedFeeClass} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-medium disabled:opacity-50">
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button type="button" onClick={sendClassFeeBalances} disabled={!selectedFeeClass || bulkSending} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50">
              {bulkSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Send Balance Messages
            </button>
          </div>
          {selectedFeeClass ? (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-5 border-b"><h3 className="font-semibold">{classes.find((item: any) => item.id === selectedFeeClass)?.name} Fee Balances</h3><p className="text-xs text-gray-500 mt-1">Learners are grouped by class. Messages include parent name, learner name, class, and outstanding balance.</p></div>
              <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b bg-gray-50"><th className="px-5 py-3 text-xs uppercase text-gray-500">Learner</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Parent</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Total</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Paid</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Outstanding</th></tr></thead><tbody>{classBalanceRows(selectedFeeClass).map((row: any) => <tr key={row.student.id} className="border-b"><td className="px-5 py-3 text-sm">{row.student.first_name} {row.student.last_name}<div className="text-xs text-gray-500">{row.student.admission_number || '-'}</div></td><td className="px-5 py-3 text-sm">{row.student.parent_name || '-'}<div className="text-xs text-gray-500">{row.student.parent_phone || '-'}</div></td><td className="px-5 py-3 text-sm">Ksh {row.total.toLocaleString()}</td><td className="px-5 py-3 text-sm text-green-600">Ksh {row.paid.toLocaleString()}</td><td className="px-5 py-3 text-sm font-semibold text-red-600">Ksh {row.balance.toLocaleString()}</td></tr>)}</tbody></table></div>
            </div>
          ) : <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-500 border">Select a class to view and communicate fee balances.</div>}
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
                    <div key={f.id || j} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">{f.type}</p>
                      <p className="text-sm font-semibold">Ksh {parseFloat(f.amount).toLocaleString()}</p>
                      <div className="mt-2 flex justify-center gap-1.5">
                        <button type="button" onClick={() => handleEditStructure(f, group)} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100" title="Edit fee structure"><Pencil className="h-3 w-3" /> Edit</button>
                        <button type="button" onClick={() => handleDeleteStructure(f)} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100" title="Delete fee structure"><Trash2 className="h-3 w-3" /> Delete</button>
                      </div>
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
