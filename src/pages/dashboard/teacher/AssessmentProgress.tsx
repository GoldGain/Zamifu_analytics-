import { useState, useEffect, useMemo } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle, AlertCircle, BarChart3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteResults } from '@/lib/resultActions';
import { resolveTeacherIdentity } from '@/lib/teacher-restrictions';
import { ASSESSMENT_LEVEL_OPTIONS, getAssessmentLevelLabel, getEffectiveGradeLevel, matchesAssessmentScope } from '@/lib/assessment-progress';

interface ProgressData {
  assessmentId: string;
  assessmentName: string;
  assessmentType: string;
  className: string;
  classId: string;
  levelKey: string;
  levelLabel: string;
  termName: string;
  totalSubjects: number;
  enteredSubjects: number;
  pendingSubjects: number;
  percentComplete: number;
  subjectProgress: {
    subjectId: string;
    subjectName: string;
    hasMarks: boolean;
    studentCount: number;
  }[];
}

export default function AssessmentProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null);
  const [currentTeacherId, setCurrentTeacherId] = useState('');
  const [currentSchoolId, setCurrentSchoolId] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  useEffect(() => {
    if (user?.id) fetchProgress();
  }, [user?.id]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const identity = await resolveTeacherIdentity(user?.id);
      if (!identity) return;

      const resolvedSchoolId = user?.schoolId || identity.schoolId;
      if (!resolvedSchoolId) return;
      setCurrentTeacherId(identity.teacherId);
      setCurrentSchoolId(resolvedSchoolId);

      const teacherIds = [...new Set([identity.teacherId, identity.profileId].filter(Boolean))];
      let assignments: any[] = [];
      for (const teacherId of teacherIds) {
        const { data } = await supabaseUntyped
          .from('teacher_subject_assignments')
          .select('id, class_id, subject_id, school_id, is_active, classes(id, name, stream, grade_level, level, curriculum), subjects(id, name)')
          .eq('teacher_id', teacherId)
          .eq('school_id', resolvedSchoolId)
          .eq('is_active', true);
        if (data?.length) {
          assignments = data;
          break;
        }
      }
      if (!assignments.length) return;

      const { data: exams, error: examsError } = await supabaseUntyped
        .from('school_exams')
        .select('id, name, type, target_type, target_class_id, target_grade_level, terms(name, academic_year)')
        .eq('school_id', resolvedSchoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (examsError) throw examsError;

      const { data: teacherResults, error: resultsError } = await supabaseUntyped
        .from('results')
        .select('subject_id, class_id, exam_id')
        .eq('teacher_id', identity.teacherId);
      if (resultsError) throw resultsError;

      const resultsMap = new Set<string>();
      (teacherResults || []).forEach((result: any) => {
        resultsMap.add(`${result.class_id}-${result.subject_id}-${result.exam_id || 'no-exam'}`);
      });

      const classMap = new Map<string, { classRecord: any; assignments: any[] }>();
      assignments.forEach((assignment: any) => {
        const classId = String(assignment.class_id || '');
        if (!classId) return;
        const classRecord = assignment.classes || { id: classId, name: 'Unknown' };
        const existing = classMap.get(classId) || { classRecord, assignments: [] };
        if (!existing.assignments.some((item) => String(item.subject_id) === String(assignment.subject_id))) {
          existing.assignments.push(assignment);
        }
        classMap.set(classId, existing);
      });

      const progressData: ProgressData[] = [];
      for (const exam of exams || []) {
        for (const [classId, classGroup] of classMap) {
          if (!matchesAssessmentScope(exam, { ...classGroup.classRecord, id: classId })) continue;
          const classRecord = classGroup.classRecord;
          const subjects = classGroup.assignments.map((assignment: any) => ({
            subjectId: assignment.subject_id || assignment.subjects?.id,
            subjectName: assignment.subjects?.name || 'Unknown',
          }));
          const subjectProgress = subjects.map((subject: any) => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            hasMarks: resultsMap.has(`${classId}-${subject.subjectId}-${exam.id}`),
            studentCount: 0,
          }));
          const enteredSubjects = subjectProgress.filter((subject) => subject.hasMarks).length;
          const totalSubjects = subjectProgress.length;
          const level = getEffectiveGradeLevel(classRecord);
          const levelKey = level === null ? 'unknown' : String(level);
          const streamLabel = String(classRecord.stream || '').trim();
          const className = `${classRecord.name || 'Unknown'}${streamLabel ? ` (${streamLabel})` : ''}`;
          progressData.push({
            assessmentId: exam.id,
            assessmentName: exam.name,
            assessmentType: exam.type,
            className,
            classId,
            levelKey,
            levelLabel: getAssessmentLevelLabel(classRecord),
            termName: `${exam.terms?.name || ''} ${exam.terms?.academic_year || ''}`.trim(),
            totalSubjects,
            enteredSubjects,
            pendingSubjects: totalSubjects - enteredSubjects,
            percentComplete: totalSubjects > 0 ? Math.round((enteredSubjects / totalSubjects) * 100) : 0,
            subjectProgress,
          });
        }
      }

      setProgress(progressData);
    } catch (err: any) {
      toast.error('Failed to load progress: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClassResults = async (p: ProgressData) => {
    if (!currentTeacherId || !currentSchoolId) return;
    if (!confirm(`Delete your results for ${p.assessmentName} (${p.className}, ${p.termName})? This cannot be undone.`)) return;
    try {
      const deleted = await deleteResults({ schoolId: currentSchoolId, classId: p.classId, examId: p.assessmentId, teacherId: currentTeacherId });
      toast.success(`Deleted ${deleted} result(s)`);
      fetchProgress();
    } catch (err: any) { toast.error('Failed to delete results: ' + err.message); }
  };

  const visibleProgress = useMemo(
    () => levelFilter === 'all' ? progress : progress.filter((item) => item.levelKey === levelFilter),
    [levelFilter, progress],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Assessment Progress</h1>
        <p className="text-sm text-[#666666]">Track marks entry progress for every assigned level, from Playgroup to Form 4.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
        <label className="text-sm font-semibold text-gray-700" htmlFor="assessment-level-filter">Level</label>
        <select id="assessment-level-filter" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          {ASSESSMENT_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="text-xs text-gray-500">{visibleProgress.length} assessment view{visibleProgress.length === 1 ? '' : 's'}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-blue-600">{visibleProgress.length}</div>
          <div className="text-xs text-gray-500">Active Assessments</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-green-600">
            {visibleProgress.filter(p => p.percentComplete === 100).length}
          </div>
          <div className="text-xs text-gray-500">Complete</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {visibleProgress.filter(p => p.percentComplete > 0 && p.percentComplete < 100).length}
          </div>
          <div className="text-xs text-gray-500">In Progress</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {visibleProgress.reduce((sum, p) => sum + p.enteredSubjects, 0)}
          </div>
          <div className="text-xs text-gray-500">Learning Areas Done</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : visibleProgress.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No assessments found. Ask your School Admin or DoS to create assessments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleProgress.map((p) => (
            <div key={`${p.assessmentId}-${p.classId}`} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedAssessment(expandedAssessment === `${p.assessmentId}-${p.classId}` ? null : `${p.assessmentId}-${p.classId}`)}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-[#111111]">{p.assessmentName}</p>
                    <p className="text-xs text-gray-500">{p.levelLabel} &middot; {p.className} &middot; {p.termName} &middot; {p.assessmentType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#111111]">{p.percentComplete}%</p>
                    <p className="text-xs text-gray-500">{p.enteredSubjects}/{p.totalSubjects} learning areas</p>
                  </div>
                  {/* Issue 25: Clear status badge showing Completed / In Progress / Not Started */}
                  {p.percentComplete === 100 ? (
                    <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full border border-green-200 whitespace-nowrap">
                      <CheckCircle className="w-3.5 h-3.5" /> Completed
                    </span>
                  ) : p.percentComplete > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full border border-orange-200 whitespace-nowrap">
                      <AlertCircle className="w-3.5 h-3.5" /> In Progress
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full border border-gray-200 whitespace-nowrap">
                      <AlertCircle className="w-3.5 h-3.5" /> Not Started
                    </span>
                  )}
                </div>
              </button>

              {/* Progress Bar */}
              <div className="px-5 pb-2">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      p.percentComplete === 100 ? 'bg-green-500' : p.percentComplete > 50 ? 'bg-blue-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${p.percentComplete}%` }}
                  />
                </div>
              </div>

              {/* Subject Details */}
              {expandedAssessment === `${p.assessmentId}-${p.classId}` && (
                <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Learning Area Progress</p>
                  <button
                    onClick={() => handleDeleteClassResults(p)}
                    className="mb-3 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete My Results
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {p.subjectProgress.map((sp) => (
                      <div
                        key={sp.subjectId}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          sp.hasMarks ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'
                        }`}
                      >
                        {sp.hasMarks ? (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${sp.hasMarks ? 'text-green-800' : 'text-gray-600'}`}>
                            {sp.subjectName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {sp.hasMarks ? 'Marks entered' : 'Pending'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
