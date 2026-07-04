import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Download, FileText, Filter, TrendingDown, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  photo_url?: string;
  classes: { name: string } | null;
}

interface FeeRecord {
  id: string;
  description: string;
  fee_type: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  created_at: string;
  payment_date?: string;
}

interface SchoolInfo {
  name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  principal_name?: string;
}

export default function ParentFeeTranscript() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');

  useEffect(() => {
    fetchChildren();
    fetchSchoolInfo();
  }, [user?.schoolId]);

  useEffect(() => {
    if (selectedChild) {
      fetchFeeRecords();
    }
  }, [selectedChild]);

  const fetchChildren = async () => {
    if (!user?.id) return;
    try {
      const { data: linked } = await supabaseUntyped
        .from('parent_student_links')
        .select('*, students(id, first_name, last_name, admission_number, photo_url, classes(name))')
        .eq('parent_id', user.id);

      if (linked) {
        const kids = linked.map(l => l.students as unknown as Child);
        setChildren(kids);
        if (kids.length > 0) setSelectedChild(kids[0]);
      }
    } catch (err: any) {
      toast.error('Failed to load children: ' + err.message);
    }
  };

  const fetchSchoolInfo = async () => {
    if (!user?.schoolId) return;
    try {
      const { data } = await supabaseUntyped
        .from('schools')
        .select('name, logo_url, address, phone, email, principal_name')
        .eq('id', user.schoolId)
        .maybeSingle();
      setSchoolInfo(data);
    } catch (err: any) {
      console.error('Failed to load school info:', err);
    }
  };

  const fetchFeeRecords = async () => {
    if (!selectedChild?.id) return;
    setLoading(true);
    try {
      const { data } = await supabaseUntyped
        .from('fee_records')
        .select('*')
        .eq('student_id', selectedChild.id)
        .order('due_date', { ascending: false });

      setFeeRecords((data || []) as FeeRecord[]);
    } catch (err: any) {
      toast.error('Failed to load fee records: ' + err.message);
    }
    setLoading(false);
  };

  const getFilteredRecords = () => {
    return feeRecords.filter(record => {
      if (filterStatus === 'all') return true;
      return record.status === filterStatus;
    });
  };

  const calculateStats = () => {
    const filtered = getFilteredRecords();
    const totalBilled = filtered.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalPaid = filtered.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
    const totalBalance = totalBilled - totalPaid;
    const paidCount = filtered.filter(r => r.status === 'paid').length;
    const pendingCount = filtered.filter(r => r.status === 'pending').length;

    return { totalBilled, totalPaid, totalBalance, paidCount, pendingCount };
  };

  const generatePDF = async () => {
    if (!selectedChild || !schoolInfo) {
      toast.error('Missing required data');
      return;
    }

    setGeneratingPDF(true);
    try {
      const filtered = getFilteredRecords();
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const schoolName = schoolInfo.name || 'School';
      const stats = calculateStats();

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolName, 105, 12, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('FEE TRANSCRIPT', 105, 20, { align: 'center' });
      if (schoolInfo.address) doc.text(schoolInfo.address, 105, 26, { align: 'center' });
      if (schoolInfo.phone || schoolInfo.email) {
        doc.setFontSize(8);
        doc.text(`Tel: ${schoolInfo.phone || ''} | Email: ${schoolInfo.email || ''}`, 105, 31, { align: 'center' });
      }

      // Student Info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(`Date: ${today}`, 14, 45);

      doc.setFont('helvetica', 'bold');
      doc.text('Student Information:', 14, 53);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${selectedChild.first_name} ${selectedChild.last_name}`, 14, 60);
      doc.text(`Admission No: ${selectedChild.admission_number}`, 14, 67);
      doc.text(`Class: ${selectedChild.classes?.name || 'N/A'}`, 14, 74);

      // Summary Box
      doc.setFillColor(240, 248, 255);
      doc.rect(14, 80, 182, 30, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Total Billed: KES ${stats.totalBilled.toLocaleString()}`, 20, 87);
      doc.text(`Total Paid: KES ${stats.totalPaid.toLocaleString()}`, 75, 87);
      doc.text(`Balance: KES ${Math.abs(stats.totalBalance).toLocaleString()}`, 130, 87);
      doc.setTextColor(stats.totalBalance > 0 ? 220 : 22, stats.totalBalance > 0 ? 38 : 163, stats.totalBalance > 0 ? 38 : 74);
      doc.setFontSize(10);
      doc.text(stats.totalBalance > 0 ? 'OWING' : stats.totalBalance < 0 ? 'OVERPAID' : 'CLEARED', 130, 100);
      doc.setTextColor(0, 0, 0);

      // Fee Records Table
      if (filtered.length > 0) {
        const feeRows = filtered.map(r => [
          r.description || r.fee_type || 'Fee',
          r.due_date ? new Date(r.due_date).toLocaleDateString() : 'N/A',
          `KES ${Number(r.amount || 0).toLocaleString()}`,
          `KES ${Number(r.paid_amount || 0).toLocaleString()}`,
          `KES ${(Number(r.amount || 0) - Number(r.paid_amount || 0)).toLocaleString()}`,
          r.status || 'pending',
        ]);

        autoTable(doc, {
          startY: 115,
          head: [['Description', 'Due Date', 'Amount', 'Paid', 'Balance', 'Status']],
          body: feeRows,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 255] },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 5) {
              const status = data.cell.raw as string;
              if (status === 'paid') data.cell.styles.textColor = [22, 163, 74];
              else if (status === 'overdue') data.cell.styles.textColor = [220, 38, 38];
            }
          },
        });
      } else {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('No fee records found.', 14, 120);
      }

      const afterTableY = filtered.length > 0 ? (doc as any).lastAutoTable.finalY + 10 : 130;

      // Payment History Summary
      if (filtered.length > 0) {
        doc.setFillColor(255, 251, 235);
        doc.rect(14, afterTableY, 182, 18, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(202, 138, 4);
        doc.text('PAYMENT SUMMARY', 18, afterTableY + 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.text(`Paid Invoices: ${stats.paidCount} | Pending: ${stats.pendingCount}`, 18, afterTableY + 13);
      }

      // Payment Instructions
      const instructionsY = afterTableY + 25;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('PAYMENT INSTRUCTIONS:', 14, instructionsY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const instructions = [
        '1. All fees must be paid by the due date to avoid late charges.',
        '2. Please retain this transcript for your records.',
        '3. Contact the school bursar for payment plans or queries.',
        '4. Late payments may affect student participation in school activities.',
      ];
      instructions.forEach((instr, idx) => {
        doc.text(instr, 18, instructionsY + 7 + idx * 5);
      });

      // Signature
      const sigY = instructionsY + 35;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text('Bursar/Finance Officer', 14, sigY + 10);
      doc.setDrawColor(150, 150, 155);
      doc.line(14, sigY + 8, 80, sigY + 8);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated by Zamifu Analytics | ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

      doc.save(`fee_transcript_${selectedChild.first_name}_${selectedChild.last_name}.pdf`);
      toast.success('Fee transcript downloaded successfully!');
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
    setGeneratingPDF(false);
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Fee Transcript</h1>
        <p className="text-sm text-[#666666]">View and download your child's fee payment history</p>
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="bg-white rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <p className="text-sm text-[#666666] mb-3">Select Child</p>
          <div className="flex gap-2 flex-wrap">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  selectedChild?.id === child.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {child.photo_url ? (
                  <img src={child.photo_url} alt={child.first_name} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold">
                    {child.first_name[0]}
                  </div>
                )}
                {child.first_name} {child.last_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedChild && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border-l-4 border-blue-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-semibold">TOTAL BILLED</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">KES {stats.totalBilled.toLocaleString()}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-300" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-5 border-l-4 border-green-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-semibold">TOTAL PAID</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">KES {stats.totalPaid.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-300" />
              </div>
            </div>

            <div className={`bg-gradient-to-br ${stats.totalBalance > 0 ? 'from-red-50 to-red-100 border-l-4 border-red-600' : 'from-green-50 to-green-100 border-l-4 border-green-600'} rounded-2xl p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-semibold ${stats.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.totalBalance > 0 ? 'BALANCE OWING' : 'BALANCE CLEARED'}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${stats.totalBalance > 0 ? 'text-red-900' : 'text-green-900'}`}>
                    KES {Math.abs(stats.totalBalance).toLocaleString()}
                  </p>
                </div>
                {stats.totalBalance > 0 ? (
                  <TrendingDown className="w-8 h-8 text-red-300" />
                ) : (
                  <TrendingUp className="w-8 h-8 text-green-300" />
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 border-l-4 border-purple-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-semibold">TRANSACTIONS</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">{feeRecords.length}</p>
                </div>
                <FileText className="w-8 h-8 text-purple-300" />
              </div>
            </div>
          </div>

          {/* Filter & Download */}
          <div className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Transactions</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <button
              onClick={generatePDF}
              disabled={generatingPDF || !selectedChild}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generatingPDF ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF
                </>
              )}
            </button>
          </div>

          {/* Fee Records Table */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading fee records...</div>
          ) : getFilteredRecords().length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No fee records found</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Due Date</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Paid</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredRecords().map((record, idx) => (
                      <tr key={record.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-6 py-3 text-sm text-gray-800">{record.description || record.fee_type}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {record.due_date ? new Date(record.due_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-3 text-sm text-right font-medium text-gray-800">
                          KES {Number(record.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-right font-medium text-green-600">
                          KES {Number(record.paid_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-right font-medium text-orange-600">
                          KES {(Number(record.amount || 0) - Number(record.paid_amount || 0)).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              record.status === 'paid'
                                ? 'bg-green-100 text-green-700'
                                : record.status === 'overdue'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {record.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
