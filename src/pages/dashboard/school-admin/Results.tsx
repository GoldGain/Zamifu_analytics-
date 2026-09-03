import { useState, useEffect } from 'react';
import { supabaseUntyped } from "@/lib/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { Search, Award, Download, FileText, Loader2, TrendingUp, TrendingDown, Minus, Send, Bell, Trophy, Pencil, Trash2, X, Filter, Users } from 'lucide-react';
import PdfFontSizeDialog from '@/components/PdfFontSizeDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { calculateCompetencyGrade, getSchoolLevelBand, is844Curriculum, calculate844Grade } from '@/lib/grading';
import type { SchoolLevelBand, SubjectResult } from '@/lib/grading';
import { computeBestPerSubject } from '@/lib/bestPerSubject';
import type { BestInSubject } from '@/lib/bestPerSubject';
import {
  generateUniqueAIComment,
  drawAIComment,
  drawTrendGraph,
  addSignaturesToPDF,
  drawReportHeader,
  addLogoToPDF,
  drawPathwayPerformance,
  drawStudentInfo,
  drawResultsTable,
  drawSummaryBox,
  drawDeviation,
  drawAchievements,
  drawReportFooter,
  SUBJECT_ORDER,
  buildPerformanceTrend,
  type SchoolInfo,
  type SignatureInfo,
  type PerformanceTrendRecord,
} from '@/lib/reportCardPdf';
import {
  configurePdfFontSize,
  DEFAULT_PDF_FONT_SIZE,
  type PdfFontSize,
  pdfFontSize,
} from '@/lib/pdfFontSize';

