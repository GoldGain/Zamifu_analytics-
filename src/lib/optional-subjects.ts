import { supabaseUntyped } from '@/lib/supabase/client';

export interface SubjectGroup {
  id: string;
  name: string;
  level_group: string | null;
  description: string | null;
  school_id: string;
  created_at?: string;
  subjects?: { id: string; name: string; code: string | null }[];
}

export interface SubjectOption {
  id: string;
  name: string;
  code: string | null;
  is_core: boolean | null;
}

/** Load a school's subject groups together with their member subjects. */
export async function fetchSubjectGroups(schoolId: string): Promise<SubjectGroup[]> {
  const { data: groups, error } = await supabaseUntyped
    .from('subject_groups')
    .select('*, subject_group_subjects(group_id, subjects(id, name, code))')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw new Error(error.message);

  return (groups || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    level_group: g.level_group,
    description: g.description,
    school_id: g.school_id,
    created_at: g.created_at,
    subjects: (g.subject_group_subjects || [])
      .filter((s: any) => s && s.subjects)
      .map((s: any) => ({ id: s.subjects.id, name: s.subjects.name, code: s.subjects.code })),
  }));
}

/** All subjects for a school (id, name, code, is_core). */
export async function fetchSchoolSubjects(schoolId: string): Promise<SubjectOption[]> {
  const { data, error } = await supabaseUntyped
    .from('subjects')
    .select('id, name, code, is_core')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * A subject is "optional" when it is marked non-core OR it belongs to a
 * subject group. Returns the set of such subject ids for a school.
 */
export async function getOptionalSubjectIds(schoolId: string): Promise<Set<string>> {
  const { data: groups } = await supabaseUntyped
    .from('subject_groups')
    .select('id')
    .eq('school_id', schoolId);
  const groupIds = (groups || []).map((g: any) => g.id);

  const ids = new Set<string>();
  if (groupIds.length > 0) {
    const { data: links } = await supabaseUntyped
      .from('subject_group_subjects')
      .select('subject_id')
      .in('group_id', groupIds);
    (links || []).forEach((l: any) => ids.add(l.subject_id));
  }

  const { data: nonCore } = await supabaseUntyped
    .from('subjects')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_core', false);
  (nonCore || []).forEach((s: any) => ids.add(s.id));

  return ids;
}

export type LearnerVisibilitySource = 'teacher-selected' | 'registered' | 'all';

export async function resolveVisibleLearners(opts: {
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId?: string | null;
}): Promise<{ all: any[]; visible: any[]; source: LearnerVisibilitySource }> {
  const { data: all } = await supabaseUntyped
    .from('students')
    .select('id, first_name, last_name, admission_number')
    .eq('class_id', opts.classId)
    .eq('is_active', true);
  const allStudents = all || [];

  if (opts.teacherId) {
    const { data: sel } = await supabaseUntyped
      .from('teacher_selected_learners')
      .select('student_id')
      .eq('teacher_id', opts.teacherId)
      .eq('subject_id', opts.subjectId)
      .eq('class_id', opts.classId);
    const selectedIds = new Set((sel || []).map((r: any) => r.student_id));
    if (selectedIds.size > 0) {
      return { all: allStudents, visible: allStudents.filter((s: any) => selectedIds.has(s.id)), source: 'teacher-selected' };
    }
  }

  const { data: reg } = await supabaseUntyped
    .from('learner_optional_subjects')
    .select('student_id')
    .eq('subject_id', opts.subjectId)
    .eq('school_id', opts.schoolId);
  const registeredIds = new Set((reg || []).map((r: any) => r.student_id));
  if (registeredIds.size > 0) {
    return { all: allStudents, visible: allStudents.filter((s: any) => registeredIds.has(s.id)), source: 'registered' };
  }

  return { all: allStudents, visible: allStudents, source: 'all' };
}
