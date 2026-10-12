import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Download, FileText, Loader2, Users, Share2, Lock, CreditCard, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import PdfFontSizeDialog from '@/components/PdfFontSizeDialog';
import { toast } from 'sonner';
import {
  generateUniqueAIComment,
  drawTrendGraph,
  addSignaturesToPDF,
  drawReportFooter,
  drawReportHeader,
  drawStudentInfo,
  drawResultsTable,
  drawSummaryBox,
  drawDeviation,
  drawAchievements,
  drawAIComment,
  canFitReportCardOptionalSection,
  getReportCardCommentBottomY,
  getPercentage,
  formatPosition,
  buildPerformanceTrend,
  drawPathwayPerformance,
  type SchoolInfo,
  type SignatureInfo,
  type PerformanceTrendRecord,
} from '@/lib/reportCardPdf';
import {
  configurePdfFontSize,
  DEFAULT_PDF_FONT_SIZE,
  type PdfFontSize,
} from '@/lib/pdfFontSize';
import { calculateGradeForClass, gradePointsForClass, getSchoolLevelBand, is844Curriculum } from '@/lib/grading';
import { computeBestPerSubject } from '@/lib/bestPerSubject';
import type { BestInSubject } from '@/lib/bestPerSubject';
import { formatClassStream } from '@/lib/class-label';
import { rankByPathway, rankByUnifiedRule } from '@/lib/ranking';
import { fetchAllRows } from '@/lib/paginatedQuery';
import { aggregateLearnerTotals, usesSevenSubjectRanking } from '@/lib/learnerTotals';
import { isSeniorCbeClass } from '@/lib/seniorPathways';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: Record<string, any>) => { openIframe: () => void };
    };
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Paystack.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack.'));
    document.body.appendChild(script);
  });
}