function sortSubjects(subjects: string[]) {
  return [...subjects].sort((a, b) => {
    const indexA = SUBJECT_ORDER.findIndex(s => a.toLowerCase().includes(s.toLowerCase()));
    const indexB = SUBJECT_ORDER.findIndex(s => b.toLowerCase().includes(s.toLowerCase()));
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
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
  'Creative Arts': 'C-Arts',
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

type ResultsScope = 'school' | 'dos' | 'class_teacher';

export default function SchoolAdminResults({ scope = 'school' }: { scope?: ResultsScope }) {
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
  const [scopedClassId, setScopedClassId] = useState('');

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
  const [pendingPdfDownload, setPendingPdfDownload] = useState<{
    target: 'class-results' | 'bulk-report-cards' | 'report-card';
    student?: any;
  } | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const getPercentage = (r: any) => {
    if (r.percentage !== undefined && r.percentage !== null) return Number(r.percentage);
    return Math.round((r.marks / (r.out_of || 100)) * 100);
  };

  const fetchAll = async () => {
    setLoading(true);
    const schoolId = user?.schoolId ?? '';
    let resolvedScopedClassId = '';
    if (scope === 'class_teacher' && user?.id) {
      const { data: teacherData } = await supabaseUntyped.from('teachers').select('assigned_class_id').eq('profile_id', user.id).maybeSingle();
      resolvedScopedClassId = teacherData?.assigned_class_id || '';
      if (!resolvedScopedClassId) {
        const { data: classData } = await supabaseUntyped.from('classes').select('id').eq('school_id', schoolId).eq('class_teacher_id', user.id).maybeSingle();
        resolvedScopedClassId = classData?.id || '';
      }
    }
    setScopedClassId(resolvedScopedClassId);
    let sch: any = null;
    try {
      const resultsData = await Promise.all([
        supabaseUntyped.from('results').select('*, students(id, first_name, last_name, admission_number, assessment_number, photo_url, gender), subjects(name), classes(curriculum, grade_level, level, name), school_exams(name, type)').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabaseUntyped.from('classes').select('*').eq('school_id', schoolId).order('level'),
        supabaseUntyped.from('terms').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
        supabaseUntyped.from('schools').select('name, motto, logo_url, principal_name, principal_signature_url, address, phone, email, next_term_start_date, school_closes_on, school_opens_on').eq('id', schoolId).maybeSingle(),
        supabaseUntyped.from('school_exams').select('id, name, type, term_id, is_active').eq('school_id', schoolId).order('created_at', { ascending: false }),
      ]);
      setResults((resultsData[0].data as any[]) || []);
      const loadedClasses = (resultsData[1].data as any[]) || [];
      const visibleClasses = scope === 'class_teacher' && resolvedScopedClassId
        ? loadedClasses.filter((c: any) => c.id === resolvedScopedClassId)
        : loadedClasses;
      setClasses(visibleClasses);
      setTerms((resultsData[2].data as any[]) || []);
      sch = resultsData[3].data;
      setExams((resultsData[4].data as any[]) || []);
      if (scope === 'class_teacher' && resolvedScopedClassId) setSelectedClass(resolvedScopedClassId);
    } catch (err: any) {
      console.error('Fetch error:', err);
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
        next_term_start_date: sch.next_term_start_date || null,
        school_closes_on: sch.school_closes_on || null,
        school_opens_on: sch.school_opens_on || sch.next_term_start_date || null,
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
    const searchLower = search.toLowerCase();
    return (
      r.students?.first_name?.toLowerCase().includes(searchLower) ||
      r.students?.last_name?.toLowerCase().includes(searchLower) ||
      r.students?.admission_number?.toLowerCase().includes(searchLower) ||
      r.students?.assessment_number?.toLowerCase().includes(searchLower) ||
      r.subjects?.name?.toLowerCase().includes(searchLower)
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
        const { sendSMS, SMS_TEMPLATES } = await import('@/lib/sms');
        let smsSentCount = 0;
        for (const student of classStudents) {
          if (student.parent_phone) {
            const { data: studentResults } = await supabaseUntyped
              .from('results')
              .select('marks, out_of, percentage, subjects(name), cbc_grade')
              .eq('student_id', student.id)
              .eq('term_id', selectedTerm);
            if (studentResults && studentResults.length > 0) {
              const classObj = classes.find((c: any) => c.id === selectedClass);
              const band = getSchoolLevelBand(classObj);
              // Build per-subject list with name, marks%, and grade
              const subjectList = studentResults.map((r: any) => {
                const pct = r.percentage !== undefined && r.percentage !== null
                  ? Math.round(Number(r.percentage))
                  : r.out_of > 0 ? Math.round((r.marks / r.out_of) * 100) : 0;
                const gradeInfo = calculateCompetencyGrade(pct, band);
                return {
                  name: r.subjects?.name || 'Unknown',
                  marks: pct,
                  grade: gradeInfo.subLevel || gradeInfo.grade || '',
                };
              });
              // Compute totals and rank
              // totalPct: sum of percentage marks (used for Average Marks across all levels)
              // totalPoints/totalPointsPossible: for Junior/Senior — actual points out of subjects × 8
              const isPrimaryBand = band === 'primary';
              const totalPct = subjectList.reduce((s: number, r: any) => s + r.marks, 0);
              const gradePoints = subjectList.reduce((sum: number, r: any) => {
                const pct = typeof r.marks === 'number' ? r.marks : 0;
                const g = calculateCompetencyGrade(pct, band);
                return sum + (g.points || 0);
              }, 0);
              // For Primary use percentage-sum semantics (as before); for Junior/Senior use points out of subjects × 8
              const smsTotalPoints = isPrimaryBand ? totalPct : gradePoints;
              const smsTotalPossible = isPrimaryBand ? subjectList.length * 100 : subjectList.length * 8;
              const allStudentSummaries = buildStudentSummary(
                results.filter((r: any) => r.class_id === selectedClass && r.term_id === selectedTerm),
                classObj
              );
              const studentSummary = allStudentSummaries.find((s: any) => s.studentId === student.id);
              const rank = studentSummary?.position ?? 0;
              const totalStudentsInClass = allStudentSummaries.length;
              const smsMsg = SMS_TEMPLATES.resultsToParent(
                `${student.first_name} ${student.last_name}`,
                classData?.name || '',
                subjectList,
                smsTotalPoints,
                smsTotalPossible,
                rank,
                totalStudentsInClass,
                '',
                classObj
              );
              const smsResult = await sendSMS(student.parent_phone, smsMsg, undefined, user?.schoolId || undefined);
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
    const effectiveClassId = scope === 'class_teacher' ? scopedClassId : selectedClass;
    let query = supabaseUntyped.from('results').select('*, students(id, first_name, last_name, admission_number, photo_url, gender), subjects(name), classes(name, curriculum, grade_level, level), school_exams(name, type)').eq('class_id', effectiveClassId).eq('term_id', selectedTerm).eq('school_id', user?.schoolId);
    if (selectedExam) query = query.eq('exam_id', selectedExam);
    const { data, error } = await query;
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
        studentMap[sid] = { studentId: sid, student: r.students, subjects: {}, totalPct: 0, count: 0, totalPoints: 0, gender: r.students?.gender || null, examName: r.school_exams?.name || r.exams?.name || '' };
      }
      const pct = r.percentage !== undefined && r.percentage !== null ? Number(r.percentage) : (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0);
      studentMap[sid].subjects[r.subjects?.name || 'Unknown'] = pct;
      studentMap[sid].totalPct += pct;
      studentMap[sid].count++;
      const band = getSchoolLevelBand(classObj);
      const gr = calculateCompetencyGrade(pct, band);
      studentMap[sid].totalPoints += (gr.points || 0);
    });
    return Object.values(studentMap).map((s: any) => ({ ...s, avgPct: s.count > 0 ? s.totalPct / s.count : 0, gender: s.gender || s.student?.gender || null })).sort((a, b) => b.avgPct - a.avgPct).map((s, i) => ({ ...s, position: i + 1 }));
  };

  const resolveAssessmentLabel = (raw: any[]) => {
    const names = Array.from(new Set(raw.map(r => r.school_exams?.name || r.exams?.name).filter(Boolean)));
    return names.length === 1 ? (names[0] as string) : '';
  };

  const openPdfFontSizeDialog = (target: 'class-results' | 'bulk-report-cards' | 'report-card', student?: any) => {
    if (generatingPDF || generatingBulk) return;
    setPendingPdfDownload({ target, student });
  };

  const closePdfFontSizeDialog = () => setPendingPdfDownload(null);

  const confirmPdfFontSize = async (fontSize: PdfFontSize) => {
    const request = pendingPdfDownload;
    if (!request) return;
    try {
      if (request.target === 'class-results') await downloadClassResultsPDF(fontSize);
      else if (request.target === 'bulk-report-cards') await downloadBulkReportCards(fontSize);
      else if (request.student) await downloadSingleReportCard(request.student, fontSize);
    } finally {
      setPendingPdfDownload(null);
    }
  };

  const downloadClassResultsPDF = async (fontSize: PdfFontSize = DEFAULT_PDF_FONT_SIZE) => {
    if (!(scope === 'class_teacher' ? scopedClassId : selectedClass) || !selectedTerm) { toast.error('Please select a class and term'); return; }
    setGeneratingPDF(true);
    try {
      const rawResults = await fetchClassResults();
      if (!rawResults || rawResults.length === 0) { toast.error('No results found'); setGeneratingPDF(false); return; }
      const classObj = classes.find(c => c.id === (scope === 'class_teacher' ? scopedClassId : selectedClass));
      const termObj = terms.find(t => t.id === selectedTerm);
      const assessmentLabel = resolveAssessmentLabel(rawResults);
      const band = getSchoolLevelBand(classObj);
      const isPrimary = band === 'primary';
      const summaries = buildStudentSummary(rawResults, classObj);
      const allSubjectsRaw = Array.from(new Set(rawResults.map((r: any) => r.subjects?.name).filter(Boolean))) as string[];
      const allSubjects = sortSubjects(allSubjectsRaw);
      const totalStudents = summaries.length;
      const classMean = totalStudents > 0 ? summaries.reduce((sum, s) => sum + s.avgPct, 0) / totalStudents : 0;
      
      const subjectStats = allSubjects.map(sub => {
        const vals = summaries.map(s => s.subjects[sub]).filter(v => v !== undefined);
        const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        const grade = overallGradeWithBand(mean, band);
        return { name: sub, mean, grade, vals };
      }).sort((a, b) => b.mean - a.mean);

      const orderedTerms = [...terms].sort((a, b) => Number(a.academic_year) - Number(b.academic_year) || Number(a.term_number || 0) - Number(b.term_number || 0));
      const currentTermIndex = orderedTerms.findIndex((term) => term.id === selectedTerm);
      const previousTerm = currentTermIndex > 0 ? orderedTerms[currentTermIndex - 1] : null;
      let previousSubjectStats = new Map<string, number>();
      if (previousTerm) {
        const { data: previousResults } = await supabaseUntyped
          .from('results')
          .select('subject_id, marks, out_of, percentage, subjects(name)')
          .eq('class_id', scope === 'class_teacher' ? scopedClassId : selectedClass)
          .eq('term_id', previousTerm.id);
        const previousBySubject = new Map<string, number[]>();
        (previousResults || []).forEach((result: any) => {
          const subjectName = result.subjects?.name;
          if (!subjectName) return;
          const percentage = Number(result.percentage ?? (Number(result.out_of) > 0 ? Number(result.marks || 0) / Number(result.out_of) * 100 : 0));
          const values = previousBySubject.get(subjectName) || [];
          values.push(percentage);
          previousBySubject.set(subjectName, values);
        });
        previousSubjectStats = new Map(Array.from(previousBySubject.entries()).map(([name, values]) => [name, values.reduce((sum, value) => sum + value, 0) / values.length]));
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      configurePdfFontSize(doc, fontSize);
      const displaySchoolName = schoolInfo.name || schoolName || 'School';

      // ── PAGE 1: CLASS SUMMARY ────────────────────────────────────────────────────
      {
        doc.setFillColor(245, 166, 35); doc.rect(0, 0, 210, 35, 'F');
        const logoAdded = schoolInfo.logo_url ? await addLogoToPDF(doc, schoolInfo.logo_url, 10, 3, 26, 26) : false;
        doc.setTextColor(26, 35, 126); doc.setFontSize(pdfFontSize(doc, 16)); doc.setFont('helvetica', 'bold');
        doc.text(displaySchoolName, logoAdded ? 40 : 105, 13, { align: logoAdded ? 'left' : 'center' });
        doc.setFontSize(pdfFontSize(doc, 11));
        doc.text('CLASS RESULTS SUMMARY', logoAdded ? 40 : 105, 22, { align: logoAdded ? 'left' : 'center' });
        doc.setFontSize(pdfFontSize(doc, 9));
        const summarySubtitle = assessmentLabel
          ? `${classObj?.name || 'Class'} — ${termObj?.name || 'Term'} ${termObj?.academic_year || ''} — ${assessmentLabel}`
          : `${classObj?.name || 'Class'} — ${termObj?.name || 'Term'} ${termObj?.academic_year || ''}`;
        doc.text(summarySubtitle, logoAdded ? 40 : 105, 30, { align: logoAdded ? 'left' : 'center' });

        const classGrade = overallGradeWithBand(classMean, band);
        const statsY = 42;
        const boys = summaries.filter(s => String(s.student?.gender || '').toLowerCase().startsWith('m')).length;
        const girls = summaries.filter(s => String(s.student?.gender || '').toLowerCase().startsWith('f')).length;
        // The requested subject average is the mean of every learning area's average.
        const subjectAverageMarks = subjectStats.length > 0
          ? subjectStats.reduce((sum, subject) => sum + subject.mean, 0) / subjectStats.length
          : 0;

        // Class Mean Marks = Total Marks of ALL Learners ÷ Number of Learners
        // Each student's totalPct is the sum of their subject percentages (each out of 100)
        // totalPct / count = avgPct (their average %). Total marks = avgPct * numSubjects
        const numSubjects = allSubjects.length;
        const classMeanMarksValue = totalStudents > 0
          ? summaries.reduce((sum, s) => sum + s.totalPct, 0) / totalStudents
          : 0;
        const classMeanMarksOutOf = numSubjects * 100;

        doc.setFillColor(232, 234, 246); doc.rect(14, statsY, 182, 68, 'F');
        doc.setFontSize(pdfFontSize(doc, 8.5)); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        doc.text(`Total Learners: ${totalStudents}`, 20, statsY + 8);
        doc.text(`Boys: ${boys}`, 72, statsY + 8);
        doc.text(`Girls: ${girls}`, 108, statsY + 8);
        doc.text(`Class Mean Grade: ${isPrimary ? classGrade.grade : classGrade.subLevel}${!isPrimary ? ` (${classGrade.points} pts)` : ''}`, 140, statsY + 8);
        doc.text(`Class Mean Marks: ${classMeanMarksValue.toFixed(1)} / ${classMeanMarksOutOf}`, 20, statsY + 18);
        doc.text(`Subject Average Marks: ${subjectAverageMarks.toFixed(1)}%`, 20, statsY + 28);
        doc.text(`Learning Areas: ${allSubjects.length}`, 88, statsY + 28);
        doc.text(`Grading System: ${isPrimary ? 'Primary CBE (Marks Only)' : 'CBE (With Points)'}`, 125, statsY + 28);
        if (assessmentLabel) {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(106, 27, 154);
          doc.text(`Assessment: ${assessmentLabel}`, 20, statsY + 38);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        }

        const gradeDistY = statsY + 75;
        doc.setFontSize(pdfFontSize(doc, 11)); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
        doc.text('PERFORMANCE DISTRIBUTION', 14, gradeDistY); doc.setFontSize(pdfFontSize(doc, 8)); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

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
          const drawBar = (doc: jsPDF, x: number, y: number, w: number, pct: number, color: [number, number, number]) => {
            doc.setFillColor(240, 240, 245); doc.rect(x, y, w, 4, 'F');
            doc.setFillColor(color[0], color[1], color[2]); doc.rect(x, y, w * pct, 4, 'F');
          };
          drawBar(doc, 90, y - 3, 80, pct, g.color as [number, number, number]);
          row++;
        }

        const top5Y = gradeDistY + (isPrimary ? 52 : 72);
        doc.setFontSize(pdfFontSize(doc, 10)); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
        doc.text('TOP 5 PERFORMERS', 14, top5Y); doc.setFontSize(pdfFontSize(doc, 8)); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        summaries.slice(0, 5).forEach((s: any, i: number) => {
          const gr = overallGradeWithBand(s.avgPct, band);
          doc.text(`${i + 1}. ${s.student?.first_name} ${s.student?.last_name} — ${s.avgPct.toFixed(1)}% — ${isPrimary ? gr.grade : gr.subLevel}${!isPrimary ? ` (${gr.points}pts)` : ''}`, 20, top5Y + 7 + i * 6);
        });

        const bestSubjY = top5Y + 42;
        if (bestPerSubjectList.length > 0) {
          doc.setFontSize(pdfFontSize(doc, 10)); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 166, 35);
          doc.text('BEST LEARNER PER LEARNING AREA', 14, bestSubjY); doc.setTextColor(0, 0, 0); doc.setFontSize(pdfFontSize(doc, 8)); doc.setFont('helvetica', 'normal');
          bestPerSubjectList.slice(0, 10).forEach((b, i) => { const pts = b.points !== null ? ` (${b.points} pts)` : ''; doc.text(`Best in ${b.subjectName}: ${b.studentName} (${b.percentage}% — ${b.gradeLabel}${pts})`, 20, bestSubjY + 8 + i * 6); });
        }
        doc.setFontSize(pdfFontSize(doc, 7)); doc.setTextColor(150, 150, 150);
        doc.text('Generated by Zamifu Analytics School Management System', 105, 290, { align: 'center' });
      }

      // ── PAGE 2: LEARNING AREA PERFORMANCE ANALYSIS ───────────────────────────────
      doc.addPage();
      {
        doc.setFillColor(245, 166, 35); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(26, 35, 126); doc.setFontSize(pdfFontSize(doc, 14)); doc.setFont('helvetica', 'bold');
        doc.text(displaySchoolName, 105, 8, { align: 'center' }); doc.setFontSize(pdfFontSize(doc, 14));
        doc.text(assessmentLabel ? `LEARNING AREA PERFORMANCE ANALYSIS — ${assessmentLabel}` : 'LEARNING AREA PERFORMANCE ANALYSIS', 105, 16, { align: 'center' });

        const chartTop = 27;
        const chartRowHeight = 7;
        const chartLabelWidth = 30;
        const chartWidth = 52;
        doc.setFontSize(pdfFontSize(doc, 14)); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
        doc.text(previousTerm ? 'CURRENT VS PREVIOUS ASSESSMENT' : 'LEARNING AREA PERFORMANCE', 14, chartTop);
        doc.setFontSize(pdfFontSize(doc, 10)); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
        doc.text(`Current: ${assessmentLabel || termObj?.name || 'Selected assessment'}`, 14, chartTop + 6);
        if (previousTerm) doc.text(`Previous: ${previousTerm.name} ${previousTerm.academic_year || ''}`, 112, chartTop + 6);
        subjectStats.forEach((subject, index) => {
          const y = chartTop + 12 + index * chartRowHeight;
          const previous = previousSubjectStats.get(subject.name) ?? 0;
          const label = subject.name.length > 20 ? `${subject.name.slice(0, 19)}…` : subject.name;
          doc.setFontSize(pdfFontSize(doc, 10)); doc.setTextColor(0, 0, 0); doc.text(label, 14, y + 3);
          doc.setFillColor(225, 230, 240); doc.rect(14 + chartLabelWidth, y, chartWidth, 3, 'F');
          doc.setFillColor(37, 99, 235); doc.rect(14 + chartLabelWidth, y, chartWidth * Math.min(100, subject.mean) / 100, 3, 'F');
          if (previousTerm) {
            doc.setFillColor(225, 230, 240); doc.rect(112 + chartLabelWidth, y, chartWidth, 3, 'F');
            doc.setFillColor(106, 27, 154); doc.rect(112 + chartLabelWidth, y, chartWidth * Math.min(100, previous) / 100, 3, 'F');
          }
          doc.setFontSize(pdfFontSize(doc, 9)); doc.setTextColor(37, 99, 235); doc.text(`${subject.mean.toFixed(1)}%`, 14 + chartLabelWidth + chartWidth + 2, y + 3);
          if (previousTerm) { doc.setTextColor(106, 27, 154); doc.text(`${previous.toFixed(1)}%`, 112 + chartLabelWidth + chartWidth + 2, y + 3); }
        });

        const subRows = subjectStats.map((s, i) => {
          const gr = s.grade.subLevel;
          let status = '--> AVERAGE';
          if (i === 0) status = 'Up STRONG';
          else if (i === 1 && subjectStats.length > 3) status = 'Up GOOD';
          else if (i === subjectStats.length - 1) status = 'Down WEAK';
          else if (i === subjectStats.length - 2) status = 'Down NEEDS WORK';
          const displayName = s.name === 'Creative Arts' ? 'C-Arts' : s.name;
          return [String(i + 1), displayName, `${s.mean.toFixed(1)}%`, gr, status];
        });

        autoTable(doc, { startY: Math.min(150, chartTop + 20 + subjectStats.length * chartRowHeight), head: [['Rank', 'Learning Area', 'Average', 'Grade', 'Status']], body: subRows, styles: { fontSize: pdfFontSize(doc, 14), cellPadding: 2 }, headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: pdfFontSize(doc, 14), fontStyle: 'bold' }, alternateRowStyles: { fillColor: [232, 234, 246] } });
        doc.setFontSize(pdfFontSize(doc, 14)); doc.setTextColor(150, 150, 150);
        doc.text('Generated by Zamifu Analytics School Management System', 105, 290, { align: 'center' });
      }

      // ── PAGE 3: LEARNER RESULTS TABLE ───────────────────────────────────────
      // Keep every page of the Class Summary Results PDF in portrait orientation.
      doc.addPage('a4', 'portrait');
      {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const centerX = pageWidth / 2;
        doc.setFillColor(245, 166, 35); doc.rect(0, 0, pageWidth, 20, 'F');
        doc.setTextColor(26, 35, 126); doc.setFontSize(pdfFontSize(doc, 14)); doc.setFont('helvetica', 'bold');
        doc.text(displaySchoolName, centerX, 8, { align: 'center' }); doc.setFontSize(pdfFontSize(doc, 10));
        const tableSubtitle = assessmentLabel
          ? `LEARNER RESULTS TABLE — ${classObj?.name || ''} — ${termObj?.name || ''} ${termObj?.academic_year || ''} — ${assessmentLabel}`
          : `LEARNER RESULTS TABLE — ${classObj?.name || ''} — ${termObj?.name || ''} ${termObj?.academic_year || ''}`;
        doc.text(tableSubtitle, centerX, 16, { align: 'center' });

        const subjectShorts = allSubjects.map(s => shortName(s));
        const tableHeaders = isPrimary ? ['POS', 'Learner', ...subjectShorts, 'Total', 'Avg%', 'Grade'] : ['POS', 'Learner', ...subjectShorts, 'Total', 'Avg%', 'Pts', 'Grade'];

        const tableRows = summaries.map((s: any) => {
          const gr = overallGradeWithBand(s.avgPct, band);
          const subjectCells = allSubjects.map(sub => {
            if (s.subjects[sub] === undefined) return '\u2014';
            const subPct = s.subjects[sub];
            const subGrade = overallGradeWithBand(subPct, band).subLevel;
            return `${subPct.toFixed(0)}% ${subGrade}`;
          });
          const row = [String(s.position), `${s.student?.first_name} ${s.student?.last_name}`, ...subjectCells, s.totalPct.toFixed(0), `${s.avgPct.toFixed(1)}%` ];
          if (!isPrimary) row.push(String(s.totalPoints));
          row.push(isPrimary ? gr.grade : gr.subLevel);
          return row;
        });

        autoTable(doc, {
          startY: 26,
          head: [tableHeaders],
          body: tableRows,
          tableWidth: 'auto',
          styles: { fontSize: pdfFontSize(doc, 7), cellPadding: 1.5, overflow: 'linebreak', halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: pdfFontSize(doc, 7), fontStyle: 'bold', halign: 'center' },
          alternateRowStyles: { fillColor: [232, 234, 246] },
          columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 38, halign: 'left' } },
          margin: { left: 10, right: 10 },
          showHead: 'everyPage',
        });
        doc.setFontSize(pdfFontSize(doc, 7)); doc.setTextColor(150, 150, 150);
        doc.text('Generated by Zamifu Analytics School Management System', centerX, pageHeight - 8, { align: 'center' });
      }

      // ── PAGE 4: GENDER PERFORMANCE ANALYSIS ────────────────────────────────
      doc.addPage('a4', 'portrait');
      {
        doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(pdfFontSize(doc, 14)); doc.setFont('helvetica', 'bold');
        doc.text(displaySchoolName, 105, 8, { align: 'center' }); doc.setFontSize(pdfFontSize(doc, 10));
        doc.text('GENDER PERFORMANCE ANALYSIS', 105, 16, { align: 'center' });

        const maleSummaries = summaries.filter(s => s.gender === 'male');
        const femaleSummaries = summaries.filter(s => s.gender === 'female');
        const unknownSummaries = summaries.filter(s => !s.gender || (s.gender !== 'male' && s.gender !== 'female'));

        const maleCount = maleSummaries.length;
        const femaleCount = femaleSummaries.length;
        const unknownCount = unknownSummaries.length;

        const maleAvg = maleCount > 0 ? maleSummaries.reduce((sum, s) => sum + s.avgPct, 0) / maleCount : 0;
        const femaleAvg = femaleCount > 0 ? femaleSummaries.reduce((sum, s) => sum + s.avgPct, 0) / femaleCount : 0;

        const maleGrade = maleCount > 0 ? overallGradeWithBand(maleAvg, band) : null;
        const femaleGrade = femaleCount > 0 ? overallGradeWithBand(femaleAvg, band) : null;

        // Overview stats
        const gY = 28;
        doc.setFillColor(245, 247, 255); doc.rect(14, gY, 182, 28, 'F');
        doc.setFontSize(pdfFontSize(doc, 9)); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        doc.text(`Total Learners: ${totalStudents}`, 20, gY + 8);
        doc.text(`Male: ${maleCount} (${totalStudents > 0 ? ((maleCount / totalStudents) * 100).toFixed(1) : 0}%)`, 75, gY + 8);
        doc.text(`Female: ${femaleCount} (${totalStudents > 0 ? ((femaleCount / totalStudents) * 100).toFixed(1) : 0}%)`, 130, gY + 8);
        if (unknownCount > 0) doc.text(`Gender not set: ${unknownCount}`, 20, gY + 18);
        doc.text(`Male Average: ${maleCount > 0 ? maleAvg.toFixed(1) + '%' : 'N/A'}`, 75, gY + 18);
        doc.text(`Female Average: ${femaleCount > 0 ? femaleAvg.toFixed(1) + '%' : 'N/A'}`, 130, gY + 18);

        // Visual comparison bar
        const barY = gY + 36;
        doc.setFontSize(pdfFontSize(doc, 10)); doc.setFont('helvetica', 'bold');
        doc.text('AVERAGE PERFORMANCE COMPARISON', 14, barY);
        doc.setFontSize(pdfFontSize(doc, 8)); doc.setFont('helvetica', 'normal');

        if (maleCount > 0) {
          doc.setFillColor(37, 99, 235); doc.rect(14, barY + 8, 8, 8, 'F');
          doc.setTextColor(0, 0, 0); doc.text(`Male (${maleCount} learners): ${maleAvg.toFixed(1)}% — ${maleGrade ? (isPrimary ? maleGrade.grade : maleGrade.subLevel) : 'N/A'}`, 25, barY + 14);
          doc.setFillColor(200, 220, 255); doc.rect(14, barY + 18, 182, 6, 'F');
          doc.setFillColor(37, 99, 235); doc.rect(14, barY + 18, Math.max(1, 182 * maleAvg / 100), 6, 'F');
        }
        if (femaleCount > 0) {
          doc.setFillColor(236, 72, 153); doc.rect(14, barY + 30, 8, 8, 'F');
          doc.setTextColor(0, 0, 0); doc.text(`Female (${femaleCount} learners): ${femaleAvg.toFixed(1)}% — ${femaleGrade ? (isPrimary ? femaleGrade.grade : femaleGrade.subLevel) : 'N/A'}`, 25, barY + 36);
          doc.setFillColor(255, 200, 230); doc.rect(14, barY + 40, 182, 6, 'F');
          doc.setFillColor(236, 72, 153); doc.rect(14, barY + 40, Math.max(1, 182 * femaleAvg / 100), 6, 'F');
        }

        // Gap analysis
        if (maleCount > 0 && femaleCount > 0) {
          const gap = Math.abs(maleAvg - femaleAvg);
          const leader = maleAvg >= femaleAvg ? 'Male' : 'Female';
          const gapY = barY + 55;
          doc.setFontSize(pdfFontSize(doc, 9)); doc.setFont('helvetica', 'bold');
          doc.setTextColor(gap > 10 ? 220 : gap > 5 ? 249 : 22, gap > 10 ? 38 : gap > 5 ? 115 : 163, gap > 10 ? 38 : gap > 5 ? 115 : 74);
          doc.text(`Gender Gap: ${gap.toFixed(1)}% — ${leader} learners lead by ${gap.toFixed(1)}%`, 14, gapY);
          doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(pdfFontSize(doc, 8));
          if (gap > 10) doc.text('Significant gender gap detected. Consider targeted support for the lower-performing group.', 14, gapY + 7);
          else if (gap > 5) doc.text('Moderate gender gap. Monitor trends over subsequent terms.', 14, gapY + 7);
          else doc.text('Gender performance is well-balanced. Keep up the inclusive teaching approach!', 14, gapY + 7);
        }

        // Per-learning-area gender breakdown table
        const subjGenderY = barY + (maleCount > 0 && femaleCount > 0 ? 72 : 55);
        doc.setFontSize(pdfFontSize(doc, 10)); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
        doc.text('LEARNING AREA-WISE GENDER BREAKDOWN', 14, subjGenderY);

        const genderSubjectRows = allSubjects.map(sub => {
          const maleVals = maleSummaries.map(s => s.subjects[sub]).filter(v => v !== undefined);
          const femaleVals = femaleSummaries.map(s => s.subjects[sub]).filter(v => v !== undefined);
          const mAvg = maleVals.length ? maleVals.reduce((a, b) => a + b, 0) / maleVals.length : null;
          const fAvg = femaleVals.length ? femaleVals.reduce((a, b) => a + b, 0) / femaleVals.length : null;
          const diff = mAvg !== null && fAvg !== null ? mAvg - fAvg : null;
          const leader = diff === null ? 'N/A' : diff > 0.5 ? `M +${diff.toFixed(1)}%` : diff < -0.5 ? `F +${Math.abs(diff).toFixed(1)}%` : 'Equal';
          return [
            sub === 'Creative Arts' ? 'C-Arts' : sub,
            mAvg !== null ? `${mAvg.toFixed(1)}%` : 'N/A',
            fAvg !== null ? `${fAvg.toFixed(1)}%` : 'N/A',
            leader,
          ];
        });

        autoTable(doc, {
          startY: subjGenderY + 6,
          head: [['Learning Area', 'Male Avg', 'Female Avg', 'Leader']],
          body: genderSubjectRows,
          styles: { fontSize: pdfFontSize(doc, 8), cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: pdfFontSize(doc, 8), fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 255] },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const val = data.cell.raw as string;
              if (val.startsWith('M')) { data.cell.styles.textColor = [37, 99, 235]; data.cell.styles.fontStyle = 'bold'; }
              else if (val.startsWith('F')) { data.cell.styles.textColor = [236, 72, 153]; data.cell.styles.fontStyle = 'bold'; }
            }
          },
        });

        // Top male and female learners
        const topGenderY = (doc as any).lastAutoTable.finalY + 10;
        if (maleSummaries.length > 0) {
          const topMale = maleSummaries[0];
          const topMaleGr = overallGradeWithBand(topMale.avgPct, band);
          doc.setFontSize(pdfFontSize(doc, 9)); doc.setFont('helvetica', 'bold'); doc.setTextColor(37, 99, 235);
          doc.text('Top Male Learner:', 14, topGenderY);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
          doc.text(`${topMale.student?.first_name} ${topMale.student?.last_name} — ${topMale.avgPct.toFixed(1)}% — ${isPrimary ? (topMaleGr as any).grade : (topMaleGr as any).subLevel}`, 55, topGenderY);
        }
        if (femaleSummaries.length > 0) {
          const topFemale = femaleSummaries[0];
          const topFemaleGr = overallGradeWithBand(topFemale.avgPct, band);
          doc.setFontSize(pdfFontSize(doc, 9)); doc.setFont('helvetica', 'bold'); doc.setTextColor(236, 72, 153);
          doc.text('Top Female Learner:', 14, topGenderY + 8);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
          doc.text(`${topFemale.student?.first_name} ${topFemale.student?.last_name} — ${topFemale.avgPct.toFixed(1)}% — ${isPrimary ? (topFemaleGr as any).grade : (topFemaleGr as any).subLevel}`, 55, topGenderY + 8);
        }
        if (unknownCount > 0) {
          doc.setFontSize(pdfFontSize(doc, 7)); doc.setTextColor(150, 150, 150);
          doc.text(`Note: ${unknownCount} learner(s) have no gender recorded and are excluded from gender analysis.`, 14, topGenderY + 20);
        }
        doc.setFontSize(pdfFontSize(doc, 7)); doc.setTextColor(150, 150, 150);
        doc.text('Generated by Zamifu Analytics School Management System', 105, 290, { align: 'center' });
      }

      const pdfName = `class_results_${classObj?.name || 'Class'}_${termObj?.name || 'Term'}_${termObj?.academic_year || ''}.pdf`.replace(/\s+/g, '_');
      doc.save(pdfName);
      toast.success('Class results PDF generated!');
    } catch (err: any) { toast.error('Failed to generate PDF: ' + err.message); console.error(err); }
    setGeneratingPDF(false);
  };

  const downloadSingleReportCard = async (s: any, fontSize: PdfFontSize = DEFAULT_PDF_FONT_SIZE) => {
    try {
      const classObj = classes.find(c => c.id === (scope === 'class_teacher' ? scopedClassId : selectedClass));
      const band = getSchoolLevelBand(classObj);
      const termObj = terms.find(t => t.id === selectedTerm);
      const assessmentLabel = selectedExam ? exams.find(e => e.id === selectedExam)?.name : '';
      
      let teacherSigUrl: string | null = null;
      if (classObj?.class_teacher_id) {
        const { data: teacherData } = await supabaseUntyped.from('teachers').select('signature_url').eq('profile_id', classObj.class_teacher_id).maybeSingle();
        teacherSigUrl = teacherData?.signature_url || null;
      }
      const signatures: SignatureInfo = { principal_signature_url: principalSignatureUrl, teacher_signature_url: teacherSigUrl };

      const prevAvg = await fetchPreviousTermAvg(s.studentId, selectedTerm);
      const deviation = prevAvg !== null && prevAvg !== undefined ? s.avgPct - prevAvg : null;
      const isNew = deviation === null;

      const subjectEntriesRaw = Object.entries(s.subjects).filter(([k]) => !k.endsWith('_grade') && !k.endsWith('_points')) as [string, number][];
      const subjectEntries = subjectEntriesRaw.sort((a, b) => {
        const indexA = SUBJECT_ORDER.findIndex(s => a[0].toLowerCase().includes(s.toLowerCase()));
        const indexB = SUBJECT_ORDER.findIndex(s => b[0].toLowerCase().includes(s.toLowerCase()));
        if (indexA === -1 && indexB === -1) return a[0].localeCompare(b[0]);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      const sortedBest = [...subjectEntries].sort((a, b) => b[1] - a[1]);
      const bestSubject = sortedBest[0]?.[0] || 'all learning areas';
      const weakestSubject = sortedBest[sortedBest.length - 1]?.[0] || 'some learning areas';
      const studentFullName = `${s.student?.first_name || ''} ${s.student?.last_name || ''}`;
      
      const { data: allResults } = await supabaseUntyped
        .from('results')
        .select('percentage, marks, out_of, term_id, exam_id, terms(name, academic_year), school_exams(name, type)')
        .eq('student_id', s.studentId)
        .order('terms(academic_year)', { ascending: true })
        .order('terms(name)', { ascending: true });
      const trendData = buildPerformanceTrend((allResults || []) as PerformanceTrendRecord[]);

      const allSubjectResults: SubjectResult[] = subjectEntries.map(([name, pct]) => ({
        name,
        percentage: pct,
        grade: calculateCompetencyGrade(pct, band).subLevel,
        previousPercentage: trendData.slice(-2)[0]?.avg ?? null,
      }));
      const aiComment = generateUniqueAIComment(studentFullName, s.avgPct, deviation, bestSubject, weakestSubject, s.position, summaries.length, isNew, classObj, allSubjectResults);

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      configurePdfFontSize(doc, fontSize);
      await drawReportHeader(doc, schoolInfo, {
        name: studentFullName,
        photoUrl: s.student?.photo_url,
      });
      
      const cardAssessment = s.examName || assessmentLabel || '';
      const studentPosition = `${s.position}${s.position === 1 ? 'st' : s.position === 2 ? 'nd' : s.position === 3 ? 'rd' : 'th'} out of ${summaries.length}`;
      
      drawStudentInfo(doc, studentFullName, s.student?.admission_number || 'N/A', classObj?.name || 'N/A', termObj?.name || '', termObj?.academic_year || '', studentPosition, 48, cardAssessment, s.student?.assessment_number || undefined);

      const studentResultsForTable = subjectEntries.map(([subName, pct]) => ({
        subjects: { name: subName },
        marks: pct,
        out_of: 100
      }));

      let currentY = drawResultsTable(doc, studentResultsForTable, classObj, cardAssessment ? 69 : 63);
      const gradeLevelNum = Number(classObj?.grade_level || classObj?.level || 0);
      if (gradeLevelNum >= 6 && gradeLevelNum <= 9) {
        currentY = drawPathwayPerformance(doc, studentResultsForTable, currentY + 4);
      }
      currentY = drawSummaryBox(doc, studentResultsForTable, s.avgPct, s.totalPoints, `${s.position}/${summaries.length}`, classObj, currentY + 4);
            currentY = drawDeviation(doc, deviation, prevAvg, null, currentY);
      if (trendData.length >= 2) {
        currentY = drawTrendGraph(doc, trendData, 14, currentY, 182, 34, band) + 2;
      }
      const bulkBestPerSubject = computeBestPerSubject(results.filter(r => r.class_id === selectedClass && r.term_id === selectedTerm), classObj);
      const studentBests = bulkBestPerSubject.filter(b => b.studentId === s.studentId);
      currentY = drawAchievements(doc, studentBests, currentY + 2);
      currentY = drawAIComment(doc, aiComment, currentY + 2);
      await addSignaturesToPDF(doc, signatures, currentY + 2, schoolInfo);
      drawReportFooter(doc);

      doc.save(`report_card_${studentFullName.replace(/\s+/g, '_')}_${termObj?.name}.pdf`);
      toast.success(`Report card for ${studentFullName} generated!`);
    } catch (err: any) {
      toast.error('Failed to generate report card: ' + err.message);
      console.error(err);
    }
  };

  const downloadBulkReportCards = async (fontSize: PdfFontSize = DEFAULT_PDF_FONT_SIZE) => {
    if (!(scope === 'class_teacher' ? scopedClassId : selectedClass) || !selectedTerm) { toast.error('Please select a class and term'); return; }
    setGeneratingBulk(true);
    try {
      const rawResults = await fetchClassResults();
      if (!rawResults || rawResults.length === 0) { toast.error('No results found'); setGeneratingBulk(false); return; }
      const classObj = classes.find(c => c.id === (scope === 'class_teacher' ? scopedClassId : selectedClass));
      const band = getSchoolLevelBand(classObj);
      const isPrimary = band === 'primary';
      const allSubjectsRaw = Array.from(new Set(rawResults.map((r: any) => r.subjects?.name).filter(Boolean))) as string[];
      const allSubjects = sortSubjects(allSubjectsRaw);
      const summaries = buildStudentSummary(rawResults, classObj);
      const termObj = terms.find(t => t.id === selectedTerm);
      const assessmentLabel = resolveAssessmentLabel(rawResults);
      const totalStudents = summaries.length;

      let teacherSigUrl: string | null = null;
      if (classObj?.class_teacher_id) {
        const { data: teacherData } = await supabaseUntyped.from('teachers').select('signature_url').eq('profile_id', classObj.class_teacher_id).maybeSingle();
        teacherSigUrl = teacherData?.signature_url || null;
      }
      const signatures: SignatureInfo = { principal_signature_url: principalSignatureUrl, teacher_signature_url: teacherSigUrl };

      const prevAvgMap: Record<string, number | null> = {};
      for (const s of summaries) { prevAvgMap[s.studentId] = await fetchPreviousTermAvg(s.studentId, selectedTerm); }

      const bulkBestPerSubject = computeBestPerSubject(rawResults, classObj);

      // Pre-fetch all student trends in one pass so every learner PDF can show
      // distinct previous assessments, including legacy term-only results.
      const studentTrends: Record<string, { term: string; avg: number }[]> = {};
      for (const s of summaries) {
        const { data: allResults } = await supabaseUntyped
          .from('results')
          .select('percentage, marks, out_of, term_id, exam_id, terms(name, academic_year), school_exams(name, type)')
          .eq('student_id', s.studentId)
          .order('terms(academic_year)', { ascending: true })
          .order('terms(name)', { ascending: true });
        studentTrends[s.studentId] = buildPerformanceTrend((allResults || []) as PerformanceTrendRecord[]);
      }

      // Generate a single optimized PDF for all learners
      const mainDoc = new jsPDF({ unit: 'mm', format: 'a4' });
      configurePdfFontSize(mainDoc, fontSize);
      const BATCH_SIZE = 5;
      let addedFirstPage = false;

      for (let idx = 0; idx < summaries.length; idx++) {
        const s = summaries[idx];
        const prevAvg = prevAvgMap[s.studentId];
        const deviation = prevAvg !== null && prevAvg !== undefined ? s.avgPct - prevAvg : null;
        const isNew = deviation === null;
        const subjectEntriesRaw = Object.entries(s.subjects).filter(([k]) => !k.endsWith('_grade') && !k.endsWith('_points')) as [string, number][];
        const subjectEntries = subjectEntriesRaw.sort((a, b) => {
          const indexA = SUBJECT_ORDER.findIndex(s => a[0].toLowerCase().includes(s.toLowerCase()));
          const indexB = SUBJECT_ORDER.findIndex(s => b[0].toLowerCase().includes(s.toLowerCase()));
          if (indexA === -1 && indexB === -1) return a[0].localeCompare(b[0]);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });

        const sortedBest = [...subjectEntries].sort((a, b) => b[1] - a[1]);
        const bestSubject = sortedBest[0]?.[0] || 'all learning areas';
        const weakestSubject = sortedBest[sortedBest.length - 1]?.[0] || 'some learning areas';
        const studentFullName = `${s.student?.first_name || ''} ${s.student?.last_name || ''}`;
        const allSubjectResults: SubjectResult[] = subjectEntries.map(([name, pct]) => ({
          name,
          percentage: pct,
          grade: calculateCompetencyGrade(pct, band).subLevel,
          previousPercentage: studentTrends[s.studentId]?.slice(-2)[0]?.avg ?? null,
        }));
        const aiComment = generateUniqueAIComment(studentFullName, s.avgPct, deviation, bestSubject, weakestSubject, s.position, totalStudents, isNew, classObj, allSubjectResults);

        if (addedFirstPage) mainDoc.addPage();
        addedFirstPage = true;

        await drawReportHeader(mainDoc, schoolInfo, {
          name: studentFullName,
          photoUrl: s.student?.photo_url,
        });
        
        const cardAssessment = s.examName || assessmentLabel || '';
        const studentPosition = `${s.position}${s.position === 1 ? 'st' : s.position === 2 ? 'nd' : s.position === 3 ? 'rd' : 'th'} out of ${totalStudents}`;
        
        drawStudentInfo(
          mainDoc,
          studentFullName,
          s.student?.admission_number || 'N/A',
          classObj?.name || 'N/A',
          termObj?.name || '',
          termObj?.academic_year || '',
          studentPosition,
          48,
          cardAssessment,
          s.student?.assessment_number || undefined
        );

        const studentResultsForTable = subjectEntries.map(([subName, pct]) => ({
          subjects: { name: subName },
          marks: pct,
          out_of: 100
        }));

        let currentY = drawResultsTable(mainDoc, studentResultsForTable, classObj, cardAssessment ? 69 : 63);

        const gradeLevelNum = Number(classObj?.grade_level || classObj?.level || 0);
        if (gradeLevelNum >= 6 && gradeLevelNum <= 9) {
          currentY = drawPathwayPerformance(mainDoc, studentResultsForTable, currentY + 4);
        }

        currentY = drawSummaryBox(mainDoc, studentResultsForTable, s.avgPct, s.totalPoints, `${s.position}/${totalStudents}`, classObj, currentY + 4);
        
                currentY = drawDeviation(mainDoc, deviation, prevAvg, null, currentY);
        const studentTrend = studentTrends[s.studentId] || [];
        if (studentTrend.length >= 2) {
          currentY = drawTrendGraph(mainDoc, studentTrend, 14, currentY, 182, 34, band) + 2;
        }
        const bulkStudentBests = bulkBestPerSubject.filter(b => b.studentId === (s.student?.id || s.studentId));
        currentY = drawAchievements(mainDoc, bulkStudentBests, currentY + 2);

        // Issue 7 & 8: Use shared drawAIComment to auto-expand comment box and prevent cut-off
        currentY = drawAIComment(mainDoc, aiComment, currentY + 2);
        await addSignaturesToPDF(mainDoc, signatures, currentY + 2, schoolInfo);
        drawReportFooter(mainDoc);

        // Yield to browser between learners to prevent freeze
        await new Promise(resolve => setTimeout(resolve, 0));

        // Extra yield every BATCH_SIZE learners
        if ((idx + 1) % BATCH_SIZE === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const pdfName = ['bulk_report_cards', classObj?.name, termObj?.name, termObj?.academic_year, assessmentLabel || null].filter(Boolean).join('_').replace(/\s+/g, '_');
      mainDoc.save(`${pdfName}.pdf`);
      toast.success(assessmentLabel ? `Bulk report cards generated for ${totalStudents} learners (${assessmentLabel})!` : `Bulk report cards generated for ${totalStudents} learners!`);
    } catch (err: any) { toast.error('Failed to generate bulk report cards: ' + err.message); console.error(err); }
    setGeneratingBulk(false);
  };

  const filteredExams = exams.filter(e => !selectedTerm || e.term_id === selectedTerm);

  // Class Teachers must never see school-wide summary counts. Use the resolved
  // assigned class as the source of truth, with selectedClass as a safe fallback.
  const summaryClassId = scope === 'class_teacher' ? (scopedClassId || selectedClass) : selectedClass;
  const summaryResults = summaryClassId
    ? results.filter(r => r.class_id === summaryClassId)
    : scope === 'class_teacher' ? [] : filtered;
  const totalLearners = new Set(summaryResults.map(r => r.student_id).filter(Boolean)).size;
  const totalSubjects = new Set(summaryResults.map(r => r.subject_id).filter(Boolean)).size;

  const classObj = classes.find(c => c.id === summaryClassId || c.id === selectedClass);
  const summaries = buildStudentSummary(filtered, classObj);
  const allSubjectsRaw = Array.from(new Set(filtered.map((r: any) => r.subjects?.name).filter(Boolean))) as string[];
  const allSubjects = sortSubjects(allSubjectsRaw);
  const band = getSchoolLevelBand(classObj);
  const isPrimary = band === 'primary';
  const is844Class = is844Curriculum(classObj);
  const getDisplayGrade = (pct: number) => {
    if (is844Class) { const g = calculate844Grade(pct); return g.grade; }
    return overallGradeWithBand(pct, band).subLevel;
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">{scope === 'dos' ? 'DoS Results Dashboard' : scope === 'class_teacher' ? 'Class Results Dashboard' : 'Results Dashboard'}</h1>
          <p className="text-sm text-[#666666]">{scope === 'class_teacher' ? 'Results and report cards for your assigned class only' : 'Comprehensive academic analysis and reporting'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-blue-50 px-3 sm:px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-700">{totalLearners} Learners</span>
          </div>
          <div className="bg-purple-50 px-3 sm:px-4 py-2 rounded-xl border border-purple-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-bold text-purple-700">{totalSubjects} Subjects</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border border-gray-100">
        <h2 className="text-lg font-semibold text-[#111111] mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> Generate Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-[#666666] mb-1">Select Class</label>
            <select value={selectedClass} disabled={scope === 'class_teacher'} onChange={e => setSelectedClass(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white disabled:bg-gray-100">
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
              <Filter className="w-3.5 h-3.5" /> Assessment Filter
            </label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">-- All Assessments --</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.name} {e.type ? `(${e.type})` : ''}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button onClick={() => openPdfFontSizeDialog('class-results')} disabled={generatingPDF || generatingBulk || !selectedClass || !selectedTerm}
            className="min-h-11 flex flex-1 sm:flex-none items-center justify-center gap-2 bg-[#2563EB] text-white px-4 sm:px-5 py-3 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors shadow-sm">
            {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generatingPDF ? 'Generating...' : 'Class Summary PDF'}
          </button>
          <button onClick={() => openPdfFontSizeDialog('bulk-report-cards')} disabled={generatingBulk || generatingPDF || !selectedClass || !selectedTerm}
            className="min-h-11 flex flex-1 sm:flex-none items-center justify-center gap-2 bg-green-600 text-white px-4 sm:px-5 py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm">
            {generatingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generatingBulk ? 'Bulk Report Cards' : 'Bulk Report Cards'}
          </button>
          {scope === 'school' && (
            <button onClick={publishResults} disabled={publishing || !selectedClass || !selectedTerm}
              className="min-h-11 flex flex-1 sm:flex-none items-center justify-center gap-2 bg-purple-600 text-white px-4 sm:px-5 py-3 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {publishing ? 'Publishing...' : 'Publish & Notify'}
            </button>
          )}
        </div>
      </div>

      {/* LEARNER RESULTS TABLE GRID */}
      {selectedClass && selectedTerm && (
        <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#111111] flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Learner Performance Results
            </h2>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Grid View</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="w-[52px] min-w-[52px] px-4 py-3 text-[10px] font-black text-[#666666] uppercase sticky left-0 bg-gray-50 z-10 border-r border-gray-100">POS</th>
                  <th className="min-w-[170px] px-4 py-3 text-[10px] font-black text-[#666666] uppercase sticky left-[52px] bg-gray-50 z-10 border-r border-gray-100">Learner</th>
                  {allSubjects.map(sub => (
                    <th key={sub} className="px-4 py-3 text-[10px] font-black text-[#666666] uppercase text-center border-r border-gray-100 min-w-[100px]">{shortName(sub)}</th>
                  ))}
                  <th className="px-4 py-3 text-[10px] font-black text-[#666666] uppercase text-center border-r border-gray-100">Avg%</th>
                  {!isPrimary && <th className="px-4 py-3 text-[10px] font-black text-[#666666] uppercase text-center border-r border-gray-100">Pts</th>}
                  <th className="px-4 py-3 text-[10px] font-black text-[#666666] uppercase text-center border-r border-gray-100">Grade</th>
                  <th className="px-4 py-3 text-[10px] font-black text-[#666666] uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaries.map((s: any) => {
                  const gr = overallGradeWithBand(s.avgPct, band);
                  return (
                    <tr key={s.studentId} className="hover:bg-blue-50/30 transition-colors">
                      <td className="w-[52px] min-w-[52px] px-4 py-3 text-xs font-bold text-gray-500 sticky left-0 bg-white z-10 border-r border-gray-100">{s.position}</td>
                      <td className="px-4 py-3 sticky left-[52px] bg-white z-10 border-r border-gray-100">
                        <div className="max-w-[170px] whitespace-normal break-words text-xs font-bold leading-tight text-[#111111]">{s.student?.first_name} {s.student?.last_name}</div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase">{s.student?.admission_number}</div>
                      </td>
                      {allSubjects.map(sub => {
                        const pct = s.subjects[sub];
                        if (pct === undefined) return <td key={sub} className="px-4 py-3 text-center text-gray-300 text-xs border-r border-gray-100">—</td>;
                        const subGrade = overallGradeWithBand(pct, band).subLevel;
                        return (
                          <td key={sub} className="px-4 py-3 text-center border-r border-gray-100">
                            <div className="text-xs font-bold text-gray-700">{pct.toFixed(0)}%</div>
                            <div className={`text-[9px] font-black uppercase ${gradeColor(subGrade)} px-1 rounded inline-block`}>{subGrade}</div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center border-r border-gray-100 font-black text-blue-600 text-xs">{s.avgPct.toFixed(1)}%</td>
                      {!isPrimary && <td className="px-4 py-3 text-center border-r border-gray-100 font-bold text-purple-600 text-xs">{s.totalPoints}</td>}
                      <td className="px-4 py-3 text-center border-r border-gray-100">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${gradeColor(isPrimary ? gr.grade : gr.subLevel)}`}>
                          {isPrimary ? gr.grade : gr.subLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={() => openPdfFontSizeDialog('report-card', s)} disabled={generatingPDF || generatingBulk} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50" title="Download Report Card">
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#111111] flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Individual Records
          </h2>
              <div className="relative w-full md:w-72 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search learner or subject..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider">Learner</th>
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider">Learning Area</th>
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-center">Marks</th>
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-center">%</th>
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-center">Grade</th>
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-center">Points</th>
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" /><p className="text-sm text-gray-500 mt-2">Loading records...</p></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500 italic">No records found matching your criteria.</td></tr>
              ) : filtered.map(r => {
                const band = getSchoolLevelBand(r.classes);
                const g = calculateCompetencyGrade(getPercentage(r), band);
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-[#111111]">{r.students?.first_name} {r.students?.last_name}</div>
                      <div className="text-[10px] text-[#666666] uppercase font-bold tracking-tight">{r.students?.admission_number} • {r.students?.gender || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#111111]">{r.subjects?.name === 'Creative Arts' ? 'C-Arts' : r.subjects?.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#111111] text-center font-bold">{r.marks} / {r.out_of}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-black text-blue-600">{getPercentage(r)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${gradeColor(g.subLevel)}`}>
                        {g.subLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#111111] text-center font-bold">{band === 'primary' ? '-' : g.points}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${r.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditResult(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeletingResult(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#111111]">Edit Record</h3>
              <button onClick={() => setEditingResult(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSaveResult} className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl mb-2">
                <p className="text-sm font-bold text-blue-900">{editingResult.students?.first_name} {editingResult.students?.last_name}</p>
                <p className="text-xs text-blue-700 font-medium">{editingResult.subjects?.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#666666] uppercase mb-1.5">Marks Obtained</label>
                  <input type="number" step="0.1" value={editMarks} onChange={e => setEditMarks(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#666666] uppercase mb-1.5">Out Of</label>
                  <input type="number" step="0.1" value={editOutOf} onChange={e => setEditOutOf(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingResult(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-[#666666] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={savingResult} className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-bold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50">
                  {savingResult ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingPdfDownload && (
        <PdfFontSizeDialog
          open
          title={pendingPdfDownload.target === 'class-results' ? 'Download Class Results' : pendingPdfDownload.target === 'bulk-report-cards' ? 'Download Bulk Report Cards' : 'Download Report Card'}
          description="Choose the font size for the downloaded PDF. The default and recommended size is 14."
          onCancel={closePdfFontSizeDialog}
          onConfirm={confirmPdfFontSize}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6" /></div>
              <h3 className="text-lg font-bold text-[#111111] mb-2">Delete Record?</h3>
              <p className="text-sm text-[#666666] mb-6">Are you sure you want to delete this record for <b>{deletingResult.students?.first_name}</b>? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingResult(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-[#666666] hover:bg-gray-50 transition-colors">No, Keep</button>
                <button onClick={handleDeleteResult} disabled={deletingResultLoading} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
                  {deletingResultLoading ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
