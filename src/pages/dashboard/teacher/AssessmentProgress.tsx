import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, BookOpen, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface ProgressData {
  assessmentId: string;
  assessmentName: string;
  assessmentType: string;
  className: string;
  classId: string;
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

  useEffect(() => {
    if (user?.id) fetchProgress();
  }, [user?.id]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      // Get teacher record
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id, school_id')
        .eq('profile_id', user?.id)
        .single();

      const teacherId = teacherData?.id;
      if (!teacherId) {
        setLoading(false);
        return;
      }

      // Issue 9: Resolve school_id from teacher record as fallback when user.schoolId is null
      const resolvedSchoolId = user?.schoolId || teacherData?.school_id;
      if (!resolvedSchoolId) {
        setLoading(false);
        return;
      }

      // Get teacher's class-subject assignments
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('*, classes(id, name), subjects(id, name)')
        .eq('teacher_id', teacherId);

      if (!assignments || assignments.length === 0) {
        setLoading(false);
        return;
      }

      // Get active assessments for this school
      const { data: exams } = await supabaseUntyped
        .from('school_exams')
        .select('*, terms(name, academic_year)')
        .eq('school_id', resolvedSchoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const activeExams = exams || [];

      // Get all results entered by this teacher
      const { data: teacherResults } = await supabaseUntyped
        .from('results')
        .select('subject_id, class_id, exam_id')
        .eq('teacher_id', teacherId);

      const resultsMap = new Map<string, Set<string>>();
      (teacherResults || []).forEach((r: any) => {
        const key = `${r.class_id}-${r.subject_id}-${r.exam_id || 'no-exam'}`;
        if (!resultsMap.has(key)) resultsMap.set(key, new Set());
        resultsMap.get(key)!.add(r.subject_id);
      });

      // Build progress data
      const progressData: ProgressData[] = [];

      for (const exam of activeExams) {
        // Group assignments by class
        const classMap = new Map<string, any[]>();
        assignments.forEach((a: any) => {
          const classId = a.class_id;
          if (!classMap.has(classId)) classMap.set(classId, []);
          classMap.get(classId)!.push(a);
        });

        for (const [classId, classAssignments] of classMap) {
          const className = classAssignments[0]?.classes?.name || 'Unknown';
          const subjects = classAssignments.map((a: any) => ({
            subjectId: a.subject_id || a.subjects?.id,
            subjectName: a.subjects?.name || 'Unknown',
          }));

          const totalSubjects = subjects.length;
          let enteredSubjects = 0;

          const subjectProgress = subjects.map((s: any) => {
            const key = `${classId}-${s.subjectId}-${exam.id}`;
            const hasMarks = resultsMap.has(key);
            if (hasMarks) enteredSubjects++;
            return {
              subjectId: s.subjectId,
              subjectName: s.subjectName,
              hasMarks,
              studentCount: 0,
            };
          });

          const percentComplete = totalSubjects > 0 ? Math.round((enteredSubjects / totalSubjects) * 100) : 0;

          progressData.push({
            assessmentId: exam.id,
            assessmentName: exam.name,
            assessmentType: exam.type,
            className,
            classId,
            termName: `${exam.terms?.name || ''} ${exam.terms?.academic_year || ''}`,
            totalSubjects,
            enteredSubjects,
            pendingSubjects: totalSubjects - enteredSubjects,
            percentComplete,
            subjectProgress,
          });
        }
      }

      setProgress(progressData);
    } catch (err: any) {
      toast.error('Failed to load progress: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Assessment Progress</h1>
        <p className="text-sm text-[#666666]">Track marks entry progress for your assessments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-blue-600">{progress.length}</div>
          <div className="text-xs text-gray-500">Active Assessments</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-green-600">
            {progress.filter(p => p.percentComplete === 100).length}
          </div>
          <div className="text-xs text-gray-500">Complete</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {progress.filter(p => p.percentComplete > 0 && p.percentComplete < 100).length}
          </div>
          <div className="text-xs text-gray-500">In Progress</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {progress.reduce((sum, p) => sum + p.enteredSubjects, 0)}
          </div>
          <div className="text-xs text-gray-500">Learning Areas Done</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : progress.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No assessments found. Ask your School Admin or DoS to create assessments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.map((p) => (
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
                    <p className="text-xs text-gray-500">{p.className} &middot; {p.termName} &middot; {p.assessmentType}</p>
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
