import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Lock, Loader2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

type LockTarget = 'school_admin' | 'dean_of_studies';

interface SchoolLocks {
  admin_portal_locked: boolean;
  dos_portal_locked: boolean;
  lock_reason: string | null;
  name: string;
}

/**
 * Blocks School Admin or Dean of Studies portals when the school is locked.
 * Reseller / master admins are never blocked by these flags.
 */
export default function SchoolPortalLockGate({
  target,
  children,
}: {
  target: LockTarget;
  children: React.ReactNode;
}) {
  const { user, signOut, schoolData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [locks, setLocks] = useState<SchoolLocks | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.schoolId) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await (supabase as any)
          .from('schools')
          .select('name, admin_portal_locked, dos_portal_locked, lock_reason')
          .eq('id', user.schoolId)
          .maybeSingle();
        if (!cancelled) {
          setLocks(
            data
              ? {
                  name: data.name,
                  admin_portal_locked: !!data.admin_portal_locked,
                  dos_portal_locked: !!data.dos_portal_locked,
                  lock_reason: data.lock_reason || null,
                }
              : null
          );
        }
      } catch {
        if (!cancelled) setLocks(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.schoolId]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const blocked =
    target === 'school_admin'
      ? !!locks?.admin_portal_locked
      : !!locks?.dos_portal_locked;

  if (!blocked) return <>{children}</>;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-red-100 rounded-2xl shadow-sm p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Portal locked</h1>
        <p className="text-sm text-gray-600 mb-1">
          Access to the {target === 'school_admin' ? 'School Admin' : 'Dean of Studies'} portal
          for <strong>{locks?.name || schoolData?.name || 'this school'}</strong> is currently locked.
        </p>
        {locks?.lock_reason && (
          <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 mt-3">
            Reason: {locks.lock_reason}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-4">
          Contact your reseller or school administrator if you need access restored.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm hover:bg-gray-50"
          >
            Go to home
          </button>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate('/auth/login');
            }}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm hover:bg-red-700 inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