export default function ParentChildReportCard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [schoolPayConfig, setSchoolPayConfig] = useState<any>(null);
  const [pdfPaid, setPdfPaid] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({ name: '' });
  const [signatures, setSignatures] = useState<SignatureInfo>({});
  const [classBestList, setClassBestList] = useState<BestInSubject[]>([]);
  const [previousAvg, setPreviousAvg] = useState<number | null>(null);
  const [trendData, setTrendData] = useState<{ term: string; avg: number }[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [classPosition, setClassPosition] = useState<number | null>(null);
  const [childPhotoLoadError, setChildPhotoLoadError] = useState(false);
  const [showFontSizeDialog, setShowFontSizeDialog] = useState(false);

  useEffect(() => { fetchChildren(); }, [user?.id]);

  const fetchChildren = async () => {
    setLoading(true);
    const { data: links } = await supabaseUntyped
      .from('parent_student_links')
      .select('student_id')
      .eq('parent_id', user?.id);
    if (links && links.length > 0) {
      const ids = links.map((l: any) => l.student_id);
      const { data: students } = await supabaseUntyped
        .from('students')
        .select('*, classes!students_class_id_fkey(name, stream, stream_name, level, grade_level, curriculum, class_teacher_id)')
        .in('id', ids);
      setChildren(students || []);
      if (students && students.length > 0) {
        const firstChild = students[0] as any;
        setSelectedChild(firstChild);
        setChildPhotoLoadError(false);
        fetchTerms(firstChild.school_id);
        fetchSchoolPayConfig(firstChild.school_id);
        fetchSchoolInfo(firstChild.school_id);
        fetchSignatures(firstChild.school_id, firstChild.classes?.class_teacher_id);
        fetchTotalStudents(firstChild.class_id, firstChild.school_id);
      }
    }
    setLoading(false);
  };

  const fetchTotalStudents = async (classId: string, schoolId: string) => {
    const { count } = await supabaseUntyped
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('school_id', schoolId);
    setTotalStudents(count || 0);
  };

  const fetchSchoolInfo = async (schoolId: string) => {
    try {
      const { data } = await supabaseUntyped
        .from('schools')
        .select('name, motto, logo_url, principal_name, principal_signature_url, address, phone, email, next_term_start_date, school_closes_on, school_opens_on')
        .eq('id', schoolId)
        .maybeSingle();
      if (data) {
        setSchoolInfo({
          name: data.name?.trim() || 'School',
          motto: data.motto || '',
          logo_url: data.logo_url || null,
          principal_name: data.principal_name || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          next_term_start_date: data.next_term_start_date || null,
          school_closes_on: data.school_closes_on || null,
          school_opens_on: data.school_opens_on || data.next_term_start_date || null,
        });
        setSignatures(prev => ({
          ...prev,
          principal_signature_url: data.principal_signature_url || null,
        }));
      } else {
        setSchoolInfo({ name: 'School' });
      }
    } catch (err: any) {
      try {
        const { data } = await supabaseUntyped
          .from('schools')
          .select('name, logo_url, principal_name, address, phone, email, next_term_start_date, school_closes_on, school_opens_on')
          .eq('id', schoolId)
          .maybeSingle();
        if (data) {
          setSchoolInfo({
            name: data.name?.trim() || 'School',
            motto: '',
            logo_url: data.logo_url || null,
            principal_name: data.principal_name || '',
            address: data.address || '',
            phone: data.phone || '',
            email: data.email || '',
          next_term_start_date: data.next_term_start_date || null,
          school_closes_on: data.school_closes_on || null,
          school_opens_on: data.school_opens_on || data.next_term_start_date || null,
          });
        } else {
          setSchoolInfo({ name: 'School' });
        }
      } catch {
        setSchoolInfo({ name: 'School' });
      }
    }
  };

  const fetchSignatures = async (schoolId: string, classTeacherId?: string) => {
    let principalSigUrl: string | null = null;
    try {
      const { data: schoolSig } = await supabaseUntyped
        .from('schools')
        .select('principal_signature_url')
        .eq('id', schoolId)
        .maybeSingle();
      principalSigUrl = schoolSig?.principal_signature_url || null;
    } catch {}
    let teacherSigUrl: string | null = null;
    if (classTeacherId) {
      try {
        const { data: teacherSig } = await supabaseUntyped
          .from('teachers')
          .select('signature_url')
          .eq('profile_id', classTeacherId)
          .maybeSingle();
        teacherSigUrl = teacherSig?.signature_url || null;
      } catch {}
    }
    setSignatures(prev => ({
      ...prev,
      principal_signature_url: principalSigUrl,
      teacher_signature_url: teacherSigUrl,
    }));
  };

  const fetchSchoolPayConfig = async (schoolId: string) => {
    const { data: school } = await supabaseUntyped
      .from('schools')
      .select('parent_pay_enabled, view_results_fee, pdf_report_fee, reseller_id')
      .eq('id', schoolId)
      .maybeSingle();
    if (!school) return;
    let resellerPaystackKey: string | null = null;
    if (school.reseller_id) {
      const { data: reseller } = await supabaseUntyped
        .from('resellers')
        .select('paystack_public_key, parent_pay_enabled')
        .eq('id', school.reseller_id)
        .maybeSingle();
      if (reseller?.parent_pay_enabled && reseller?.paystack_public_key) {
        resellerPaystackKey = reseller.paystack_public_key;
      }
    }
    setSchoolPayConfig({
      parent_pay_enabled: school.parent_pay_enabled && !!resellerPaystackKey,
      view_results_fee: school.view_results_fee || 50,
      pdf_report_fee: school.pdf_report_fee || 50,
      reseller_id: school.reseller_id,
      reseller_paystack_public_key: resellerPaystackKey,
      school_id: schoolId,
    });
  };

  const checkPdfPaid = async (childId: string): Promise<boolean> => {
    if (pdfPaid[childId]) return true;
    const { data } = await supabaseUntyped
      .from('parent_payments')
      .select('id')
      .eq('parent_id', user?.id)
      .eq('student_id', childId)
      .eq('payment_type', 'pdf_report')
      .eq('status', 'success')
      .limit(1);
    const paid = !!(data && data.length > 0);
    if (paid) setPdfPaid(prev => ({ ...prev, [childId]: true }));
    return paid;
  };

  const fetchTerms = async (schoolId: string) => {
    const { data } = await supabaseUntyped
      .from('terms')
      .select('*')
      .eq('school_id', schoolId)
      .order('academic_year', { ascending: false });
    setTerms(data || []);
    if (data && data.length > 0) setSelectedTerm(data[0].id);
  };

  useEffect(() => {
    if (selectedChild && selectedTerm) {
      fetchResults();
      fetchTrendData();
    }
  }, [selectedChild, selectedTerm]);

  const fetchResults = async () => {
    if (!selectedChild || !selectedTerm) return;
    const { data } = await supabaseUntyped
      .from('results')
      .select('*, subjects(name)')
      .eq('student_id', selectedChild.id)
      .eq('term_id', selectedTerm);
    setResults(data || []);
    await fetchPreviousAvg();
    // Paged: PostgREST returns at most 1000 rows, and a class-sized result set
    // exceeds that, so an unpaged read would truncate the ranking cohort.
    const classResults = await fetchAllRows((from, to) => supabaseUntyped
      .from('results')
      .select('*, students(id, first_name, last_name), subjects(name)')
      .eq('class_id', selectedChild.class_id)
      .eq('term_id', selectedTerm)
      .order('created_at')
      .order('id')
      .range(from, to));
    if (classResults && classResults.length > 0) {
      setClassBestList(computeBestPerSubject(classResults, selectedChild?.classes || {}));
    } else {
      setClassBestList([]);
    }
    // Unified ranking: the parent view must show the same position as the
    // Student Portal, Class Summary and report card for the same learner.
    if (classResults && classResults.length > 0) {
      // Same aggregation as the class summary, so both report the same total.
      const totals = aggregateLearnerTotals(classResults, selectedChild?.classes || {});
      const ranked = isSeniorCbeClass(selectedChild?.classes || {})
        ? rankByPathway(totals, getSchoolLevelBand(selectedChild?.classes || {}))
        : rankByUnifiedRule(totals, getSchoolLevelBand(selectedChild?.classes || {}));
      const entry = ranked.find((row) => row.studentId === selectedChild.id);
      setClassPosition(entry ? entry.position : null);
    } else {
      setClassPosition(null);
    }
  };

  const fetchTrendData = async () => {
    if (!selectedChild) return;
    const { data: allResults } = await supabaseUntyped
      .from('results')
      .select('percentage, marks, out_of, term_id, exam_id, terms(name, academic_year), school_exams(name, type)')
      .eq('student_id', selectedChild.id)
      .order('terms(academic_year)', { ascending: true })
      .order('terms(name)', { ascending: true });
    if (!allResults) {
      setTrendData([]);
      return;
    }
    setTrendData(buildPerformanceTrend(allResults as PerformanceTrendRecord[]));
  };

  const fetchPreviousAvg = async () => {
    if (!selectedChild || !selectedTerm || terms.length === 0) { setPreviousAvg(null); return; }
    const sortedTerms = [...terms].sort((a, b) => {
      if (a.academic_year !== b.academic_year) return Number(a.academic_year) - Number(b.academic_year);
      const termNum = (n: string) => n.includes('1') ? 1 : n.includes('2') ? 2 : 3;
      return termNum(a.name) - termNum(b.name);
    });
    const currentIdx = sortedTerms.findIndex(t => t.id === selectedTerm);
    if (currentIdx <= 0) { setPreviousAvg(null); return; }
    const prevTerm = sortedTerms[currentIdx - 1];
    const { data: prevResults } = await supabaseUntyped
      .from('results')
      .select('marks, out_of, percentage')
      .eq('student_id', selectedChild.id)
      .eq('term_id', prevTerm.id);
    if (!prevResults || prevResults.length === 0) { setPreviousAvg(null); return; }
    const totalPct = prevResults.reduce((s: number, r: any) => s + (r.percentage || (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0)), 0);
    setPreviousAvg(totalPct / prevResults.length);
  };

  const classDataForGrading = selectedChild?.classes || {};
  const isPrimary = getSchoolLevelBand(classDataForGrading) === 'primary';

  const doGeneratePDF = async (fontSize: PdfFontSize = DEFAULT_PDF_FONT_SIZE) => {
    if (!results.length) { toast.error('No results found for this term'); return; }
    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      configurePdfFontSize(doc, fontSize);
      const term = terms.find(t => t.id === selectedTerm);
      const learnerMetrics = aggregateLearnerTotals(results.map((row: any) => ({ ...row, students: selectedChild })), classDataForGrading)[0];
      const rankingDetails = learnerMetrics?.rankingSubjects?.length ? { subjects: learnerMetrics.rankingSubjects, totalMarks: learnerMetrics.rankingTotalMarks || 0, totalPoints: learnerMetrics.rankingTotalPoints || 0 } : undefined;
      const avgPercentage = learnerMetrics?.avgPct || 0;
      const totalPoints = isPrimary ? null : (rankingDetails?.totalPoints ?? learnerMetrics?.totalPoints ?? 0);
      const deviation = previousAvg !== null ? avgPercentage - previousAvg : null;
      const isNew = deviation === null;
      // Prefer the unified ranking position so the parent sees the same rank as
      // the school's class summary and the learner's own portal.
      const position = classPosition ?? results[0]?.class_position ?? results[0]?.position ?? null;
      const positionStr = formatPosition(position, totalStudents || 0);
      // Build subjectScores with `percentage` key (matching SubjectResult interface for pathway logic)
      const subjectScores = results.map(r => ({
        name: r.subjects?.name || 'Unknown',
        percentage: getPercentage(r),
        previousPercentage: null,
      }));
      const sortedBest = [...subjectScores].sort((a, b) => b.percentage - a.percentage);
      const bestSubject = sortedBest[0]?.name || 'all subjects';
      const weakestSubject = sortedBest[sortedBest.length - 1]?.name || 'some subjects';
      const studentFullName = `${selectedChild.first_name} ${selectedChild.last_name}`;
      // FIX Issue 2: Pass subjectScores so pathway performance is included in comment
      const aiComment = generateUniqueAIComment(
        studentFullName, avgPercentage, deviation, bestSubject, weakestSubject,
        position, totalStudents || 0, isNew, classDataForGrading, subjectScores
      );

      await drawReportHeader(doc, schoolInfo, {
        name: studentFullName,
        photoUrl: selectedChild.photo_url || null,
      });
      const overallGrade = calculateGradeForClass(avgPercentage, classDataForGrading);
      drawStudentInfo(doc, studentFullName, selectedChild.admission_number || 'N/A', formatClassStream(classDataForGrading), term?.name || '', term?.academic_year || '', positionStr, 48, results[0]?.school_exams?.name || undefined, selectedChild.assessment_number || undefined, { totalMarks: rankingDetails ? `${Math.round(rankingDetails.totalMarks)} marks out of 700` : undefined, totalPoints: rankingDetails ? `${rankingDetails.totalPoints} points out of 56` : undefined, pathway: selectedChild.pathway, track: selectedChild.track, overallGrade: 'subLevel' in overallGrade ? overallGrade.subLevel : overallGrade.grade, showPathway: usesSevenSubjectRanking(classDataForGrading), is844: is844Curriculum(classDataForGrading) });
      const qrOptions = { assessmentNumber: selectedChild.assessment_number };
      const commentBottomY = getReportCardCommentBottomY(doc, schoolInfo, qrOptions);
      let currentY = drawResultsTable(doc, results, classDataForGrading, usesSevenSubjectRanking(classDataForGrading) ? 69 : 62, { showDeviation: previousAvg !== null, rankingDetails }) + 6;
      
      // RESTRICTED Pathway Performance: Only for Junior (Grade 6-9)
      if (getSchoolLevelBand(classDataForGrading) === 'junior') {
        currentY = drawPathwayPerformance(doc, results, currentY) + 6;
      }
      
      currentY = drawSummaryBox(doc, results, avgPercentage, totalPoints, positionStr, classDataForGrading, currentY, undefined, rankingDetails);
      currentY = drawDeviation(doc, deviation, previousAvg, position, currentY + 6);
      if (trendData.length >= 2 && canFitReportCardOptionalSection(doc, currentY, 38, aiComment, schoolInfo, qrOptions)) {
        currentY = drawTrendGraph(doc, trendData, 14, currentY, 182, 34, getSchoolLevelBand(classDataForGrading)) + 2;
      }
      const studentBests = classBestList.filter(b => b.studentId === selectedChild.id);
      if (studentBests.length > 0 && canFitReportCardOptionalSection(doc, currentY, 20, aiComment, schoolInfo, qrOptions)) {
        currentY = drawAchievements(doc, studentBests, currentY);
      }
      currentY = drawAIComment(doc, aiComment, currentY, { bottomY: commentBottomY });
      await addSignaturesToPDF(doc, signatures, currentY, schoolInfo, qrOptions);
      drawReportFooter(doc);
      doc.save(`Report_Card_${selectedChild.first_name}_${selectedChild.last_name}.pdf`);
    } catch (err: any) {
      toast.error('PDF Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedChild) return;
    if (schoolPayConfig?.parent_pay_enabled) {
      const isPaid = await checkPdfPaid(selectedChild.id);
      if (!isPaid) {
        toast.error(`Please pay the report card fee (KSH ${schoolPayConfig.pdf_report_fee}) to download.`);
        return;
      }
    }
    setShowFontSizeDialog(true);
  };

  const handlePayment = async (type: 'pdf_report' | 'view_results') => {
    if (!selectedChild || !schoolPayConfig?.reseller_paystack_public_key) return;
    setPaying(true);
    try {
      await loadPaystackScript();
      const amount = type === 'pdf_report' ? schoolPayConfig.pdf_report_fee : schoolPayConfig.view_results_fee;
      const handler = window.PaystackPop?.setup({
        key: schoolPayConfig.reseller_paystack_public_key,
        email: user?.email || 'parent@zamifu.com',
        amount: amount * 100,
        currency: 'KES',
        ref: `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        // NOTE: Paystack V1 inline.js rejects async arrow functions in callbacks
        // ("Attribute callback must be a valid function") — wrap async logic in a
        // plain synchronous function
        callback: (response: any) => {
          supabaseUntyped.from('parent_payments').insert({
            parent_id: user?.id,
            student_id: selectedChild.id,
            school_id: schoolPayConfig.school_id,
            amount,
            payment_type: type,
            status: 'success',
            transaction_ref: response.reference,
          }).then(({ error }) => {
            if (error) toast.error('Payment recorded with error: ' + error.message);
            else {
              toast.success('Payment successful!');
              if (type === 'pdf_report') setPdfPaid(prev => ({ ...prev, [selectedChild.id]: true }));
              fetchResults();
            }
            setPaying(false);
          });
        },
        onClose: () => { setPaying(false); toast.info('Payment cancelled'); },
      });
      handler?.openIframe();
    } catch (err: any) {
      toast.error('Payment Error: ' + err.message);
      setPaying(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Child Report Card</h1>
          <p className="text-sm text-[#666666]">View and download your child's academic performance</p>
        </div>
        <div className="flex items-center gap-3">
          {children.length > 1 && (
            <select
              value={selectedChild?.id}
              onChange={(e) => {
                const child = children.find(c => c.id === e.target.value);
                setSelectedChild(child);
                setChildPhotoLoadError(false);
                fetchTerms(child.school_id);
                fetchSchoolPayConfig(child.school_id);
                fetchSchoolInfo(child.school_id);
                fetchSignatures(child.school_id, child.classes?.class_teacher_id);
                fetchTotalStudents(child.class_id, child.school_id);
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {children.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          )}
          <button
            onClick={handleDownload}
            disabled={generating || !results.length}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden border-4 border-white shadow-sm">
              {selectedChild?.photo_url && !childPhotoLoadError ? (
                <img src={selectedChild.photo_url} alt="" onError={() => setChildPhotoLoadError(true)} className="w-full h-full object-cover" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">{selectedChild?.first_name?.[0]}{selectedChild?.last_name?.[0]}</div>
              )}
            </div>
            <h2 className="text-lg font-bold text-[#111111]">{selectedChild?.first_name} {selectedChild?.last_name}</h2>
            <p className="text-sm text-[#666666] mb-4">{selectedChild?.admission_number || 'No Admission No.'}</p>
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
              <Users className="w-3.5 h-3.5" /> {formatClassStream(selectedChild?.classes)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-4">Select Term</h3>
            <div className="space-y-2">
              {terms.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTerm(t.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                    selectedTerm === t.id ? 'bg-blue-600 text-white font-medium' : 'hover:bg-gray-50 text-[#666666]'
                  }`}
                >
                  {t.name} {t.academic_year}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-3 space-y-6">
          {results.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border border-gray-100">
                  <p className="text-xs font-bold text-[#666666] uppercase mb-1">Average Score</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-[#111111]">
                      {(results.reduce((s, r) => s + getPercentage(r), 0) / results.length).toFixed(1)}%
                    </span>
                    {previousAvg !== null && (
                      <span className={`text-xs font-bold flex items-center ${
                        (results.reduce((s, r) => s + getPercentage(r), 0) / results.length) >= previousAvg ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(results.reduce((s, r) => s + getPercentage(r), 0) / results.length) >= previousAvg ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                        {Math.abs((results.reduce((s, r) => s + getPercentage(r), 0) / results.length) - previousAvg).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border border-gray-100">
                  <p className="text-xs font-bold text-[#666666] uppercase mb-1">Overall Grade</p>
                  <span className="text-2xl font-black text-purple-600 uppercase">
                    {(() => {
                      const avg = results.reduce((s, r) => s + getPercentage(r), 0) / results.length;
                      const activeGrade = calculateGradeForClass(avg, classDataForGrading);
                      return 'subLevel' in activeGrade ? activeGrade.subLevel : activeGrade.grade;
                    })()}
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border border-gray-100">
                  <p className="text-xs font-bold text-[#666666] uppercase mb-1">Class Position</p>
                  <span className="text-2xl font-black text-blue-600">
                    {classPosition ?? results[0]?.class_position ?? results[0]?.position ?? 'N/A'}
                    <span className="text-sm font-normal text-gray-400 ml-1">/ {totalStudents}</span>
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-[#111111] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> Learning Area Performance
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider">Learning Area</th>
                        <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-center">Score</th>
                        <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider text-center">Grade</th>
                        <th className="px-6 py-4 text-xs font-bold text-[#666666] uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.map(r => {
                        const pct = getPercentage(r);
                        const activeGrade = calculateGradeForClass(pct, classDataForGrading);
                        const g = 'subLevel' in activeGrade ? activeGrade.subLevel : activeGrade.grade;
                        const is844 = is844Curriculum(classDataForGrading);
                        const strong = is844 ? activeGrade.points >= 7 : activeGrade.grade === 'EE';
                        const meeting = is844 ? activeGrade.points >= 5 : activeGrade.grade === 'ME';
                        const approaching = is844 ? activeGrade.points >= 3 : activeGrade.grade === 'AE';
                        return (
                          <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#111111]">{r.subjects?.name === 'Creative Arts' ? 'C-Arts' : r.subjects?.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-bold text-[#111111]">{pct}%</div>
                              <div className="w-24 bg-gray-100 h-1.5 rounded-full mx-auto mt-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 41 ? 'bg-blue-500' : pct >= 21 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                  strong ? 'bg-green-100 text-green-700' : meeting ? 'bg-blue-100 text-blue-700' : approaching ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                              }`}>{g}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-[#666666]">
                                {strong ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : meeting ? <Minus className="w-3.5 h-3.5 text-blue-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                                {strong ? 'Exceeding' : meeting ? 'Meeting' : approaching ? 'Approaching' : 'Below'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-gray-300" /></div>
              <h3 className="text-lg font-bold text-[#111111] mb-2">No Results Available</h3>
              <p className="text-sm text-[#666666] max-w-xs mx-auto">Results for this term haven't been published yet. Please check back later or contact the school.</p>
            </div>
          )}
        </div>
      </div>

      {showFontSizeDialog && (
        <PdfFontSizeDialog
          open
          title="Download Child Report Card"
          description="Choose the font size for the downloaded report card. The default and recommended size is 14."
          onCancel={() => setShowFontSizeDialog(false)}
          onConfirm={async (fontSize) => {
            await doGeneratePDF(fontSize);
            setShowFontSizeDialog(false);
          }}
        />
      )}
    </div>
  );
}
