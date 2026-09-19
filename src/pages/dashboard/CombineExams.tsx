import { useEffect, useMemo, useState } from 'react';
import { Check, Download, FilePlus2, FileSpreadsheet, FileText, Loader2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { deactivateSameScopeActives } from '@/lib/assessment-active';

type Scope = { id: string; label: string; classIds: string[]; gradeLevel: string | null; allStreams: boolean };
type CombinedRow = {
  studentId: string; studentName: string; admissionNumber: string; classId: string; className: string; stream: string;
  subjectId: string; subjectName: string; sourceCount: number; percentage: number; marks: number;
  teacherId: string | null; academicYear: string; curriculum: string;
};

const cleanFileName = (value: string) => value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'combined_exam';
const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;

export default function CombineExams() {
  const { user, schoolData } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [resultExamRefs, setResultExamRefs] = useState<any[]>([]);
  const [selectedScope, setSelectedScope] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [rows, setRows] = useState<CombinedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [combinedName, setCombinedName] = useState('');
  const [savedExamId, setSavedExamId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.schoolId) return;
    const load = async () => {
      setLoading(true);
      const [{ data: classData, error: classError }, { data: termData, error: termError }, { data: examData, error: examError }, { data: resultRefs, error: resultRefsError }] = await Promise.all([
        supabaseUntyped.from('classes').select('id, name, stream, stream_name, level, grade_level').eq('school_id', user.schoolId).eq('is_active', true).order('level').order('name'),
        supabaseUntyped.from('terms').select('id, name, academic_year, start_date, end_date').eq('school_id', user.schoolId).order('academic_year', { ascending: false }).order('start_date'),
        supabaseUntyped.from('school_exams').select('id, name, type, term_id, target_type, target_class_id, target_grade_level, created_at, is_active').eq('school_id', user.schoolId).order('created_at', { ascending: false }),
        supabaseUntyped.from('results').select('exam_id, term_id, class_id').eq('school_id', user.schoolId).not('exam_id', 'is', null).limit(5000),
      ]);
      if (classError || termError || examError || resultRefsError) toast.error('Could not load all combine-exam data. Refresh and try again.');
      setClasses(classData || []); setTerms(termData || []); setExams(examData || []); setResultExamRefs(resultRefs || []);
      if (termData?.[0]?.id) setSelectedTerm(termData[0].id);
      setLoading(false);
    };
    void load();
  }, [user?.schoolId]);

  const scopes = useMemo<Scope[]>(() => {
    const individual = classes.map((item) => ({ id: `class:${item.id}`, label: `${item.name}${item.stream || item.stream_name ? ` (${item.stream || item.stream_name})` : ''}`, classIds: [item.id], gradeLevel: String(item.grade_level ?? item.level ?? ''), allStreams: false }));
    const byGrade = new Map<string, any[]>();
    classes.forEach((item) => { const grade = String(item.grade_level ?? item.level ?? ''); if (!byGrade.has(grade)) byGrade.set(grade, []); byGrade.get(grade)!.push(item); });
    const streams = Array.from(byGrade.entries()).filter(([, items]) => items.length > 1).map(([grade, items]) => ({ id: `grade:${grade}`, label: `All streams · Grade ${grade}`, classIds: items.map((item) => item.id), gradeLevel: grade, allStreams: true }));
    return [...individual, ...streams];
  }, [classes]);

  const activeScope = scopes.find((item) => item.id === selectedScope);
  const availableExams = useMemo(() => exams.filter((exam) => {
    const linked = resultExamRefs.filter((ref) => ref.exam_id === exam.id);
    if (selectedTerm && exam.term_id && exam.term_id !== selectedTerm) return false;
    if (selectedTerm && !exam.term_id && !linked.some((ref) => ref.term_id === selectedTerm)) return false;
    if (!activeScope) return true;
    if (exam.target_type === 'class') return activeScope.classIds.includes(exam.target_class_id);
    if (exam.target_type === 'grade') return String(exam.target_grade_level) === String(activeScope.gradeLevel);
    return linked.length === 0 || linked.some((ref) => activeScope.classIds.includes(ref.class_id));
  }), [activeScope, exams, resultExamRefs, selectedTerm]);

  const resetSelection = () => { setSelectedExams([]); setRows([]); setSavedExamId(null); };
  const selectedExamNames = availableExams.filter((exam) => selectedExams.includes(exam.id)).map((exam) => exam.name);
  const toggleExam = (id: string) => setSelectedExams((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const buildPreview = async () => {
    if (!user?.schoolId || !activeScope || !selectedTerm || selectedExams.length < 2) { toast.error('Choose a class or all-streams scope, term, and at least two exams.'); return; }
    setPreviewing(true); setSavedExamId(null);
    try {
      const { data, error } = await supabaseUntyped.from('results').select('student_id, class_id, subject_id, marks, out_of, percentage, teacher_id, academic_year, curriculum, students(first_name, last_name, admission_number), subjects(name), classes(name, stream, stream_name)').eq('school_id', user.schoolId).in('class_id', activeScope.classIds).eq('term_id', selectedTerm).in('exam_id', selectedExams).limit(10000);
      if (error) throw error;
      const grouped = new Map<string, { result: any; values: any[] }>();
      (data || []).forEach((result: any) => {
        const key = `${result.student_id}:${result.subject_id}`;
        const item = grouped.get(key) || { result, values: [] };
        const percentage = Number(result.percentage ?? (Number(result.out_of) > 0 ? Number(result.marks || 0) / Number(result.out_of) * 100 : 0));
        item.values.push({ ...result, percentage }); grouped.set(key, item);
      });
      const preview = Array.from(grouped.values()).map(({ result, values }) => {
        const percentage = values.reduce((sum: number, item: any) => sum + item.percentage, 0) / values.length;
        return { studentId: result.student_id, studentName: `${result.students?.first_name || ''} ${result.students?.last_name || ''}`.trim() || 'Unnamed learner', admissionNumber: result.students?.admission_number || '', classId: result.class_id, className: result.classes?.name || 'Class', stream: result.classes?.stream || result.classes?.stream_name || '', subjectId: result.subject_id, subjectName: result.subjects?.name || 'Learning Area', sourceCount: values.length, percentage, marks: percentage, teacherId: values.find((item: any) => item.teacher_id)?.teacher_id || null, academicYear: result.academic_year || String(new Date().getFullYear()), curriculum: result.curriculum || 'CBE' };
      }).sort((a, b) => a.className.localeCompare(b.className) || a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true }) || a.subjectName.localeCompare(b.subjectName));
      setRows(preview); if (!combinedName) setCombinedName(`${activeScope.allStreams ? `Grade ${activeScope.gradeLevel}` : activeScope.label} · ${selectedExamNames.join(' + ')}`.slice(0, 160));
      toast.success(`Preview ready: ${preview.length} learner-learning-area rows.`);
    } catch (error: any) { toast.error(`Could not preview combined results: ${error.message || 'Unknown error'}`); } finally { setPreviewing(false); }
  };

  const saveCombinedExam = async () => {
    if (!user?.schoolId || !activeScope || !selectedTerm || rows.length === 0 || selectedExams.length < 2) { toast.error('Create a preview before saving the combined exam.'); return; }
    const name = combinedName.trim(); if (!name) { toast.error('Enter a name for the combined exam.'); return; }
    setSaving(true);
    try {
      const targetType = activeScope.allStreams ? 'grade' : 'class';
      const targetClassId = activeScope.allStreams ? null : activeScope.classIds[0];
      const targetColumn = activeScope.allStreams ? 'target_grade_level' : 'target_class_id';
      const targetValue = activeScope.allStreams ? activeScope.gradeLevel : targetClassId;
      const { data: existing, error: lookupError } = await supabaseUntyped.from('school_exams').select('id').eq('school_id', user.schoolId).eq('name', name).eq('term_id', selectedTerm).eq('target_type', targetType).eq(targetColumn, targetValue).limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      let examId = existing?.id as string | undefined;
      if (!examId) {
        const deactResult = await deactivateSameScopeActives({ schoolId: user.schoolId, termId: selectedTerm, targetType, targetClassId: targetClassId || undefined, targetGradeLevel: activeScope.gradeLevel ? Number(activeScope.gradeLevel) || null : null, actingUserId: user.id });
        if (deactResult.error) throw deactResult.error;
        const { data: exam, error: examError } = await supabaseUntyped.from('school_exams').insert({ school_id: user.schoolId, name, type: 'combined', term_id: selectedTerm, target_type: targetType, target_class_id: targetClassId, target_grade_level: activeScope.gradeLevel, is_active: true, activated_at: new Date().toISOString() }).select('id').single();
        if (examError) throw examError; examId = exam.id;
      } else {
        const { error: deleteError } = await supabaseUntyped.from('results').delete().eq('school_id', user.schoolId).eq('exam_id', examId);
        if (deleteError) throw deleteError;
        const { error: updateError } = await supabaseUntyped.from('school_exams').update({ is_active: true }).eq('id', examId).eq('school_id', user.schoolId);
        if (updateError) throw updateError;
      }
      const payload = rows.map((row) => ({ school_id: user.schoolId, student_id: row.studentId, class_id: row.classId, subject_id: row.subjectId, teacher_id: row.teacherId || user.id, term_id: selectedTerm, academic_year: row.academicYear, curriculum: row.curriculum, marks: Number(row.marks.toFixed(2)), out_of: 100, percentage: Number(row.percentage.toFixed(2)), exam_id: examId, status: 'submitted' }));
      const { error: resultError } = await supabaseUntyped.from('results').upsert(payload, { onConflict: 'student_id,subject_id,term_id,exam_id' });
      if (resultError) throw resultError;
      setSavedExamId(examId || null); toast.success(existing ? `Updated “${name}” with ${payload.length} rows.` : `Saved “${name}” with ${payload.length} rows.`);
    } catch (error: any) { toast.error(`Could not save combined exam: ${error.message || 'Unknown error'}`); } finally { setSaving(false); }
  };

  const learnerSummary = useMemo(() => Array.from(new Map(rows.map((row) => [`${row.classId}:${row.studentId}`, row])).entries()).map(([key, first]) => { const items = rows.filter((row) => `${row.classId}:${row.studentId}` === key); const average = items.reduce((sum, item) => sum + item.percentage, 0) / items.length; return { className: first.className, stream: first.stream, studentName: first.studentName, admissionNumber: first.admissionNumber, subjects: items.length, average, status: average >= 50 ? 'Pass' : 'Needs support' }; }).sort((a, b) => b.average - a.average), [rows]);
  const streamSummary = useMemo(() => Array.from(new Map(rows.map((row) => [row.classId, row])).values()).map((first) => { const items = rows.filter((row) => row.classId === first.classId); const learnerAverages = Array.from(new Set(items.map((item) => item.studentId))).map((studentId) => { const studentRows = items.filter((item) => item.studentId === studentId); return studentRows.reduce((sum, item) => sum + item.percentage, 0) / studentRows.length; }); const average = learnerAverages.reduce((sum, value) => sum + value, 0) / Math.max(learnerAverages.length, 1); return { className: first.className, stream: first.stream || 'Main', learners: learnerAverages.length, average, passRate: learnerAverages.filter((value) => value >= 50).length / Math.max(learnerAverages.length, 1) * 100, highest: Math.max(...learnerAverages, 0), lowest: Math.min(...learnerAverages, 0) }; }), [rows]);

  const downloadXlsx = (kind: 'learners' | 'streams') => {
    if (!rows.length) { toast.error('Build a preview before downloading summaries.'); return; }
    const data = kind === 'learners' ? learnerSummary.map((item, index) => ({ Rank: index + 1, Class: item.className, Stream: item.stream, Learner: item.studentName, 'Admission No.': item.admissionNumber, Subjects: item.subjects, Average: Number(item.average.toFixed(2)), Status: item.status })) : streamSummary.map((item) => ({ Class: item.className, Stream: item.stream, Learners: item.learners, Average: Number(item.average.toFixed(2)), 'Pass Rate': Number(item.passRate.toFixed(2)), Highest: Number(item.highest.toFixed(2)), Lowest: Number(item.lowest.toFixed(2)) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), kind === 'learners' ? 'Class Summary' : 'All Streams'); XLSX.writeFile(wb, `${cleanFileName(combinedName)}_${kind}_summary.xlsx`); toast.success('Excel summary downloaded.');
  };

  const downloadCsv = () => { if (!rows.length) return toast.error('Build a preview before downloading.'); const headers = ['Class', 'Stream', 'Learner', 'Admission No.', 'Learning Area', 'Source Exams', 'Average']; const body = rows.map((row) => [row.className, row.stream, row.studentName, row.admissionNumber, row.subjectName, row.sourceCount, row.percentage.toFixed(2)]); const csv = [headers, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `${cleanFileName(combinedName)}_results.csv`; link.click(); URL.revokeObjectURL(link.href); toast.success('CSV downloaded.'); };

  const downloadPdf = () => { if (!rows.length) return toast.error('Build a preview before downloading.'); const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); doc.setFontSize(16); doc.text(combinedName || 'Combined Exam Summary', 14, 14); doc.setFontSize(9); doc.text(`${schoolData?.name || 'School'} · ${activeScope?.label || ''} · ${terms.find((term) => term.id === selectedTerm)?.name || ''}`, 14, 20); autoTable(doc, { startY: 25, head: [['Rank', 'Class', 'Stream', 'Learner', 'Admission No.', 'Subjects', 'Average', 'Status']], body: learnerSummary.map((item, index) => [index + 1, item.className, item.stream, item.studentName, item.admissionNumber, item.subjects, pct(item.average), item.status]), styles: { fontSize: 8 }, headStyles: { fillColor: [109, 40, 217] }, showHead: 'everyPage' }); doc.save(`${cleanFileName(combinedName)}_class_summary.pdf`); toast.success('Class summary PDF downloaded.'); };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FilePlus2 className="w-7 h-7 text-violet-600" /> Combine Exams</h1><p className="text-sm text-gray-500 mt-1">Combine assessments once, safely update the same named exam, and download powerful class and all-stream summaries.</p></div>
    <div className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
      <label className="text-sm font-medium text-gray-700">Class or scope<select value={selectedScope} onChange={(event) => { setSelectedScope(event.target.value); resetSelection(); }} className="mt-2 w-full rounded-xl border px-3 py-2.5"><option value="">Select class or all streams</option>{scopes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-sm font-medium text-gray-700">Term<select value={selectedTerm} onChange={(event) => { setSelectedTerm(event.target.value); resetSelection(); }} className="mt-2 w-full rounded-xl border px-3 py-2.5"><option value="">Select term</option>{terms.map((item) => <option key={item.id} value={item.id}>{item.name} {item.academic_year}</option>)}</select></label>
      <label className="text-sm font-medium text-gray-700 md:col-span-2">Combined exam name<input value={combinedName} onChange={(event) => setCombinedName(event.target.value)} placeholder="e.g. Term 2 Final Combined Assessment" className="mt-2 w-full rounded-xl border px-3 py-2.5" /></label>
    </div>
    <div className="bg-white rounded-2xl border p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold text-gray-900">Available source exams</h2><p className="text-xs text-gray-500">Select two or more exams from the chosen term and scope. Saving the same name updates instead of creating a duplicate.</p></div><span className="text-sm font-semibold text-violet-700">{selectedExams.length} selected</span></div>{availableExams.length === 0 ? <p className="text-sm text-gray-500">{activeScope && selectedTerm ? 'No source exams are available for this scope and term. Choose another term or scope, or add results to at least two source exams.' : 'Choose a class or all-streams scope and term to see available exams.'}</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{availableExams.map((exam) => <label key={exam.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${selectedExams.includes(exam.id) ? 'border-violet-500 bg-violet-50' : 'border-gray-200'}`}><input type="checkbox" checked={selectedExams.includes(exam.id)} onChange={() => toggleExam(exam.id)} /><span className="flex-1"><span className="block font-medium">{exam.name}</span><span className="text-xs text-gray-500">{exam.type || 'Assessment'} · {new Date(exam.created_at).toLocaleDateString()}</span></span>{selectedExams.includes(exam.id) && <Check className="w-5 h-5 text-violet-600" />}</label>)}</div>}<button type="button" onClick={buildPreview} disabled={previewing || selectedExams.length < 2} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Preview combined results</button></div>
    {rows.length > 0 && <>
      <div className="bg-white rounded-2xl border p-5 flex flex-wrap items-center gap-3"><div className="mr-auto"><h2 className="font-semibold text-gray-900">{combinedName}</h2><p className="text-xs text-gray-500">{rows.length} subject rows · {learnerSummary.length} learners · {streamSummary.length} classes/streams</p></div><button type="button" onClick={saveCombinedExam} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {savedExamId ? 'Update combined exam' : 'Save combined exam'}</button><button type="button" onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold"><FileText className="w-4 h-4" /> Class summary PDF</button><button type="button" onClick={() => downloadXlsx('learners')} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold"><FileSpreadsheet className="w-4 h-4" /> Class Excel</button><button type="button" onClick={() => downloadXlsx('streams')} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold"><Download className="w-4 h-4" /> All streams Excel</button><button type="button" onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold">CSV</button></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[{ label: 'Learners', value: learnerSummary.length }, { label: 'Classes / streams', value: streamSummary.length }, { label: 'Overall average', value: pct(learnerSummary.reduce((sum, item) => sum + item.average, 0) / Math.max(learnerSummary.length, 1)) }, { label: 'Pass rate', value: pct(learnerSummary.filter((item) => item.average >= 50).length / Math.max(learnerSummary.length, 1) * 100) }].map((card) => <div key={card.label} className="rounded-2xl border bg-violet-50 p-4"><p className="text-xs text-violet-700">{card.label}</p><p className="text-2xl font-bold text-violet-950 mt-1">{card.value}</p></div>)}</div>
      <div className="bg-white rounded-2xl border overflow-hidden"><div className="p-5 border-b"><h2 className="font-semibold">Learner class summary</h2><p className="text-xs text-gray-500">Average across all selected source exams and learning areas.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Class / Stream</th><th className="px-4 py-3">Learner</th><th className="px-4 py-3">Admission No.</th><th className="px-4 py-3">Subjects</th><th className="px-4 py-3">Average</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{learnerSummary.map((item, index) => <tr key={`${item.className}:${item.admissionNumber}:${item.studentName}`} className="border-t"><td className="px-4 py-3 font-semibold">{index + 1}</td><td className="px-4 py-3">{item.className} {item.stream && `(${item.stream})`}</td><td className="px-4 py-3 font-medium">{item.studentName}</td><td className="px-4 py-3">{item.admissionNumber || '-'}</td><td className="px-4 py-3">{item.subjects}</td><td className="px-4 py-3 font-semibold">{pct(item.average)}</td><td className={`px-4 py-3 font-semibold ${item.status === 'Pass' ? 'text-green-700' : 'text-amber-700'}`}>{item.status}</td></tr>)}</tbody></table></div></div>
      <div className="bg-white rounded-2xl border overflow-hidden"><div className="p-5 border-b flex items-center justify-between"><div><h2 className="font-semibold">All streams summary</h2><p className="text-xs text-gray-500">Compare every selected stream and download it as Excel.</p></div><button type="button" onClick={() => downloadXlsx('streams')} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-3 py-2 text-sm font-semibold"><Download className="w-4 h-4" /> Download all streams</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-3">Class</th><th className="px-4 py-3">Stream</th><th className="px-4 py-3">Learners</th><th className="px-4 py-3">Average</th><th className="px-4 py-3">Pass rate</th><th className="px-4 py-3">Highest</th><th className="px-4 py-3">Lowest</th></tr></thead><tbody>{streamSummary.map((item) => <tr key={`${item.className}:${item.stream}`} className="border-t"><td className="px-4 py-3 font-medium">{item.className}</td><td className="px-4 py-3">{item.stream}</td><td className="px-4 py-3">{item.learners}</td><td className="px-4 py-3 font-semibold">{pct(item.average)}</td><td className="px-4 py-3">{pct(item.passRate)}</td><td className="px-4 py-3">{pct(item.highest)}</td><td className="px-4 py-3">{pct(item.lowest)}</td></tr>)}</tbody></table></div></div>
    </>}
  </div>;
}
