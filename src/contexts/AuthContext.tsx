import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase/client';
import type { UserRole, Profile } from '@/types/database';

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  schoolId: string | null;
  avatarUrl: string | null;
}

export interface SchoolData {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  principal_name: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  schoolData: SchoolData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  impersonation: ImpersonationState | null;
  searchImpersonationTargets: (query: string) => Promise<{ targets: ImpersonationTarget[]; error: string | null }>;
  listImpersonationAudit: () => Promise<{ entries: ImpersonationAuditEntry[]; error: string | null }>;
  startImpersonation: (targetUserId: string) => Promise<{ error: string | null }>;
  exitImpersonation: (reason?: string) => Promise<void>;
}

export interface ImpersonationTarget {
  id: string;
  name: string;
  email: string | null;
  role: string;
  school_id: string | null;
  school_name: string | null;
  admission_number?: string | null;
  assessment_number?: string | null;
}

export interface ImpersonationState {
  auditId: string;
  target: ImpersonationTarget;
  expiresAt: string;
}

export interface ImpersonationAuditEntry {
  id: string;
  impersonator_email: string | null;
  target_email: string | null;
  target_role: string;
  target_school_id: string | null;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  expires_at: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('zamifu_impersonation') || 'null'); } catch { return null; }
  });

  const fetchSchoolData = async (schoolId: string) => {
    if (!schoolId) return;
    console.log('[AuthContext] fetchSchoolData called with schoolId:', schoolId);
    try {
      // Use type cast to avoid TypeScript errors with columns like motto
      const { data, error } = await (supabase as any)
        .from('schools')
        .select('id, name, logo_url, address, phone, email, motto, principal_name')
        .eq('id', schoolId)
        .maybeSingle();

      console.log('[AuthContext] school fetch result:', { data: data ? { id: data.id, name: data.name } : null, error });

      if (error) {
        console.error('School fetch error:', error);
        return;
      }

      if (data) {
        console.log('[AuthContext] Setting schoolData:', data.name);
        setSchoolData({
          id: data.id,
          name: data.name, // Always use the actual school name from the database
          logo_url: data.logo_url || null,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          motto: data.motto || null,
          principal_name: data.principal_name || null,
        });
      }
    } catch (err) {
      console.error('fetchSchoolData error:', err);
    }
  };

  const fetchProfile = async (userId: string, email: string, metadata: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) console.error('Profile fetch error:', error);
      
      const profileData = data as unknown as Profile | null;
      if (profileData) {
        setProfile(profileData);
        setUser({
          id: userId,
          email: email,
          role: profileData.role,
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          schoolId: profileData.school_id,
          avatarUrl: profileData.avatar_url,
        });
        // Fetch school data if user has a school
        if (profileData.school_id) {
          await fetchSchoolData(profileData.school_id);
        }
      } else {
        const schoolId = metadata?.school_id || null;
        setUser({
          id: userId,
          email: email,
          role: metadata?.role || 'student',
          firstName: metadata?.first_name || '',
          lastName: metadata?.last_name || '',
          schoolId: schoolId,
          avatarUrl: null,
        });
        if (schoolId) {
          await fetchSchoolData(schoolId);
        }
      }
    } catch (err) {
      console.error('fetchProfile error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email!, session.user.user_metadata);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email!, session.user.user_metadata);
      } else {
        setUser(null);
        setProfile(null);
        setSchoolData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, role: UserRole) => {
    const { error } = await supabase.auth.signUp({ 
      email, password,
      options: { data: { first_name: firstName, last_name: lastName, role: role } }
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSchoolData(null);
  };

  const resetPassword = async (email: string) => {
    const redirectTo = Capacitor.isNativePlatform()
      ? 'https://zamifu.company/auth/reset-password'
      : `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message || null };
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchProfile(session.user.id, session.user.email!, session.user.user_metadata);
    }
  };

  const searchImpersonationTargets = useCallback(async (query: string) => {
    const { data, error } = await supabase.functions.invoke('impersonate-user', { body: { action: 'search', query } });
    return { targets: (data?.targets || []) as ImpersonationTarget[], error: error?.message || data?.error || null };
  }, []);

  const listImpersonationAudit = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('impersonate-user', { body: { action: 'audit' } });
    return { entries: (data?.entries || []) as ImpersonationAuditEntry[], error: error?.message || data?.error || null };
  }, []);

  const startImpersonation = async (targetUserId: string) => {
    const { data: current } = await supabase.auth.getSession();
    if (!current.session) return { error: 'Your master admin session has expired. Please sign in again.' };
    const { data, error } = await supabase.functions.invoke('impersonate-user', { body: { action: 'start', target_user_id: targetUserId } });
    if (error || data?.error) return { error: error?.message || data?.error || 'Could not start support access' };
    sessionStorage.setItem('zamifu_master_session', JSON.stringify(current.session));
    const nextState: ImpersonationState = { auditId: data.audit_id, target: data.target, expiresAt: data.expires_at };
    sessionStorage.setItem('zamifu_impersonation', JSON.stringify(nextState));
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (verifyError) {
      sessionStorage.removeItem('zamifu_master_session');
      sessionStorage.removeItem('zamifu_impersonation');
      return { error: verifyError.message };
    }
    setImpersonation(nextState);
    return { error: null };
  };

  const exitImpersonation = async (reason = 'manual_exit') => {
    const storedState = impersonation || (() => { try { return JSON.parse(sessionStorage.getItem('zamifu_impersonation') || 'null'); } catch { return null; } })();
    const storedSession = sessionStorage.getItem('zamifu_master_session');
    if (!storedSession || !storedState) return;
    try {
      const masterSession = JSON.parse(storedSession);
      await supabase.auth.setSession({ access_token: masterSession.access_token, refresh_token: masterSession.refresh_token });
      await supabase.functions.invoke('impersonate-user', { body: { action: 'end', audit_id: storedState.auditId, reason } });
    } finally {
      sessionStorage.removeItem('zamifu_master_session');
      sessionStorage.removeItem('zamifu_impersonation');
      setImpersonation(null);
      await refreshProfile();
    }
  };

  useEffect(() => {
    if (!impersonation) return;
    const remaining = new Date(impersonation.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => { void exitImpersonation('timeout'); }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [impersonation?.auditId, impersonation?.expiresAt]);

  return (
    <AuthContext.Provider value={{ user, profile, schoolData, loading, signIn, signUp, signOut, resetPassword, refreshProfile, impersonation, searchImpersonationTargets, listImpersonationAudit, startImpersonation, exitImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
