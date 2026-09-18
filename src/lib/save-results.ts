import { supabaseUntyped } from '@/lib/supabase/client';

/**
 * Save result/marks records.
 * - examId set: marks belong to a specific assessment. Verifies the assessment is ACTIVE,
 *   then merges per student (updates rows already entered for this exam, inserts the rest)
 *   so different assessments never overwrite each other and re-saving edits the same rows.
 * - examId unset: legacy term-level upload, keeps upserting on (student, subject, term).
 */
export async function saveResultRecords(opts: {
  records: any[];
  examId?: string | null;
  classId: string;
  subjectId: string;
  actingUserId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { records, examId, classId, subjectId } = opts;
  if (!records || records.length === 0) return { success: true };

  if (examId) {
    // 1) Only the ACTIVE assessment accepts marks.
    const { data: exam, error: examErr } = await supabaseUntyped
      .from('school_exams')
      .select('id, is_active')
      .eq('id', examId)
      .maybeSingle();
    if (examErr) return { success: false, error: examErr.message };
    if (!exam) return { success: false, error: 'Assessment not found.' };
    if (!exam.is_active) {
      return {
        success: false,
        error: 'This assessment is inactive. Marks cannot be entered. Ask the admin to activate it.',
      };
    }

    const studentIds = [...new Set(records.map((r: any) => r.student_id).filter(Boolean))];
    // 2) Merge per-student rows for THIS exam only.
    const { data: existing, error: qErr } = await supabaseUntyped
      .from('results')
      .select('id, student_id')
      .eq('exam_id', examId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .in('student_id', studentIds);
    if (qErr) return { success: false, error: qErr.message };
    const idByStudent = new Map((existing || []).map((r: any) => [r.student_id, r.id]));
    const toUpdate = records
      .filter((r: any) => idByStudent.has(r.student_id))
      .map((r: any) => ({ ...r, id: idByStudent.get(r.student_id) }));
    const toInsert = records.filter((r: any) => !idByStudent.has(r.student_id));

    if (toUpdate.length > 0) {
      const { error: upErr } = await supabaseUntyped.from('results').upsert(toUpdate, { onConflict: 'id' });
      if (upErr) return { success: false, error: upErr.message };
    }
    if (toInsert.length > 0) {
      const { error: inErr } = await supabaseUntyped.from('results').insert(toInsert);
      if (inErr) return { success: false, error: inErr.message };
    }
    return { success: true };
  }

  const { error: upErr } = await supabaseUntyped.from('results').upsert(records, {
    onConflict: 'student_id,subject_id,term_id',
    ignoreDuplicates: false,
  });
  if (upErr) return { success: false, error: upErr.message };
  return { success: true };
}
