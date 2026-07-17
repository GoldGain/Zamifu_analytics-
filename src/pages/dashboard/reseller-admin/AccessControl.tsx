import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Unlock, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getResellerForUser } from '@/lib/reseller';

export default function ResellerAccessControl() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const reseller = await getResellerForUser(user.id);
    if (reseller) {
      const { data } = await supabase
        .from('schools')
        .select('id, name, code, admin_portal_locked, dos_portal_locked, lock_reason, locked_at, locked_by_role')
        .eq('reseller_id', reseller.id)
        .order('name');
      setSchools(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const toggle = async (school: any, field: 'admin_portal_locked' | 'dos_portal_locked') => {
    setBusyId(school.id + field);
    try {
      const next = !school[field];
      const admin = field === 'admin_portal_locked' ? next : !!school.admin_portal_locked;
      const dos = field === 'dos_portal_locked' ? next : !!school.dos_portal_locked;
      const any = admin || dos;
      const { error } = await (supabase as any)
        .from('schools')
        .update({
          [field]: next,
          locked_at: any ? new Date().toISOString() : null,
          locked_by_role: any ? 'reseller_super_admin' : null,
          lock_reason: any ? school.lock_reason || 'Locked by reseller' : null,
        })
        .eq('id', school.id);
      if (error) throw error;
      toast.success(next ? 'Portal locked' : 'Portal unlocked');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const unlockAll = async (school: any) => {
    setBusyId(school.id);
    try {
      const { error } = await (supabase as any)
        .from('schools')
        .update({
          admin_portal_locked: false,
          dos_portal_locked: false,
          lock_reason: null,
          locked_at: null,
          locked_by_role: null,
        })
        .eq('id', school.id);
      if (error) throw error;
      toast.success('All portals unlocked');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Unlock failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> Access Control
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Lock or unlock School Admin and Dean of Studies portals per school. Other roles remain open.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
        When locked, the affected user sees a clear lock screen with your reason. Teachers, students, and parents are not blocked by these controls.
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : schools.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No schools yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">School Admin</th>
                  <th className="px-4 py-3">Dean of Studies</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={busyId === s.id + 'admin_portal_locked'}
                        onClick={() => toggle(s, 'admin_portal_locked')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          s.admin_portal_locked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {s.admin_portal_locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {s.admin_portal_locked ? 'Locked' : 'Open'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={busyId === s.id + 'dos_portal_locked'}
                        onClick={() => toggle(s, 'dos_portal_locked')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          s.dos_portal_locked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {s.dos_portal_locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {s.dos_portal_locked ? 'Locked' : 'Open'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{s.lock_reason || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => unlockAll(s)}
                        disabled={busyId === s.id || (!s.admin_portal_locked && !s.dos_portal_locked)}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                      >
                        Unlock all
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
