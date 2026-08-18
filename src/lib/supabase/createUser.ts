import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';

interface CreateUserInput {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  school_id?: string | null;
  metadata?: Record<string, unknown>;
  admission_number?: string;
  class_id?: string;
}

interface CreateUserResult {
  user: {
    id: string;
    email: string;
  };
  message?: string;
}

export async function createScopedUser(input: CreateUserInput): Promise<CreateUserResult> {
  const { data, error } = await supabase.functions.invoke<CreateUserResult>('create-user', {
    body: {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      first_name: input.first_name || '',
      last_name: input.last_name || '',
      role: input.role,
      school_id: input.school_id || null,
      admission_number: input.admission_number || null,
      class_id: input.class_id || null,
      metadata: input.metadata || {},
    },
  });

  if (error) {
    let detail = error.message || 'Unable to create user account.';
    try {
      const response = (error as any).context;
      if (response && typeof response.text === 'function') {
        const raw = await response.text();
        if (raw) {
          try {
            const payload = JSON.parse(raw);
            detail = payload.error || payload.message || raw;
          } catch {
            detail = raw;
          }
        }
      }
    } catch {
      // Keep the SDK message when the Edge Function response cannot be read.
    }
    throw new Error(detail);
  }

  if (!data?.user?.id) {
    throw new Error('User account was not created by the provisioning service.');
  }

  return data;
}
