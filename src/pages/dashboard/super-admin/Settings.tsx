import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Eye, EyeOff, CheckCircle, Loader2, Settings, DollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';

// Issue 16: Pricing tier configuration
interface PricingTier {
  id: string;
  name: string;
  price_per_month: number;
  price_per_year: number;
  max_students: number;
  max_teachers: number;
  features: string[];
  currency: string;
}

const DEFAULT_PRICING: PricingTier[] = [
  { id: 'trial', name: 'Trial', price_per_month: 0, price_per_year: 0, max_students: 50, max_teachers: 5, features: ['Basic features', '50 learners', '5 teachers'], currency: 'KES' },
  { id: 'basic', name: 'Basic', price_per_month: 2000, price_per_year: 20000, max_students: 200, max_teachers: 20, features: ['All features', '200 learners', '20 teachers', 'SMS notifications'], currency: 'KES' },
  { id: 'pro', name: 'Pro', price_per_month: 5000, price_per_year: 50000, max_students: 1000, max_teachers: 100, features: ['All features', '1000 learners', '100 teachers', 'SMS + push', 'Analytics'], currency: 'KES' },
  { id: 'premium', name: 'Premium', price_per_month: 10000, price_per_year: 100000, max_students: 999999, max_teachers: 999999, features: ['Unlimited learners', 'Unlimited teachers', 'All features', 'Priority support'], currency: 'KES' },
];

export default function SuperAdminSettings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Issue 16: Pricing state
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(DEFAULT_PRICING);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingLoaded, setPricingLoaded] = useState(false);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const { data } = await supabaseUntyped
        .from('platform_settings')
        .select('key, value')
        .eq('key', 'pricing_tiers')
        .maybeSingle();
      if (data?.value) {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPricingTiers(parsed);
        }
      }
    } catch (err) {
      // platform_settings table may not exist yet; use defaults
    }
    setPricingLoaded(true);
  };

  const savePricing = async () => {
    setSavingPricing(true);
    try {
      // Try upsert into platform_settings table
      const { error } = await supabaseUntyped
        .from('platform_settings')
        .upsert({ key: 'pricing_tiers', value: JSON.stringify(pricingTiers), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Pricing tiers saved successfully!');
      setEditingTier(null);
    } catch (err: any) {
      // If table doesn't exist, show a helpful message
      if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
        toast.error('platform_settings table not found. Please run the migration to create it.');
      } else {
        toast.error('Failed to save pricing: ' + err.message);
      }
    }
    setSavingPricing(false);
  };

  const updateTier = (tierId: string, field: keyof PricingTier, value: any) => {
    setPricingTiers(prev => prev.map(t => t.id === tierId ? { ...t, [field]: value } : t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: currentPassword });
      if (verifyError) { toast.error('Current password is incorrect'); setLoading(false); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setSuccess(true);
      toast.success('Password changed successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error('Failed to change password: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#111111]">Settings</h1><p className="text-sm text-[#666666]">Manage your super admin account and platform configuration</p></div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><Settings className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h3 className="font-semibold text-[#111111]">Account Information</h3>
            <p className="text-sm text-[#666666]">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-[#666666]">Name:</span> <span className="font-medium">{user?.firstName} {user?.lastName}</span></div>
          <div><span className="text-[#666666]">Role:</span> <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span></div>
        </div>
      </div>

      {/* Issue 16: Pricing Tier Configuration */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><DollarSign className="w-6 h-6 text-green-600" /></div>
            <div>
              <h3 className="font-semibold text-[#111111]">Pricing Tiers</h3>
              <p className="text-sm text-[#666666]">Configure subscription plans and pricing</p>
            </div>
          </div>
          <button
            onClick={savePricing}
            disabled={savingPricing}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {savingPricing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Pricing
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pricingTiers.map((tier) => (
            <div key={tier.id} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm capitalize">{tier.name} Plan</span>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{tier.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Monthly Price ({tier.currency})</label>
                  <input
                    type="number"
                    value={tier.price_per_month}
                    onChange={e => updateTier(tier.id, 'price_per_month', Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Yearly Price ({tier.currency})</label>
                  <input
                    type="number"
                    value={tier.price_per_year}
                    onChange={e => updateTier(tier.id, 'price_per_year', Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Max Learners</label>
                  <input
                    type="number"
                    value={tier.max_students === 999999 ? '' : tier.max_students}
                    placeholder="Unlimited"
                    onChange={e => updateTier(tier.id, 'max_students', e.target.value === '' ? 999999 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Max Teachers</label>
                  <input
                    type="number"
                    value={tier.max_teachers === 999999 ? '' : tier.max_teachers}
                    placeholder="Unlimited"
                    onChange={e => updateTier(tier.id, 'max_teachers', e.target.value === '' ? 999999 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm"
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Currency</label>
                <select
                  value={tier.currency}
                  onChange={e => updateTier(tier.id, 'currency', e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                >
                  <option value="KES">KES (Kenyan Shilling)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="UGX">UGX (Ugandan Shilling)</option>
                  <option value="TZS">TZS (Tanzanian Shilling)</option>
                  <option value="ZAR">ZAR (South African Rand)</option>
                  <option value="NGN">NGN (Nigerian Naira)</option>
                  <option value="GHS">GHS (Ghanaian Cedi)</option>
                </select>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                <strong>Monthly:</strong> {tier.currency} {tier.price_per_month.toLocaleString()} &nbsp;|&nbsp;
                <strong>Yearly:</strong> {tier.currency} {tier.price_per_year.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Password changed successfully!</span>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] max-w-md">
        <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Current Password', value: currentPassword, setter: setCurrentPassword, show: showCurrent, toggleShow: () => setShowCurrent(!showCurrent) },
            { label: 'New Password', value: newPassword, setter: setNewPassword, show: showNew, toggleShow: () => setShowNew(!showNew) },
            { label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword, show: showConfirm, toggleShow: () => setShowConfirm(!showConfirm) },
          ].map((field, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-[#111111] mb-1.5">{field.label}</label>
              <div className="relative">
                <input type={field.show ? 'text' : 'password'} value={field.value} onChange={e => field.setter(e.target.value)} required placeholder={`Enter ${field.label.toLowerCase()}`} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] pr-10" />
                <button type="button" onClick={field.toggleShow} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
          ))}
          <button type="submit" disabled={loading} className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
