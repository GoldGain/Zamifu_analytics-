import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Save, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterAdminSettings() {
  const [platformName, setPlatformName] = useState('Zamifu Analytics');
  const [currency, setCurrency] = useState('KES');
  const [supportEmail, setSupportEmail] = useState('tutorsultimate@gmail.com');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('platform_settings').upsert([
        { key: 'platform_name', value: platformName },
        { key: 'currency', value: currency },
        { key: 'support_email', value: supportEmail },
      ], { onConflict: 'key' });
      if (error) throw error;
      toast.success('Platform settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure global Zamifu Analytics platform settings</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
          <input value={platformName} onChange={e => setPlatformName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="KES">KES — Kenyan Shilling</option>
            <option value="USD">USD — US Dollar</option>
            <option value="UGX">UGX — Ugandan Shilling</option>
            <option value="TZS">TZS — Tanzanian Shilling</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
          <input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-xl">
        <h3 className="font-semibold text-blue-800 mb-2">Master Admin Credentials</h3>
        <p className="text-sm text-blue-700">Martin Makau — <strong>martinmakau2005@gmail.com</strong></p>
        <p className="text-xs text-blue-600 mt-1">This account has full platform access including all resellers, schools, students, teachers, results, and payments.</p>
      </div>
    </div>
  );
}
