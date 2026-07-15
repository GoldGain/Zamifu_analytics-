import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, Edit2, CheckCircle, XCircle, Calendar, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Exam {
  id: string;
  name: string;
  type: string;
  term_id: string | null;
  start_date: string | null;
  end_date: string | null;
  weightage: number | null;
  is_active: boolean;
  created_at: string;
  terms?: { name: string } | null;
}

interface Term {
  id: string;
  name: string;
  academic_year: string;
}

const EXAM_TYPES = [
  'Opener',
  'Mid Term',
  'End Term',
  'CAT',
  'Mock',
  'Pre-Mock',
  'Trial Exam',
  'Holiday Assignment',
  'Weekly Assessment',
  'Revision Test',
  // Issue 5: Added Formative and Summative assessment types
  'Formative Assessment',
  'Summative Assessment',
  'Custom',
];

const defaultForm = {
  name: '',
  type: 'Custom',
  term_id: '',
  start_date: '',
  end_date: '',
  weightage: '',
};

export default function Assessments() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.schoolId) {
      fetchData();
    }
  }, [user?.schoolId, user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: termsData } = await (supabase as any)
        .from('terms')
        .select('id, name, academic_year')
        .eq('school_id', user?.schoolId)
        .order('academic_year', { ascending: false });
      setTerms(termsData || []);

      // Prefer embedded term name; fall back if PostgREST relationship is missing
      let examsData: any[] | null = null;
      const embedded = await (supabase as any)
        .from('school_exams')
        .select('*, terms(name)')
        .eq('school_id', user?.schoolId)
        .order('created_at', { ascending: false });
      if (embedded.error) {
        const plain = await (supabase as any)
          .from('school_exams')
          .select('*')
          .eq('school_id', user?.schoolId)
          .order('created_at', { ascending: false });
        if (plain.error) throw plain.error;
        const termMap = Object.fromEntries((termsData || []).map((t: any) => [t.id, t.name]));
        examsData = (plain.data || []).map((e: any) => ({
          ...e,
          terms: e.term_id ? { name: termMap[e.term_id] || '' } : null,
        }));
      } else {
        examsData = embedded.data || [];
      }
      setExams(examsData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingExam(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (exam: Exam) => {
    setEditingExam(exam);
    setForm({
      name: exam.name,
      type: exam.type || 'Custom',
      term_id: exam.term_id || '',
      start_date: exam.start_date || '',
      end_date: exam.end_date || '',
      weightage: exam.weightage != null ? String(exam.weightage) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Assessment name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        school_id: user?.schoolId,
        name: form.name.trim(),
        type: form.type,
        term_id: form.term_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        weightage: form.weightage ? parseFloat(form.weightage) : null,
        is_active: true,
        created_by: user?.id,
      };

      if (editingExam) {
        const { data: updatedData, error } = await (supabase as any)
          .from('school_exams')
          .update(payload)
          .eq('id', editingExam.id)
          .select('*, terms(name)');
        if (error) throw error;
        // Optimistic update
        if (updatedData && updatedData.length > 0) {
          setExams(prev => prev.map(e => e.id === editingExam.id ? updatedData[0] : e));
        }
        toast.success('Assessment updated successfully');
      } else {
        const { data: newData, error } = await (supabase as any)
          .from('school_exams')
          .insert(payload)
          .select('*, terms(name)');
        if (error) throw error;
        // Optimistic update — add to list immediately
        if (newData && newData.length > 0) {
          setExams(prev => [newData[0], ...prev]);
        }
        toast.success('Assessment created successfully');
      }
      setShowModal(false);
      // Also refresh from DB to ensure consistency
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assessment? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const { error } = await (supabase as any)
        .from('school_exams')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Assessment deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete assessment');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (exam: Exam) => {
    try {
      const { error } = await (supabase as any)
        .from('school_exams')
        .update({ is_active: !exam.is_active })
        .eq('id', exam.id);
      if (error) throw error;
      toast.success(`Assessment ${exam.is_active ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update assessment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage any assessment with any name</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Assessment
        </button>
      </div>

      {/* Examples hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">You can create ANY assessment with ANY name</p>
            <p className="text-xs text-blue-600 mt-1">
              Examples: "Form 4 National Trial Exam", "CAT 1", "Holiday Assignment Test", "Weekly Assessment 3", "Mock Exams", "Pre-Mock", "Revision Tests", "End of Year Assessment"
            </p>
          </div>
        </div>
      </div>

      {/* Assessments list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No assessments yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "Create Assessment" to add your first one</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className={`bg-white rounded-2xl border p-5 flex items-center justify-between gap-4 ${
                exam.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  exam.is_active ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <BookOpen className={`w-5 h-5 ${exam.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{exam.name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{exam.type}</span>
                    {exam.is_active ? (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                    {exam.terms?.name && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {exam.terms.name}
                      </span>
                    )}
                    {exam.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {exam.start_date}
                        {exam.end_date && ` – ${exam.end_date}`}
                      </span>
                    )}
                    {exam.weightage != null && (
                      <span>Weight: {exam.weightage}%</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(exam)}
                  title={exam.is_active ? 'Deactivate' : 'Activate'}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {exam.is_active ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => openEdit(exam)}
                  className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(exam.id)}
                  disabled={deletingId === exam.id}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                >
                  {deletingId === exam.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingExam ? 'Edit Assessment' : 'Create New Assessment'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Give this assessment any name you want
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Form 4 National Trial Exam, CAT 1, Mock Exams..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Term */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term (optional)</label>
                <select
                  value={form.term_id}
                  onChange={(e) => setForm({ ...form, term_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No specific term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Weightage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weightage % (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.weightage}
                  onChange={(e) => setForm({ ...form, weightage: e.target.value })}
                  placeholder="e.g. 30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingExam ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
