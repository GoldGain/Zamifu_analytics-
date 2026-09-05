import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { AddMarksModal, type AddMarksTarget } from '@/components/AddMarksModal';

interface SubjectProgress {
  subject_id: string;
  subject_name: string;
  teacher_name: string;
  entered_count: number;
  total_students: number;
  percentage: number;
}

interface MarksProgressProps {
  classId: string;
  className: string;
  termId: string;
  schoolId: string;
  compact?: boolean;
  examId?: string;
}

export function MarksProgress({ classId, className, termId, schoolId, compact = false, examId }: MarksProgressProps) {
  const [subjects, setSubjects] = useState<SubjectProgress[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [missingMap, setMissingMap] = useState<Record<string, any[]>>({});
  const [loadingMissing, setLoadingMissing] = useState(false);
  const [addTarget, setAddTarget] = useState<AddMarksTarget | null>(null);

  useEffect(() => {
    if (classId && termId && schoolId) fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, termId, schoolId, examId]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const { count: studCount } = await (supabase as any).from('students').select('*', { count: 'exact', head: true }).eq('class_id', classId).eq('is_active', true);
      const studentCount = studCount || 0;
      setTotalStudents(studentCount);

      const { data: assignments } = await (supabase as any).from('teacher_subject_assignments').select(`subject_id, subjects(name), teachers(first_name, last_name)`).eq('class_id', classId).eq('school_id', schoolId).eq('is_active', true);
      if (!assignments || assignments.length === 0) { setSubjects([]); setLoading(false); return; }

      const progressData: SubjectProgress[] = await Promise.all(
        assignments.map(async (a: any) => {
          let resultsQuery = (supabase as any).from('results').select('*', { count: 'exact', head: true }).eq('class_id', classId).eq('subject_id', a.subject_id).eq('term_id', termId).eq('school_id', schoolId);
          if (examId) resultsQuery = resultsQuery.eq('exam_id', examId);
          const { count: enteredCount } = await resultsQuery;
          const entered = enteredCount || 0;
          const pct = studentCount > 0 ? Math.round((entered / studentCount) * 100) : 0;
          return { subject_id: a.subject_id, subject_name: a.subjects?.name || 'Unknown Subject', teacher_name: a.teachers ? `${a.teachers.first_name} ${a.teachers.last_name}` : 'Unassigned', entered_count: entered, total_students: studentCount, percentage: pct };
        })
      );
      setSubjects(progressData.sort((a, b) => a.percentage - b.percentage));
    } catch (err) { console.error('MarksProgress error:', err); }
    finally { setLoading(false); }
  };

  const loadMissingStudents = async (subjectId: string) => {
    if (missingMap[subjectId]) return;
    setLoadingMissing(true);
    try {
      const { data: students } = await (supabase as any).from('students').select('id, first_name, last_name, admission_number').eq('class_id', classId).eq('is_active', true).order('admission_number');
      let enteredQuery = (supabase as any).from('results').select('student_id').eq('class_id', classId).eq('subject_id', subjectId).eq('term_id', termId).eq('school_id', schoolId);
      if (examId) enteredQuery = enteredQuery.eq('exam_id', examId);
      const { data: entered } = await enteredQuery;
      const enteredIds = new Set((entered || []).map((r: any) => r.student_id));
      const missing = (students || []).filter((s: any) => !enteredIds.has(s.id));
      setMissingMap((prev) => ({ ...prev, [subjectId]: missing }));
    } catch (err) { console.error('MarksProgress missing students error:', err); }
    finally { setLoadingMissing(false); }
  };

  const toggleSubject = (subjectId: string) => {
    if (expandedSubjectId === subjectId) { setExpandedSubjectId(null); }
    else { setExpandedSubjectId(subjectId); loadMissingStudents(subjectId); }
  };

  const overallEntered = subjects.reduce((sum, s) => sum + s.entered_count, 0);
  const overallTotal = subjects.length * totalStudents;
  const overallPct = overallTotal > 0 ? Math.round((overallEntered / overallTotal) * 100) : 0;
  const missingSubjects = subjects.filter((s) => s.percentage < 100);
  const completeSubjects = subjects.filter((s) => s.percentage === 100);

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">{className}</span><span className="text-sm font-bold text-gray-900">{overallPct}%</span></div>
        <div className="w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${overallPct === 100 ? 'bg-green-500' : overallPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${overallPct}%` }} /></div>
        <p className="text-xs text-gray-500">{completeSubjects.length}/{subjects.length} subjects complete{missingSubjects.length > 0 && ` · ${missingSubjects.length} missing`}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold text-gray-700">Overall Progress</span><span className="text-lg font-bold text-gray-900">{overallPct}%</span></div>
        <div className="w-full bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full transition-all ${overallPct === 100 ? 'bg-green-500' : overallPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${overallPct}%` }} /></div>
        <div className="flex justify-between mt-2 text-xs text-gray-500"><span>{completeSubjects.length} of {subjects.length} subjects fully entered</span><span>{totalStudents} students</span></div>
      </div>

      {subjects.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No subject assignments found for this class.</p>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => {
            const isOpen = expandedSubjectId === s.subject_id;
            const missing = missingMap[s.subject_id] || [];
            return (
              <div key={s.subject_id}>
                <div
                  role="button" tabIndex={0}
                  onClick={() => { if (s.percentage < 100) toggleSubject(s.subject_id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && s.percentage < 100) toggleSubject(s.subject_id); }}
                  title={s.percentage < 100 ? `View missing learners for ${s.subject_name}` : 'Complete'}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${s.percentage < 100 ? 'cursor-pointer hover:shadow-sm hover:border-red-300' : ''} ${s.percentage === 100 ? 'bg-green-50 border-green-200' : s.percentage > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}
                >
                  {s.percentage === 100 ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">{s.subject_name}</span>
                      {s.percentage < 100 && <span className="ml-1 text-[11px] font-semibold text-red-500">&rarr; View missing</span>}
                      <span className={`text-xs font-bold ml-2 ${s.percentage === 100 ? 'text-green-700' : s.percentage > 0 ? 'text-yellow-700' : 'text-red-600'}`}>{s.entered_count}/{s.total_students}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${s.percentage === 100 ? 'bg-green-500' : s.percentage > 0 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${s.percentage}%` }} /></div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{s.teacher_name}</span>
                    </div>
                  </div>
                  {s.percentage < 100 && (isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />)}
                </div>

                {isOpen && (
                  <div className="mt-1 rounded-xl border border-red-100 bg-white p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Missing learners</p>
                    {loadingMissing ? (
                      <div className="flex items-center justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-blue-600" /></div>
                    ) : missing.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">No missing learners for this learning area.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {missing.map((stu: any) => (
                          <div key={stu.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-red-50/50 rounded-lg">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{stu.first_name} {stu.last_name}</p>
                              <p className="text-[11px] text-gray-500">{stu.admission_number || '-'}</p>
                            </div>
                            <button
                              onClick={() => setAddTarget({ schoolId, classId, subjectId: s.subject_id, subjectName: s.subject_name, termId, examId: examId || null, studentId: stu.id, studentName: `${stu.first_name} ${stu.last_name}`, admissionNumber: stu.admission_number || '' })}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
                            >
                              <Plus className="w-3 h-3" /> Add Marks
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addTarget && (
        <AddMarksModal target={addTarget} onClose={() => setAddTarget(null)} onSaved={() => { setMissingMap({}); fetchProgress(); }} />
      )}
    </div>
  );
}

export default MarksProgress;
