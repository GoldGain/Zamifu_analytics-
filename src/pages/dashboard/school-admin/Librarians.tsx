import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Copy, KeyRound, Loader2, Mail, Plus, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';
import { deleteScopedUser } from '@/lib/supabase/accountActions';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const random = new Uint8Array(24);
  globalThis.crypto.getRandomValues(random);
  return `Zf!1${Array.from(random, (byte) => alphabet[byte % alphabet.length]).join('')}`;
}

type Librarian = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

type NewCredentials = { email: string; password: string };

export default function SchoolAdminLibrarians() {
  const { user, schoolData } = useAuth();
  const [librarians, setLibrarians] = useState<Librarian[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const fetchLibrarians = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, first_name, last_name, email, phone, created_at, is_active')
        .eq('school_id', user.schoolId)
        .eq('role', 'librarian')
        .or('is_active.is.null,is_active.eq.true')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLibrarians((data || []) as Librarian[]);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not load librarian accounts.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchLibrarians(); }, [user?.schoolId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return librarians;
    return librarians.filter((librarian) => `${librarian.first_name || ''} ${librarian.last_name || ''} ${librarian.email || ''}`.toLowerCase().includes(needle));
  }, [librarians, search]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.schoolId) return toast.error('No school is assigned to your account.');
    setSaving(true);
    setCredentials(null);
    const email = form.email.trim().toLowerCase();
    const password = generateTemporaryPassword();
    try {
      await createScopedUser({
        email,
        password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: 'librarian',
        school_id: user.schoolId,
        metadata: { phone: form.phone.trim() || null, account_type: 'school_librarian' },
      });
      setCredentials({ email, password });
      toast.success('Librarian account created. Share the temporary sign-in details securely.');
      setForm({ first_name: '', last_name: '', email: '', phone: '' });
      setShowForm(false);
      await fetchLibrarians();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to create the librarian account.'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (librarian: Librarian) => {
    if (!librarian.email) return toast.error('This librarian account has no email address.');
    setResettingId(librarian.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(librarian.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${librarian.email}.`);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not send the password reset email.'));
    } finally {
      setResettingId(null);
    }
  };

  const handleRemove = async (librarian: Librarian) => {
    const name = `${librarian.first_name || ''} ${librarian.last_name || ''}`.trim() || librarian.email || 'this librarian';
    if (!user?.schoolId) return toast.error('No school is assigned to your account.');
    if (!window.confirm(`Remove ${name} from active librarian accounts? They will lose sign-in access.`)) return;
    setRemovingId(librarian.id);
    try {
      await deleteScopedUser({ target_user_id: librarian.id, target_type: 'librarian', school_id: user.schoolId });
      toast.success('Librarian sign-in access has been removed.');
      await fetchLibrarians();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not remove the librarian account.'));
    } finally {
      setRemovingId(null);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`Zamifu librarian sign-in\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}`);
      toast.success('Temporary sign-in details copied. Share them securely.');
    } catch {
      toast.error('Copy was unavailable. Select and copy the temporary details manually.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Librarians</h1>
          <p className="mt-1 text-sm text-gray-500">Add and manage staff who sign in to the Library workspace for {schoolData?.name || 'your school'}.</p>
        </div>
        <button onClick={() => { setCredentials(null); setShowForm((value) => !value); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Librarian
        </button>
      </div>

      {credentials && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Temporary sign-in details</h2>
              <p className="mt-1 text-sm">Share these privately. The password is shown only after account creation.</p>
              <p className="mt-3 text-sm"><strong>Email:</strong> <span className="font-mono">{credentials.email}</span></p>
              <p className="mt-1 text-sm"><strong>Temporary password:</strong> <span className="font-mono select-all">{credentials.password}</span></p>
            </div>
            <button type="button" onClick={() => void copyCredentials()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold hover:bg-emerald-100"><Copy className="h-4 w-4" /> Copy details</button>
          </div>
        </section>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add New Librarian</h2>
              <p className="text-sm text-gray-500">The librarian can sign in to the Library workspace only. A strong temporary password is generated automatically.</p>
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
            <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span>For account security, the temporary password is created at submission and displayed once after successful creation.</span></div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Librarian</button>
          </div>
        </form>
      )}

      <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search librarians by name or email..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500" /></div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : filtered.length === 0 ? <div className="p-10 text-center text-sm text-gray-500"><BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />No librarian accounts yet. Click Add Librarian to create a Library staff login.</div> : <div className="divide-y divide-gray-100">{filtered.map((librarian) => <div key={librarian.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><div className="rounded-full bg-blue-50 p-3 text-blue-600"><UserRound className="h-5 w-5" /></div><div><p className="font-bold text-gray-900">{`${librarian.first_name || ''} ${librarian.last_name || ''}`.trim() || 'Librarian'}</p><p className="flex items-center gap-1 text-sm text-gray-500"><Mail className="h-3.5 w-3.5" />{librarian.email || 'No email'}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Library</span><button type="button" onClick={() => void handleResetPassword(librarian)} disabled={!librarian.email || resettingId === librarian.id || removingId === librarian.id} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{resettingId === librarian.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Reset password</button><button type="button" onClick={() => void handleRemove(librarian)} disabled={removingId === librarian.id || resettingId === librarian.id} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{removingId === librarian.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove</button></div></div>)}</div>}
      </div>
    </div>
  );
}
