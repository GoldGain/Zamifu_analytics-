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

async function deleteLearnerAuthAfterDatabaseCleanup(input: { target_user_id: string; school_id: string }) {
  const result = await invokeWithSession<{
    success: boolean;
    deleted_auth_account: boolean;
    deleted_record: boolean;
  }>('delete-user', {
    target_user_id: input.target_user_id,
    target_type: 'student',
    school_id: input.school_id,
    database_deletion_complete: true,
  }, 'The learner data was removed, but the linked Auth account could not be deleted.');
  if (!result?.success || !result.deleted_auth_account) {
    throw new Error('The learner data was removed, but the linked Auth account could not be deleted.');
  }
  return result;
}

export async function retryLearnerAuthCleanup(input: { target_user_id: string; school_id: string }) {
  return deleteLearnerAuthAfterDatabaseCleanup(input);
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

export async function syncTeacherAccount(input: {
  teacher_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  tsc_number?: string | null;
}) {
  return invokeWithSession<{
    success: boolean;
    teacher_id: string;
    auth_user_id: string;
    created_auth_account: boolean;
    email: string;
    message: string;
  }>('sync-teacher-account', input as unknown as Record<string, unknown>, 'Teacher/Auth synchronization failed.');
}

export async function deleteScopedUser(input: {
  record_id?: string;
  target_user_id?: string;
  target_type: 'student' | 'learner' | 'teacher' | 'parent' | 'school_admin';
  school_id?: string;
  permanent?: boolean;
}) {
  if ((input.target_type === 'student' || input.target_type === 'learner') && input.permanent) {
    if (!input.record_id || !input.school_id) {
      throw new Error('A learner record and school are required for permanent deletion.');
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw new Error('Your session has expired. Please sign in again.');
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) throw new Error('Your session could not be refreshed. Please sign in again.');
    const { data, error } = await (supabase as any).rpc('permanently_delete_school_user', {
      p_record_id: input.record_id,
      p_target_type: input.target_type,
      p_school_id: input.school_id,
    });
    if (error) throw new Error(`Learner deletion was rolled back: ${error.message}`);
    if (!data?.success || !data?.deleted_record) {
      throw new Error('Learner deletion did not complete; no account fallback was attempted.');
    }
    if (data.auth_user_id) {
      try {
        await deleteLearnerAuthAfterDatabaseCleanup({ target_user_id: data.auth_user_id, school_id: input.school_id });
      } catch (error: any) {
        const pending = new Error(`Learner data was deleted, but Auth account cleanup failed: ${error?.message || 'unknown error'}`);
        (pending as any).authCleanupPending = true;
        throw pending;
      }
    }
    return { ...data, deleted_auth_account: Boolean(data.auth_user_id) };
  }

  return invokeWithSession<{
    success: boolean;
    target_type: string;
    target_role: string;
    deleted_auth_account: boolean;
    deleted_record: boolean;
  }>('delete-user', input as unknown as Record<string, unknown>, 'User account deletion failed.');
}
