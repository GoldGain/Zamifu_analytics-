import { supabaseUntyped } from '@/lib/supabase/client';

/** Zamifu Learn runs its own auth, so we hand it a one-time token instead of a session. */
export const LEARN_ORIGIN = 'https://zamifulearn.company';

export async function createLearnHandoff(input: {
  userId: string;
  email: string;
  fullName: string;
  schoolName?: string | null;
  role: string;
  classLevel?: string | null;
}): Promise<string> {
  const { data, error } = await supabaseUntyped
    .from('sso_handoffs')
    .insert({
      user_id: input.userId,
      email: input.email,
      full_name: input.fullName,
      school_name: input.schoolName || null,
      role: input.role,
      class_level: input.classLevel || null,
    })
    .select('token')
    .single();

  const token = (data as { token?: string } | null)?.token;
  if (error || !token) {
    throw new Error(error?.message || 'Could not start the Zamifu Learn sign-in. Try again.');
  }
  return `${LEARN_ORIGIN}/sso?token=${token}`;
}
