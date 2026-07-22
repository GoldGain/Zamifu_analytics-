import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit, RefreshCw, Trash2, Lock, Unlock, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_FEE_PER_LEARNER, feeOrDefault, getResellerForUser } from '@/lib/reseller';

interface SchoolForm {
  name: string;
  code: string;
  county: string;
  curriculum: string;
  principal_name: string;
  phone: string;
  email: string;
  fee_per_learner_per_term: number;
}

const defaultForm: SchoolForm = {
  name: '',
  code: '',
  county: '',
  curriculum: 'CBE',
  principal_name: '',
  phone: '',
  email: '',
  fee_per_learner_per_term: DEFAULT_FEE_PER_LEARNER,
};

export default function ResellerSchools() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SchoolForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [lockModal, setLockModal] = useState<any | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockAdmin, setLockAdmin] = useState(false);
  const [lockDos, setLockDos] = useState(false);
  const [lockSaving, setLockSaving] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const reseller = await getResellerForUser(user!.id);
    if (reseller) {
      setResellerId(reseller.id);
      const defaultFee = feeOrDefault(reseller.default_fee_per_learner);
      setForm((f) => ({ ...f, fee_per_learner_per_term: f.fee_per_learner_per_term || defaultFee }));
      const { data: schoolsData } = await supabase
        .from('schools')
        .select('*')
        .eq('reseller_id', reseller.id)
        .order('created_at', { ascending: false });
      setSchools(schoolsData || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resellerId) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        code: form.code,
        county: form.county,
        curriculum: form.curriculum,
        principal_name: form.principal_name,
        phone: form.phone,
        email: form.email,
        reseller_id: resellerId,
        status: 'active',
        subscription_plan: 'basic',
        fee_per_learner_per_term: feeOrDefault(form.fee_per_learner_per_term),
      };
      if (editingId) {
        const { error } = await supabase.from('schools').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('School updated');
      } else {
        const { error } = await supabase.from('schools').insert({
          ...payload,
          admin_portal_locked: false,
          dos_portal_locked: false,
        });
        if (error) throw error;
        toast.success('School created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(defaultForm);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save school');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: any) => {
    setForm({
      name: s.name,
      code: s.code,
      county: s.county || '',
      curriculum: (Array.isArray(s.curriculum) ? s.curriculum[0] : s.curriculum) || 'CBE',
      principal_name: s.principal_name || '',
      phone: s.phone || '',
      email: s.email || '',
      fee_per_learner_per_term: feeOrDefault(s.fee_per_learner_per_term),
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const openLockModal = (s: any) => {
    setLockModal(s);
    setLockAdmin(!!s.admin_portal_locked);
    setLockDos(!!s.dos_portal_locked);
    setLockReason(s.lock_reason || '');
  };

  const saveLocks = async () => {
    if (!lockModal) return;
    setLockSaving(true);
    try {
      const anyLocked = lockAdmin || lockDos;
      const { error } = await (supabase as any)
        .from('schools')
        .update({
          admin_portal_locked: lockAdmin,
          dos_portal_locked: lockDos,
          lock_reason: anyLocked ? lockReason || null : null,
          locked_at: anyLocked ? new Date().toISOString() : null,
          locked_by_role: anyLocked ? 'reseller_super_admin' : null,
        })
        .eq('id', lockModal.id);
      if (error) throw error;
      toast.success('Portal access updated');
      setLockModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update locks');
    } finally {
      setLockSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      // Delete all child records in dependency order before deleting the school.
      // Most tables already have ON DELETE CASCADE at DB level, but we explicitly
      // clean up the ones that previously had NO ACTION to be safe.
      await supabase.from('school_admins').delete().eq('school_id', confirmDeleteId);
      await supabase.from('school_announcements').delete().eq('school_id', confirmDeleteId);
      await supabase.from('parent_payments').delete().eq('school_id', confirmDeleteId);
      await supabase.from('results').delete().eq('school_id', confirmDeleteId);
      await supabase.from('students').delete().eq('school_id', confirmDeleteId);
      await supabase.from('teachers').delete().eq('school_id', confirmDeleteId);
      await supabase.from('classes').delete().eq('school_id', confirmDeleteId);
      await supabase.from('subjects').delete().eq('school_id', confirmDeleteId);
      await supabase.from('terms').delete().eq('school_id', confirmDeleteId);
      await supabase.from('announcements').delete().eq('school_id', confirmDeleteId);
      // Finally delete the school — remaining child tables cascade automatically
      const { error } = await supabase.from('schools').delete().eq('id', confirmDeleteId);
      if (error) throw error;
      toast.success(`School "${confirmDeleteName}" deleted successfully`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete school. Please try again or contact support.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schools</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create schools, set fee per learner per term, and lock School Admin or DoS portals
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm(defaultForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" /> Add School
          </button>
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete School</h3>
            </div>
            <p className="text-gray-700 text-sm font-medium mb-3">
              Are you sure you want to delete <strong>&quot;{confirmDeleteName}&quot;</strong>?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-xs font-semibold mb-2">This will permanently delete:</p>
              <ul className="text-red-600 text-xs space-y-1 list-disc list-inside">
                <li>All students and their records</li>
                <li>All teachers and assignments</li>
                <li>All classes, subjects and timetables</li>
                <li>All exams, results and report cards</li>
                <li>All school admins and access</li>
                <li>All fees, payments and invoices</li>
                <li>All announcements and messages</li>
              </ul>
              <p className="text-red-700 text-xs font-bold mt-2">This action CANNOT be undone.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={!!deletingId}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deletingId ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Yes, Delete School'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-900">Portal access — {lockModal.name}</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Locks apply only to School Admin and Dean of Studies. Teachers, students, and parents stay open.
            </p>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 mb-2 cursor-pointer">
              <input type="checkbox" checked={lockAdmin} onChange={(e) => setLockAdmin(e.target.checked)} className="rounded" />
              <div>
                <p className="text-sm font-medium">Lock School Admin portal</p>
                <p className="text-xs text-gray-500">Blocks /school-admin for this school</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 mb-4 cursor-pointer">
              <input type="checkbox" checked={lockDos} onChange={(e) => setLockDos(e.target.checked)} className="rounded" />
              <div>
                <p className="text-sm font-medium">Lock Dean of Studies portal</p>
                <p className="text-xs text-gray-500">Blocks /dean-of-studies for this school</p>
              </div>
            </label>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              rows={3}
              placeholder="e.g. Subscription overdue — pay to unlock"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLockModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={saveLocks}
                disabled={lockSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {lockSaving ? 'Saving...' : 'Save access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit School' : 'Add New School'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Code *</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum</label>
              <select value={form.curriculum} onChange={(e) => setForm({ ...form, curriculum: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="CBE">CBE</option>
                <option value="8-4-4">8-4-4</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Principal Name</label>
              <input value={form.principal_name} onChange={(e) => setForm({ ...form, principal_name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee per learner per term (KES) *</label>
              <input
                required
                type="number"
                min={1}
                value={form.fee_per_learner_per_term}
                onChange={(e) => setForm({ ...form, fee_per_learner_per_term: Number(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Used for platform subscription billing for this school</p>
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : schools.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No schools yet. Add your first school.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Fee / learner / term</th>
                  <th className="px-4 py-3">Admin lock</th>
                  <th className="px-4 py-3">DoS lock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <div>{s.name}</div>
                      <div className="text-xs text-gray-500">{s.county || '—'}{s.sub_county ? ` · ${s.sub_county}` : ''}</div>
                      {s.knec_centre_code && <div className="text-[11px] text-blue-600">KNEC: {s.knec_centre_code}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm capitalize">{(s.school_level || '—').toString().replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${s.registration_source === 'self_register' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {s.registration_source === 'self_register' ? 'Self-registered' : (s.registration_source || 'Manual')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.code}</td>
                    <td className="px-4 py-3 font-medium">KES {feeOrDefault(s.fee_per_learner_per_term).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {s.admin_portal_locked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <Unlock className="w-3 h-3" /> Open
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.dos_portal_locked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <Unlock className="w-3 h-3" /> Open
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openLockModal(s)} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-700" title="Portal locks">
                          <Shield className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(s)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDeleteId(s.id);
                            setConfirmDeleteName(s.name);
                          }}
                          disabled={deletingId === s.id}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
