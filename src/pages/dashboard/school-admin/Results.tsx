import { useState, useEffect } from 'react';
import { supabaseUntyped } from "@/lib/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { Search, Award, Download, FileText, Loader2, TrendingUp, TrendingDown, Minus, Send, Bell, Trophy, Pencil, Trash2, X, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

import { calculateCompetencyGrade, getSchoolLevelBand } from '@/lib/grading';
import type { SchoolLevelBand } from '@/lib/grading';
import { computeBestPerSubject } from '@/lib/bestPerSubject';
import type { BestInSubject } from '@/lib/bestPerSubject';
import {
  generateUniqueAIComment,
  drawTrendGraph,
  addSignaturesToPDF,
  drawReportHeader,
  addStudentPhotoToPDF,
  addLogoToPDF,
  type SchoolInfo,
  type SignatureInfo,
} from '@/lib/reportCardPdf';

function calculateCBEGrade(pct: number, classData?: { curriculum?: string | null; grade_level?: number | string | null; level?: number | string | null; name?: string | null }) {
  const band = getSchoolLevelBand(classData);
  const g = calculateCompetencyGrade(pct, band);
  return { subLevel: g.subLevel, grade: g.grade, points: g.points };
}

function overallGradeLabelCBE(avgPct: number): string {
  if (avgPct >= 75) return 'EE';
  if (avgPct >= 41) return 'ME';
  if (avgPct >= 21) return 'AE';
  return 'BE';
}

function overallGradeWithBand(avgPct: number, band: SchoolLevelBand) {
  const g = calculateCompetencyGrade(avgPct, band);
  return { subLevel: g.subLevel, grade: g.grade, points: g.points, descriptor: g.descriptor };
}

const SUBJECT_SHORT: Record<string, string> = {
  'Mathematics Activities': 'MATH-ACT',
  'English language Activities': 'ENG-ACT',
  'Environment Activities': 'ENV-ACT',
  'Creative Arts activities': 'ART-ACT',
  'Religious Studies Activities': 'RE-ACT',
  'Kiswahili Activities': 'KSW-ACT',
  'English': 'ENG',
  'English Composition': 'ENG-COMP',
  'English Grammar': 'ENG-GRAM',
  'Kiswahili': 'KSW',
  'Kiswahili Insha': 'KSW-INSHA',
  'Kiswahili Sarufi': 'KSW-SARUFI',
  'Mathematics': 'MATH',
  'Science and Technology': 'SCI-TECH',
  'Social Studies': 'SST',
  'Religious Education': 'RE',
  'Creative Arts': 'ARTS',
  'Physical and Health Education': 'PE',
  'Indigenous Languages': 'IND-LANG',
  'Integrated Science': 'INTSCI',
  'Pre-Technical Studies': 'PRE-TECH',
  'Business Studies': 'BUS',
  'Agriculture': 'AGRI',
  'Biology': 'BIO',
  'Chemistry': 'CHEM',
  'Physics': 'PHY',
  'History': 'HIST',
  'Geography': 'GEO',
  'Computer Studies': 'COMP',
  'Home Science': 'HOME-SCI',
  'Community Service Learning': 'CSL',
};
function shortName(name: string) {
  return SUBJECT_SHORT[name] || name.substring(0, 7).toUpperCase();
}

