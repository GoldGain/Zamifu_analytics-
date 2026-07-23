import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Download, FileText, Loader2, Users, Share2, Lock, CreditCard, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import {
  generateUniqueAIComment,
  drawTrendGraph,
  addSignaturesToPDF,
  drawReportHeader,
  drawStudentInfo,
  drawResultsTable,
  drawSummaryBox,
  drawDeviation,
  drawAchievements,
  drawAIComment,
  getPercentage,
  formatPosition,
  addStudentPhotoToPDF,
  drawPathwayPerformance,
  type SchoolInfo,
  type SignatureInfo,
} from '@/lib/reportCardPdf';
import { getSchoolLevelBand } from '@/lib/grading';
import { computeBestPerSubject } from '@/lib/bestPerSubject';
import type { BestInSubject } from '@/lib/bestPerSubject';

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
        .select('*, classes(name, level, grade_level, curriculum, class_teacher_id)')
        .in('id', ids);
      setChildren(students || []);
      if (students && students.length > 0) {
        const firstChild = students[0] as any;
        setSelectedChild(firstChild);
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
        .select('name, motto, logo_url, principal_name, principal_signature_url, address, phone, email')
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
          .select('name, logo_url, principal_name, address, phone, email')
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
          .eq('id', classTeacherId)
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
    const { data: classResults } = await supabaseUntyped
      .from('results')
      .select('*, students(id, first_name, last_name), subjects(name)')
      .eq('class_id', selectedChild.class_id)
      .eq('term_id', selectedTerm);
    if (classResults && classResults.length > 0) {
      setClassBestList(computeBestPerSubject(classResults, selectedChild?.classes || {}));
    } else {
      setClassBestList([]);
    }
  };

  const fetchTrendData = async () => {
    if (!selectedChild) return;
    const { data: allResults } = await supabaseUntyped
      .from('results')
      .select('percentage, marks, out_of, term_id, terms(name, academic_year)')
      .eq('student_id', selectedChild.id)
      .order('terms(academic_year)', { ascending: true })
      .order('terms(name)', { ascending: true });
    if (!allResults) return;
    const termMap: Record<string, { term: string; total: number; count: number }> = {};
    allResults.forEach((r: any) => {
      const tname = r.terms?.name || '';
      const year = r.terms?.academic_year || '';
      const key = `${year}-${tname}`;
      const pct = r.percentage !== undefined && r.percentage !== null ? Number(r.percentage) : (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0);
      if (!termMap[key]) termMap[key] = { term: `${tname} ${year}`, total: 0, count: 0 };
      termMap[key].total += pct;
      termMap[key].count++;
    });
    setTrendData(Object.values(termMap).map(t => ({ term: t.term, avg: t.count > 0 ? t.total / t.count : 0 })));
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
  const is = (classDataForGrading?.curriculum || 'CBE') === '';
  const band = getSchoolLevelBand(classDataForGrading);
  const isPrimary = band === 'primary';

  const doGeneratePDF = async () => {
    if (!results.length) { toast.error('No results found for this term'); return; }
    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const term = terms.find(t => t.id === selectedTerm);
      const avgPercentage = results.length
        ? results.reduce((s, r) => s + getPercentage(r), 0) / results.length
        : 0;
      const totalPoints = is
        ? results.reduce((s, r) => {
            const pct = getPercentage(r);
            if (pct >= 80) return s + 12; if (pct >= 75) return s + 11; if (pct >= 70) return s + 10;
            if (pct >= 65) return s + 9; if (pct >= 60) return s + 8; if (pct >= 55) return s + 7;
            if (pct >= 50) return s + 6; if (pct >= 45) return s + 5; if (pct >= 40) return s + 4;
            if (pct >= 35) return s + 3; if (pct >= 30) return s + 2; return s + 1;
          }, 0)
        : isPrimary ? null : results.reduce((s, r) => {
            const pct = getPercentage(r);
            if (pct >= 90) return s + 8; if (pct >= 75) return s + 7; if (pct >= 58) return s + 6;
            if (pct >= 41) return s + 5; if (pct >= 31) return s + 4; if (pct >= 21) return s + 3;
            if (pct >= 11) return s + 2; return s + 1;
          }, 0);
      const deviation = previousAvg !== null ? avgPercentage - previousAvg : null;
      const isNew = deviation === null;
      const position = results[0]?.class_position || results[0]?.position || null;
      const positionStr = formatPosition(position, totalStudents || 0);
      const subjectScores = results.map(r => ({ name: r.subjects?.name || 'Unknown', pct: getPercentage(r) }));
      const sortedBest = [...subjectScores].sort((a, b) => b.pct - a.pct);
      const bestSubject = sortedBest[0]?.name || 'all subjects';
      const weakestSubject = sortedBest[sortedBest.length - 1]?.name || 'some subjects';
      const studentFullName = `${selectedChild.first_name} ${selectedChild.last_name}`;
      const aiComment = generateUniqueAIComment(
        studentFullName, avgPercentage, deviation, bestSubject, weakestSubject,
        position, totalStudents || 0, isNew, classDataForGrading
      );

      await drawReportHeader(doc, schoolInfo);
      const photoUrl = selectedChild.photo_url || null;
      if (photoUrl) {
        await addStudentPhotoToPDF(doc, photoUrl, 163, 30, 35);
      }
      drawStudentInfo(doc, studentFullName, selectedChild.admission_number || 'N/A', classDataForGrading.name || 'N/A', term?.name || '', term?.academic_year || '', positionStr);
      let currentY = drawResultsTable(doc, results, classDataForGrading, 70) + 8;
      
      // NEW: Pathway Performance
      currentY = drawPathwayPerformance(doc, results, currentY) + 8;
      
      currentY = drawSummaryBox(doc, results, avgPercentage, totalPoints, positionStr, classDataForGrading, currentY);
      currentY = drawDeviation(doc, deviation, previousAvg, currentY + 8);
      if (trendData.length >= 2) {
        drawTrendGraph(doc, trendData, 14, currentY + 5, 182, 45, band);
        currentY += 55;
      }
      const studentBest = classBestList.filter(b => b.studentId === selectedChild.id);
      currentY = drawAchievements(doc, studentBest, currentY + 5);
      currentY = drawAIComment(doc, aiComment, currentY + 5);
      addSignaturesToPDF(doc, signatures, currentY + 10, schoolInfo);
      
      doc.save(`${studentFullName}_Report_Card.pdf`);
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
    setGenerating(false);
  };

  const handleDownload = async () => {
    if (!selectedChild) return;
    if (schoolPayConfig?.parent_pay_enabled) {
      const paid = await checkPdfPaid(selectedChild.id);
      if (!paid) {
        toast.info('Payment required to download report card.');
        return;
      }
    }
    doGeneratePDF();
  };

  const handlePay = async () => {
    if (!selectedChild || !schoolPayConfig) return;
    setPaying(true);
    try {
      await loadPaystackScript();
      const amount = (schoolPayConfig.pdf_report_fee || 50) * 100;
      const handler = window.PaystackPop?.setup({
        key: schoolPayConfig.reseller_paystack_public_key,
        email: user?.email,
        amount,
        currency: 'KES',
        ref: `PDF_${selectedChild.id}_${Date.now()}`,
        callback: async (response: any) => {
          if (response.status === 'success') {
            const { error } = await supabaseUntyped.from('parent_payments').insert([{
              parent_id: user?.id,
              student_id: selectedChild.id,
              school_id: schoolPayConfig.school_id,
              payment_type: 'pdf_report',
              amount: schoolPayConfig.pdf_report_fee,
              transaction_ref: response.reference,
              status: 'success',
            }]);
            if (!error) {
              setPdfPaid(prev => ({ ...prev, [selectedChild.id]: true }));
              toast.success('Payment successful! You can now download the report card.');
            }
          }
          setPaying(false);
        },
        onClose: () => setPaying(false),
      });
      handler?.openIframe();
    } catch (err: any) {
      toast.error(err.message);
      setPaying(false);
    }
  };

  const currentAvg = results.length ? results.reduce((s, r) => s + getPercentage(r), 0) / results.length : 0;
  const deviation = previousAvg !== null ? currentAvg - previousAvg : null;

  return (
    <div className="space-y-6 -m-2 p-2 sm:p-4 rounded-3xl bg-gradient-to-br from-slate-50 via-amber-50/40 to-purple-50/50 min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A237E]">Child Report Card</h1>
          <p className="text-sm text-[#666666]">View and download official academic reports</p>
        </div>
        {children.length > 1 && (
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/80 shadow-sm">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${selectedChild?.id === child.id ? 'bg-[#1A237E] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {child.first_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] border border-white/80">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center border-2 border-amber-200 overflow-hidden">
                {selectedChild?.photo_url ? (
                  <img src={selectedChild.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-amber-600" />
                )}
              </div>
              <div>
                <h3 className="font-black text-[#1A237E]">{selectedChild?.first_name} {selectedChild?.last_name}</h3>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">{selectedChild?.classes?.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Select Assessment Term</label>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#F5A623] bg-gray-50/50"
                >
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
                </select>
              </div>

              <div className="pt-2">
                {schoolPayConfig?.parent_pay_enabled && !pdfPaid[selectedChild?.id] ? (
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="w-full flex items-center justify-center gap-2 bg-[#F5A623] text-white px-6 py-3.5 rounded-2xl text-sm font-black hover:bg-[#e69512] transition-all shadow-lg shadow-amber-200 disabled:opacity-50"
                  >
                    {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                    Unlock Report (KES {schoolPayConfig.pdf_report_fee})
                  </button>
                ) : (
                  <button
                    onClick={handleDownload}
                    disabled={generating || !results.length}
                    className="w-full flex items-center justify-center gap-2 bg-[#6A1B9A] text-white px-6 py-3.5 rounded-2xl text-sm font-black hover:bg-[#5a1682] transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    Download Official PDF
                  </button>
                )}
              </div>
            </div>
          </div>

          {results.length > 0 && (
            <div className={`rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] ${
              deviation === null ? 'bg-gray-50 border border-gray-200' :
              deviation >= 0 ? 'bg-emerald-50 border border-emerald-200' :
              'bg-rose-50 border border-rose-200'
            }`}>
              <div className="flex items-center gap-3">
                {deviation === null ? (
                  <Minus className="w-8 h-8 text-gray-400" />
                ) : deviation >= 0 ? (
                  <TrendingUp className="w-8 h-8 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-rose-600" />
                )}
                <div>
                  <div className={`text-lg font-black ${
                    deviation === null ? 'text-gray-600' :
                    deviation >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {deviation === null ? 'First Term' : deviation >= 0 ? `+${deviation.toFixed(1)}% Progress` : `${deviation.toFixed(1)}% Drop`}
                  </div>
                  <p className="text-xs font-medium text-gray-500">Compared to previous term</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] overflow-hidden border border-white/80">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black text-[#1A237E] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#F5A623]" /> Term Results Preview
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Average:</span>
                <span className="text-lg font-black text-[#6A1B9A]">{currentAvg.toFixed(1)}%</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="text-left text-[10px] font-black text-[#1A237E] uppercase tracking-wider px-6 py-4">Learning Area</th>
                    <th className="text-left text-[10px] font-black text-[#1A237E] uppercase tracking-wider px-6 py-4">Marks</th>
                    <th className="text-left text-[10px] font-black text-[#1A237E] uppercase tracking-wider px-6 py-4">Grade</th>
                    <th className="text-left text-[10px] font-black text-[#1A237E] uppercase tracking-wider px-6 py-4">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" /></td></tr>
                  ) : results.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-sm text-gray-500 font-bold">No results published for this term yet.</td></tr>
                  ) : results.map((r, i) => (
                    <tr key={r.id} className={`hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#E8EAF6]/30'}`}>
                      <td className="px-6 py-4 text-sm font-bold text-[#111111]">{r.subjects?.name}</td>
                      <td className="px-6 py-4 text-sm font-medium">{r.marks}/{r.out_of} ({getPercentage(r)}%)</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                          getPercentage(r) >= 75 ? 'bg-emerald-100 text-emerald-700' :
                          getPercentage(r) >= 41 ? 'bg-blue-100 text-blue-700' :
                          getPercentage(r) >= 21 ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {getPercentage(r) >= 75 ? 'EE' : getPercentage(r) >= 41 ? 'ME' : getPercentage(r) >= 21 ? 'AE' : 'BE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-[#6A1B9A]">{r.cbc_points || r.points_ || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
