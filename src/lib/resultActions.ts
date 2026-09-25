import { supabaseUntyped } from '@/lib/supabase/client';

export interface DeleteResultsScope {
  schoolId: string;
  recordId?: string;
  recordIds?: string[];
  studentIds?: string[];
  classId?: string;
  subjectId?: string;
  termId?: string;
  examId?: string;
  teacherId?: string;
  studentId?: string;
}

function applyScope(query: any, scope: DeleteResultsScope) {
  let q = query.eq('school_id', scope.schoolId);
  if (scope.recordIds?.length) q = q.in('id', scope.recordIds);
  else if (scope.recordId) q = q.eq('id', scope.recordId);
  if (scope.studentIds?.length) q = q.in('student_id', scope.studentIds);
  if (scope.classId) q = q.eq('class_id', scope.classId);
  if (scope.subjectId) q = q.eq('subject_id', scope.subjectId);
  if (scope.termId) q = q.eq('term_id', scope.termId);
  if (scope.teacherId) q = q.eq('teacher_id', scope.teacherId);
  if (scope.studentId) q = q.eq('student_id', scope.studentId);
  if (scope.examId !== undefined) q = q.eq('exam_id', scope.examId);
  return q;
}

export async function deleteResults(scope: DeleteResultsScope): Promise<number> {
  if (!scope.schoolId) throw new Error('A school scope is required before deleting results.');
  const { data: rowsToDelete, error: snapshotError } = await applyScope(
    supabaseUntyped.from('results').select('id, student_id, class_id, subject_id, term_id, exam_id, status').limit(5000), scope);
  if (snapshotError) throw new Error(snapshotError.message);
  if (!rowsToDelete?.length) return 0;

  const { data: { user: actor } } = await supabaseUntyped.auth.getUser();
  const { count, error: countErr } = await applyScope(
    supabaseUntyped.from('results').select('id', { count: 'exact', head: true }), scope);
  if (countErr) throw new Error(countErr.message);
  if (!count) return 0;
  const { error } = await applyScope(supabaseUntyped.from('results').delete(), scope);
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabaseUntyped.from('audit_logs').insert({
    school_id: scope.schoolId,
    user_id: actor?.id || null,
    action: rowsToDelete.length === 1 ? 'DELETE' : 'DELETE_BULK',
    table_name: 'results',
    record_id: scope.recordId || (rowsToDelete.length === 1 ? rowsToDelete[0].id : null),
    old_values: {
      scope,
      deleted_count: rowsToDelete.length,
      result_ids: rowsToDelete.map((row: any) => row.id),
      records: rowsToDelete,
    },
    new_values: null,
  });
  if (auditError) console.warn('Result deletion audit could not be recorded:', auditError.message);
  return count ?? rowsToDelete.length;
}
