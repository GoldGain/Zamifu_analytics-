import { supabaseUntyped } from '@/lib/supabase/client';

export interface TeacherAssignment {
  id?: string;
  class_id: string;
  subject_id: string;
  class_name?: string;
  subject_name?: string;
  lessons_per_week?: number;
  is_priority?: boolean;
}

export interface TeacherIdentity {
  teacherId: string;
  profileId: string;
  schoolId: string | null;
}

/**
 * Resolve the teachers.id row for the logged-in profile.
 * Assignments always store teachers.id (not profiles.id).
 */
export async function resolveTeacherIdentity(profileId?: string | null): Promise<TeacherIdentity | null> {
  if (!profileId) return null;

  const { data: teacher } = await supabaseUntyped
    .from('teachers')
    .select('id, school_id, profile_id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (!teacher?.id) return null;

  return {
    teacherId: teacher.id as string,
    profileId: (teacher.profile_id as string) || profileId,
    schoolId: (teacher.school_id as string) || null,
  };
}

/**
 * Load class/subject assignments for a teacher.
 * Tries teachers.id first, then falls back to profile_id for legacy rows.
 */
export async function fetchTeacherAssignments(profileId?: string | null): Promise<{
  identity: TeacherIdentity | null;
  assignments: TeacherAssignment[];
}> {
  const identity = await resolveTeacherIdentity(profileId);
  if (!identity) return { identity: null, assignments: [] };

  const idsToTry = [identity.teacherId, identity.profileId].filter(Boolean);

  let rows: any[] = [];
  for (const tid of idsToTry) {
    const { data } = await supabaseUntyped
      .from('teacher_subject_assignments')
      .select(`
        id,
        class_id,
        subject_id,
        lessons_per_week,
        is_priority,
        classes(name),
        subjects(name)
      `)
      .eq('teacher_id', tid)
      .eq('is_active', true);

    if (data && data.length > 0) {
      rows = data;
      break;
    }
  }

  // Some DBs may not have is_active — retry without that filter if empty
  if (rows.length === 0) {
    for (const tid of idsToTry) {
      const { data } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select(`
          id,
          class_id,
          subject_id,
          lessons_per_week,
          is_priority,
          classes(name),
          subjects(name)
        `)
        .eq('teacher_id', tid);

      if (data && data.length > 0) {
        rows = data;
        break;
      }
    }
  }

  const assignments: TeacherAssignment[] = (rows || []).map((a: any) => ({
    id: a.id,
    class_id: a.class_id,
    subject_id: a.subject_id,
    lessons_per_week: a.lessons_per_week,
    is_priority: a.is_priority,
    class_name: a.classes?.name,
    subject_name: a.subjects?.name,
  }));

  return { identity, assignments };
}

/**
 * Backend-style verification: teacher may only upload for an assigned class+subject pair.
 */
export async function verifyTeacherSubjectAssignment(
  profileId: string | undefined | null,
  classId: string,
  subjectId: string
): Promise<{ allowed: boolean; teacherId: string | null; reason?: string }> {
  if (!profileId) {
    return { allowed: false, teacherId: null, reason: 'Not authenticated' };
  }
  if (!classId || !subjectId) {
    return { allowed: false, teacherId: null, reason: 'Class and learning area are required' };
  }

  const { identity, assignments } = await fetchTeacherAssignments(profileId);
  if (!identity) {
    return { allowed: false, teacherId: null, reason: 'Teacher profile not found' };
  }

  if (assignments.length === 0) {
    return {
      allowed: false,
      teacherId: identity.teacherId,
      reason: 'No learning areas have been assigned to you. Contact your school admin.',
    };
  }

  const match = assignments.some(
    (a) => a.class_id === classId && a.subject_id === subjectId
  );

  if (!match) {
    return {
      allowed: false,
      teacherId: identity.teacherId,
      reason: 'You are not assigned to this class and learning area combination.',
    };
  }

  return { allowed: true, teacherId: identity.teacherId };
}

export function uniqueAssignedClasses(assignments: TeacherAssignment[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  assignments.forEach((a) => {
    if (a.class_id) map.set(a.class_id, a.class_name || 'Class');
  });
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

export function subjectsForClass(assignments: TeacherAssignment[], classId: string): TeacherAssignment[] {
  return assignments.filter((a) => a.class_id === classId && a.subject_id);
}
