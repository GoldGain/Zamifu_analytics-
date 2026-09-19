import { useState, useEffect, useCallback } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Loader2, BookOpen, Pencil, Trash2, X, Check, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

type CurriculumType = 'CBE';

const CATEGORIES = ['Languages', 'Mathematics', 'Sciences', 'Humanities', 'Technical', 'Creative', 'Life Skills'] as const;
type CategoryType = typeof CATEGORIES[number];

interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  curriculum: CurriculumType;
  category?: CategoryType | null;
  is_core?: boolean | null;
  created_at?: string | null;
}

// ─── Pre-populated Learning Areas by CBE level ─────────────────────────────

/** PRE-PRIMARY (PP1, PP2) */
const PRE_PRIMARY_LEARNING_AREAS: { name: string; category: CategoryType }[] = [
  { name: 'Mathematics Activities',        category: 'Mathematics' },
  { name: 'English language Activities',   category: 'Languages'   },
  { name: 'Environment Activities',        category: 'Sciences'    },
  { name: 'Creative Arts activities',      category: 'Creative'    },
  { name: 'Religious Studies Activities',  category: 'Humanities'  },
  { name: 'Kiswahili Activities',          category: 'Languages'   },
];

/** PRIMARY (Grades 1-6) */
const PRIMARY_LEARNING_AREAS: { name: string; category: CategoryType }[] = [
  { name: 'English',                       category: 'Languages'   },
  { name: 'English Composition',           category: 'Languages'   },
  { name: 'English Grammar',               category: 'Languages'   },
  { name: 'Kiswahili',                     category: 'Languages'   },
  { name: 'Kiswahili Insha',               category: 'Languages'   },
  { name: 'Kiswahili Sarufi',              category: 'Languages'   },
  { name: 'Mathematics',                   category: 'Mathematics' },
  { name: 'Science and Technology',        category: 'Sciences'    },
  { name: 'Social Studies',                category: 'Humanities'  },
  { name: 'CRE',                            category: 'Humanities'  },
  { name: 'IRE',                            category: 'Humanities'  },
  { name: 'Creative Arts',                 category: 'Creative'    },
  { name: 'Physical and Health Education', category: 'Creative'    },
  { name: 'Indigenous Languages',          category: 'Languages'   },
];

/** JUNIOR (Grades 7-9) */
const JUNIOR_LEARNING_AREAS: { name: string; category: CategoryType }[] = [
  { name: 'English',                       category: 'Languages'   },
  { name: 'Kiswahili',                     category: 'Languages'   },
  { name: 'Mathematics',                   category: 'Mathematics' },
  { name: 'Integrated Science',            category: 'Sciences'    },
  { name: 'Social Studies',                category: 'Humanities'  },
  { name: 'Pre-Technical Studies',         category: 'Technical'   },
  { name: 'Business Studies',              category: 'Humanities'  },
  { name: 'Agriculture',                   category: 'Sciences'    },
  { name: 'Creative Arts',                 category: 'Creative'    },
  { name: 'Physical Education',            category: 'Creative'    },
  { name: 'CRE',                            category: 'Humanities'  },
  { name: 'IRE',                            category: 'Humanities'  },
  { name: 'Community Service Learning',    category: 'Life Skills' },
];

/** SENIOR (Grades 10-12) */
const SENIOR_LEARNING_AREAS: { name: string; category: CategoryType }[] = [
  { name: 'English',                       category: 'Languages'   },
  { name: 'Kiswahili',                     category: 'Languages'   },
  { name: 'Mathematics',                   category: 'Mathematics' },
  { name: 'Biology',                       category: 'Sciences'    },
  { name: 'Chemistry',                     category: 'Sciences'    },
  { name: 'Physics',                       category: 'Sciences'    },
  { name: 'History',                       category: 'Humanities'  },
  { name: 'Geography',                     category: 'Humanities'  },
  { name: 'Business Studies',              category: 'Humanities'  },
  { name: 'Agriculture',                   category: 'Sciences'    },
  { name: 'Computer Studies',              category: 'Technical'   },
  { name: 'Home Science',                  category: 'Technical'   },
  { name: 'Physical Education',            category: 'Creative'    },
  { name: 'CRE',                            category: 'Humanities'  },
  { name: 'IRE',                            category: 'Humanities'  },
  { name: 'Community Service Learning',    category: 'Life Skills' },
];

