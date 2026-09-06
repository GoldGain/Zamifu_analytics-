import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { fetchSubjectGroups, type SubjectGroup } from '@/lib/optional-subjects';
import { Loader2, Save, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LearnerOptionalSubjects() {
  const { user } = useAuth();
  const schoolId = user?.schoolId ?? '';

  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  // group id -> chosen subject id (one per group)
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [g, c] = await Promise.all([
          fetchSubjectGroups(schoolId),
          supabaseUntyped.from('classes').select('id, name, grade_level, level').eq('school_id', schoolId).order('level'),
        ]);
        setGroups(g);
        setClasses(c.data || []);
      } catch (e: any) {
        toast.error('Failed to load: ' + (e?.message || ''));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass) { setStudents([]); setSelectedStudent(''); return; }
    const loadStudents = async () => {
      const { data } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('class_id', selectedClass)
        .eq('is_active', true)
        .order('first_name');
      setStudents((data || []).sort((a, b) => (a.admission_number || '').localeCompare(b.admission_number || '', undefined, { numeric: true })));
      setSelectedStudent('');
    };
    loadStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedStudent) { setSelections({}); setExisting({}); return; }
    const loadReg = async () => {
      const { data } = await supabaseUntyped
        .from('learner_optional_subjects')
        .select('group_id, subject_id')
        .eq('student_id', selectedStudent);
      const sel: Record<string, string> = {};
      const ex: Record<string, boolean> = {};
      (data || []).forEach(r => { sel[r.group_id] = r.subject_id; ex[r.group_id] = true; });
      setSelections(sel);
      setExisting(ex);
    };
    loadReg();
  }, [selectedStudent]);

  const studentName = useMemo(() => {
    const s = students.find(s => s.id === selectedStudent);
    return s ? `${s.first_name} ${s.last_name}` : '';
  }, [selectedStudent, students]);

  const save = async () => {
    if (!selectedStudent) { toast.error('Select a learner first'); return; }
    setSaving(true);

    // validate: one per group
    for (const g of groups) {
      if (!selections[g.id]) {
        toast.error(`Select a subject for "${g.name}" (or ensure the group has subjects).`);
        setSaving(false);
        return;
      }
    }

    // delete existing registrations for this student, then re-insert
    await supabaseUntyped.from('learner_optional_subjects').delete().eq('student_id', selectedStudent);

    const rows = Object.entries(selections).map(([groupId, subjectId]) => ({
      student_id: selectedStudent,
      subject_id: subjectId,
      group_id: groupId,
      school_id: schoolId,
    }));

    const { error } = await supabaseUntyped.from('learner_optional_subjects').insert(rows);
    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Optional subjects saved for ' + studentName);
      const ex: Record<string, boolean> = {};
      Object.keys(selections).forEach(k => { ex[k] = true; });
      setExisting(ex);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Register Optional Subjects</h1>
        <p className="text-sm text-[#666666]">
          Choose which learner takes which optional subject (one per group).
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] grid grid-cols-1 md:grid-cols-2 gap-4">
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
          <option value="">Select grade/class</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
          <option value="">Select learner</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>)}
        </select>
      </div>

      {selectedStudent && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] space-y-5">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-[#111111]">{studentName}</h3>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-gray-500">No subject groups configured. Create them under Subject Groups first.</p>
          ) : (
            groups.map(g => (
              <div key={g.id} className="border border-gray-100 rounded-xl p-4">
                <p className="font-medium text-sm text-[#111111] mb-2">{g.name}</p>
                <div className="flex flex-wrap gap-2">
                  {(g.subjects || []).map(s => (
                    <button key={s.id} type="button" onClick={() => setSelections(prev => ({ ...prev, [g.id]: s.id }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selections[g.id] === s.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save selection
          </button>
        </div>
      )}
    </div>
  );
}
