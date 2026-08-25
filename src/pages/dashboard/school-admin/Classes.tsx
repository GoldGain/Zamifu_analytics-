import { useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClasses } from '@/hooks/useSupabaseData';
import { Plus, Loader2, School, Search, ArrowRight, Users, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

type CurriculumType = 'CBE' | '';

interface StandardClass {
  name: string;
  grade_level: number;
  curriculum: CurriculumType;
  label: string;
}

const STANDARD_CLASSES: StandardClass[] = [
  { name: 'Playgroup', grade_level: -3, curriculum: 'CBE', label: 'Playgroup — Pre-Primary CBE' },
  { name: 'PP1',      grade_level: -2, curriculum: 'CBE', label: 'PP1      — Pre-Primary CBE' },
  { name: 'PP2',      grade_level: -1, curriculum: 'CBE', label: 'PP2      — Pre-Primary CBE' },
  { name: 'Grade 1',  grade_level: 1,  curriculum: 'CBE', label: 'Grade 1  — Primary CBE'  },
  { name: 'Grade 2',  grade_level: 2,  curriculum: 'CBE', label: 'Grade 2  — Primary CBE'  },
  { name: 'Grade 3',  grade_level: 3,  curriculum: 'CBE', label: 'Grade 3  — Primary CBE'  },
  { name: 'Grade 4',  grade_level: 4,  curriculum: 'CBE', label: 'Grade 4  — Primary CBE'  },
  { name: 'Grade 5',  grade_level: 5,  curriculum: 'CBE', label: 'Grade 5  — Primary CBE'  },
  { name: 'Grade 6',  grade_level: 6,  curriculum: 'CBE', label: 'Grade 6  — Primary CBE'  },
  { name: 'Grade 7',  grade_level: 7,  curriculum: 'CBE', label: 'Grade 7  — Junior CBE'   },
  { name: 'Grade 8',  grade_level: 8,  curriculum: 'CBE', label: 'Grade 8  — Junior CBE'   },
  { name: 'Grade 9',  grade_level: 9,  curriculum: 'CBE', label: 'Grade 9  — Junior CBE'   },
  { name: 'Grade 10', grade_level: 10, curriculum: 'CBE', label: 'Grade 10 — Senior CBE'   },
  { name: 'Grade 11', grade_level: 11, curriculum: 'CBE', label: 'Grade 11 — Senior CBE'   },
  { name: 'Grade 12', grade_level: 12, curriculum: 'CBE', label: 'Grade 12 — Senior CBE'   },
  { name: 'Form 3',   grade_level: 11, curriculum: '', label: 'Form 3   — '        },
  { name: 'Form 4',   grade_level: 12, curriculum: '', label: 'Form 4   — '        },
];

const CURRICULUM_OPTIONS: { value: CurriculumType; label: string }[] = [
  { value: 'CBE', label: 'CBE (Competency Based)' },
  { value: '', label: ' (Traditional)' },
];

export default function SchoolAdminClasses() {
  const { user } = useAuth();
  const { classes, loading, refetch } = useClasses(user?.schoolId || undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCurriculum, setFilterCurriculum] = useState<CurriculumType | ''>('');

  const [selectedPreset, setSelectedPreset] = useState('');
  const [stream, setStream] = useState('');
  const [capacity, setCapacity] = useState(60);

  // Edit state
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', stream: '', capacity: 60, curriculum: 'CBE' as CurriculumType });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingClass, setDeletingClass] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPreset) { toast.error('Please select a class from the list'); return; }
    const preset = STANDARD_CLASSES.find(c => c.name === selectedPreset);
    if (!preset) { toast.error('Invalid class selection'); return; }
    setAdding(true);
    try {
      const { error } = await supabaseUntyped.from('classes').insert([{
        name: preset.name,
        level: preset.grade_level,
        grade_level: preset.grade_level,
        curriculum: preset.curriculum,
        stream: stream.trim() || null,
        capacity: capacity || 60,
        school_id: user?.schoolId,
        is_active: true,
      }]);
      if (error) throw new Error(error.message);
      const displayName = stream.trim() ? `${preset.name} (${stream.trim()})` : preset.name;
      toast.success(`Class "${displayName}" added successfully!`);
      setShowAdd(false);
      setSelectedPreset('');
      setStream('');
      setCapacity(60);
      refetch();
    } catch (err: any) {
      toast.error('Failed to add class: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (c: any) => {
    setEditingClass(c);
    setEditForm({
      name: c.name || '',
      stream: c.stream || '',
      capacity: c.capacity || 60,
      curriculum: (c.curriculum || 'CBE') as CurriculumType,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setSaving(true);
    try {
      const { error } = await supabaseUntyped.from('classes').update({
        name: editForm.name.trim(),
        stream: editForm.stream.trim() || null,
        capacity: editForm.capacity || 60,
        curriculum: editForm.curriculum,
      }).eq('id', editingClass.id);
      if (error) throw new Error(error.message);
      toast.success('Class updated successfully!');
      setEditingClass(null);
      refetch();
    } catch (err: any) {
      toast.error('Failed to update class: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClass) return;
    setDeleting(true);
    try {
      const { error } = await supabaseUntyped.from('classes').delete().eq('id', deletingClass.id);
      if (error) throw new Error(error.message);
      toast.success(`Class "${deletingClass.name}" deleted.`);
      setDeletingClass(null);
      refetch();
    } catch (err: any) {
      toast.error('Failed to delete class: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredClasses = classes.filter((c: any) => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.stream?.toLowerCase().includes(search.toLowerCase());
    const matchesCurriculum = filterCurriculum ? c.curriculum === filterCurriculum : true;
    return matchesSearch && matchesCurriculum;
  });

  const grouped = filteredClasses.reduce((acc: Record<string, any[]>, c: any) => {
    const key = c.curriculum || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, any[]>);

  const [bulkPromoteClass, setBulkPromoteClass] = useState<any | null>(null);
  const [bulkDestClassId, setBulkDestClassId] = useState('');
  const [bulkPromoting, setBulkPromoting] = useState(false);

  const handleBulkPromote = async () => {
    if (!bulkPromoteClass || !bulkDestClassId) { toast.error('Please select a destination class'); return; }
    setBulkPromoting(true);
    try {
      const { data: students, error: fetchErr } = await supabaseUntyped.from('students').select('id').eq('class_id', bulkPromoteClass.id).eq('is_active', true);
      if (fetchErr) throw fetchErr;
      if (!students || students.length === 0) { toast.error('No active students in this class'); setBulkPromoting(false); return; }
      const { error: updateErr } = await supabaseUntyped.from('students').update({ class_id: bulkDestClassId, previous_class_id: bulkPromoteClass.id, promoted_at: new Date().toISOString() }).eq('class_id', bulkPromoteClass.id).eq('is_active', true);
      if (updateErr) throw updateErr;
      toast.success(`${students.length} students promoted successfully!`);
      setBulkPromoteClass(null);
      setBulkDestClassId('');
      refetch();
    } catch (err: any) { toast.error('Bulk promotion failed: ' + err.message); }
    setBulkPromoting(false);
  };

  const getLevelBadgeColor = (gradeLevel: number, curriculum?: string) => {
    if (curriculum === '') return 'bg-purple-100 text-purple-700';
    if (gradeLevel >= 1 && gradeLevel <= 6) return 'bg-green-100 text-green-700';
    if (gradeLevel >= 7 && gradeLevel <= 9) return 'bg-blue-100 text-blue-700';
    if (gradeLevel >= 10 && gradeLevel <= 12) return 'bg-indigo-100 text-indigo-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getLevelLabel = (gradeLevel: number, curriculum?: string, name?: string) => {
    if (curriculum === '') return '';
    if (name?.toLowerCase().startsWith('form')) return '';
    if (gradeLevel < 0) return 'Pre-Primary';
    if (gradeLevel >= 1 && gradeLevel <= 6) return 'Primary';
    if (gradeLevel >= 7 && gradeLevel <= 9) return 'Junior';
    if (gradeLevel >= 10 && gradeLevel <= 12) return 'Senior';
    return `Grade ${gradeLevel}`;
  };

  const previewPreset = STANDARD_CLASSES.find(c => c.name === selectedPreset);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Classes</h1>
          <p className="text-sm text-[#666666]">{filteredClasses.length} of {classes.length} classes</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]">
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search classes..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
        </div>
        <select value={filterCurriculum} onChange={e => setFilterCurriculum(e.target.value as CurriculumType | '')} className="w-full sm:w-48 px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
          <option value="">All Curricula</option>
          {CURRICULUM_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Add Class Form */}
      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="text-lg font-semibold mb-1">Add Class</h3>
          <p className="text-xs text-gray-500 mb-4">Select a standard class from the list. Optionally add a stream (e.g. "A", "East", "North") if your school has multiple streams per grade.</p>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Class *</label>
              <select value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white" required>
                <option value="">— Select a class —</option>
                <optgroup label="Pre-Primary CBE (Playgroup, PP1–PP2)">
                  {STANDARD_CLASSES.filter(c => c.curriculum === 'CBE' && c.grade_level < 0).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Primary CBE (Grades 1–6)">
                  {STANDARD_CLASSES.filter(c => c.curriculum === 'CBE' && c.grade_level >= 1 && c.grade_level <= 6).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Junior CBE (Grades 7–9)">
                  {STANDARD_CLASSES.filter(c => c.curriculum === 'CBE' && c.grade_level >= 7 && c.grade_level <= 9).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Senior CBE (Grades 10–12)">
                  {STANDARD_CLASSES.filter(c => c.curriculum === 'CBE' && c.grade_level >= 10).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
                <optgroup label=" (Form 3–4)">
                  {STANDARD_CLASSES.filter(c => c.curriculum === '').map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
              </select>
              {previewPreset && (
                <p className="text-xs text-blue-600 mt-1">
                  {previewPreset.curriculum === '' ? '' : previewPreset.grade_level <= 6 ? 'Primary CBE' : previewPreset.grade_level <= 9 ? 'Junior CBE' : 'Senior CBE'} · Grade level {previewPreset.grade_level}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stream <span className="text-gray-400">(optional)</span></label>
              <input placeholder="e.g. A, B, East, North" value={stream} onChange={e => setStream(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              <p className="text-xs text-gray-400 mt-1">Leave blank if no streams</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Capacity</label>
              <input type="number" placeholder="60" value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 60)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" min={1} max={200} />
            </div>
            {previewPreset && (
              <div className="md:col-span-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
                <strong>Preview:</strong> {previewPreset.name}{stream.trim() ? ` (${stream.trim()})` : ''} &nbsp;·&nbsp; {previewPreset.curriculum === '' ? '' : 'CBE'} &nbsp;·&nbsp; Grade level {previewPreset.grade_level} &nbsp;·&nbsp; Capacity {capacity}
              </div>
            )}
            <div className="flex items-end gap-3 md:col-span-3">
              <button type="submit" disabled={adding} className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {adding ? 'Adding...' : 'Add Class'}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setSelectedPreset(''); setStream(''); setCapacity(60); }} className="border border-gray-200 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Promote Modal */}
      {bulkPromoteClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-lg">
            <h2 className="text-lg font-semibold mb-1">Bulk Promote Class</h2>
            <p className="text-sm text-gray-500 mb-4">Promote ALL active students from <strong>{bulkPromoteClass.name}</strong> to a new class.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Destination Class</label>
              <select value={bulkDestClassId} onChange={e => setBulkDestClassId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">-- Select Destination Class --</option>
                {classes.filter(c => c.id !== bulkPromoteClass.id).sort((a,b) => (a.level||0)-(b.level||0)).map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.stream || ''} {c.level ? `(Level ${c.level})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBulkPromoteClass(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleBulkPromote} disabled={bulkPromoting || !bulkDestClassId} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {bulkPromoting ? <><Loader2 className="w-4 h-4 animate-spin" /> Promoting...</> : <><ArrowRight className="w-4 h-4" /> Promote All Students</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classes List */}
      {loading ? (
        <div className="text-center py-8 text-sm text-[#666666]">Loading classes...</div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <School className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-[#666666] font-medium">No classes found</p>
          <p className="text-sm text-gray-400 mt-1">Click "Add Class" to add your first class — just select the grade and optionally a stream.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([curriculum, cls]) => (
          <div key={curriculum} className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 mb-4">
              <School className="w-5 h-5 text-[#2563EB]" />
              <h3 className="font-semibold text-[#111111]">
                {curriculum === '' ? ' (Form 3–4)' : 'CBE'} Classes ({cls.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...cls].sort((a: any, b: any) => (a.level || a.grade_level || 0) - (b.level || b.grade_level || 0)).map((c: any) => {
                const gradeLevel = c.grade_level || c.level || 0;
                return (
                  <div key={c.id} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#111111]">
                        {c.name}{c.stream ? ` (${c.stream})` : ''}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLevelBadgeColor(gradeLevel, c.curriculum)}`}>
                        {getLevelLabel(gradeLevel, c.curriculum, c.name)}
                      </span>
                    </div>
                    <div className="text-xs text-[#666666] space-y-0.5">
                      <div>Grade level {gradeLevel} · Capacity: {c.capacity}</div>
                      <div className="flex items-center justify-between gap-1 mt-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${curriculum === 'CBE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {curriculum === '' ? '' : 'CBE'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setBulkPromoteClass(c); setBulkDestClassId(''); }} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                            <Users className="w-3 h-3" /> Promote
                          </button>
                          <button onClick={() => openEdit(c)} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors font-medium">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => setDeletingClass(c)} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Class</h2>
              <button onClick={() => setEditingClass(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Class Name *</label>
                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stream <span className="text-gray-400">(optional)</span></label>
                <input placeholder="e.g. A, B, East" value={editForm.stream} onChange={e => setEditForm({...editForm, stream: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Curriculum</label>
                <select value={editForm.curriculum} onChange={e => setEditForm({...editForm, curriculum: e.target.value as CurriculumType})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white">
                  <option value="CBE">CBE (Competency Based)</option>
                  <option value=""> (Traditional)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Capacity</label>
                <input type="number" value={editForm.capacity} onChange={e => setEditForm({...editForm, capacity: parseInt(e.target.value) || 60})} className="w-full px-4 py-2.5 border rounded-xl text-sm" min={1} max={200} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingClass(null)} className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Delete Class</h2>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deletingClass.name}{deletingClass.stream ? ` (${deletingClass.stream})` : ''}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingClass(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
