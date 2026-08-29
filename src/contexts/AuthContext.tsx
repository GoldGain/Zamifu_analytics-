import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <AuthContext.Provider value={{ user, profile, schoolData, loading, signIn, signUp, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
