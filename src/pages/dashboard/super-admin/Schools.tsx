import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';
import { Search, Plus, School, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminSchools() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '', code: '', email: '', phone: '', county: '', 
    principal_name: '', principal_phone: '',
    subscription_plan: 'trial', status: 'active',
    paystack_enabled: false,
    paystack_public_key: '',
    paystack_secret_key: '',
    paystack_currency: 'KES',
    admin_email: '', admin_password: '', admin_first_name: '', admin_last_name: '',
  });

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    setLoading(true);
    const { data } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
    setSchools(data || []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);

    try {
      // 1. Insert the school. The database migration adds owner scoping defaults for reseller isolation.
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert([{
          name: formData.name.trim(),
          code: (formData.name.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'SCHOOL') + '-' + Math.floor(1000 + Math.random() * 9000),
          email: formData.email.trim().toLowerCase() || null,
          phone: formData.phone.trim() || null,
          county: formData.county.trim() || null,
          principal_name: formData.principal_name.trim() || null,
          principal_phone: formData.principal_phone.trim() || null,
          subscription_plan: formData.subscription_plan,
          status: formData.status,
          paystack_enabled: formData.paystack_enabled,
          paystack_public_key: formData.paystack_public_key.trim() || null,
          paystack_secret_key: formData.paystack_secret_key.trim() || null,
          paystack_currency: formData.paystack_currency || 'KES',
        }])
        .select()
        .single();

      if (schoolError) throw new Error(schoolError.message);

      // 2. Create the school admin without changing the current super-admin session.
      await createScopedUser({
        email: formData.admin_email,
        password: formData.admin_password,
        first_name: formData.admin_first_name,
        last_name: formData.admin_last_name,
        role: 'school_admin',
        school_id: school.id,
        metadata: { school_name: formData.name.trim() },
      });

      toast.success(`School "${formData.name}" and admin account created!`);
      setShowAdd(false);
      setFormData({
        name: '', code: '', email: '', phone: '', county: '', 
        principal_name: '', principal_phone: '',
        subscription_plan: 'trial', status: 'active',
        admin_email: '', admin_password: '', admin_first_name: '', admin_last_name: '',
      });
      fetchSchools();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAdding(false);
    }
  };

  const filtered = schools.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schools</h1>
          <p className="text-sm text-gray-500">{filtered.length} total schools</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]">
          <Plus className="w-4 h-4" /> Add School
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Add New School</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="School Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" required />
              <input placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" type="email" />
              <input placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" />
              <input placeholder="County" value={formData.county} onChange={e => setFormData({...formData, county: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" />
              <input placeholder="Principal Name" value={formData.principal_name} onChange={e => setFormData({...formData, principal_name: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" />
              <input placeholder="Principal Phone" value={formData.principal_phone} onChange={e => setFormData({...formData, principal_phone: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" />
              <div className="flex gap-2">
                <select value={formData.subscription_plan} onChange={e => setFormData({...formData, subscription_plan: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm bg-white">
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm bg-white">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Parent Paystack Configuration</h4>
              <p className="text-xs text-gray-500 mb-3">Parent online payments are only shown when the school is owned by Theophillus Ngewa and Paystack is enabled here.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={formData.paystack_enabled} onChange={e => setFormData({...formData, paystack_enabled: e.target.checked})} className="rounded" />
                  Enable Paystack parent payments
                </label>
                <select value={formData.paystack_currency} onChange={e => setFormData({...formData, paystack_currency: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm bg-white">
                  <option value="KES">KES</option>
                  <option value="NGN">NGN</option>
                  <option value="GHS">GHS</option>
                  <option value="ZAR">ZAR</option>
                  <option value="USD">USD</option>
                </select>
                <input placeholder="Paystack Public Key (pk_...)" value={formData.paystack_public_key} onChange={e => setFormData({...formData, paystack_public_key: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" />
                <input placeholder="Paystack Secret Key (sk_...)" value={formData.paystack_secret_key} onChange={e => setFormData({...formData, paystack_secret_key: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" type="password" />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Admin Account</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input placeholder="First Name *" value={formData.admin_first_name} onChange={e => setFormData({...formData, admin_first_name: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" required />
                <input placeholder="Last Name *" value={formData.admin_last_name} onChange={e => setFormData({...formData, admin_last_name: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" required />
                <input placeholder="Email *" value={formData.admin_email} onChange={e => setFormData({...formData, admin_email: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" type="email" required />
                <input placeholder="Password *" value={formData.admin_password} onChange={e => setFormData({...formData, admin_password: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-sm" type="password" required />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={adding} className="bg-[#2563EB] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create School
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="border px-6 py-2 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">School</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Parent Pay</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-500">No schools found</td></tr>
              ) : (
                filtered.map((school) => (
                  <tr key={school.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600"><School className="w-4 h-4" /></div>
                        <span className="text-sm font-medium">{school.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{school.code}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">{school.subscription_plan}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1 text-xs font-medium ${school.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                        {school.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {school.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${school.paystack_enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {school.paystack_enabled ? 'Paystack enabled' : 'Office only'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
