import { supabaseUntyped } from '@/lib/supabase/client';

export interface PromotedTerm {
  next_term_id: string;
  next_term_name: string;
  next_academic_year: string;
}

export async function promoteSchoolToNextTerm(schoolId: string): Promise<PromotedTerm> {
  const { data, error } = await supabaseUntyped.rpc('promote_school_to_next_term', {
    p_school_id: schoolId,
  });
  if (error) throw error;
  const promoted = Array.isArray(data) ? data[0] : data;
  if (!promoted?.next_term_id) throw new Error('The term promotion did not return a new current term.');
  return promoted as PromotedTerm;
}
