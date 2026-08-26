import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Calendar, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

const prettyDate = (value?: string | null) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  : '';

export default function SchoolSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [form, setForm] = useState({
    school_closes_on: '',
    school_opens_on: '',
  });

  useEffect(() => {
    if (!user?.schoolId) return;
    const fetchSchoolInfo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseUntyped
          .from('schools')
          .select('id, name, school_closes_on, school_opens_on, next_term_start_date')
          .eq('id', user.schoolId)
          .single();
        if (error) throw error;
        const openingDate = data?.school_opens_on || data?.next_term_start_date || '';
        setSchoolInfo(data);
        setForm({
          school_closes_on: data?.school_closes_on || '',
          school_opens_on: openingDate,
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
    if ((form.school_closes_on && !form.school_opens_on) || (!form.school_closes_on && form.school_opens_on)) {
      toast.error('Enter both the school closing date and opening date, or clear both fields.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabaseUntyped
        .from('schools')
        .update({
          school_closes_on: form.school_closes_on || null,
          school_opens_on: form.school_opens_on || null,
          next_term_start_date: form.school_opens_on || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.schoolId);
      if (error) throw error;
      toast.success('School calendar dates saved successfully!');
      setSchoolInfo({ ...schoolInfo, school_closes_on: form.school_closes_on || null, school_opens_on: form.school_opens_on || null, next_term_start_date: form.school_opens_on || null });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error(err.message || 'Failed to save school settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">School Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage school-wide settings and the dates shown on report cards.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Calendar className="w-5 h-5 text-blue-600" /></div>
            <div><h2 className="text-lg font-semibold text-gray-900">School calendar dates</h2><p className="text-sm text-gray-500">These dates are displayed on learner and parent report cards.</p></div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div><p className="text-sm font-medium text-blue-800">Calendar display</p><p className="text-xs text-blue-600 mt-1">The report card will read: “School closes on [date] and opens on [date].” Set both dates together for a complete notice.</p></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School closes on</label>
              <input type="date" value={form.school_closes_on} onChange={(event) => setForm({ ...form, school_closes_on: event.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {form.school_closes_on && <div className="mt-2 flex items-center gap-2 text-sm text-green-600"><CheckCircle className="w-4 h-4" /><span>{prettyDate(form.school_closes_on)}</span></div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School opens on</label>
              <input type="date" value={form.school_opens_on} onChange={(event) => setForm({ ...form, school_opens_on: event.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {form.school_opens_on && <div className="mt-2 flex items-center gap-2 text-sm text-green-600"><CheckCircle className="w-4 h-4" /><span>{prettyDate(form.school_opens_on)}</span></div>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100"><button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving...' : 'Save Settings'}</button></div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" /><div><p className="text-sm font-medium text-green-800">How it works</p><p className="text-xs text-green-600 mt-1">Once both dates are saved, the same school closes/opens notice will appear on generated report-card PDFs for learners and parents.</p></div></div>
    </div>
  );
}