// Combined CBE list (union of Primary + Junior + Senior, deduplicated by name)
const CBE_ALL_LEARNING_AREAS: { name: string; category: CategoryType; level: string }[] = [
  ...PRE_PRIMARY_LEARNING_AREAS.map(s => ({ ...s, level: 'Pre-Primary (PP1–PP2)' })),
  ...PRIMARY_LEARNING_AREAS
    .filter(s => !PRE_PRIMARY_LEARNING_AREAS.find(p => p.name === s.name))
    .map(s => ({ ...s, level: 'Primary (Gr 1–6)' })),
  ...JUNIOR_LEARNING_AREAS
    .filter(s => !PRE_PRIMARY_LEARNING_AREAS.find(p => p.name === s.name) && !PRIMARY_LEARNING_AREAS.find(p => p.name === s.name))
    .map(s => ({ ...s, level: 'Junior (Gr 7–9)' })),
  ...SENIOR_LEARNING_AREAS
    .filter(s => !PRE_PRIMARY_LEARNING_AREAS.find(p => p.name === s.name) && !PRIMARY_LEARNING_AREAS.find(p => p.name === s.name) && !JUNIOR_LEARNING_AREAS.find(j => j.name === s.name))
    .map(s => ({ ...s, level: 'Senior (Gr 10–12)' })),
];

const emptyForm = {
  name: '',
  code: '',
  curriculum: 'CBE' as CurriculumType,
  category: '' as CategoryType | '',
};

