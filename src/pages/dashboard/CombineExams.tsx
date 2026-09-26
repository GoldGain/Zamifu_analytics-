import { useEffect, useMemo, useState } from 'react';
import { Check, FilePlus2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { deactivateSameScopeActives } from '@/lib/assessment-active';
import { formatClassStream } from '@/lib/class-label';
import { resultPercentage } from '@/lib/assessmentAnalytics';

type Scope = { id: string; label: string; classIds: string[]; gradeLevel: string | null; allStreams: boolean };
type CombinedRow = {
  studentId: string; studentName: string; admissionNumber: string; classId: string; className: string; stream: string;
  subjectId: string; subjectName: string; sourceCount: number; percentage: number; marks: number;
  teacherId: string | null; academicYear: string; curriculum: string;
};

const defaultName = (scope: Scope | undefined, examNames: string[]) =>
  `${scope?.allStreams ? `Grade ${scope.gradeLevel}` : scope?.label || 'Combined assessment'} · ${examNames.join(' + ')}`.slice(0, 160);

export default function CombineExams() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [resultExamRefs, setResultExamRefs] = useState<any[]>([]);
  const [selectedScope, setSelectedScope] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [examWeights, setExamWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [combinedName, setCombinedName] = useState('');

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
    const individual = classes.map((item) => ({ id: `class:${item.id}`, label: formatClassStream(item), classIds: [item.id], gradeLevel: String(item.grade_level ?? item.level ?? ''), allStreams: false }));
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

  const resetSelection = () => { setSelectedExams([]); setExamWeights({}); };
  const selectedExamNames = availableExams.filter((exam) => selectedExams.includes(exam.id)).map((exam) => exam.name);
  const toggleExam = (id: string) => setSelectedExams((current) => {
    if (current.includes(id)) {
      setExamWeights((weights) => { const next = { ...weights }; delete next[id]; return next; });
      return current.filter((item) => item !== id);
    }
    setExamWeights((weights) => ({ ...weights, [id]: weights[id] || 1 }));
    return [...current, id];
  });

  const buildCombinedRows = async (): Promise<CombinedRow[]> => {
    if (!user?.schoolId || !activeScope || !selectedTerm || selectedExams.length < 2) throw new Error('Choose a class or all-streams scope, term, and at least two exams.');
    const pageSize = 1000;
    const resultRows: any[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabaseUntyped
        .from('results')
        .select('student_id, class_id, subject_id, marks, out_of, percentage, teacher_id, academic_year, curriculum, exam_id, students(first_name, last_name, admission_number), subjects(name), classes(name, stream, stream_name)')
        .eq('school_id', user.schoolId)
        .in('class_id', activeScope.classIds)
        .eq('term_id', selectedTerm)
        .in('exam_id', selectedExams)
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      resultRows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    // Union by learner + learning area. This deliberately uses OR semantics:
    // marks present in either source exam are enough to create the combined row.
    const grouped = new Map<string, { result: any; values: any[] }>();
    resultRows.forEach((result: any) => {
      if (!result.student_id || !result.subject_id) return;
      const key = `${result.student_id}:${result.subject_id}`;
      const item = grouped.get(key) || { result, values: [] };
      item.values.push({ ...result, percentage: resultPercentage(result), weight: Math.max(0.0001, Number(examWeights[result.exam_id] || 1)) });
      grouped.set(key, item);
    });
    return Array.from(grouped.values()).map(({ result, values }) => {
      const totalWeight = values.reduce((sum: number, item: any) => sum + item.weight, 0);
      const percentage = values.reduce((sum: number, item: any) => sum + item.percentage * item.weight, 0) / Math.max(totalWeight, 0.0001);
      return {
        studentId: result.student_id,
        studentName: `${result.students?.first_name || ''} ${result.students?.last_name || ''}`.trim() || 'Unnamed learner',
        admissionNumber: result.students?.admission_number || '',
        classId: result.class_id,
        className: formatClassStream(result.classes),
        stream: result.classes?.stream || result.classes?.stream_name || '',
        subjectId: result.subject_id,
        subjectName: result.subjects?.name || 'Learning Area',
        sourceCount: values.length,
        percentage,
        marks: percentage,
        teacherId: values.find((item: any) => item.teacher_id)?.teacher_id || null,
        academicYear: result.academic_year || String(new Date().getFullYear()),
        curriculum: result.curriculum || 'CBE',
      };
    }).sort((a, b) => a.className.localeCompare(b.className) || a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true }) || a.subjectName.localeCompare(b.subjectName));
  };

  const saveCombinedExam = async () => {
    if (!user?.schoolId || !activeScope || !selectedTerm || selectedExams.length < 2) { toast.error('Choose a class or all-streams scope, term, and at least two exams.'); return; }
    const name = combinedName.trim() || defaultName(activeScope, selectedExamNames);
    if (!name) { toast.error('Enter a name for the combined exam.'); return; }
    setSaving(true);
    try {
      const rows = await buildCombinedRows();
      if (!rows.length) throw new Error('No marks were found in either selected exam.');
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
        if (examError) throw examError;
        examId = exam.id;
      } else {
        const { error: deleteError } = await supabaseUntyped.from('results').delete().eq('school_id', user.schoolId).eq('exam_id', examId);
        if (deleteError) throw deleteError;
        const { error: updateError } = await supabaseUntyped.from('school_exams').update({ is_active: true }).eq('id', examId).eq('school_id', user.schoolId);
        if (updateError) throw updateError;
      }
      const payload = rows.map((row) => ({ school_id: user.schoolId, student_id: row.studentId, class_id: row.classId, subject_id: row.subjectId, teacher_id: row.teacherId || user.id, term_id: selectedTerm, academic_year: row.academicYear, curriculum: row.curriculum, marks: Number(row.marks.toFixed(2)), out_of: 100, percentage: Number(row.percentage.toFixed(2)), exam_id: examId, status: 'submitted' }));
      const { error: componentDeleteError } = await (supabaseUntyped as any).from('school_exam_components').delete().eq('school_id', user.schoolId).eq('combined_exam_id', examId);
      if (componentDeleteError) throw componentDeleteError;
      const componentRows = selectedExams.map((sourceExamId, component_order) => ({ school_id: user.schoolId, combined_exam_id: examId, source_exam_id: sourceExamId, weight: Math.max(0.0001, Number(examWeights[sourceExamId] || 1)), component_order, created_by: user.id }));
      const { error: componentInsertError } = await (supabaseUntyped as any).from('school_exam_components').insert(componentRows);
      if (componentInsertError) throw componentInsertError;
      for (let offset = 0; offset < payload.length; offset += 500) {
        const { error: resultError } = await supabaseUntyped.from('results').insert(payload.slice(offset, offset + 500));
        if (resultError) throw resultError;
      }
      toast.success(existing ? `Updated “${name}” with ${payload.length} rows.` : `Saved “${name}” with ${payload.length} rows.`);
      navigate(user.role === 'school_admin' ? '/school-admin/results' : '/dean-of-studies/results');
    } catch (error: any) {
      toast.error(`Could not save combined results: ${error.message || 'Unknown error'}`);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FilePlus2 className="w-7 h-7 text-violet-600" /> Combine Exams</h1><p className="text-sm text-gray-500 mt-1">Combine assessments once, then use Download Results to generate the saved output.</p></div>
    <div className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
      <label className="text-sm font-medium text-gray-700">Class or scope<select value={selectedScope} onChange={(event) => { setSelectedScope(event.target.value); resetSelection(); }} className="mt-2 w-full rounded-xl border px-3 py-2.5"><option value="">Select class or all streams</option>{scopes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-sm font-medium text-gray-700">Term<select value={selectedTerm} onChange={(event) => { setSelectedTerm(event.target.value); resetSelection(); }} className="mt-2 w-full rounded-xl border px-3 py-2.5"><option value="">Select term</option>{terms.map((item) => <option key={item.id} value={item.id}>{item.name} {item.academic_year}</option>)}</select></label>
      <label className="text-sm font-medium text-gray-700 md:col-span-2">Combined exam name<input value={combinedName} onChange={(event) => setCombinedName(event.target.value)} placeholder={defaultName(activeScope, selectedExamNames) || 'e.g. Term 2 Final Combined Assessment'} className="mt-2 w-full rounded-xl border px-3 py-2.5" /></label>
    </div>
    <div className="bg-white rounded-2xl border p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold text-gray-900">Available source exams</h2><p className="text-xs text-gray-500">Select two or more exams from the chosen term and scope. Set a positive weight for each source before saving.</p></div><span className="text-sm font-semibold text-violet-700">{selectedExams.length} selected</span></div>{availableExams.length === 0 ? <p className="text-sm text-gray-500">{activeScope && selectedTerm ? 'No source exams are available for this scope and term. Choose another term or scope, or add results to at least two source exams.' : 'Choose a class or all-streams scope and term to see available exams.'}</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{availableExams.map((exam) => <label key={exam.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${selectedExams.includes(exam.id) ? 'border-violet-500 bg-violet-50' : 'border-gray-200'}`}><input type="checkbox" checked={selectedExams.includes(exam.id)} onChange={() => toggleExam(exam.id)} /><span className="flex-1"><span className="block font-medium">{exam.name}</span><span className="text-xs text-gray-500">{exam.type || 'Assessment'} · {new Date(exam.created_at).toLocaleDateString()}</span>{selectedExams.includes(exam.id) && <span className="mt-2 flex items-center gap-2 text-xs text-violet-700">Weight <input type="number" min="0.01" step="0.05" value={examWeights[exam.id] || 1} onClick={(event) => event.stopPropagation()} onChange={(event) => setExamWeights((weights) => ({ ...weights, [exam.id]: Math.max(0.01, Number(event.target.value) || 0.01) }))} className="w-20 rounded-lg border border-violet-200 bg-white px-2 py-1 text-sm text-gray-900" /></span>}</span>{selectedExams.includes(exam.id) && <Check className="w-5 h-5 text-violet-600" />}</label>)}</div>}<button type="button" onClick={saveCombinedExam} disabled={saving || selectedExams.length < 2} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save combined exam</button></div>
    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">After saving, Download Results opens with the stored combined assessment available for class summaries, all-stream summaries, and PDFs.</div>
  </div>;
}
