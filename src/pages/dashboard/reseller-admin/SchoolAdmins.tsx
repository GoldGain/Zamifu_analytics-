import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_SCHOOL_ADMIN_PASSWORD = 'SchoolAdmin@2025';

interface SchoolAdmin {
  id: string;
  user_id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

interface SchoolAdminForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  school_id: string;
}

const defaultForm: SchoolAdminForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  school_id: '',
};

export default function ResellerSchoolAdmins() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [admins, setAdmins] = useState<SchoolAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SchoolAdminForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get reseller ID
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!resellerData) {
        toast.error('Reseller not found');
        setLoading(false);
        return;
      }

      // Get schools for this reseller
      const { data: schoolsData } = await supabase
        .from('schools')
        .select('id, name')
        .or(`reseller_id.eq.${resellerData.id},reseller_id.is.null`)
        .order('name', { ascending: true });

      setSchools(schoolsData || []);

      // Get school admins for this reseller's schools
      if (schoolsData && schoolsData.length > 0) {
        const schoolIds = schoolsData.map((s) => s.id);
        const { data: adminsData } = await supabase
          .from('school_admins')
          .select('*')
          .in('school_id', schoolIds)
          .order('created_at', { ascending: false });

        setAdmins((adminsData || []) as SchoolAdmin[]);
      }
    } catch (err: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.school_id) {
      toast.error('Please select a school');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Update existing admin
        const { error } = await supabase
          .from('school_admins')
          .update({
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone: form.phone || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('School admin updated');
      } else {
        // Create new auth user using RPC (reliable, uses service role)
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_auth_user', {
          p_email: form.email,
          p_password: DEFAULT_SCHOOL_ADMIN_PASSWORD,
          p_first_name: form.first_name,
          p_last_name: form.last_name,
          p_role: 'school_admin',
          p_school_id: form.school_id
        });

        if (rpcError) throw rpcError;

        const userId = rpcData.user_id;

        // Create school admin record
        const { error: adminError } = await supabase.from('school_admins').insert({
          user_id: userId,
          school_id: form.school_id,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          is_active: true,
        });

        if (adminError) throw adminError;

        toast.success(
          `✅ School Admin created! Login: ${form.email} | Password: ${DEFAULT_SCHOOL_ADMIN_PASSWORD}`
        );
      }

      setShowForm(false);
      setEditingId(null);
      setForm(defaultForm);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save school admin');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (admin: SchoolAdmin) => {
    setForm({
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      phone: admin.phone || '',
      school_id: admin.school_id,
    });
    setEditingId(admin.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this school admin? This cannot be undone.')) return;
    const { error } = await supabase.from('school_admins').delete().eq('id', id);
    if (error) toast.error('Failed to delete school admin');
    else {
      toast.success('School admin deleted');
      fetchData();
    }
  };

  const filteredAdmins = admins.filter((admin) =>
    `${admin.first_name} ${admin.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    admin.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Admins</h1>
          <p className="text-gray-500 text-sm mt-1">Manage school administrators for your schools</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(defaultForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add School Admin
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit School Admin' : 'Add New School Admin'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                required
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                required
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School *</label>
              <select
                required
                value={form.school_id}
                onChange={(e) => setForm({ ...form, school_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select a school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Password
                </label>
                <input
                  disabled
                  type="text"
                  value={DEFAULT_SCHOOL_ADMIN_PASSWORD}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-assigned password for new admins</p>
              </div>
            )}
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Admins Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {schools.length === 0
              ? 'No schools available. Create a school first.'
              : 'No school admins yet. Add one to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => {
                  const school = schools.find((s) => s.id === admin.school_id);
                  return (
                    <tr key={admin.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {admin.first_name} {admin.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                      <td className="px-4 py-3 text-gray-600">{admin.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{school?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            admin.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(admin)}
                            title="Edit"
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(admin.id)}
                            title="Delete"
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