export default function SchoolAdminSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [bulkAdding, setBulkAdding] = useState(false);

  // Quick-add from pre-populated list
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Subject | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabaseUntyped
      .from('subjects')
      .select('*')
      .eq('school_id', user?.schoolId)
      .order('name');
    if (!error) setSubjects(data || []);
    setLoading(false);
  }, [user?.schoolId]);

  useEffect(() => {
    if (user?.schoolId) fetchSubjects();
  }, [user?.schoolId, fetchSubjects]);

  // Get pre-populated list for selected curriculum
  const getPresetList = () => CBE_ALL_LEARNING_AREAS;

  // Get subjects not yet added
  const getAvailablePresets = () => {
    const existing = subjects.map(s => s.name.toLowerCase());
    return getPresetList().filter(
      p => !existing.includes(p.name.toLowerCase())
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Learning area name is required'); return; }
    setAdding(true);
    const { error } = await supabaseUntyped.from('subjects').insert([{
      school_id: user?.schoolId,
      name: formData.name.trim(),
      code: formData.code.trim() || null,
      curriculum: formData.curriculum,
      category: formData.category || null,
      class_levels: [],
    }]);
    if (error) {
      toast.error('Failed to add learning area: ' + error.message);
    } else {
      toast.success(`Learning area "${formData.name}" added successfully!`);
      setFormData(emptyForm);
      setShowAdd(false);
      fetchSubjects();
    }
    setAdding(false);
  };

  const handleQuickAdd = async () => {
    if (!selectedPreset) { toast.error('Select a learning area from the list'); return; }
    const [curriculum, name] = selectedPreset.split('::');
    const preset = getPresetList().find(p => p.name === name);
    if (!preset) return;

    setAdding(true);
    const { error } = await supabaseUntyped.from('subjects').insert([{
      school_id: user?.schoolId,
      name: preset.name,
      code: null,
      curriculum: curriculum as CurriculumType,
      category: preset.category,
      class_levels: [],
    }]);
    if (error) {
      toast.error('Failed to add learning area: ' + error.message);
    } else {
      toast.success(`"${preset.name}" added!`);
      setSelectedPreset('');
      fetchSubjects();
    }
    setAdding(false);
  };

  const handleBulkAdd = async () => {
    const available = getAvailablePresets();
    if (available.length === 0) {
      toast.info('All CBE learning areas already added!');
      return;
    }
    setBulkAdding(true);
    const rows = available.map(p => ({
      school_id: user?.schoolId,
      name: p.name,
      code: null,
      curriculum: 'CBE' as CurriculumType,
      category: p.category,
      class_levels: [],
    }));
    const { error } = await supabaseUntyped.from('subjects').insert(rows);
    if (error) {
      toast.error('Failed to bulk add learning areas: ' + error.message);
    } else {
      toast.success(`Added ${available.length} CBE learning areas!`);
      fetchSubjects();
    }
    setBulkAdding(false);
  };

  const startEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setEditForm({
      name: subject.name,
      code: subject.code || '',
      curriculum: subject.curriculum,
      category: (subject.category as CategoryType) || '',
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name.trim()) { toast.error('Learning area name is required'); return; }
    setSaving(true);
    const { error } = await supabaseUntyped.from('subjects').update({
      name: editForm.name.trim(),
      code: editForm.code.trim() || null,
      curriculum: editForm.curriculum,
      category: editForm.category || null,
    }).eq('id', id);
    if (error) {
      toast.error('Failed to update learning area: ' + error.message);
    } else {
      toast.success('Learning area updated successfully!');
      setEditingId(null);
      fetchSubjects();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    const { error } = await supabaseUntyped.from('subjects').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete learning area: ' + error.message);
    } else {
      toast.success(`Learning area "${name}" deleted.`);
      fetchSubjects();
    }
    setDeletingId(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    await handleDelete(deleteConfirm.id, deleteConfirm.name);
    setDeleteLoading(false);
    setDeleteConfirm(null);
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Learning Areas</h1>
          <p className="text-sm text-[#666666]">{subjects.length} learning area{subjects.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Learning Area Manually
        </button>
      </div>

      {/* Quick-Add from Pre-populated List */}
      <div className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-[#111111]">Quick Add from Standard Learning Areas</h3>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          All official CBE learning areas are listed below — Primary (PP1–Gr 6), Junior (Gr 7–9), and Senior (Gr 10–12).
          Community Service Learning (CSL) is included for all CBE levels.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            value={selectedPreset}
            onChange={e => setSelectedPreset(e.target.value)}
            className={`flex-1 ${inputClass}`}
          >
            <option value="">— Select a learning area to add —</option>
            <optgroup label="Pre-Primary Learning Areas (PP1–PP2)">
              {getAvailablePresets()
                .filter(p => PRE_PRIMARY_LEARNING_AREAS.find(s => s.name === p.name))
                .map(p => (
                  <option key={`CBE::${p.name}`} value={`CBE::${p.name}`}>{p.name}</option>
                ))}
            </optgroup>
            <optgroup label="Primary Learning Areas (Gr 1–6)">
              {getAvailablePresets()
                .filter(p => PRIMARY_LEARNING_AREAS.find(s => s.name === p.name) && !PRE_PRIMARY_LEARNING_AREAS.find(s => s.name === p.name))
                .map(p => (
                  <option key={`CBE::${p.name}`} value={`CBE::${p.name}`}>{p.name}</option>
                ))}
            </optgroup>
            <optgroup label="Junior Learning Areas (Gr 7–9)">
              {getAvailablePresets()
                .filter(p => JUNIOR_LEARNING_AREAS.find(s => s.name === p.name) && !PRIMARY_LEARNING_AREAS.find(s => s.name === p.name))
                .map(p => (
                  <option key={`CBE::${p.name}`} value={`CBE::${p.name}`}>{p.name}</option>
                ))}
            </optgroup>
            <optgroup label="Senior Learning Areas (Gr 10–12)">
              {getAvailablePresets()
                .filter(p => SENIOR_LEARNING_AREAS.find(s => s.name === p.name) && !PRIMARY_LEARNING_AREAS.find(s => s.name === p.name) && !JUNIOR_LEARNING_AREAS.find(s => s.name === p.name))
                .map(p => (
                  <option key={`CBE::${p.name}`} value={`CBE::${p.name}`}>{p.name}</option>
                ))}
            </optgroup>
          </select>
          <button
            onClick={handleQuickAdd}
            disabled={adding || !selectedPreset}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Selected
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleBulkAdd()}
            disabled={bulkAdding}
            className="flex items-center gap-2 border border-blue-200 text-blue-700 bg-blue-50 px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
          >
            {bulkAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Add All CBE Learning Areas ({getAvailablePresets().length} remaining)
          </button>
        </div>
      </div>

      {/* Add Learning Area Form (manual / custom) */}
      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="text-lg font-semibold mb-1 text-[#111111]">Add Custom Learning Area Manually</h3>
          <p className="text-xs text-gray-500 mb-4">Use this to add learning areas not in the standard list (e.g. French, Sign Language, Music).</p>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Learning Area Name *</label>
              <input
                placeholder="e.g. French"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Code</label>
              <input
                placeholder="e.g. FRE101"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as CategoryType | '' })}
                className={inputClass}
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="flex gap-3 md:col-span-2 lg:col-span-4">
              <button
                type="submit"
                disabled={adding}
                className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {adding ? 'Adding...' : 'Add Learning Area'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setFormData(emptyForm); }}
                className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Learning Areas Table */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[#666666]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2563EB]" />
          Loading learning areas...
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-[#666666] font-medium">No learning areas added yet</p>
          <p className="text-sm text-gray-400 mt-1">Use the quick-add panel above to add standard CBE learning areas, or click &quot;Add Learning Area Manually&quot;.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#2563EB]" />
            <h3 className="font-semibold text-[#111111]">
              CBE Learning Areas ({subjects.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Learning Area</th>
                  <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Code</th>
                  <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Category</th>
                  <th className="text-right text-xs font-medium text-[#666666] uppercase py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(subject => (
                  <tr key={subject.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {editingId === subject.id ? (
                      <>
                        <td className="py-2 px-3">
                          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
                        </td>
                        <td className="py-2 px-3">
                          <input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className={inputClass} placeholder="Code" />
                        </td>
                        <td className="py-2 px-3">
                          <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value as CategoryType | '' })} className={inputClass}>
                            <option value="">Category</option>
                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleSaveEdit(subject.id)} disabled={saving} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 font-medium text-[#111111]">{subject.name}</td>
                        <td className="py-2 px-3 text-[#666666]">{subject.code || '—'}</td>
                        <td className="py-2 px-3">
                          {subject.category ? (
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{subject.category}</span>
                          ) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => startEdit(subject)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm(subject)} disabled={deletingId === subject.id} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50">
                              {deletingId === subject.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Delete Learning Area</h2>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteConfirmed} disabled={deleteLoading} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