export default function SchoolAdminResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [editingResult, setEditingResult] = useState<any | null>(null);
  const [editMarks, setEditMarks] = useState('');
  const [editOutOf, setEditOutOf] = useState('');
  const [savingResult, setSavingResult] = useState(false);

  const [deletingResult, setDeletingResult] = useState<any | null>(null);
  const [deletingResultLoading, setDeletingResultLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('School');
  const [bestPerSubjectList, setBestPerSubjectList] = useState<BestInSubject[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({ name: '' });
  const [principalSignatureUrl, setPrincipalSignatureUrl] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const getPercentage = (r: any) => {
    if (r.percentage !== undefined && r.percentage !== null) return Number(r.percentage);
    return Math.round((r.marks / (r.out_of || 100)) * 100);
  };

  const fetchAll = async () => {
    setLoading(true);
    const schoolId = user?.schoolId ?? '';
    let sch: any = null;
    try {
      const results = await Promise.all([
        supabaseUntyped.from('results').select('*, students(first_name, last_name, admission_number), subjects(name), classes(curriculum, grade_level, level, name), exams(name)').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabaseUntyped.from('classes').select('*').eq('school_id', schoolId).order('level'),
        supabaseUntyped.from('terms').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
        supabaseUntyped.from('schools').select('name, motto, logo_url, principal_name, principal_signature_url, address, phone, email').eq('id', schoolId).maybeSingle(),
        supabaseUntyped.from('school_exams').select('id, name, type, term_id, is_active').eq('school_id', schoolId).order('created_at', { ascending: false }),
      ]);
      setResults((results[0].data as any[]) || []);
      setClasses((results[1].data as any[]) || []);
      setTerms((results[2].data as any[]) || []);
      sch = results[3].data;
      setExams((results[4].data as any[]) || []);
    } catch (err: any) {
      if (err.message?.includes('motto')) {
        const results = await Promise.all([
          supabaseUntyped.from('results').select('*, students(first_name, last_name, admission_number), subjects(name), classes(curriculum, grade_level, level, name), exams(name)').eq('school_id', schoolId).order('created_at', { ascending: false }),
          supabaseUntyped.from('classes').select('*').eq('school_id', schoolId).order('level'),
          supabaseUntyped.from('terms').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
          supabaseUntyped.from('schools').select('name, logo_url, principal_name, principal_signature_url, address, phone, email').eq('id', schoolId).maybeSingle(),
          supabaseUntyped.from('school_exams').select('id, name, type, term_id, is_active').eq('school_id', schoolId).order('created_at', { ascending: false }),
        ]);
        setResults((results[0].data as any[]) || []);
        setClasses((results[1].data as any[]) || []);
        setTerms((results[2].data as any[]) || []);
        sch = results[3].data;
        setExams((results[4].data as any[]) || []);
      }
    }
    if (sch) {
      setSchoolName(sch.name?.trim() || 'School');
      setSchoolInfo({
        name: sch.name?.trim() || 'School',
        motto: sch.motto || '',
        logo_url: sch.logo_url || null,
        principal_name: sch.principal_name || '',
        address: sch.address || '',
        phone: sch.phone || '',
        email: sch.email || '',
      });
      setPrincipalSignatureUrl(sch.principal_signature_url || null);
    }
    setLoading(false);
  };

  const filtered = results.filter(r => {
    if (selectedClass && r.class_id !== selectedClass) return false;
    if (selectedTerm && r.term_id !== selectedTerm) return false;
    // Issue 11-12: Filter by assessment/exam name
    if (selectedExam) {
      const examName = r.exams?.name || '';
      const examId = r.exam_id || '';
      if (examId !== selectedExam && examName !== selectedExam) return false;
    }
    if (!search) return true;
    return (
      r.students?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.students?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.subjects?.name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const gradeColor = (grade: string) => {
    if (grade?.startsWith('EE')) return 'bg-green-100 text-green-700';
    if (grade?.startsWith('ME')) return 'bg-blue-100 text-blue-700';
    if (grade?.startsWith('AE')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const publishResults = async () => {
    if (!selectedClass || !selectedTerm) { toast.error('Please select a class and term first'); return; }
    setPublishing(true);
    try {
      const { error: updateError } = await supabaseUntyped.from('results').update({ status: 'published', published_at: new Date().toISOString() }).eq('class_id', selectedClass).eq('term_id', selectedTerm).eq('school_id', user?.schoolId);
      if (updateError) throw updateError;
      const { data: classStudents } = await supabaseUntyped.from('students').select('id, profile_id, first_name, last_name, parent_phone, parent_name').eq('class_id', selectedClass).eq('is_active', true);
      if (!classStudents) throw new Error('Failed to fetch learners');
      const studentIds = classStudents.map(s => s.id);
      const { data: parentRelations } = await supabaseUntyped.from('parent_student_links').select('parent_id').in('student_id', studentIds);
      const parentIds = parentRelations?.map((r: any) => r.parent_id) || [];
      const allUserIds = [...classStudents.map((s: any) => s.profile_id).filter(Boolean), ...parentIds];
      const termData = terms.find(t => t.id === selectedTerm);
      const classData = classes.find(c => c.id === selectedClass);
      // Include assessment name in notification
      const examData = exams.find(e => e.id === selectedExam);
      const assessmentLabel = examData ? `(${examData.name})` : '';
      const notifTitle = 'Results Published';
      const notifMessage = `Results for ${classData?.name} - ${termData?.name} ${termData?.academic_year} ${assessmentLabel} have been published. Check your report card now!`;
      const notifications = allUserIds.map(userId => ({ user_id: userId, school_id: user?.schoolId, title: notifTitle, message: notifMessage, type: 'results_published', is_read: false, action_url: '/student/results', created_at: new Date().toISOString() }));
      if (notifications.length > 0) {
        const { error: notifError } = await supabaseUntyped.from('notifications').insert(notifications);
        if (notifError) console.warn('Notification insert warning:', notifError);
      }
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://naihzzlszvrkxrxogsuz.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey }, body: JSON.stringify({ userIds: allUserIds, title: notifTitle, message: notifMessage }) });
      } catch (pushErr) { console.warn('Push notification delivery warning:', pushErr); }
      // Issue 9: Send automated SMS to parents when results are published
      try {
        const { sendSMS, generateResultsSMS } = await import('@/lib/sms');
        let smsSentCount = 0;
        for (const student of classStudents) {
          if (student.parent_phone) {
            const { data: studentResults } = await supabaseUntyped
              .from('results')
              .select('marks, out_of, percentage')
              .eq('student_id', student.id)
              .eq('term_id', selectedTerm);
            const avgPct = studentResults && studentResults.length > 0
              ? Math.round(studentResults.reduce((s: number, r: any) => s + (r.percentage ?? (r.out_of > 0 ? Math.round((r.marks / r.out_of) * 100) : 0)), 0) / studentResults.length)
              : null;
            if (avgPct !== null) {
              const smsMsg = generateResultsSMS(
                student.parent_name || 'Parent',
                `${student.first_name} ${student.last_name}`,
                `${termData?.name || ''} ${termData?.academic_year || ''}`,
                String(avgPct)
              );
              const smsResult = await sendSMS(student.parent_phone, smsMsg);
              if (smsResult.success) smsSentCount++;
            }
          }
        }
        if (smsSentCount > 0) toast.success(`SMS sent to ${smsSentCount} parent(s)!`);
      } catch (smsErr) { console.warn('SMS notification warning:', smsErr); }
      toast.success(`Results published! ${allUserIds.length} users notified.`);
      fetchAll();
    } catch (err: any) { toast.error('Failed to publish results: ' + err.message); console.error(err); }
    setPublishing(false);
  };

  useEffect(() => {
    if (selectedClass && selectedTerm) { fetchAndComputeBestPerSubject(); } else { setBestPerSubjectList([]); }
  }, [selectedClass, selectedTerm]);

  const fetchAndComputeBestPerSubject = async () => {
    const classObj = classes.find(c => c.id === selectedClass);
    const { data } = await supabaseUntyped.from('results').select('*, students(id, first_name, last_name), subjects(name)').eq('class_id', selectedClass).eq('term_id', selectedTerm).eq('school_id', user?.schoolId);
    if (data && data.length > 0) { setBestPerSubjectList(computeBestPerSubject(data, classObj)); } else { setBestPerSubjectList([]); }
  };

  const openEditResult = (r: any) => {
    setEditingResult(r);
    setEditMarks(String(r.marks ?? ''));
    setEditOutOf(String(r.out_of ?? 100));
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResult) return;
    setSavingResult(true);
    try {
      const marks = parseFloat(editMarks);
      const outOf = parseFloat(editOutOf) || 100;
      if (isNaN(marks) || marks < 0 || marks > outOf) {
        toast.error(`Marks must be between 0 and ${outOf}`);
        setSavingResult(false);
        return;
      }
      const percentage = Math.round((marks / outOf) * 100);
      const classObj = classes.find(c => c.id === editingResult.class_id);
      const band = getSchoolLevelBand(classObj);
      const isPrimaryBand = band === 'primary';
      const cbeResult = calculateCompetencyGrade(percentage, band);
      const { error } = await supabaseUntyped.from('results').update({
        marks,
        out_of: outOf,
        percentage,
        converted_marks: marks,
        cbc_sublevel: isPrimaryBand ? null : (cbeResult.subLevel || null),
        cbc_grade: cbeResult.grade,
        cbc_points: isPrimaryBand ? null : cbeResult.points,
        cbc_descriptor: cbeResult.descriptor,
      }).eq('id', editingResult.id);
      if (error) throw new Error(error.message);
      toast.success('Result updated and grade recalculated!');
      setEditingResult(null);
      fetchAll();
    } catch (err: any) {
      toast.error('Failed to update result: ' + err.message);
    } finally {
      setSavingResult(false);
    }
  };

  const handleDeleteResult = async () => {
    if (!deletingResult) return;
    setDeletingResultLoading(true);
    try {
      const { error } = await supabaseUntyped.from('results').delete().eq('id', deletingResult.id);
      if (error) throw new Error(error.message);
      toast.success('Result deleted successfully.');
      setDeletingResult(null);
      fetchAll();
    } catch (err: any) {
      toast.error('Failed to delete result: ' + err.message);
    } finally {
      setDeletingResultLoading(false);
    }
  };

  const fetchClassResults = async () => {
    if (!selectedClass || !selectedTerm) { toast.error('Please select a class and term first'); return null; }
    const { data, error } = await supabaseUntyped.from('results').select('*, students(id, first_name, last_name, admission_number, gender, photo_url), subjects(name), exams(name)').eq('class_id', selectedClass).eq('term_id', selectedTerm).eq('school_id', user?.schoolId);
    if (error) { toast.error('Failed to fetch results: ' + error.message); return null; }
    return data || [];
  };

  const fetchPreviousTermAvg = async (studentId: string, currentTermId: string) => {
    const currentTermObj = terms.find(t => t.id === currentTermId);
    if (!currentTermObj) return null;
    const sortedTerms = [...terms].sort((a, b) => {
      if (a.academic_year !== b.academic_year) return Number(a.academic_year) - Number(b.academic_year);
      const termNum = (n: string) => n.includes('1') ? 1 : n.includes('2') ? 2 : 3;
      return termNum(a.name) - termNum(b.name);
    });
    const currentIdx = sortedTerms.findIndex(t => t.id === currentTermId);
    if (currentIdx <= 0) return null;
    const prevTerm = sortedTerms[currentIdx - 1];
    const { data } = await supabaseUntyped.from('results').select('marks, out_of, percentage').eq('student_id', studentId).eq('term_id', prevTerm.id);
    if (!data || data.length === 0) return null;
    const totalPct = data.reduce((s: number, r: any) => s + (r.percentage || (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0)), 0);
    return totalPct / data.length;
  };

  const buildStudentSummary = (rawResults: any[], classData?: any) => {
    const band = getSchoolLevelBand(classData);
    const byStudent: Record<string, any> = {};
    rawResults.forEach((r: any) => {
      const sid = r.students?.id || r.student_id;
      if (!byStudent[sid]) { byStudent[sid] = { student: r.students, subjects: {}, totalPct: 0, totalPoints: 0, count: 0, gender: r.students?.gender || null, examName: r.exams?.name || '' }; }
      const pct = r.percentage !== undefined && r.percentage !== null ? Number(r.percentage) : (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0);
      const subName = r.subjects?.name || 'Unknown';
      byStudent[sid].subjects[subName] = pct;
      byStudent[sid].subjects[subName + '_grade'] = r.cbc_sublevel || r.cbc_grade || '';
      byStudent[sid].subjects[subName + '_points'] = r.cbc_points || 0;
      byStudent[sid].totalPct += pct;
      byStudent[sid].totalPoints += r.cbc_points || 0;
      byStudent[sid].count += 1;
      // Store assessment name for display
      if (r.exams?.name && !byStudent[sid].examName) {
        byStudent[sid].examName = r.exams.name;
      }
    });
    const summaries = Object.entries(byStudent).map(([sid, v]: [string, any]) => ({
      studentId: sid, student: v.student, subjects: v.subjects, avgPct: v.count > 0 ? v.totalPct / v.count : 0,
      totalPct: v.totalPct, totalPoints: v.totalPoints, subjectCount: v.count, position: 0,
      gender: v.gender || v.student?.gender || null,
      examName: v.examName || '',
    }));
    summaries.sort((a, b) => { if (b.totalPct !== a.totalPct) return b.totalPct - a.totalPct; return b.totalPoints - a.totalPoints; });
    summaries.forEach((s, i) => { s.position = i + 1; });
    return summaries;
  };

  const drawBar = (doc: jsPDF, x: number, y: number, width: number, filledPct: number, color: [number, number, number]) => {
    doc.setDrawColor(220, 220, 220); doc.setFillColor(240, 240, 240);
    doc.rect(x, y, width, 5, 'FD');
    if (filledPct > 0) { doc.setFillColor(color[0], color[1], color[2]); doc.rect(x, y, width * filledPct, 5, 'F'); }
  };

  const getPreviousTerm = (currentTermId: string) => {
    if (!terms.length) return null;
    const sortedTerms = [...terms].sort((a, b) => {
      if (a.academic_year !== b.academic_year) return Number(a.academic_year) - Number(b.academic_year);
      const termNum = (n: string) => n.includes('1') ? 1 : n.includes('2') ? 2 : 3;
      return termNum(a.name) - termNum(b.name);
    });
    const currentIdx = sortedTerms.findIndex(t => t.id === currentTermId);
    if (currentIdx <= 0) return null;
    return sortedTerms[currentIdx - 1];
  };

  // Filter exams by selected term
  const filteredExams = selectedTerm ? exams.filter(e => !e.term_id || e.term_id === selectedTerm) : exams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Results</h1>
        <p className="text-sm text-[#666666]">View and download class results with analysis</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold text-[#111111] mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> Generate Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-[#666666] mb-1">Select Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">-- Select Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#666666] mb-1">Select Term</label>
            <select value={selectedTerm} onChange={e => { setSelectedTerm(e.target.value); setSelectedExam(''); }} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">-- Select Term --</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
            </select>
          </div>
          {/* Issue 11-12: Assessment name filter */}
          <div>
            <label className="block text-sm font-medium text-[#666666] mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Select Assessment (optional)
            </label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">-- All Assessments --</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.name} {e.type ? `(${e.type})` : ''} {e.is_active ? '' : '[Inactive]'}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={downloadClassResultsPDF} disabled={generatingPDF || !selectedClass || !selectedTerm}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
            {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generatingPDF ? 'Generating...' : 'Download Class Results PDF'}
          </button>
          <button onClick={downloadBulkReportCards} disabled={generatingBulk || !selectedClass || !selectedTerm}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {generatingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generatingBulk ? 'Generating...' : 'Bulk Report Cards (All Learners)'}
          </button>
          <button onClick={publishResults} disabled={publishing || !selectedClass || !selectedTerm}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {publishing ? 'Publishing...' : 'Publish & Notify'}
          </button>
        </div>
        <p className="text-xs text-[#999] mt-2">
          <strong>Class Results PDF</strong> = Class summary with grade distribution, learning area analysis &amp; learner table.<br />
          <strong>Bulk Report Cards</strong> = Individual report card for EACH learner with AI comments, signatures &amp; trend graphs.
        </p>
      </div>

      {/* Active filters display */}
      {(selectedClass || selectedTerm || selectedExam) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Active filters:</span>
          {selectedClass && <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">Class: {classes.find(c => c.id === selectedClass)?.name}</span>}
          {selectedTerm && <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">Term: {terms.find(t => t.id === selectedTerm)?.name} {terms.find(t => t.id === selectedTerm)?.academic_year}</span>}
          {selectedExam && <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">Assessment: {exams.find(e => e.id === selectedExam)?.name}</span>}
        </div>
      )}

      {bestPerSubjectList.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-[#111111]">Best Learner Per Learning Area</h2>
            <span className="text-xs text-gray-400 ml-auto">{classes.find(c => c.id === selectedClass)?.name} — {terms.find(t => t.id === selectedTerm)?.name} {terms.find(t => t.id === selectedTerm)?.academic_year}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bestPerSubjectList.map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <span className="text-xl mt-0.5">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide truncate">{b.subjectName}</p>
                  <p className="text-sm font-medium text-[#111111] truncate">{b.studentName}</p>
                  <p className="text-xs text-green-700 font-bold">{b.percentage}% — {b.gradeLabel}{b.points !== null ? ` (${b.points} pts)` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search by learner or learning area..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]" />
      </div>

      {/* Issue 11-12: Show assessment name in results table */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse results-table">
            <thead>
              <tr className="bg-[#2563EB] text-white">
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Learner</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Learning Area</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Assessment</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Marks</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Grade</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Points</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">DEV</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Status</th>
                <th className="text-left text-xs font-semibold uppercase px-4 py-3 border border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-[#666666]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-[#666666]">No results found</td></tr>
              ) : (
                filtered.map(r => {
                  const dev = r.deviation;
                  const isPrimary = getSchoolLevelBand(r.classes) === 'primary';
                  const pct = getPercentage(r);
                  let displayGrade = r.cbc_sublevel || r.cbc_grade || '';
                  const pts = r.cbc_points != null ? Number(r.cbc_points) : null;
                  const displayPoints = pts && pts > 0 ? pts : null;
                  return (
                    <tr key={r.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors even:bg-gray-50/50">
                      <td className="px-4 py-3 border border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0"><Award className="w-3.5 h-3.5" /></div>
                          <div>
                            <span className="text-sm font-semibold text-[#111111]">{r.students?.first_name} {r.students?.last_name}</span><br />
                            <span className="text-xs text-[#888888]">{r.students?.admission_number}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border border-gray-200 text-sm font-medium text-[#333333]">{r.subjects?.name}</td>
                      {/* Issue 11-12: Show assessment name */}
                      <td className="px-4 py-3 border border-gray-200">
                        <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full font-medium">
                          {r.exams?.name || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 border border-gray-200 text-sm font-bold text-[#111111]">{pct}%</td>
                      <td className="px-4 py-3 border border-gray-200">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColor(displayGrade)}`}>{displayGrade}</span>
                      </td>
                      <td className="px-4 py-3 border border-gray-200 text-sm font-medium text-center">{isPrimary ? <span className="text-gray-400">—</span> : (displayPoints !== null ? <span className="font-bold text-blue-700">{displayPoints}</span> : <span className="text-gray-400">—</span>)}</td>
                      <td className="px-4 py-3 border border-gray-200">
                        {dev !== null && dev !== undefined ? (
                          <span className={`flex items-center gap-1 text-xs font-semibold ${Number(dev) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Number(dev) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Number(dev) >= 0 ? '+' : ''}{Number(dev).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Minus className="w-3 h-3" />NEW</span>
                        )}
                      </td>
                      <td className="px-4 py-3 border border-gray-200">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.status === 'published' ? 'bg-green-100 text-green-700' : r.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 border border-gray-200">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditResult(r)} className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => setDeletingResult(r)} className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Edit Result Modal */}
      {editingResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Result</h2>
              <button onClick={() => setEditingResult(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-1"><strong>Learner:</strong> {editingResult.students?.first_name} {editingResult.students?.last_name}</p>
            <p className="text-sm text-gray-600 mb-4"><strong>Learning Area:</strong> {editingResult.subjects?.name}</p>
            <form onSubmit={handleSaveResult} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Marks Scored *</label>
                  <input type="number" value={editMarks} onChange={e => setEditMarks(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl text-sm" min="0" step="0.1" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Out Of</label>
                  <input type="number" value={editOutOf} onChange={e => setEditOutOf(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl text-sm" min="1" step="1" />
                </div>
              </div>
              {editMarks && editOutOf && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
                  <strong>Preview:</strong> {Math.round((parseFloat(editMarks) / parseFloat(editOutOf)) * 100)}% — Grade will be auto-recalculated on save
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingResult(null)} className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingResult} className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                  {savingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save & Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Result Confirmation Modal */}
      {deletingResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Delete Result</h2>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Are you sure you want to delete the result for:
            </p>
            <p className="text-sm font-medium text-gray-900 mb-1">{deletingResult.students?.first_name} {deletingResult.students?.last_name}</p>
            <p className="text-sm text-gray-600 mb-6">Learning Area: {deletingResult.subjects?.name}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingResult(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteResult} disabled={deletingResultLoading} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {deletingResultLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
