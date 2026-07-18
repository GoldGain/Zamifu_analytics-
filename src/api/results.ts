import { supabaseUntyped } from '@/lib/supabase/client';
import { verifyTeacherSubjectAssignment } from '@/lib/teacher-restrictions';

export interface ResultUploadRecord {
  school_id: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  term_id: string;
  academic_year: string;
  curriculum?: string;
  marks: number;
  out_of: number;
  percentage: number;
  converted_marks?: number;
  cbc_sublevel?: string | null;
  cbc_grade?: string | null;
  cbc_points?: number | null;
  cbc_descriptor?: string | null;
  grade_844?: string | null;
  exam_id?: string | null;
  position?: number | null;
  status?: 'draft' | 'submitted';
  submitted_at?: string;
}

/**
 * Upsert results only after verifying the teacher is assigned to the subject/class.
 */
export async function submitTeacherResults(params: {
  profileId: string;
  classId: string;
  subjectId: string;
  records: Omit<ResultUploadRecord, 'teacher_id'>[];
  asDraft?: boolean;
  examId?: string | null;
}): Promise<{ success: boolean; error?: string; count?: number }> {
  const verification = await verifyTeacherSubjectAssignment(
    params.profileId,
    params.classId,
    params.subjectId
  );

  if (!verification.allowed || !verification.teacherId) {
    return {
      success: false,
      error: verification.reason || 'Upload rejected: you are not assigned to this learning area.',
    };
  }

  const records: ResultUploadRecord[] = params.records.map((r) => ({
    ...r,
    teacher_id: verification.teacherId!,
    class_id: params.classId,
    subject_id: params.subjectId,
    status: params.asDraft ? 'draft' : 'submitted',
    exam_id: params.examId ?? r.exam_id ?? null,
  }));

  const conflictKey = params.examId
    ? 'student_id,subject_id,term_id,exam_id'
    : 'student_id,subject_id,term_id';

  const { error: upsertError } = await supabaseUntyped.from('results').upsert(records, {
    onConflict: conflictKey,
    ignoreDuplicates: false,
  });

  if (upsertError) {
    const { error: insertError } = await supabaseUntyped.from('results').insert(records);
    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  return { success: true, count: records.length };
}
