import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Calendar, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

export default function SchoolSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [form, setForm] = useState({
    next_term_start_date: '',
  });

  useEffect(() => {
    if (!user?.schoolId) return;
    const fetchSchoolInfo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseUntyped
          .from('schools')
          .select('id, name, next_term_start_date')
          .eq('id', user.schoolId)
          .single();
        
        if (error) throw error;
        
        setSchoolInfo(data);
        setForm({
          next_term_start_date: data?.next_term_start_date || '',
        });
      } catch (err: any) {
        console.error('Error fetching school info:', err);
        toast.error('Failed to load school settings');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSchoolInfo();
  }, [user?.schoolId]);

  const handleSave = async () => {
    if (!user?.schoolId) return;
    
    if (!form.next_term_start_date) {
      toast.error('Please select a next term start date');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabaseUntyped
        .from('schools')
        .update({
          next_term_start_date: form.next_term_start_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.schoolId);
      
      if (error) throw error;
      
      toast.success('School settings saved successfully!');
      setSchoolInfo({ ...schoolInfo, next_term_start_date: form.next_term_start_date });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error(err.message || 'Failed to save school settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">School Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage school-wide settings and configurations</p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
        {/* Next Term Start Date Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Next Term Start Date</h2>
              <p className="text-sm text-gray-500">This date will be displayed on all report cards</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Important</p>
                <p className="text-xs text-blue-600 mt-1">
                  Setting the next term start date will automatically display it on all student, parent, and teacher report cards as "Next term will start on: [date]"
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Next Term Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.next_term_start_date}
              onChange={(e) => setForm({ ...form, next_term_start_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {form.next_term_start_date && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>Date set to: {new Date(form.next_term_start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">How it works</p>
            <p className="text-xs text-green-600 mt-1">
              Once you set the next term start date, it will automatically appear on all report cards generated for students, parents, and teachers. This helps everyone know when the next term begins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
