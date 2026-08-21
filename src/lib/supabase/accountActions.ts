import { supabase } from '@/lib/supabase/client';

type ParentContact = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type ParentSyncInput = {
  student_id: string;
  primary: ParentContact;
  secondary?: ParentContact;
};

type EdgeFunctionErrorLike = {
  message?: string;
  context?: { text?: () => Promise<string> };
};

async function readFunctionError(error: EdgeFunctionErrorLike, fallback: string) {
  let detail = error?.message || fallback;
  try {
    if (error?.context && typeof error.context.text === 'function') {
      const raw = await error.context.text();
      if (raw) {
        try {
          const payload = JSON.parse(raw) as { error?: string; message?: string };
          detail = payload.error || payload.message || raw;
        } catch {
          detail = raw;
        }
      }
    }
  } catch {
    // Keep the SDK message when the response body cannot be read.
  }
  return detail;
}

async function invokeWithSession<T>(functionName: string, body: Record<string, unknown>, fallback: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('Your session has expired. Please sign in again.');
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session) throw new Error('Your session could not be refreshed. Please sign in again.');

  const { data, error } = await supabase.functions.invoke<T>(functionName, { body });
  if (error) throw new Error(await readFunctionError(error, fallback));
  return data as T;
}

export async function syncParentAccounts(input: ParentSyncInput) {
  return invokeWithSession<{
    success: boolean;
    primary_parent_id: string | null;
    secondary_parent_id: string | null;
    created_parent_accounts: number;
    linked_parent_accounts: number;
  }>('sync-parent-account', input as unknown as Record<string, unknown>, 'Parent account synchronization failed.');
}

export async function deleteScopedUser(input: {
  record_id?: string;
  target_user_id?: string;
  target_type: 'student' | 'learner' | 'teacher' | 'parent' | 'school_admin';
  school_id?: string;
}) {
  return invokeWithSession<{
    success: boolean;
    target_type: string;
    target_role: string;
    deleted_auth_account: boolean;
    deleted_record: boolean;
  }>('delete-user', input as unknown as Record<string, unknown>, 'User account deletion failed.');
}
