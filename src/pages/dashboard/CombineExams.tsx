import { useEffect, useMemo, useState } from 'react';
import { Check, FilePlus2, Loader2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type CombinedRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  subjectId: string;
  subjectName: string;
  sourceCount: number;
  percentage: number;
  marks: number;
};

export default function CombineExams() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [rows, setRows] = useState<CombinedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [combinedName, setCombinedName] = useState('');

  useEffect(() => {
    if (!user?.schoolId) return;
    const load = async () => {
      setLoading(true);
      const [{ data: classData, error: classError }, { data: termData, error: termError }, { data: examData, error: examError }] = await Promise.all([
        supabaseUntyped.from('classes').select('id, name, stream, level, grade_level').eq('school_id', user.schoolId).eq('is_active', true).order('level').order('name'),
        supabaseUntyped.from('terms').select('id, name, academic_year, start_date, end_date').eq('school_id', user.schoolId).order('academic_year', { ascending: false }).order('start_date'),
        supabaseUntyped.from('school_exams').select('id, name, type, term_id, target_type, target_class_id, created_at').eq('school_id', user.schoolId).eq('is_active', true).order('created_at', { ascending: false }),
      ]);
      if (classError || termError || examError) toast.error('Could not load exam-combination data.');
      setClasses(classData || []);
      setTerms(termData || []);
      setExams(examData || []);
      if (termData?.[0]?.id) setSelectedTerm(termData[0].id);
      setLoading(false);
    };
    void load();
  }, [user?.schoolId]);

  const availableExams = useMemo(() => exams.filter((exam) => {
    if (selectedTerm && exam.term_id && exam.term_id !== selectedTerm) return false;
    if (!selectedClass) return true;
    if (exam.target_type === 'class') return exam.target_class_id === selectedClass;
    if (exam.target_type === 'grade') {
      const cls = classes.find((item) => item.id === selectedClass);
      return String(exam.target_grade_level) === String(cls?.grade_level ?? cls?.level);
    }
    return true;
  }), [classes, exams, selectedClass, selectedTerm]);

  const toggleExam = (id: string) => setSelectedExams((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const buildPreview = async () => {
    if (!selectedClass || !selectedTerm || selectedExams.length < 2) {
      toast.error('Select a class, term, and at least two exams.');
      return;
    }
    setPreviewing(true);
    try {
      const { data, error } = await supabaseUntyped
        .from('results')
        .select('student_id, class_id, subject_id, marks, out_of, percentage, teacher_id, academic_year, curriculum, students(first_name, last_name, admission_number), subjects(name)')
        .eq('school_id', user?.schoolId)
        .eq('class_id', selectedClass)
        .eq('term_id', selectedTerm)
        .in('exam_id', selectedExams);
      if (error) throw error;
      const grouped = new Map<string, any>();
      (data || []).forEach((result: any) => {
        const key = `${result.student_id}:${result.subject_id}`;
        const item = grouped.get(key) || { result, values: [] };
        const percentage = Number(result.percentage ?? (Number(result.out_of) > 0 ? Number(result.marks || 0) / Number(result.out_of) * 100 : 0));
        item.values.push({ ...result, percentage });
        grouped.set(key, item);
      });
      const preview = Array.from(grouped.values()).map(({ result, values }) => {
        const percentage = values.reduce((sum: number, item: any) => sum + item.percentage, 0) / values.length;
        return {
          studentId: result.student_id,
          studentName: `${result.students?.first_name || ''} ${result.students?.last_name || ''}`.trim(),
          admissionNumber: result.students?.admission_number || '',
          subjectId: result.subject_id,
          subjectName: result.subjects?.name || 'Learning Area',
          sourceCount: values.length,
          percentage,
          marks: percentage,
          teacherId: values.find((item: any) => item.teacher_id)?.teacher_id || null,
          academicYear: result.academic_year || '',
          curriculum: result.curriculum || 'CBE',
        };
      }).sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true }) || a.subjectName.localeCompare(b.subjectName));
      setRows(preview as CombinedRow[]);
      if (!combinedName) setCombinedName(`Combined: ${availableExams.filter((exam) => selectedExams.includes(exam.id)).map((exam) => exam.name).join(' + ')}`.slice(0, 120));
      toast.success(`Preview ready: ${preview.length} learner-learning-area rows.`);
    } catch (error: any) {
      toast.error(`Could not preview combined results: ${error.message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const saveCombinedExam = async () => {
    if (!user?.schoolId || !selectedClass || !selectedTerm || rows.length === 0 || selectedExams.length < 2) {
      toast.error('Create a preview before saving the combined exam.');
      return;
    }
    setSaving(true);
    try {
      const { data: exam, error: examError } = await supabaseUntyped.from('school_exams').insert({
        school_id: user.schoolId,
        name: combinedName.trim() || 'Combined Exam',
        type: 'combined',
        term_id: selectedTerm,
        target_type: 'class',
        target_class_id: selectedClass,
        is_active: true,
      }).select('id').single();
      if (examError) throw examError;
      const payload = (rows as any[]).filter((row) => row.teacherId).map((row) => ({
        school_id: user.schoolId,
        student_id: row.studentId,
        class_id: selectedClass,
        subject_id: row.subjectId,
        teacher_id: row.teacherId,
        term_id: selectedTerm,
        academic_year: row.academicYear || String(new Date().getFullYear()),
        curriculum: row.curriculum || 'CBE',
        marks: Number(row.marks.toFixed(2)),
        out_of: 100,
        percentage: Number(row.percentage.toFixed(2)),
        exam_id: exam.id,
        status: 'submitted',
      }));
      if (payload.length === 0) throw new Error('No preview rows contained a valid teacher record.');
      const { error: resultError } = await supabaseUntyped.from('results').upsert(payload, { onConflict: 'student_id,subject_id,term_id,exam_id' });
      if (resultError) throw resultError;
      toast.success(`Combined exam saved with ${payload.length} result rows.`);
      setSelectedExams([]);
      setRows([]);
      setCombinedName('');
    } catch (error: any) {
      toast.error(`Could not save combined exam: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FilePlus2 className="w-7 h-7 text-violet-600" /> Combine Exams</h1><p className="text-sm text-gray-500 mt-1">Select multiple assessments, preview averaged results, and save them as one exam.</p></div>
      <div className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-sm font-medium text-gray-700">Class<select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedExams([]); setRows([]); }} className="mt-2 w-full rounded-xl border px-3 py-2.5"><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.stream ? ` (${item.stream})` : ''}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Term<select value={selectedTerm} onChange={(event) => { setSelectedTerm(event.target.value); setSelectedExams([]); setRows([]); }} className="mt-2 w-full rounded-xl border px-3 py-2.5"><option value="">Select term</option>{terms.map((item) => <option key={item.id} value={item.id}>{item.name} {item.academic_year}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Combined exam name<input value={combinedName} onChange={(event) => setCombinedName(event.target.value)} placeholder="Combined Exam" className="mt-2 w-full rounded-xl border px-3 py-2.5" /></label>
      </div>
      <div className="bg-white rounded-2xl border p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold text-gray-900">Available Exams</h2><p className="text-xs text-gray-500">Select at least two exams from the same class and term.</p></div><span className="text-sm font-semibold text-violet-700">{selectedExams.length} selected</span></div>{availableExams.length === 0 ? <p className="text-sm text-gray-500">Choose a class and term to see available exams.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{availableExams.map((exam) => <label key={exam.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${selectedExams.includes(exam.id) ? 'border-violet-500 bg-violet-50' : 'border-gray-200'}`}><input type="checkbox" checked={selectedExams.includes(exam.id)} onChange={() => toggleExam(exam.id)} /><span className="flex-1"><span className="block font-medium">{exam.name}</span><span className="text-xs text-gray-500">{exam.type || 'Assessment'}</span></span>{selectedExams.includes(exam.id) && <Check className="w-5 h-5 text-violet-600" />}</label>)}</div>}<button type="button" onClick={buildPreview} disabled={previewing || selectedExams.length < 2} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Preview Combined Results</button></div>
      {rows.length > 0 && <div className="bg-white rounded-2xl border overflow-hidden"><div className="p-5 flex items-center justify-between"><div><h2 className="font-semibold text-gray-900">Combined Results Preview</h2><p className="text-xs text-gray-500">Each row is the average percentage across the selected exams.</p></div><button type="button" onClick={saveCombinedExam} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Combined Exam</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-3">Learner</th><th className="px-4 py-3">Admission No.</th><th className="px-4 py-3">Learning Area</th><th className="px-4 py-3">Source Exams</th><th className="px-4 py-3">Average</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.studentId}:${row.subjectId}`} className="border-t"><td className="px-4 py-3 font-medium">{row.studentName}</td><td className="px-4 py-3">{row.admissionNumber || '-'}</td><td className="px-4 py-3">{row.subjectName}</td><td className="px-4 py-3">{row.sourceCount}</td><td className="px-4 py-3 font-semibold">{row.percentage.toFixed(1)}%</td></tr>)}</tbody></table></div></div>}
    </div>
  );
}
