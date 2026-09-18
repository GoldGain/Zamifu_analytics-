import { supabaseUntyped } from '@/lib/supabase/client';

interface Scope {
  schoolId: string;
  termId?: string | null;
  targetType: string;
  targetClassId?: string | null;
  targetGradeLevel?: number | null;
  actingUserId?: string | null;
}

/**
 * Deactivate every currently-active assessment in the same (school, term, target) scope.
 * Used when creating a new assessment and when manually activating one — a new active
 * assessment always replaces the previous one for that scope only (multi-tenant safe).
 */
export async function deactivateSameScopeActives(scope: Scope) {
  const { schoolId, termId, targetType, targetClassId, targetGradeLevel, actingUserId } = scope;
  let query = supabaseUntyped
    .from('school_exams')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: actingUserId || null,
    })
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .eq('target_type', targetType);

  if (termId) {
    query = query.eq('term_id', termId);
  } else {
    query = query.is('term_id', null);
  }

  if (targetType === 'class') {
    query = query.eq('target_class_id', targetClassId || '00000000-0000-0000-0000-000000000000').is('target_grade_level', null);
  } else if (targetType === 'grade') {
    query = query.is('target_class_id', null).eq('target_grade_level', targetGradeLevel ?? -1);
  } else {
    query = query.is('target_class_id', null).is('target_grade_level', null);
  }
  return query;
}

/**
 * Manually make an assessment the active one for its scope.
 * Deactivates any currently-active assessment in the same scope first.
 */
export async function activateAssessment(
  exam: {
    id: string;
    school_id: string;
    term_id?: string | null;
    target_type?: string | null;
    target_class_id?: string | null;
    target_grade_level?: number | null;
  },
  actingUserId?: string | null
) {
  await deactivateSameScopeActives({
    schoolId: exam.school_id,
    termId: exam.term_id || null,
    targetType: exam.target_type || 'school',
    targetClassId: exam.target_class_id || null,
    targetGradeLevel: exam.target_grade_level ?? null,
    actingUserId,
  });
  return supabaseUntyped
    .from('school_exams')
    .update({
      is_active: true,
      activated_at: new Date().toISOString(),
      deactivated_at: null,
      deactivated_by: null,
    })
    .eq('id', exam.id);
}

/**
 * Manually deactivate an assessment. Leaves the scope with NO active assessment until
 * the admin activates one. Historical marks stay saved and viewable.
 */
export async function deactivateAssessment(examId: string, actingUserId?: string | null) {
  return supabaseUntyped
    .from('school_exams')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: actingUserId || null,
    })
    .eq('id', examId);
}
