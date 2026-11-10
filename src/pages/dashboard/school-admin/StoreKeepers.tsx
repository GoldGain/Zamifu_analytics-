import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Package, Plus, Search, ShieldCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';

const DEFAULT_STORE_KEEPER_PASSWORD = 'storekeeper@2025';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type StoreKeeper = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

export default function SchoolAdminStoreKeepers() {
  const { user, schoolData } = useAuth();
  const [keepers, setKeepers] = useState<StoreKeeper[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const fetchKeepers = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, created_at, is_active')
        .eq('school_id', user.schoolId)
        .eq('role', 'store_keeper')
        .or('is_active.is.null,is_active.eq.true')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setKeepers((data || []) as StoreKeeper[]);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not load Store Keeper accounts.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeepers(); }, [user?.schoolId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return keepers;
    return keepers.filter((keeper) => `${keeper.first_name || ''} ${keeper.last_name || ''} ${keeper.email || ''}`.toLowerCase().includes(needle));
  }, [keepers, search]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.schoolId) return toast.error('No school is assigned to your account.');
    setSaving(true);
    try {
      await createScopedUser({
        email: form.email,
        password: DEFAULT_STORE_KEEPER_PASSWORD,
        first_name: form.first_name,
        last_name: form.last_name,
        role: 'store_keeper' as never,
        school_id: user.schoolId,
        metadata: { phone: form.phone.trim() || null, account_type: 'school_store_keeper' },
      });
      toast.success('Store Keeper created. Share the default password securely.');
      setForm({ first_name: '', last_name: '', email: '', phone: '' });
      setShowForm(false);
      await fetchKeepers();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not create the Store Keeper account.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (keeper: StoreKeeper) => {
    const name = `${keeper.first_name || ''} ${keeper.last_name || ''}`.trim() || keeper.email || 'this Store Keeper';
    if (!user?.schoolId) return toast.error('No school is assigned to your account.');
    if (!window.confirm(`Deactivate ${name}? They will lose sign-in access; their stock records are retained.`)) return;
    setRemovingId(keeper.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', keeper.id)
        .eq('school_id', user.schoolId);
      if (error) throw error;
      toast.success('Store Keeper deactivated. Stock records were retained.');
      await fetchKeepers();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Could not deactivate the Store Keeper.'));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Store Keepers</h1>
          <p className="mt-1 text-sm text-gray-500">Create the officer who runs inventory for {schoolData?.name || 'your school'}. Only a Store Keeper can add, issue or adjust stock — School Admins are read-only in Inventory.</p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Store Keeper
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add New Store Keeper</h2>
              <p className="text-sm text-gray-500">The account is restricted to the Inventory module. Share the default password securely and ask them to change it after first login.</p>
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
                <input required={key !== 'phone'} type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
            ))}
            <label className="text-sm font-semibold text-gray-700">
              Default Password
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                <KeyRound className="h-4 w-4" /><span className="font-mono text-sm">{DEFAULT_STORE_KEEPER_PASSWORD}</span>
              </div>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Store Keeper
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Store Keepers" className="w-full rounded-xl border border-gray-200 py-2.5 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            <Package className="mx-auto mb-2 h-6 w-6 text-gray-300" />
            No Store Keeper yet. Inventory stays read-only for everyone until you create one.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((keeper) => (
              <li key={keeper.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-gray-900">{`${keeper.first_name || ''} ${keeper.last_name || ''}`.trim() || keeper.email}</p>
                  <p className="text-xs text-gray-500">{[keeper.email, keeper.phone].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">Store Keeper</span>
                  <button onClick={() => handleDeactivate(keeper)} disabled={removingId === keeper.id} className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50">
                    {removingId === keeper.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />} Deactivate
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
