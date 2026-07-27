import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { MessageSquare, Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SMSSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState({
    sms_provider: 'olympus',
    sms_api_key: '',
    sms_username: '',
    sms_sender_id: 'ZAMIFU',
    school_motto: '',
    school_slogan: '',
  });

  useEffect(() => {
    if (!user?.schoolId) return;
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await supabaseUntyped
        .from('school_settings')
        .select('*')
        .eq('school_id', user.schoolId)
        .maybeSingle();
      if (data) {
        setSettingsId(data.id);
        setForm({
          sms_provider: data.sms_provider || 'olympus',
          sms_api_key: data.sms_api_key || '',
          sms_username: data.sms_username || '',
          sms_sender_id: data.sms_sender_id || 'ZAMIFU',
          school_motto: data.school_motto || '',
          school_slogan: data.school_slogan || '',
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [user?.schoolId]);

  const handleSave = async () => {
    if (!user?.schoolId) return;
    setSaving(true);
    try {
      const payload: any = {
        school_id: user.schoolId,
        sms_provider: form.sms_provider,
        sms_sender_id: form.sms_sender_id,
        updated_at: new Date().toISOString(),
      };

      // Only set API key and username if using Africa's Talking
      if (form.sms_provider === 'africastalking') {
        payload.sms_api_key = form.sms_api_key || null;
        payload.sms_username = form.sms_username || null;
      }

      if (settingsId) {
        const { error } = await supabaseUntyped
          .from('school_settings')
          .update(payload)
          .eq('id', settingsId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabaseUntyped
          .from('school_settings')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        setSettingsId(data.id);
      }

      toast.success('SMS settings saved successfully!');
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-sm text-gray-500">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SMS Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your SMS credentials and branding for outgoing messages.</p>
      </div>

      {/* Provider Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" /> SMS Provider
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SMS Provider</label>
          <select
            value={form.sms_provider}
            onChange={e => setForm(f => ({ ...f, sms_provider: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="olympus">Olympus SMS (Built-in - No setup required)</option>
            <option value="africastalking">Africa's Talking</option>
          </select>
        </div>

        {/* Olympus Info */}
        {form.sms_provider === 'olympus' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <p className="font-medium mb-1">Olympus SMS is configured and ready to use.</p>
            <p className="text-green-700">No additional setup needed. Messages are sent via our integrated provider with sender ID "PROCALL".</p>
          </div>
        )}

        {/* Africa's Talking Setup */}
        {form.sms_provider === 'africastalking' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <p className="font-medium mb-1">How to set up Africa's Talking SMS</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Create an account at <a href="https://africastalking.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">africastalking.com</a></li>
                <li>Go to Settings → API Key to get your API key</li>
                <li>Register a Sender ID (e.g. your school name, max 11 chars) or use the default</li>
                <li>Top up your SMS balance and go live</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={form.sms_username}
                onChange={e => setForm(f => ({ ...f, sms_username: e.target.value }))}
                placeholder="Your Africa's Talking username (e.g. sandbox for testing)"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-xs text-gray-500 mt-1">Use "sandbox" for testing, your actual username for production</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={form.sms_api_key}
                  onChange={e => setForm(f => ({ ...f, sms_api_key: e.target.value }))}
                  placeholder="Your Africa's Talking API key"
                  className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID / SMS Name</label>
              <input
                type="text"
                value={form.sms_sender_id}
                onChange={e => setForm(f => ({ ...f, sms_sender_id: e.target.value.slice(0, 11) }))}
                placeholder="e.g. ZAMIFU or your school short name"
                maxLength={11}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-xs text-gray-500 mt-1">Max 11 characters. This is what recipients see as the sender name.</p>
            </div>
          </>
        )}

        {/* Olympus Sender ID */}
        {form.sms_provider === 'olympus' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
            <input
              type="text"
              value="PROCALL"
              disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Olympus SMS uses a fixed sender ID. Cannot be changed.</p>
          </div>
        )}
      </div>

      {/* School Branding */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">School Branding for SMS</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School Motto</label>
          <input
            type="text"
            value={form.school_motto}
            onChange={e => setForm(f => ({ ...f, school_motto: e.target.value }))}
            placeholder="e.g. Excellence in Education"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School Slogan</label>
          <input
            type="text"
            value={form.school_slogan}
            onChange={e => setForm(f => ({ ...f, school_slogan: e.target.value }))}
            placeholder="e.g. Nurturing Future Leaders"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-xs text-gray-500 mt-1">This slogan will be appended to results SMS messages.</p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving...' : 'Save SMS Settings'}
      </button>

      {/* Status indicator */}
      {form.sms_provider === 'olympus' ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="w-4 h-4" />
          SMS is ready. Olympus SMS is configured by default. You can send SMS from Bulk SMS, and welcome SMS will be sent when adding teachers.
        </div>
      ) : form.sms_api_key ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="w-4 h-4" />
          Africa's Talking credentials configured. SMS will use your account for sending.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          Africa's Talking API key not set. Please add your API key above, or switch to Olympus SMS for instant use.
        </div>
      )}
    </div>
  );
}
