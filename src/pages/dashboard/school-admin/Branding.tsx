import { useState, useEffect, useRef } from 'react';
import { supabaseUntyped } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Save, Palette, School, Bell, Signature, Upload, Link, X, Image } from 'lucide-react';
import { toast } from 'sonner';
import { subscribeToPush } from '@/hooks/usePWA';
import DigitalSignature from '@/components/DigitalSignature';

export default function SchoolBranding() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'signatures'>('branding');
  const [logoInputMode, setLogoInputMode] = useState<'url' | 'upload'>('url');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    motto: '',
    primary_color: '#2563EB',
    secondary_color: '#1d4ed8',
    logo_url: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    principal_name: '',
    next_term_start_date: '',
  });
  // Signature states
  const [principalSig, setPrincipalSig] = useState<{ url: string | null; type: string | null }>({ url: null, type: null });
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherSigs, setTeacherSigs] = useState<Record<string, { url: string | null; type: string | null }>>({});

  useEffect(() => { fetchSchool(); checkNotifPermission(); }, []);

  const checkNotifPermission = () => {
    if ('Notification' in window) {
      setNotifEnabled(Notification.permission === 'granted');
    }
  };

  const fetchSchool = async () => {
    setLoading(true);
    let data: any = null;
    try {
      const { data: schoolData, error } = await supabaseUntyped
        .from('schools')
        .select('id, name, motto, primary_color, secondary_color, logo_url, address, phone, email, website, principal_name, next_term_start_date, principal_signature_url, principal_signature_type')
        .eq('id', user?.schoolId)
        .single();
      if (error) throw error;
      data = schoolData;
    } catch (err: any) {
      // If motto column doesn't exist, fetch without it
      if (err.message?.includes('motto')) {
        const { data: schoolData } = await supabaseUntyped
          .from('schools')
          .select('id, name, primary_color, secondary_color, logo_url, address, phone, email, website, principal_name, principal_signature_url, principal_signature_type')
          .eq('id', user?.schoolId)
          .single();
        data = schoolData;
      }
    }
    if (data) {
      setForm({
        name: data.name || '',
        motto: data.motto || '',
        primary_color: data.primary_color || '#2563EB',
        secondary_color: data.secondary_color || '#1d4ed8',
        logo_url: data.logo_url || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        principal_name: data.principal_name || '',
        next_term_start_date: data.next_term_start_date || '',
      });
      setPrincipalSig({
        url: data.principal_signature_url || null,
        type: data.principal_signature_type || null,
      });
    }
    // Fetch class teachers (is_class_teacher = true) only
    const { data: teachersData } = await supabaseUntyped
      .from('teachers')
      .select('id, first_name, last_name, signature_url, signature_type, is_class_teacher')
      .eq('school_id', user?.schoolId)
      .eq('is_active', true)
      .eq('is_class_teacher', true)
      .order('first_name');
    if (teachersData) {
      setTeachers(teachersData);
      const sigs: Record<string, { url: string | null; type: string | null }> = {};
      teachersData.forEach((t: any) => {
        sigs[t.id] = { url: t.signature_url || null, type: t.signature_type || null };
      });
      setTeacherSigs(sigs);
    }
    setLoading(false);
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Max 5MB.'); return; }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) { toast.error('Only PNG, JPG, SVG, WEBP files are allowed.'); return; }

    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `logos/${user?.schoolId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;

      // Save to DB immediately
      const { error: dbError } = await supabaseUntyped
        .from('schools')
        .update({ logo_url: publicUrl })
        .eq('id', user?.schoolId);
      if (dbError) throw new Error(dbError.message);

      setForm(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('School logo uploaded and saved!');
    } catch (err: any) {
      toast.error('Logo upload failed: ' + err.message);
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Try to save with motto first, fallback without motto if column doesn't exist
      let error: any = null;
      try {
        const result = await supabaseUntyped
          .from('schools')
          .update({
            motto: form.motto,
            primary_color: form.primary_color,
            secondary_color: form.secondary_color,
            logo_url: form.logo_url,
            address: form.address,
            phone: form.phone,
            email: form.email,
            website: form.website,
            principal_name: form.principal_name,
            next_term_start_date: form.next_term_start_date || null,
          })
          .eq('id', user?.schoolId);
        error = result.error;
      } catch (err: any) {
        if (err.message?.includes('motto') || err.message?.includes('schema cache')) {
          // Retry without motto
          const result = await supabaseUntyped
            .from('schools')
            .update({
              primary_color: form.primary_color,
              secondary_color: form.secondary_color,
              logo_url: form.logo_url,
              address: form.address,
              phone: form.phone,
              email: form.email,
              website: form.website,
              principal_name: form.principal_name,
              next_term_start_date: form.next_term_start_date || null,
            })
            .eq('id', user?.schoolId);
          error = result.error;
        } else {
          throw err;
        }
      }
      if (error) throw error;
      toast.success('School branding saved!');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const savePrincipalSignature = async (signatureUrl: string, signatureType: 'drawn' | 'uploaded') => {
    const { error } = await supabaseUntyped
      .from('schools')
      .update({
        principal_signature_url: signatureUrl,
        principal_signature_type: signatureType,
      })
      .eq('id', user?.schoolId);
    if (error) throw error;
    setPrincipalSig({ url: signatureUrl, type: signatureType });
  };

  const clearPrincipalSignature = async () => {
    const { error } = await supabaseUntyped
      .from('schools')
      .update({
        principal_signature_url: null,
        principal_signature_type: null,
      })
      .eq('id', user?.schoolId);
    if (error) throw error;
    setPrincipalSig({ url: null, type: null });
  };

  const saveTeacherSignature = async (teacherId: string, signatureUrl: string, signatureType: 'drawn' | 'uploaded') => {
    const { error } = await supabaseUntyped
      .from('teachers')
      .update({
        signature_url: signatureUrl,
        signature_type: signatureType,
      })
      .eq('id', teacherId)
      .eq('school_id', user?.schoolId);
    if (error) throw error;
    setTeacherSigs(prev => ({
      ...prev,
      [teacherId]: { url: signatureUrl, type: signatureType },
    }));
  };

  const clearTeacherSignature = async (teacherId: string) => {
    const { error } = await supabaseUntyped
      .from('teachers')
      .update({
        signature_url: null,
        signature_type: null,
      })
      .eq('id', teacherId)
      .eq('school_id', user?.schoolId);
    if (error) throw error;
    setTeacherSigs(prev => ({
      ...prev,
      [teacherId]: { url: null, type: null },
    }));
  };

  const enableNotifications = async () => {
    setNotifLoading(true);
    try {
      const success = await subscribeToPush(user?.id || '', supabaseUntyped);
      if (success) {
        setNotifEnabled(true);
        toast.success('Push notifications enabled!');
      } else {
        toast.error('Could not enable notifications. Please check browser permissions.');
      }
    } catch (err) {
      toast.error('Notification setup failed');
    }
    setNotifLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">School Settings & Branding</h1>
        <p className="text-sm text-[#666666]">Customise your school's appearance, signatures and notification settings</p>
      </div>

      {/* Push Notifications */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-500" />
          Push Notifications
        </h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-[#111111]">Browser Push Notifications</p>
            <p className="text-xs text-[#666666]">Receive instant alerts for new results, fees, and announcements</p>
          </div>
          {notifEnabled ? (
            <span className="text-xs font-medium text-green-600 bg-green-100 px-3 py-1.5 rounded-full">Enabled</span>
          ) : (
            <button
              onClick={enableNotifications}
              disabled={notifLoading}
              className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {notifLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('branding')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'branding' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Palette className="w-4 h-4" /> Branding</span>
        </button>
        <button
          onClick={() => setActiveTab('signatures')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'signatures' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Signature className="w-4 h-4" /> Digital Signatures</span>
        </button>
      </div>

      {activeTab === 'branding' && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-500" />
            School Branding
          </h3>

          {/* Color Preview */}
          <div className="mb-6 p-4 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 mb-3">Brand Preview</p>
            <div className="flex gap-3 items-center">
              {form.logo_url ? (
                <img src={form.logo_url} alt="School Logo" className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-white" />
              ) : (
                <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: form.primary_color }}>
                  {form.name?.[0] || 'S'}
                </div>
              )}
              <div>
                <p className="font-bold text-sm" style={{ color: form.primary_color }}>{form.name || 'School Name'}</p>
                <p className="text-xs text-gray-500 italic">{form.motto || 'School motto'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">School Name</label>
              <input value={form.name} disabled className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">School Motto</label>
              <input value={form.motto} onChange={e => setForm({ ...form, motto: e.target.value })} placeholder="e.g. Excellence in Education" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Primary Colour</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                <input value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Secondary Colour</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                <input value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              </div>
            </div>

            {/* School Logo — dual mode: Upload File OR URL */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-2">School Logo</label>
              {/* Mode toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setLogoInputMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${logoInputMode === 'upload' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Image File
                </button>
                <button
                  type="button"
                  onClick={() => setLogoInputMode('url')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${logoInputMode === 'url' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  <Link className="w-3.5 h-3.5" /> Enter URL
                </button>
              </div>

              {logoInputMode === 'upload' ? (
                <div className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                  {form.logo_url ? (
                    <div className="relative">
                      <img src={form.logo_url} alt="Logo preview" className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-white" />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                      <Image className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => logoFileRef.current?.click()}
                      disabled={logoUploading}
                      className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
                    >
                      {logoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {logoUploading ? 'Uploading...' : 'Choose Logo File'}
                    </button>
                    <p className="text-xs text-gray-400 mt-1.5">PNG, JPG, SVG, WEBP — max 5MB</p>
                    <p className="text-xs text-gray-400">Logo appears on all report cards and portal headers</p>
                  </div>
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                </div>
              ) : (
                <div>
                  <input
                    value={form.logo_url}
                    onChange={e => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                  <p className="text-xs text-gray-400 mt-1">Logo appears on all PDF report cards and portal headers</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Principal Name</label>
              <input value={form.principal_name} onChange={e => setForm({ ...form, principal_name: e.target.value })} placeholder="Principal's full name" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="School physical address" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Website</label>
              <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://yourschool.ac.ke" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Next Term Start Date</label>
              <input type="date" value={form.next_term_start_date} onChange={e => setForm({ ...form, next_term_start_date: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              <p className="text-xs text-gray-400 mt-1">This date will be displayed on all report cards</p>
            </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="mt-6 flex items-center gap-2 bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}

      {activeTab === 'signatures' && (
        <div className="space-y-6">
          {/* Principal Signature */}
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
              <Signature className="w-5 h-5 text-blue-600" />
              Principal / Headteacher Signature
            </h3>
            <p className="text-xs text-[#666666] mb-4">
              This signature will appear on all student report cards as the Principal's approval.
            </p>
            <DigitalSignature
              title="Principal Signature"
              subtitle="Appears on all student report cards"
              existingSignatureUrl={principalSig.url}
              existingSignatureType={principalSig.type}
              onSave={savePrincipalSignature}
              onClear={clearPrincipalSignature}
            />
          </div>

          {/* Teacher Signatures */}
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
              <Signature className="w-5 h-5 text-green-600" />
              Class Teacher Signatures
            </h3>
            <p className="text-xs text-[#666666] mb-4">
              Each class teacher's signature will appear on their students' report cards.
            </p>
            {teachers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No active teachers found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teachers.map((teacher: any) => (
                  <div key={teacher.id} className="border border-gray-100 rounded-xl p-4">
                    <p className="font-medium text-sm text-[#111111] mb-3">{teacher.first_name} {teacher.last_name}</p>
                    <DigitalSignature
                      title={`${teacher.first_name}'s Signature`}
                      subtitle="Appears on their students' report cards"
                      existingSignatureUrl={teacherSigs[teacher.id]?.url || null}
                      existingSignatureType={teacherSigs[teacher.id]?.type || null}
                      onSave={(url, type) => saveTeacherSignature(teacher.id, url, type)}
                      onClear={() => clearTeacherSignature(teacher.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
