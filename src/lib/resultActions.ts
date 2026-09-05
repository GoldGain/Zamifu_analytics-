import { supabaseUntyped } from '@/lib/supabase/client';

export interface DeleteResultsScope {
  schoolId: string;
  classId?: string;
  subjectId?: string;
  termId?: string;
  examId?: string;
  teacherId?: string;
  studentId?: string;
}

function applyScope(query: any, scope: DeleteResultsScope) {
  let q = query.eq('school_id', scope.schoolId);
  if (scope.classId) q = q.eq('class_id', scope.classId);
  if (scope.subjectId) q = q.eq('subject_id', scope.subjectId);
  if (scope.termId) q = q.eq('term_id', scope.termId);
  if (scope.teacherId) q = q.eq('teacher_id', scope.teacherId);
  if (scope.studentId) q = q.eq('student_id', scope.studentId);
  if (scope.examId !== undefined) q = q.eq('exam_id', scope.examId);
  return q;
}

export async function deleteResults(scope: DeleteResultsScope): Promise<number> {
  const { count, error: countErr } = await applyScope(
    supabaseUntyped.from('results').select('id', { count: 'exact', head: true }), scope);
  if (countErr) throw new Error(countErr.message);
  if (!count) return 0;
  const { error } = await applyScope(supabaseUntyped.from('results').delete(), scope);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
