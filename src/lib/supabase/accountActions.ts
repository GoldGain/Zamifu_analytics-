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

type AuthCleanupTarget = 'student' | 'teacher';

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

async function deleteAccountAuthAfterDatabaseCleanup(input: {
  target_user_id: string;
  school_id: string;
  target_type: AuthCleanupTarget;
}) {
  const result = await invokeWithSession<{
    success: boolean;
    deleted_auth_account: boolean;
  }>('delete-learner-auth', {
    target_user_id: input.target_user_id,
    target_type: input.target_type,
    school_id: input.school_id,
  }, 'The school record was removed, but the linked Auth account could not be deleted.');
  if (!result?.success || !result.deleted_auth_account) {
    throw new Error('The school record was removed, but the linked Auth account could not be deleted.');
  }
  return result;
}

function markAuthCleanupPending(error: unknown, targetUserId: string, targetType: AuthCleanupTarget) {
  const message = error instanceof Error ? error.message : String(error || 'Auth cleanup failed.');
  return Object.assign(new Error(`The ${targetType} record was deleted, but Auth account cleanup failed: ${message}`), {
    authCleanupPending: true,
    targetUserId,
    targetType,
  });
}

export async function retryLearnerAuthCleanup(input: { target_user_id: string; school_id: string }) {
  try {
    return await deleteAccountAuthAfterDatabaseCleanup({ ...input, target_type: 'student' });
  } catch (error: unknown) {
    throw markAuthCleanupPending(error, input.target_user_id, 'student');
  }
}

export async function retryTeacherAuthCleanup(input: { target_user_id: string; school_id: string }) {
  try {
    return await deleteAccountAuthAfterDatabaseCleanup({ ...input, target_type: 'teacher' });
  } catch (error: unknown) {
    throw markAuthCleanupPending(error, input.target_user_id, 'teacher');
  }
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
  target_type: 'student' | 'learner' | 'teacher' | 'parent' | 'school_admin' | 'bursar';
  school_id?: string;
  permanent?: boolean;
}) {
  const targetType: AuthCleanupTarget | null = input.target_type === 'teacher'
    ? 'teacher'
    : input.target_type === 'student' || input.target_type === 'learner' ? 'student' : null;

  // Teacher deletion and explicit permanent learner deletion use a database
  // transaction first; the Auth account is removed by the guarded endpoint last.
  if (targetType === 'teacher' || (targetType === 'student' && input.permanent)) {
    if (!input.record_id || !input.school_id) {
      throw new Error(`A ${targetType} record and school are required for permanent deletion.`);
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw new Error('Your session has expired. Please sign in again.');
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) throw new Error('Your session could not be refreshed. Please sign in again.');

    const { data, error } = await (supabase as any).rpc('permanently_delete_school_user', {
      p_record_id: input.record_id,
      p_target_type: targetType,
      p_school_id: input.school_id,
    });
    const label = targetType === 'teacher' ? 'Teacher' : 'Learner';
    if (error) throw new Error(`${label} deletion was rolled back: ${error.message}`);
    if (!data?.success || !data?.deleted_record) {
      throw new Error(`${label} deletion did not complete; no Auth account fallback was attempted.`);
    }

    if (data.auth_user_id) {
      try {
        await deleteAccountAuthAfterDatabaseCleanup({
          target_user_id: data.auth_user_id,
          school_id: input.school_id,
          target_type: targetType,
        });
      } catch (error: unknown) {
        throw markAuthCleanupPending(error, data.auth_user_id, targetType);
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
