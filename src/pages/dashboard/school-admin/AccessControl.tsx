import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Lock, Unlock, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * School Admin can lock/unlock:
 * - Dean of Studies portal
 * - School Admin portal (self) — use carefully
 */
export default function SchoolAdminAccessControl() {
  const { user, schoolData } = useAuth();
  const [adminLocked, setAdminLocked] = useState(false);
  const [dosLocked, setDosLocked] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('schools')
      .select('admin_portal_locked, dos_portal_locked, lock_reason')
      .eq('id', user.schoolId)
      .maybeSingle();
    if (data) {
      setAdminLocked(!!data.admin_portal_locked);
      setDosLocked(!!data.dos_portal_locked);
      setReason(data.lock_reason || '');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.schoolId]);

  const save = async () => {
    if (!user?.schoolId) return;
    setSaving(true);
    try {
      const any = adminLocked || dosLocked;
      const { error } = await (supabase as any)
        .from('schools')
        .update({
          admin_portal_locked: adminLocked,
          dos_portal_locked: dosLocked,
          lock_reason: any ? reason || null : null,
          locked_at: any ? new Date().toISOString() : null,
          locked_by_role: any ? 'school_admin' : null,
        })
        .eq('id', user.schoolId);
      if (error) throw error;
      toast.success('Access settings saved');
      if (adminLocked) {
        toast.message('School Admin portal is locked. You will be blocked on the next page load.');
      }
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" /> Access Control
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Control portal access for {schoolData?.name || 'your school'}. Locks apply to School Admin and Dean of Studies only.
        </p>
      </div>

      {adminLocked && (
        <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          School Admin portal is currently marked locked. Save with the toggle off to reopen access.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer">
          <input type="checkbox" className="mt-1" checked={dosLocked} onChange={(e) => setDosLocked(e.target.checked)} />
          <div>
            <p className="font-medium text-sm flex items-center gap-1">
              {dosLocked ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-green-600" />}
              Lock Dean of Studies portal
            </p>
            <p className="text-xs text-gray-500">Blocks the DoS dashboard for teachers assigned as Dean of Studies</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer">
          <input type="checkbox" className="mt-1" checked={adminLocked} onChange={(e) => setAdminLocked(e.target.checked)} />
          <div>
            <p className="font-medium text-sm flex items-center gap-1">
              {adminLocked ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-green-600" />}
              Lock School Admin portal
            </p>
            <p className="text-xs text-gray-500">Blocks school admin routes for this school. Use carefully — you can lock yourself out.</p>
          </div>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason shown on lock screen</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full border rounded-xl px-3 py-2 text-sm"
            placeholder="Optional message for locked users"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save access settings'}
        </button>
      </div>
    </div>
  );
}
