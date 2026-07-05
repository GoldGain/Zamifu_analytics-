import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import PhotoUpload from '@/components/PhotoUpload';
import DigitalSignature from '@/components/DigitalSignature';

export default function TeacherProfile() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '' });
  // Issue 9: Signature state
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<string | null>(null);

  useEffect(() => { fetchProfile(); }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: profileData } = await supabaseUntyped
      .from('profiles')
      .select('first_name, last_name, email, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (profileData) {
      setProfile({ first_name: profileData.first_name || '', last_name: profileData.last_name || '', email: profileData.email || '' });
      setAvatarUrl(profileData.avatar_url || null);
    }
    // Issue 9: Fetch teacher record including signature
    const { data: teacherData } = await supabaseUntyped
      .from('teachers')
      .select('id, signature_url, signature_type')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (teacherData) {
      setTeacherId(teacherData.id);
      setSignatureUrl(teacherData.signature_url || null);
      setSignatureType(teacherData.signature_type || null);
    }
    setLoading(false);
  };

  const handlePhotoSuccess = async (url: string) => {
    setAvatarUrl(url);
    await supabaseUntyped.from('profiles').update({ avatar_url: url }).eq('id', user?.id);
    await refreshProfile();
    toast.success('Profile photo updated!');
  };

  // Issue 9: Save teacher signature
  const handleSaveSignature = async (sigUrl: string, sigType: 'drawn' | 'uploaded') => {
    if (!teacherId) {
      toast.error('Teacher record not found');
      return;
    }
    const { error } = await supabaseUntyped
      .from('teachers')
      .update({ signature_url: sigUrl, signature_type: sigType })
      .eq('id', teacherId);
    if (error) {
      toast.error('Failed to save signature: ' + error.message);
      return;
    }
    setSignatureUrl(sigUrl);
    setSignatureType(sigType);
    toast.success('Signature saved successfully!');
  };

  // Issue 9: Clear teacher signature
  const handleClearSignature = async () => {
    if (!teacherId) return;
    const { error } = await supabaseUntyped
      .from('teachers')
      .update({ signature_url: null, signature_type: null })
      .eq('id', teacherId);
    if (error) {
      toast.error('Failed to clear signature: ' + error.message);
      return;
    }
    setSignatureUrl(null);
    setSignatureType(null);
    toast.success('Signature cleared');
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Profile</h1>
        <p className="text-sm text-[#666666]">Manage your profile photo, signature and personal information</p>
      </div>

      {/* Profile Photo */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[#111111]">Profile Photo</h3>
            <p className="text-xs text-[#666666]">Upload or capture your photo. Appears on dashboards and report cards.</p>
          </div>
        </div>

        <div className="flex flex-col items-center py-4">
          <PhotoUpload
            currentPhotoUrl={avatarUrl}
            bucket="avatars"
            folder="teachers"
            entityId={user?.id || ''}
            onSuccess={handlePhotoSuccess}
            label="Profile Photo"
            size="lg"
          />
          <p className="text-xs text-gray-400 mt-3">Max 5MB · JPG, PNG, or WebP</p>
        </div>
      </div>

      {/* Issue 9: Teacher Signature Section */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <PenLine className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[#111111]">My Signature</h3>
            <p className="text-xs text-[#666666]">Draw or upload your signature. It will appear on report cards you generate.</p>
          </div>
        </div>

        {teacherId ? (
          <DigitalSignature
            title="Teacher Signature"
            subtitle="Your signature appears on report cards"
            existingSignatureUrl={signatureUrl}
            existingSignatureType={signatureType}
            onSave={handleSaveSignature}
            onClear={handleClearSignature}
          />
        ) : (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
            Teacher profile not found. Please contact your administrator.
          </div>
        )}
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4">Account Information</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-500 w-28">Name</span>
            <span className="text-sm font-medium text-[#111111]">{profile.first_name} {profile.last_name}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-500 w-28">Email</span>
            <span className="text-sm font-medium text-[#111111]">{profile.email}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-500 w-28">Role</span>
            <span className="text-sm font-medium text-blue-600 capitalize">Teacher</span>
          </div>
        </div>
      </div>
    </div>
  );
}
