import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchTeacherAssignments,
  type TeacherAssignment,
} from '@/lib/teacher-restrictions';
import { BookOpen, Upload, AlertCircle, Loader2, GraduationCap, CheckCircle2, XCircle } from 'lucide-react';
import { supabaseUntyped } from '@/lib/supabase/client';

type AssignmentRow = TeacherAssignment & {
  hasResults?: boolean;
  hasActiveExam?: boolean;
};

/**
 * Teacher Results Upload hub — shows ONLY learning areas assigned to this teacher.
 *
 * The "Uploaded" badge is scoped to the ACTIVE assessment for each class.
 * Marks from old/deactivated assessments NEVER trigger "Uploaded" here.
 * Three states per assignment card:
 *   - No active assessment → amber "No assessment" badge (click still opens upload page for info)
 *   - Active assessment, no results yet → blue "Upload" CTA
 *   - Active assessment, results entered → green "Uploaded" badge
 */
export default function AssignedSubjectsUpload() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDoS, setIsDoS] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data: teacherRecord } = await supabaseUntyped
          .from('teachers')
          .select('id, school_id')
          .eq('profile_id', user.id)
          .maybeSingle();
        let dosUser = false;
        if (teacherRecord?.school_id === user.schoolId) {
          const { data: schoolRecord } = await supabaseUntyped
            .from('schools')
            .select('dean_of_studies_id')
            .eq('id', user.schoolId)
            .maybeSingle();
          dosUser = schoolRecord?.dean_of_studies_id === teacherRecord.id;
        }
        setIsDoS(dosUser);
        if (dosUser) { setAssignments([]); return; }

        const { assignments: rows } = await fetchTeacherAssignments(user.id);

        // Current term — used to match term-scoped assessments
        const { data: termData } = await supabaseUntyped
          .from('terms')
          .select('id')
          .eq('school_id', user.schoolId)
          .eq('is_current', true)
          .maybeSingle();
        const currentTermId = termData?.id as string | undefined;

        // Class metadata (grade_level) to resolve grade-scoped assessments
        const classIds = [...new Set(rows.map((r) => r.class_id).filter(Boolean))];
        const { data: classesData } = await supabaseUntyped
          .from('classes')
          .select('id, grade_level, level')
          .in('id', classIds);
        const classMap = new Map<string, any>(
          (classesData || []).map((c: any) => [c.id, c])
        );

        // ALL active assessments for this school
        const { data: activeExams } = await supabaseUntyped
          .from('school_exams')
          .select('id, target_type, target_class_id, target_grade_level, term_id')
          .eq('school_id', user.schoolId)
          .eq('is_active', true);

        // Find the best active assessment that covers a given class.
        // Priority: class-specific > grade > whole-school.
        const findActiveExam = (classId: string) => {
          const cls = classMap.get(classId);
          const grade = cls?.grade_level ?? cls?.level;
          const exams = (activeExams || []) as any[];
          const termOk = (e: any) =>
            !currentTermId || !e.term_id || e.term_id === currentTermId;
          return (
            exams.find((e) => e.target_type === 'class' && e.target_class_id === classId && termOk(e)) ||
            exams.find((e) => e.target_type === 'grade' && String(e.target_grade_level) === String(grade) && termOk(e)) ||
            exams.find((e) => e.target_type === 'school' && termOk(e))
          );
        };

        // Collect the distinct active exam IDs we need to check results for
        const activeExamIds = [
          ...new Set(classIds.map((cid) => findActiveExam(cid)?.id).filter(Boolean)),
        ] as string[];

        // Query results ONLY for those active exam IDs — never for inactive ones
        const uploadedKeys = new Set<string>();
        if (activeExamIds.length > 0 && rows.length > 0) {
          const { data: results } = await supabaseUntyped
            .from('results')
            .select('exam_id, class_id, subject_id')
            .in('exam_id', activeExamIds)
            .in('class_id', classIds)
            .in('subject_id', rows.map((r) => r.subject_id));
          (results || []).forEach((r: any) => {
            uploadedKeys.add(`${r.exam_id}-${r.class_id}-${r.subject_id}`);
          });
        }

        setAssignments(
          rows.map((r) => {
            const activeExam = findActiveExam(r.class_id);
            const key = activeExam ? `${activeExam.id}-${r.class_id}-${r.subject_id}` : null;
            return {
              ...r,
              hasActiveExam: !!activeExam,
              hasResults: !!(key && uploadedKeys.has(key)),
            };
          })
        );
      } catch (err) {
        console.error('Failed to load assignments:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, user?.schoolId]);

  // Group by class
  const byClass = assignments.reduce<Record<string, { className: string; items: AssignmentRow[] }>>(
    (acc, a) => {
      const key = a.class_id || 'unknown';
      if (!acc[key]) acc[key] = { className: a.class_name || 'Class', items: [] };
      acc[key].items.push(a);
      return acc;
    },
    {}
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">
          {isDoS ? 'Results Upload \u2014 All School' : 'Results Upload \u2014 Assigned Learning Areas'}
        </h1>
        <p className="text-sm text-[#666666]">
          {isDoS
            ? 'Dean of Studies can enter marks for all classes and learning areas.'
            : 'You can only upload marks for learning areas assigned to you by your school administrator.'}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium mb-1">Restricted access</p>
          <p>Unassigned learning areas are hidden. If something is missing, ask your school admin to assign it under Assign Teachers.</p>
        </div>
      </div>

      {isDoS ? (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Dean of Studies marks entry</h3>
            <p className="text-sm text-blue-800">Enter marks for any class and any learning area in your school. Assessment-specific duplicate protection remains active.</p>
          </div>
          <Link to="/teacher/results/upload" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            <Upload className="w-4 h-4" /> Open all-school marks entry
          </Link>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No assignments yet</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">Your school admin has not assigned any class or learning area to you. You cannot upload marks until assignments are created.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byClass).map(([classId, group]) => (
            <div key={classId} className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-[#111111]">{group.className}</h2>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {group.items.length} learning area{group.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((item) => (
                  <Link
                    key={`${item.class_id}-${item.subject_id}`}
                    to={`/teacher/results/upload?classId=${encodeURIComponent(item.class_id)}&subjectId=${encodeURIComponent(item.subject_id)}`}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50 to-blue-50/40 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#111111] truncate">{item.subject_name || 'Learning Area'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.class_name}</p>
                    </div>
                    {!item.hasActiveExam ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg shrink-0">
                        <XCircle className="w-3.5 h-3.5" />
                        No assessment
                      </span>
                    ) : item.hasResults ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Uploaded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
