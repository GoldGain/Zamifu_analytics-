import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Mail, Plus, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';
import { deleteScopedUser } from '@/lib/supabase/accountActions';

const DEFAULT_BURSAR_PASSWORD = 'bursar@2025';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type Bursar = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

export default function SchoolAdminBursars() {
  const { user, schoolData } = useAuth();
  const [bursars, setBursars] = useState<Bursar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingBursarId, setResettingBursarId] = useState<string | null>(null);
  const [removingBursarId, setRemovingBursarId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const fetchBursars = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, created_at, is_active')
        .eq('school_id', user.schoolId)
        .eq('role', 'bursar')
        .or('is_active.is.null,is_active.eq.true')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBursars((data || []) as Bursar[]);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not load Bursar accounts. Apply the Bursar role migration if this is a new school.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBursars(); }, [user?.schoolId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return bursars;
    return bursars.filter((bursar) => `${bursar.first_name || ''} ${bursar.last_name || ''} ${bursar.email || ''}`.toLowerCase().includes(needle));
  }, [bursars, search]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.schoolId) return toast.error('No school is assigned to your account.');
    setSaving(true);
    try {
      await createScopedUser({
        email: form.email,
        password: DEFAULT_BURSAR_PASSWORD,
        first_name: form.first_name,
        last_name: form.last_name,
        role: 'bursar',
        school_id: user.schoolId,
        metadata: { phone: form.phone.trim() || null, account_type: 'school_bursar' },
      });
      toast.success(`Bursar created. Login: ${form.email.trim().toLowerCase()} | Password: ${DEFAULT_BURSAR_PASSWORD}`);
      setForm({ first_name: '', last_name: '', email: '', phone: '' });
      setShowForm(false);
      await fetchBursars();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to create Bursar account.'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (bursar: Bursar) => {
    if (!bursar.email) return toast.error('This bursar account has no email address.');
    setResettingBursarId(bursar.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(bursar.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${bursar.email}.`);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not send the password reset email.'));
    } finally {
      setResettingBursarId(null);
    }
  };

  const handleRemove = async (bursar: Bursar) => {
    const name = `${bursar.first_name || ''} ${bursar.last_name || ''}`.trim() || bursar.email || 'this bursar';
    if (!user?.schoolId) return toast.error('No school is assigned to your account.');
    if (!window.confirm(`Remove ${name} from active bursar accounts? They will lose sign-in access; historical fee records will be retained.`)) return;

    setRemovingBursarId(bursar.id);
    try {
      await deleteScopedUser({ target_user_id: bursar.id, target_type: 'bursar', school_id: user.schoolId });
      toast.success('Bursar access removed. Historical fee records were retained.');
      await fetchBursars();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not remove the bursar.'));
    } finally {
      setRemovingBursarId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Bursars</h1>
          <p className="mt-1 text-sm text-gray-500">Create and manage the finance officers who operate fee management for {schoolData?.name || 'your school'}.</p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Bursar
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add New Bursar</h2>
              <p className="text-sm text-gray-500">The account is restricted to fee management. A new Bursar starts with the default password shown below.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {([
              ['first_name', 'First Name', 'text'],
              ['last_name', 'Last Name', 'text'],
              ['email', 'Email', 'email'],
              ['phone', 'Phone', 'tel'],
            ] as const).map(([key, label, type]) => (
              <label key={key} className="text-sm font-semibold text-gray-700">
                {label}{key !== 'phone' && ' *'}
                <input required={key !== 'phone'} type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
            ))}
            <label className="text-sm font-semibold text-gray-700">
              Default Password
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800"><KeyRound className="h-4 w-4" /><span className="font-mono">{DEFAULT_BURSAR_PASSWORD}</span></div>
              <span className="mt-1 block text-xs font-normal text-gray-500">Share this securely and ask the Bursar to change it after first login.</span>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Bursar</button>
          </div>
        </form>
      )}

      <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Bursars by name or email..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500" /></div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : filtered.length === 0 ? <div className="p-10 text-center text-sm text-gray-500"><UserRound className="mx-auto mb-2 h-8 w-8 text-gray-300" />No Bursar accounts yet. Click Add Bursar to create the fee manager.</div> : <div className="divide-y divide-gray-100">{filtered.map((bursar) => <div key={bursar.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><div className="rounded-full bg-blue-50 p-3 text-blue-600"><UserRound className="h-5 w-5" /></div><div><p className="font-bold text-gray-900">{`${bursar.first_name || ''} ${bursar.last_name || ''}`.trim() || 'Bursar'}</p><p className="flex items-center gap-1 text-sm text-gray-500"><Mail className="h-3.5 w-3.5" />{bursar.email || 'No email'}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Fee Management</span><button type="button" onClick={() => handleResetPassword(bursar)} disabled={!bursar.email || resettingBursarId === bursar.id || removingBursarId === bursar.id} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{resettingBursarId === bursar.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Reset password</button><button type="button" onClick={() => handleRemove(bursar)} disabled={removingBursarId === bursar.id || resettingBursarId === bursar.id} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{removingBursarId === bursar.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove</button></div></div>)}</div>}
      </div>
    </div>
  );
}
