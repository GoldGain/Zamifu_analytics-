import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SchoolForm {
  name: string;
  code: string;
  county: string;
  curriculum: string;
  principal_name: string;
  phone: string;
  email: string;
}

const defaultForm: SchoolForm = {
  name: '', code: '', county: '', curriculum: 'CBE',
  principal_name: '', phone: '', email: '',
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
  // Issue 1: Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: resellerData } = await supabase
      .from('resellers').select('id, parent_pay_enabled').eq('user_id', user!.id).maybeSingle();
    
    if (resellerData) {
      setResellerId(resellerData.id);
      const { data: schoolsData } = await supabase
        .from('schools').select('*').eq('reseller_id', resellerData.id).order('created_at', { ascending: false });
      setSchools(schoolsData || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resellerId) return;
    setSaving(true);
    try {
      const payload = {
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
      };
      if (editingId) {
        const { error } = await supabase.from('schools').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('School updated');
      } else {
        const { error } = await supabase.from('schools').insert(payload);
        if (error) throw error;
        toast.success('School created');
      }
      setShowForm(false); setEditingId(null); setForm(defaultForm);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save school');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: any) => {
    setForm({
      name: s.name, code: s.code, county: s.county || '', curriculum: (Array.isArray(s.curriculum) ? s.curriculum[0] : s.curriculum) || 'CBE',
      principal_name: s.principal_name || '', phone: s.phone || '', email: s.email || '',
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  // Issue 1: Handle delete with confirmation
  const handleDeleteClick = (s: any) => {
    setConfirmDeleteId(s.id);
    setConfirmDeleteName(s.name);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      // Delete related data first to avoid FK constraint errors
      await supabase.from('students').delete().eq('school_id', confirmDeleteId);
      await supabase.from('teachers').delete().eq('school_id', confirmDeleteId);
      await supabase.from('classes').delete().eq('school_id', confirmDeleteId);
      await supabase.from('subjects').delete().eq('school_id', confirmDeleteId);
      await supabase.from('terms').delete().eq('school_id', confirmDeleteId);
      await supabase.from('results').delete().eq('school_id', confirmDeleteId);
      await supabase.from('announcements').delete().eq('school_id', confirmDeleteId);
      // Delete the school itself
      const { error } = await supabase.from('schools').delete().eq('id', confirmDeleteId);
      if (error) throw error;
      toast.success(`School "${confirmDeleteName}" deleted successfully`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete school');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schools</h1>
          <p className="text-gray-500 text-sm mt-1">Manage schools under your reseller account</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <Plus className="w-4 h-4" /> Add School
          </button>
        </div>
      </div>

      {/* Issue 1: Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete School</h3>
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to delete <strong>"{confirmDeleteName}"</strong>? This will permanently remove the school and all its associated data (students, teachers, classes, results). This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Delete School
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit School' : 'Add New School'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Code *</label>
              <input required value={form.code} onChange={e => setForm({...form, code: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <input value={form.county} onChange={e => setForm({...form, county: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum</label>
              <select value={form.curriculum} onChange={e => setForm({...form, curriculum: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="CBE">CBE (Competency Based Education)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Principal Name</label>
              <input value={form.principal_name} onChange={e => setForm({...form, principal_name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schools Table */}
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
                  <th className="px-4 py-3">School Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Curriculum</th>
                  <th className="px-4 py-3">County</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.code}</td>
                    <td className="px-4 py-3">{s.curriculum === 'CBE' ? 'CBE' : (s.curriculum || 'CBE')}</td>
                    <td className="px-4 py-3">{s.county || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-1">
                      <button onClick={() => handleEdit(s)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Edit school">
                        <Edit className="w-4 h-4" />
                      </button>
                      {/* Issue 1: Delete button */}
                      <button
                        onClick={() => handleDeleteClick(s)}
                        disabled={deletingId === s.id}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 disabled:opacity-50"
                        title="Delete school"
                      >
                        <Trash2 className="w-4 h-4" />
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
