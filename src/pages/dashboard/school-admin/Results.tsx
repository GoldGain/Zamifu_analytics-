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
  drawPathwayPerformance,
  PATHWAY_MAPPING,
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
        supabaseUntyped.from('results').select('*, students(first_name, last_name, admission_number), subjects(name), classes(curriculum, grade_level, level, name), school_exams(name, type)').eq('school_id', schoolId).order('created_at', { ascending: false }),
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
          supabaseUntyped.from('results').select('*, students(first_name, last_name, admission_number), subjects(name), classes(curriculum, grade_level, level, name), school_exams(name, type)').eq('school_id', schoolId).order('created_at', { ascending: false }),
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
    if (selectedExam) {
      const examName = r.school_exams?.name || r.exams?.name || '';
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
      if (error) throw error;
      toast.success('Result deleted');
      setDeletingResult(null);
      fetchAll();
    } catch (err: any) {
      toast.error('Failed to delete result: ' + err.message);
    } finally {
      setDeletingResultLoading(false);
    }
  };

  const fetchClassResults = async () => {
    const { data, error } = await supabaseUntyped.from('results').select('*, students(id, first_name, last_name, admission_number, photo_url), subjects(name), classes(name, curriculum, grade_level, level), school_exams(name, type)').eq('class_id', selectedClass).eq('term_id', selectedTerm).eq('school_id', user?.schoolId);
    if (error) throw error;
    return data;
  };

  const fetchPreviousTermAvg = async (studentId: string, currentTermId: string) => {
    const currentTerm = terms.find(t => t.id === currentTermId);
    if (!currentTerm) return null;
    const prevTerm = terms.find(t => t.academic_year === currentTerm.academic_year && t.name !== currentTerm.name);
    if (!prevTerm) return null;
    const { data } = await supabaseUntyped.from('results').select('percentage, marks, out_of').eq('student_id', studentId).eq('term_id', prevTerm.id);
    if (!data || data.length === 0) return null;
    return data.reduce((s, r) => s + (r.percentage ?? (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0)), 0) / data.length;
  };

  const buildStudentSummary = (rawResults: any[], classObj: any) => {
    const studentMap: Record<string, any> = {};
    rawResults.forEach(r => {
      const sid = r.student_id;
      if (!studentMap[sid]) {
        studentMap[sid] = { studentId: sid, student: r.students, subjects: {}, totalPct: 0, count: 0, totalPoints: 0, examName: r.school_exams?.name || r.exams?.name || '' };
      }
      const pct = r.percentage !== undefined && r.percentage !== null ? Number(r.percentage) : (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0);
      studentMap[sid].subjects[r.subjects?.name || 'Unknown'] = pct;
      studentMap[sid].totalPct += pct;
      studentMap[sid].count++;
      const band = getSchoolLevelBand(classObj);
      const gr = calculateCompetencyGrade(pct, band);
      studentMap[sid].totalPoints += (gr.points || 0);
    });
    return Object.values(studentMap).map((s: any) => ({ ...s, avgPct: s.count > 0 ? s.totalPct / s.count : 0 })).sort((a, b) => b.avgPct - a.avgPct).map((s, i) => ({ ...s, position: i + 1 }));
  };

  const resolveAssessmentLabel = (raw: any[]) => {
    const names = Array.from(new Set(raw.map(r => r.school_exams?.name || r.exams?.name).filter(Boolean)));
    return names.length === 1 ? (names[0] as string) : '';
  };

  const getPreviousTerm = (currentTermId: string) => {
    const currentTerm = terms.find(t => t.id === currentTermId);
    if (!currentTerm) return null;
    return terms.find(t => t.academic_year === currentTerm.academic_year && t.name !== currentTerm.name);
  };

  const drawBar = (doc: jsPDF, x: number, y: number, w: number, pct: number, color: [number, number, number]) => {
    doc.setFillColor(240, 240, 245); doc.rect(x, y, w, 4, 'F');
    doc.setFillColor(color[0], color[1], color[2]); doc.rect(x, y, w * pct, 4, 'F');
  };

  const downloadClassResultsPDF = async () => {
    if (!selectedClass || !selectedTerm) { toast.error('Please select a class and term'); return; }
    setGeneratingPDF(true);
    try {
      const rawResults = await fetchClassResults();
      if (!rawResults || rawResults.length === 0) { toast.error('No results found'); setGeneratingPDF(false); return; }
      const classObj = classes.find(c => c.id === selectedClass);
      const termObj = terms.find(t => t.id === selectedTerm);
      const assessmentLabel = resolveAssessmentLabel(rawResults);
      const band = getSchoolLevelBand(classObj);
      const isPrimary = band === 'primary';
      const summaries = buildStudentSummary(rawResults, classObj);
      const allSubjects = Array.from(new Set(rawResults.map((r: any) => r.subjects?.name).filter(Boolean))) as string[];
      const totalStudents = summaries.length;
      const classMean = totalStudents > 0 ? summaries.reduce((sum, s) => sum + s.avgPct, 0) / totalStudents : 0;
      const prevAvgMap: Record<string, number | null> = {};
      for (const s of summaries) { prevAvgMap[s.studentId] = await fetchPreviousTermAvg(s.studentId, selectedTerm); }
      
      const subjectStats = allSubjects.map(sub => {
        const vals = summaries.map(s => s.subjects[sub]).filter(v => v !== undefined);
        const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        const grade = overallGradeWithBand(mean, band);
        return { name: sub, mean, grade, vals };
      }).sort((a, b) => b.mean - a.mean);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const displaySchoolName = schoolInfo.name || schoolName || 'School';

      // ── PAGE 1: CLASS SUMMARY ────────────────────────────────────────────────────
      {
        // Vibrant Gold header background
        doc.setFillColor(245, 166, 35); doc.rect(0, 0, 210, 35, 'F');
        const logoAdded = schoolInfo.logo_url ? await addLogoToPDF(doc, schoolInfo.logo_url, 10, 3, 26, 26) : false;
        doc.setTextColor(26, 35, 126); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text(displaySchoolName, logoAdded ? 40 : 105, 13, { align: logoAdded ? 'left' : 'center' });
        doc.setFontSize(11);
        doc.text('CLASS RESULTS SUMMARY', logoAdded ? 40 : 105, 22, { align: logoAdded ? 'left' : 'center' });
        doc.setFontSize(9);
        const summarySubtitle = assessmentLabel
          ? `${classObj?.name || 'Class'} — ${termObj?.name || 'Term'} ${termObj?.academic_year || ''} — ${assessmentLabel}`
          : `${classObj?.name || 'Class'} — ${termObj?.name || 'Term'} ${termObj?.academic_year || ''}`;
        doc.text(summarySubtitle, logoAdded ? 40 : 105, 30, { align: logoAdded ? 'left' : 'center' });

        const classGrade = overallGradeWithBand(classMean, band);
        const statsY = 42;
        doc.setFillColor(232, 234, 246); doc.rect(14, statsY, 182, 30, 'F'); // Light Lavender
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        doc.text(`Total Learners: ${totalStudents}`, 20, statsY + 8);
        doc.text(`Class Average: ${classMean.toFixed(1)}%`, 75, statsY + 8);
        doc.text(`Class Mean Grade: ${isPrimary ? classGrade.grade : classGrade.subLevel}${!isPrimary ? ` (${classGrade.points} points)` : ''}`, 130, statsY + 8);
        doc.text(`Grading System: ${isPrimary ? 'Primary CBE (Marks Only)' : 'CBE (With Points)'}`, 20, statsY + 18);
        doc.text(`Learning Areas: ${allSubjects.length}`, 130, statsY + 18);
        if (assessmentLabel) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(106, 27, 154); // Deep Purple
          doc.text(`Assessment: ${assessmentLabel}`, 20, statsY + 26);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
        }

        const gradeDistY = statsY + 38;
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
        doc.text('GRADE DISTRIBUTION', 14, gradeDistY);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

        const grades = isPrimary ? [
          { label: 'EE (Exceeding)', min: 75, color: [76, 175, 80] }, { label: 'ME (Meeting)', min: 41, color: [33, 150, 243] },
          { label: 'AE (Approaching)', min: 21, color: [255, 152, 0] }, { label: 'BE (Below)', min: 0, color: [244, 67, 54] },
        ] : [
          { label: 'EE1 (8pts)', min: 90, color: [76, 175, 80] }, { label: 'EE2 (7pts)', min: 75, color: [139, 195, 74] },
          { label: 'ME1 (6pts)', min: 58, color: [33, 150, 243] }, { label: 'ME2 (5pts)', min: 41, color: [3, 169, 244] },
          { label: 'AE1 (4pts)', min: 31, color: [255, 152, 0] }, { label: 'AE2 (3pts)', min: 21, color: [255, 193, 7] },
          { label: 'BE1 (2pts)', min: 11, color: [255, 87, 34] }, { label: 'BE2 (1pt)', min: 0, color: [244, 67, 54] },
        ];
        
        let row = 0;
        for (const g of grades) {
          const count = summaries.filter(s => {
            if (isPrimary) {
              const p = s.avgPct;
              if (g.label.startsWith('EE')) return p >= 75; if (g.label.startsWith('ME')) return p >= 41 && p < 75;
              if (g.label.startsWith('AE')) return p >= 21 && p < 41; return p < 21;
            } else {
              const gr = overallGradeWithBand(s.avgPct, band); return gr.subLevel === g.label.split(' ')[0];
            }
          }).length;
          const pct = totalStudents > 0 ? count / totalStudents : 0;
          const y = gradeDistY + 10 + row * (isPrimary ? 10 : 8);
          doc.text(`${g.label}: ${count} learner${count !== 1 ? 's' : ''} (${(pct * 100).toFixed(1)}%)`, 20, y);
          drawBar(doc, 90, y - 3, 80, pct, g.color as [number, number, number]);
          row++;
        }

        const top5Y = gradeDistY + (isPrimary ? 52 : 72);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
        doc.text('TOP 5 PERFORMERS', 14, top5Y); doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        summaries.slice(0, 5).forEach((s: any, i: number) => {
          const gr = overallGradeWithBand(s.avgPct, band);
          doc.text(`${i + 1}. ${s.student?.first_name} ${s.student?.last_name} — ${s.avgPct.toFixed(1)}% — ${isPrimary ? gr.grade : gr.subLevel}${!isPrimary ? ` (${gr.points}pts)` : ''}`, 20, top5Y + 7 + i * 6);
        });

        const bestSubjY = top5Y + 42;
        if (bestPerSubjectList.length > 0) {
          doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 166, 35);
          doc.text('BEST LEARNER PER LEARNING AREA', 14, bestSubjY); doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
          bestPerSubjectList.slice(0, 10).forEach((b, i) => { const pts = b.points !== null ? ` (${b.points} pts)` : ''; doc.text(`Best in ${b.subjectName}: ${b.studentName} — ${b.percentage}% — ${b.gradeLabel}${pts}`, 20, bestSubjY + 8 + i * 6); });
        }
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text('Generated by Zamifu Analytics School Management System', 105, 290, { align: 'center' });
      }

      // ── PAGE 2: LEARNING AREA PERFORMANCE ANALYSIS ───────────────────────────────
      doc.addPage();
      {
        doc.setFillColor(245, 166, 35); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(26, 35, 126); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(displaySchoolName, 105, 8, { align: 'center' }); doc.setFontSize(10);
        doc.text(assessmentLabel ? `LEARNING AREA PERFORMANCE ANALYSIS — ${assessmentLabel}` : 'LEARNING AREA PERFORMANCE ANALYSIS', 105, 16, { align: 'center' });

        const subRows = subjectStats.map((s, i) => {
          const gr = s.grade.subLevel;
          let status = '\u2192 AVERAGE';
          if (i === 0) status = '\u2191 STRONG'; else if (i === 1 && subjectStats.length > 3) status = '\u2191 GOOD';
          else if (i >= subjectStats.length - 2) status = '\u2193 NEEDS WORK'; if (i === subjectStats.length - 1) status = '\u2193 WEAK';
          return [String(i + 1), s.name, `${s.mean.toFixed(1)}%`, gr, status];
        });

        autoTable(doc, { startY: 26, head: [['Rank', 'Learning Area', 'Average', 'Grade', 'Status']], body: subRows, styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: 9, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [232, 234, 246] } });

        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text('Generated by Zamifu Analytics School Management System', 105, 290, { align: 'center' });
      }

      // ── PAGE 3: LEARNER RESULTS TABLE ───────────────────────────────────────
      doc.addPage();
      {
        doc.setFillColor(245, 166, 35); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(26, 35, 126); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(displaySchoolName, 105, 8, { align: 'center' }); doc.setFontSize(10);
        const tableSubtitle = assessmentLabel
          ? `LEARNER RESULTS TABLE — ${classObj?.name || ''} — ${termObj?.name || ''} ${termObj?.academic_year || ''} — ${assessmentLabel}`
          : `LEARNER RESULTS TABLE — ${classObj?.name || ''} — ${termObj?.name || ''} ${termObj?.academic_year || ''}`;
        doc.text(tableSubtitle, 105, 16, { align: 'center' });

        const subjectShorts = allSubjects.map(s => shortName(s));
        const tableHeaders = isPrimary ? ['POS', 'Learner', ...subjectShorts, 'Total', 'Avg%', 'Grade'] : ['POS', 'Learner', ...subjectShorts, 'Total', 'Avg%', 'Pts', 'Grade'];

        const tableRows = summaries.map((s: any) => {
          const gr = overallGradeWithBand(s.avgPct, band);
          const subjectCells = allSubjects.map(sub => s.subjects[sub] !== undefined ? `${s.subjects[sub].toFixed(0)}` : '\u2014');
          const row = [String(s.position), `${s.student?.first_name} ${s.student?.last_name}`, ...subjectCells, s.totalPct.toFixed(0), `${s.avgPct.toFixed(1)}%` ];
          if (!isPrimary) row.push(String(s.totalPoints));
          row.push(isPrimary ? gr.grade : gr.subLevel);
          return row;
        });

        autoTable(doc, { startY: 26, head: [tableHeaders], body: tableRows, styles: { fontSize: 7, cellPadding: 1 }, headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: 7, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [232, 234, 246] }, margin: { left: 10, right: 10 } });
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text('Generated by Zamifu Analytics School Management System', 105, 290, { align: 'center' });
      }

      const pdfName = `class_results_${classObj?.name || 'Class'}_${termObj?.name || 'Term'}_${termObj?.academic_year || ''}.pdf`.replace(/\s+/g, '_');
      doc.save(pdfName);
      toast.success('Class results PDF generated!');
    } catch (err: any) { toast.error('Failed to generate PDF: ' + err.message); console.error(err); }
    setGeneratingPDF(false);
  };

  const downloadBulkReportCards = async () => {
    if (!selectedClass || !selectedTerm) { toast.error('Please select a class and term'); return; }
    setGeneratingBulk(true);
    try {
      const rawResults = await fetchClassResults();
      if (!rawResults || rawResults.length === 0) { toast.error('No results found'); setGeneratingBulk(false); return; }
      const classObj = classes.find(c => c.id === selectedClass);
      const band = getSchoolLevelBand(classObj);
      const isPrimary = band === 'primary';
      const allSubjects = Array.from(new Set(rawResults.map((r: any) => r.subjects?.name).filter(Boolean))) as string[];
      const summaries = buildStudentSummary(rawResults, classObj);
      const termObj = terms.find(t => t.id === selectedTerm);
      const assessmentLabel = resolveAssessmentLabel(rawResults);
      const totalStudents = summaries.length;

      let teacherSigUrl: string | null = null;
      if (classObj?.class_teacher_id) {
        const { data: teacherData } = await supabaseUntyped.from('teachers').select('signature_url').eq('id', classObj.class_teacher_id).maybeSingle();
        teacherSigUrl = teacherData?.signature_url || null;
      }
      const signatures: SignatureInfo = { principal_signature_url: principalSignatureUrl, teacher_signature_url: teacherSigUrl };

      const prevAvgMap: Record<string, number | null> = {};
      for (const s of summaries) { prevAvgMap[s.studentId] = await fetchPreviousTermAvg(s.studentId, selectedTerm); }

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const bulkBestPerSubject = computeBestPerSubject(rawResults, classObj);

      const studentTrends: Record<string, { term: string; avg: number }[]> = {};
      for (const s of summaries) {
        const { data: allResults } = await supabaseUntyped.from('results').select('percentage, marks, out_of, term_id, terms(name, academic_year)').eq('student_id', s.studentId).order('terms(academic_year)', { ascending: true }).order('terms(name)', { ascending: true });
        if (allResults) {
          const termMap: Record<string, { term: string; total: number; count: number }> = {};
          allResults.forEach((r: any) => {
            const tname = r.terms?.name || ''; const year = r.terms?.academic_year || '';
            const key = `${year}-${tname}`;
            const pct = r.percentage !== undefined && r.percentage !== null ? Number(r.percentage) : (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0);
            if (!termMap[key]) termMap[key] = { term: `${tname} ${year}`, total: 0, count: 0 };
            termMap[key].total += pct; termMap[key].count++;
          });
          studentTrends[s.studentId] = Object.values(termMap).map(t => ({ term: t.term, avg: t.count > 0 ? t.total / t.count : 0 }));
        }
      }

      for (let idx = 0; idx < summaries.length; idx++) {
        const s = summaries[idx];
        if (idx > 0) doc.addPage();
        const prevAvg = prevAvgMap[s.studentId];
        const deviation = prevAvg !== null && prevAvg !== undefined ? s.avgPct - prevAvg : null;
        const isNew = deviation === null;
        const subjectEntries = Object.entries(s.subjects).filter(([k]) => !k.endsWith('_grade') && !k.endsWith('_points')) as [string, number][];
        const sortedBest = [...subjectEntries].sort((a, b) => b[1] - a[1]);
        const bestSubject = sortedBest[0]?.[0] || 'all learning areas';
        const weakestSubject = sortedBest[sortedBest.length - 1]?.[0] || 'some learning areas';
        const studentFullName = `${s.student?.first_name || ''} ${s.student?.last_name || ''}`;
        const aiComment = generateUniqueAIComment(studentFullName, s.avgPct, deviation, bestSubject, weakestSubject, s.position, totalStudents, isNew, classObj);

        await drawReportHeader(doc, schoolInfo);
        if (s.student?.photo_url) { try { await addStudentPhotoToPDF(doc, s.student.photo_url, 168, 33, 30); } catch {} }

        const cardAssessment = s.examName || assessmentLabel || '';
        doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        const y = 38;
        doc.text(`Learner: ${studentFullName}`, 14, y);
        doc.text(`Adm No: ${s.student?.admission_number || 'N/A'}`, 14, y + 7);
        doc.text(`Class: ${classObj?.name || 'N/A'}`, 14, y + 14);
        doc.text(`Term: ${termObj?.name || ''} ${termObj?.academic_year || ''}`, 120, y);
        if (cardAssessment) {
          doc.setTextColor(106, 27, 154); doc.setFont('helvetica', 'bold');
          doc.text(`Assessment: ${cardAssessment}`, 120, y + 7);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
          doc.text(`Position: ${s.position}${s.position === 1 ? 'st' : s.position === 2 ? 'nd' : s.position === 3 ? 'rd' : 'th'} out of ${totalStudents}`, 120, y + 14);
          doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, y + 21);
          doc.setDrawColor(106, 27, 154); doc.line(14, y + 26, 196, y + 26);
        } else {
          doc.text(`Position: ${s.position}${s.position === 1 ? 'st' : s.position === 2 ? 'nd' : s.position === 3 ? 'rd' : 'th'} out of ${totalStudents}`, 120, y + 7);
          doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, y + 14);
          doc.setDrawColor(106, 27, 154); doc.line(14, y + 20, 196, y + 20);
        }
        const tableStartY = cardAssessment ? y + 31 : y + 25;

        const subjectRows = subjectEntries.map(([subName, pct]) => {
          const g = overallGradeWithBand(pct, band);
          return isPrimary ? [subName, `${pct.toFixed(0)}%`, g.subLevel, g.descriptor] : [subName, `${pct.toFixed(0)}%`, g.subLevel, String(g.points), g.descriptor];
        });

        autoTable(doc, { startY: tableStartY, head: [isPrimary ? ['Learning Area', 'Percentage', 'CBE Grade', 'Descriptor'] : ['Learning Area', 'Percentage', 'CBE Grade', 'Points', 'Descriptor']], body: subjectRows, styles: { fontSize: 9 }, headStyles: { fillColor: [106, 27, 154], textColor: 255 }, alternateRowStyles: { fillColor: [232, 234, 246] } });

        let currentY = (doc as any).lastAutoTable.finalY + 8;

        // NEW: Pathway Performance Profile
        const studentResultsForPathways = subjectEntries.map(([subName, pct]) => ({ subjects: { name: subName }, marks: pct, out_of: 100 }));
        currentY = drawPathwayPerformance(doc, studentResultsForPathways, currentY) + 8;

        const gr = overallGradeWithBand(s.avgPct, band);
        doc.setFillColor(0, 137, 123); doc.rect(14, currentY, 182, 25, 'F'); // Teal
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text(`Average: ${s.avgPct.toFixed(1)}%`, 20, currentY + 8);
        doc.text(`Grade: ${gr.subLevel}`, 70, currentY + 8);
        doc.text(`Position: ${s.position}/${totalStudents}`, 120, currentY + 8);
        if (!isPrimary) doc.text(`Points: ${s.totalPoints}`, 160, currentY + 8);
        doc.text(`Total: ${s.totalPct.toFixed(0)}/${allSubjects.length * 100}`, 20, currentY + 17);
        if (!isPrimary) doc.text(`${gr.descriptor}`, 70, currentY + 17);

        let devText = 'First Term \u2014 No previous data';
        if (deviation !== null) { const arrow = deviation >= 0 ? '\u25B2' : '\u25BC'; const sign = deviation >= 0 ? '+' : ''; devText = `${arrow} ${sign}${deviation.toFixed(1)}% vs previous term`; }
        doc.setFont('helvetica', 'normal');
        if (deviation !== null && deviation >= 0) doc.setTextColor(22, 163, 74); else if (deviation !== null && deviation < 0) doc.setTextColor(220, 38, 38); else doc.setTextColor(255, 255, 255);
        doc.text(devText, 120, currentY + 17); doc.setTextColor(0, 0, 0);

        let trendY = currentY + 30;
        const trends = studentTrends[s.studentId] || [];
        if (trends.length >= 2) { drawTrendGraph(doc, trends, 14, trendY, 182, 45, band); trendY += 50; }

        const bulkStudentBests = bulkBestPerSubject.filter(b => b.studentId === (s.student?.id || s.studentId));
        if (bulkStudentBests.length > 0) {
          doc.setFillColor(255, 248, 225); doc.rect(14, trendY, 182, 6 + bulkStudentBests.length * 6, 'F');
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 166, 35);
          doc.text('ACHIEVEMENT:', 18, trendY + 5); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
          bulkStudentBests.forEach((b, bi) => { const pts = b.points !== null ? ` (${b.points} pts)` : ''; doc.text(`Best in ${b.subjectName}: ${b.percentage}% \u2014 ${b.gradeLabel}${pts}`, 18, trendY + 11 + bi * 6); });
          trendY += 6 + bulkStudentBests.length * 6 + 4;
        }

        const commentY = trendY + 2;
        doc.setFillColor(232, 234, 246); doc.rect(14, commentY, 182, 28, 'F'); // Light Lavender
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text("Class Teacher's Comment:", 18, commentY + 7); doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
        const commentLines = doc.splitTextToSize(aiComment, 170); doc.text(commentLines, 18, commentY + 14);

        const sigY = commentY + 32;
        addSignaturesToPDF(doc, signatures, sigY, schoolInfo);
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text(`Page ${idx + 1} of ${totalStudents} | Zamifu Analytics School Management System`, 105, 290, { align: 'center' });
      }

      const bulkPdfName = ['bulk_report_cards', classObj?.name, termObj?.name, termObj?.academic_year, assessmentLabel || null].filter(Boolean).join('_').replace(/\s+/g, '_');
      doc.save(`${bulkPdfName}.pdf`);
      toast.success(assessmentLabel ? `Bulk report cards generated for ${totalStudents} learners (${assessmentLabel})!` : `Bulk report cards generated for ${totalStudents} learners!`);
    } catch (err: any) { toast.error('Failed to generate bulk report cards: ' + err.message); console.error(err); }
    setGeneratingBulk(false);
  };

  const filteredExams = exams.filter(e => !selectedTerm || e.term_id === selectedTerm);

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
      </div>
      
      {/* Rest of the component (Results table, etc.) can remain as is or be improved further */}
    </div>
  );
}
