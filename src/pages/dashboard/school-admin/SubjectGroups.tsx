import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { fetchSubjectGroups, fetchSchoolSubjects, type SubjectGroup } from '@/lib/optional-subjects';
import { Plus, Trash2, Loader2, Layers } from 'lucide-react';
import { toast } from 'sonner';

const LEVEL_GROUPS = [
  { value: 'senior', label: 'Senior School (10-12)' },
  { value: 'junior', label: 'Junior School (7-9)' },
  { value: 'upper_primary', label: 'Upper Primary (4-6)' },
  { value: 'lower_primary', label: 'Lower Primary (1-3)' },
];

export default function SubjectGroups() {
  const { user } = useAuth();
  const schoolId = user?.schoolId ?? '';
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; is_core: boolean | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [levelGroup, setLevelGroup] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [g, s] = await Promise.all([fetchSubjectGroups(schoolId), fetchSchoolSubjects(schoolId)]);
      setGroups(g);
      setSubjects(s);
    } catch (e: any) {
      toast.error('Failed to load subject groups: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (schoolId) load(); }, [schoolId]);

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const createGroup = async () => {
    if (!name.trim()) { toast.error('Group name is required'); return; }
    if (selectedSubjectIds.length < 2) { toast.error('A group needs at least two optional subjects'); return; }
    setSaving(true);
    const { data: grp, error } = await supabaseUntyped
      .from('subject_groups')
      .insert({ school_id: schoolId, name: name.trim(), level_group: levelGroup || null })
      .select('id')
      .single();
    if (error || !grp) {
      toast.error('Failed to create group: ' + (error?.message || ''));
      setSaving(false);
      return;
    }
    const links = selectedSubjectIds.map(subjectId => ({ group_id: grp.id, subject_id: subjectId }));
    const { error: linkErr } = await supabaseUntyped.from('subject_group_subjects').insert(links);
    if (linkErr) {
      await supabaseUntyped.from('subject_groups').delete().eq('id', grp.id);
      toast.error('Failed to add subjects to group: ' + linkErr.message);
    } else {
      toast.success('Subject group created');
      setName(''); setLevelGroup(''); setSelectedSubjectIds([]);
      load();
    }
    setSaving(false);
  };

  const deleteGroup = async (id: string) => {
    const { error } = await supabaseUntyped.from('subject_groups').delete().eq('id', id);
    if (error) toast.error('Failed to delete group: ' + error.message);
    else { toast.success('Group deleted'); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Subject Groups</h1>
        <p className="text-sm text-[#666666]">
          Group optional learning areas where a learner takes only one (e.g. IRE, CRE, HRE).
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4">Create subject group</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            placeholder="Group name (e.g. Religious Education)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <select value={levelGroup} onChange={e => setLevelGroup(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
            <option value="">All levels</option>
            {LEVEL_GROUPS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {subjects.map(s => (
            <button key={s.id} type="button" onClick={() => toggleSubject(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedSubjectIds.includes(s.id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {s.name}{s.is_core === false ? ' · optional' : ''}
            </button>
          ))}
        </div>
        <button onClick={createGroup} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create group
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          No subject groups yet. Create one above to enable optional-subject selection.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(g => (
            <div key={g.id} className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-[#111111]">{g.name}</h3>
                  <p className="text-xs text-gray-500">{LEVEL_GROUPS.find(l => l.value === g.level_group)?.label || 'All levels'}</p>
                </div>
                <button onClick={() => deleteGroup(g.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" aria-label="Delete group">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(g.subjects || []).map(s => (
                  <span key={s.id} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{s.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
