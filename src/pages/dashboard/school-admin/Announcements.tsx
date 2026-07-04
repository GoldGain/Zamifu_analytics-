import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnnouncements } from '@/hooks/useSupabaseData';
import { Plus, Loader2, Megaphone, FileText, Download, Mail, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { AnnouncementType } from '@/types/database';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SchoolAdminAnnouncements() {
  const { user } = useAuth();
  const { announcements, loading, refetch } = useAnnouncements(user?.schoolId || undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', type: 'general' as AnnouncementType });
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [generatingLetters, setGeneratingLetters] = useState(false);
  const [generatingFeeStatements, setGeneratingFeeStatements] = useState(false);
  const [announcementForLetter, setAnnouncementForLetter] = useState('');
  const [showLetterGenerator, setShowLetterGenerator] = useState(false);
  const [showFeeStatements, setShowFeeStatements] = useState(false);

  useEffect(() => {
    fetchSchoolInfo();
    fetchClasses();
  }, [user?.schoolId]);

  const fetchSchoolInfo = async () => {
    if (!user?.schoolId) return;
    try {
      const { data } = await supabaseUntyped
        .from('schools')
        .select('name, motto, logo_url, principal_name, address, phone, email')
        .eq('id', user.schoolId)
        .maybeSingle();
      setSchoolInfo(data);
    } catch (err: any) {
      // If motto column doesn't exist, fetch without it
      if (err.message?.includes('motto')) {
        const { data } = await supabaseUntyped
          .from('schools')
          .select('name, logo_url, principal_name, address, phone, email')
          .eq('id', user.schoolId)
          .maybeSingle();
        setSchoolInfo(data);
      }
    }
  };

  const fetchClasses = async () => {
    if (!user?.schoolId) return;
    const { data } = await supabaseUntyped
      .from('classes')
      .select('id, name, stream, level, grade_level')
      .eq('school_id', user.schoolId)
      .order('level');
    setClasses(data || []);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    await supabaseUntyped.from('announcements').insert([{
      title: formData.title,
      content: formData.content,
      type: formData.type,
      school_id: user?.schoolId,
      created_by: user?.id,
      is_published: true,
      published_at: new Date().toISOString(),
    }]);
    setShowAdd(false);
    setFormData({ title: '', content: '', type: 'general' });
    refetch();
    setAdding(false);
    toast.success('Announcement published!');
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'fee_reminder': return 'bg-orange-100 text-orange-700';
      case 'exam': return 'bg-blue-100 text-blue-700';
      case 'emergency': return 'bg-red-100 text-red-700';
      case 'event': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // ── ANNOUNCEMENT LETTERS PDF ─────────────────────────────────────────────────
  const generateAnnouncementLetters = async () => {
    if (!selectedClass || !announcementForLetter) {
      toast.error('Please select a class and an announcement');
      return;
    }

    setGeneratingLetters(true);
    try {
      // Fetch students for this class
      const { data: students, error: studentsError } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number, parent_name, parent_email, parent_phone')
        .eq('class_id', selectedClass)
        .eq('is_active', true)
        .order('first_name');

      if (studentsError) throw studentsError;
      if (!students || students.length === 0) {
        toast.error('No active students found in this class');
        setGeneratingLetters(false);
        return;
      }

      // Get the announcement
      const ann = announcements.find(a => a.id === announcementForLetter);
      if (!ann) { toast.error('Announcement not found'); setGeneratingLetters(false); return; }

      const classObj = classes.find(c => c.id === selectedClass);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const schoolName = schoolInfo?.name || 'School';

      for (let idx = 0; idx < students.length; idx++) {
        const student = students[idx];
        if (idx > 0) doc.addPage();

        // Header
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(schoolName, 105, 11, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        if (schoolInfo?.address) doc.text(schoolInfo.address, 105, 18, { align: 'center' });
        if (schoolInfo?.phone || schoolInfo?.email) {
          doc.text(`Tel: ${schoolInfo?.phone || ''} | Email: ${schoolInfo?.email || ''}`, 105, 24, { align: 'center' });
        }

        // Letter body
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(today, 14, 40);

        doc.setFont('helvetica', 'bold');
        doc.text('To:', 14, 50);
        doc.setFont('helvetica', 'normal');
        doc.text(`${student.parent_name || 'Parent/Guardian'}`, 14, 57);
        doc.text(`Parent/Guardian of: ${student.first_name} ${student.last_name}`, 14, 64);
        doc.text(`Admission No: ${student.admission_number}`, 14, 71);
        doc.text(`Class: ${classObj?.name || ''} ${classObj?.stream || ''}`, 14, 78);

        // Subject line
        doc.setFont('helvetica', 'bold');
        doc.text(`RE: ${ann.title}`, 14, 90);
        doc.setDrawColor(37, 99, 235);
        doc.line(14, 92, 196, 92);

        // Salutation
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Dear ${student.parent_name || 'Parent/Guardian'},`, 14, 100);

        // Content
        const contentLines = doc.splitTextToSize(ann.content, 175);
        doc.text(contentLines, 14, 110);

        const afterContentY = 110 + contentLines.length * 5 + 10;

        // Closing
        doc.text('Yours faithfully,', 14, afterContentY);
        doc.setFont('helvetica', 'bold');
        doc.text(schoolInfo?.principal_name || 'School Principal', 14, afterContentY + 15);
        doc.setFont('helvetica', 'normal');
        doc.text('Principal', 14, afterContentY + 21);
        doc.text(schoolName, 14, afterContentY + 27);

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Letter ${idx + 1} of ${students.length} | Generated by Zamifu Analytics`, 105, 285, { align: 'center' });
      }

      doc.save(`announcement_letters_${classObj?.name}_${ann.title.substring(0, 20)}.pdf`);
      toast.success(`${students.length} announcement letters generated!`);
    } catch (err: any) {
      toast.error('Failed to generate letters: ' + err.message);
    }
    setGeneratingLetters(false);
  };

  // ── FEE STATEMENTS PDF ───────────────────────────────────────────────────────
  const generateFeeStatements = async () => {
    if (!selectedClass) {
      toast.error('Please select a class first');
      return;
    }

    setGeneratingFeeStatements(true);
    try {
      // Fetch students with fee data
      const { data: students, error: studentsError } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number, parent_name, parent_email, parent_phone')
        .eq('class_id', selectedClass)
        .eq('is_active', true)
        .order('first_name');

      if (studentsError) throw studentsError;
      if (!students || students.length === 0) {
        toast.error('No active students found in this class');
        setGeneratingFeeStatements(false);
        return;
      }

      // Fetch fee records for each student
      const studentIds = students.map((s: any) => s.id);
      const { data: feeRecords } = await supabaseUntyped
        .from('fee_records')
        .select('*, students(first_name, last_name, admission_number)')
        .in('student_id', studentIds)
        .order('due_date', { ascending: false });

      const classObj = classes.find(c => c.id === selectedClass);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const schoolName = schoolInfo?.name || 'School';

      for (let idx = 0; idx < students.length; idx++) {
        const student = students[idx];
        if (idx > 0) doc.addPage();

        const studentFees = (feeRecords || []).filter((f: any) => f.student_id === student.id);
        const totalBilled = studentFees.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
        const totalPaid = studentFees.reduce((s: number, f: any) => s + (Number(f.paid_amount) || 0), 0);
        const balance = totalBilled - totalPaid;

        // Header
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(schoolName, 105, 11, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('FEE STATEMENT', 105, 18, { align: 'center' });
        if (schoolInfo?.address) doc.text(schoolInfo.address, 105, 24, { align: 'center' });

        // Student info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`Date: ${today}`, 14, 38);

        doc.setFont('helvetica', 'bold');
        doc.text(`${student.first_name} ${student.last_name}`, 14, 48);
        doc.setFont('helvetica', 'normal');
        doc.text(`Admission No: ${student.admission_number}`, 14, 55);
        doc.text(`Class: ${classObj?.name || ''} ${classObj?.stream || ''}`, 14, 62);
        doc.text(`Parent/Guardian: ${student.parent_name || 'N/A'}`, 14, 69);
        doc.text(`Contact: ${student.parent_phone || student.parent_email || 'N/A'}`, 14, 76);

        // Balance summary box
        const balanceColor = balance > 0 ? [220, 38, 38] : [22, 163, 74];
        doc.setFillColor(balance > 0 ? 254 : 240, balance > 0 ? 242 : 253, balance > 0 ? 242 : 244);
        doc.rect(14, 82, 182, 22, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Billed: KES ${totalBilled.toLocaleString()}`, 20, 91);
        doc.text(`Total Paid: KES ${totalPaid.toLocaleString()}`, 80, 91);
        doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
        doc.setFontSize(11);
        doc.text(`Balance: KES ${Math.abs(balance).toLocaleString()} ${balance > 0 ? '(OWING)' : balance < 0 ? '(OVERPAID)' : '(CLEARED)'}`, 20, 100);
        doc.setTextColor(0, 0, 0);

        // Fee records table
        if (studentFees.length > 0) {
          const feeRows = studentFees.map((f: any) => [
            f.description || f.fee_type || 'Fee',
            f.due_date ? new Date(f.due_date).toLocaleDateString() : 'N/A',
            `KES ${Number(f.amount || 0).toLocaleString()}`,
            `KES ${Number(f.paid_amount || 0).toLocaleString()}`,
            `KES ${(Number(f.amount || 0) - Number(f.paid_amount || 0)).toLocaleString()}`,
            f.status || 'pending',
          ]);

          autoTable(doc, {
            startY: 110,
            head: [['Description', 'Due Date', 'Amount', 'Paid', 'Balance', 'Status']],
            body: feeRows,
            styles: { fontSize: 8, cellPadding: 2 },
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
          doc.text('No fee records found for this student.', 14, 118);
        }

        const afterTableY = studentFees.length > 0 ? (doc as any).lastAutoTable.finalY + 10 : 130;

        // Payment instructions
        if (balance > 0) {
          doc.setFillColor(255, 251, 235);
          doc.rect(14, afterTableY, 182, 20, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(202, 138, 4);
          doc.text('PAYMENT NOTICE', 18, afterTableY + 7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(`Please clear the outstanding balance of KES ${balance.toLocaleString()} at the earliest convenience.`, 18, afterTableY + 14);
        }

        // Signature
        const sigY = afterTableY + (balance > 0 ? 28 : 8);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Bursar/Finance Officer', 14, sigY + 15);
        doc.setDrawColor(150, 150, 155);
        doc.line(14, sigY + 12, 80, sigY + 12);

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Statement ${idx + 1} of ${students.length} | Generated by Zamifu Analytics`, 105, 285, { align: 'center' });
      }

      doc.save(`fee_statements_${classObj?.name}_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
      toast.success(`${students.length} fee statements generated!`);
    } catch (err: any) {
      toast.error('Failed to generate fee statements: ' + err.message);
    }
    setGeneratingFeeStatements(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Announcements</h1>
          <p className="text-sm text-[#666666]">Manage school announcements and generate letters</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]"
        >
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      {/* New Announcement Form */}
      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="text-lg font-semibold mb-4">Create Announcement</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <input
              placeholder="Title *"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              required
            />
            <textarea
              placeholder="Content *"
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[100px]"
              required
            />
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as AnnouncementType })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="general">General</option>
              <option value="fee_reminder">Fee Reminder</option>
              <option value="exam">Exam</option>
              <option value="event">Event</option>
              <option value="emergency">Emergency</option>
            </select>
            <div className="flex gap-3">
              <button type="submit" disabled={adding} className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                {adding ? 'Publishing...' : 'Publish'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* PDF Tools Panel */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-[#111111]">Generate Letters & Statements</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-[#666666] mb-1">Select Class</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="">-- Select Class --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.stream || ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#666666] mb-1">Select Announcement (for letters)</label>
            <select
              value={announcementForLetter}
              onChange={e => setAnnouncementForLetter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="">-- Select Announcement --</option>
              {announcements.map((a: any) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={generateAnnouncementLetters}
            disabled={generatingLetters || !selectedClass || !announcementForLetter}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {generatingLetters ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {generatingLetters ? 'Generating...' : 'Generate Announcement Letters (PDF)'}
          </button>
          <button
            onClick={generateFeeStatements}
            disabled={generatingFeeStatements || !selectedClass}
            className="flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {generatingFeeStatements ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            {generatingFeeStatements ? 'Generating...' : 'Bulk Fee Statements (PDF)'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          <strong>Announcement Letters</strong> — one personalised letter per student/parent for the selected announcement.<br />
          <strong>Bulk Fee Statements</strong> — one fee statement per student showing all fees, payments, and outstanding balance.
        </p>
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-sm text-[#666666]">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#666666] bg-white rounded-2xl">No announcements yet</div>
        ) : (
          announcements.map((a: any) => (
            <div key={a.id} className="bg-white rounded-2xl p-5 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[#111111]">{a.title}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeColor(a.type || '')}`}>{a.type}</span>
                  </div>
                  <p className="text-sm text-[#666666] leading-relaxed">{a.content}</p>
                  <p className="text-xs text-gray-400 mt-2">{a.published_at ? new Date(a.published_at).toLocaleDateString() : 'Draft'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
