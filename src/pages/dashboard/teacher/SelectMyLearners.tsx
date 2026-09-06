import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { fetchTeacherAssignments, type TeacherAssignment } from '@/lib/teacher-restrictions';
import { Loader2, Save, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SelectMyLearners() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: teacher } = await supabaseUntyped.from('teachers').select('id').eq('profile_id', user.id).maybeSingle();
        setTeacherId(teacher?.id || null);
        const { assignments: rows } = await fetchTeacherAssignments(user.id);
        setAssignments(rows);
      } catch (e: any) {
        toast.error('Failed to load: ' + (e?.message || ''));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const subjectsForClass = assignments.filter(a => a.class_id === selectedClass && a.subject_id);

  useEffect(() => {
    setSelectedSubject('');
    setStudents([]);
    setSelectedIds(new Set());
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass || !selectedSubject || !teacherId) { setStudents([]); setSelectedIds(new Set()); return; }
    const load = async () => {
      const { data: studs } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('class_id', selectedClass)
        .eq('is_active', true)
        .order('first_name');
      const ordered = (studs || []).sort((a, b) => (a.admission_number || '').localeCompare(b.admission_number || '', undefined, { numeric: true }));
      setStudents(ordered);

      const { data: sel } = await supabaseUntyped
        .from('teacher_selected_learners')
        .select('student_id')
        .eq('teacher_id', teacherId)
        .eq('subject_id', selectedSubject)
        .eq('class_id', selectedClass);
      setSelectedIds(new Set((sel || []).map((r: any) => r.student_id)));
    };
    load();
  }, [selectedClass, selectedSubject, teacherId]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!teacherId || !selectedClass || !selectedSubject) { toast.error('Select a class and learning area'); return; }
    setSaving(true);

    // delete existing selection for this triple
    await supabaseUntyped.from('teacher_selected_learners')
      .delete()
      .eq('teacher_id', teacherId)
      .eq('subject_id', selectedSubject)
      .eq('class_id', selectedClass);

    const rows = Array.from(selectedIds).map(student_id => ({
      teacher_id: teacherId,
      subject_id: selectedSubject,
      class_id: selectedClass,
      student_id,
      school_id: user?.schoolId ?? '',
    }));

    let error = null;
    if (rows.length > 0) {
      const res = await supabaseUntyped.from('teacher_selected_learners').insert(rows);
      error = res.error;
    }
    if (error) toast.error('Failed to save: ' + error.message);
    else toast.success(`${selectedIds.size} learner(s) selected. They will be the only ones shown when uploading marks.`);
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const subjectName = assignments.find(a => a.subject_id === selectedSubject)?.subject_name || selectedSubject;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Select My Learners</h1>
        <p className="text-sm text-[#666666]">
          Choose which learners take your optional subject. Only selected learners appear when uploading marks.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] grid grid-cols-1 md:grid-cols-2 gap-4">
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
          <option value="">Select class</option>
          {Array.from(new Map(assignments.map(a => [a.class_id, a.class_name])).entries()).map(([id, name]) => (
            <option key={id} value={id}>{name || 'Class'}</option>
          ))}
        </select>
        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
          <option value="">Select learning area</option>
          {subjectsForClass.map(a => <option key={a.subject_id} value={a.subject_id}>{a.subject_name || 'Learning Area'}</option>)}
        </select>
      </div>

      {selectedClass && selectedSubject && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-[#111111]">{subjectName} — learners in this class</h3>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{selectedIds.size} selected</span>
          </div>

          {students.length === 0 ? (
            <div className="text-sm text-gray-500 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> No learners found in this class.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {students.map(s => (
                <label key={s.id} className="flex items-center gap-3 py-3 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="flex-1 text-sm text-[#111111]">{s.first_name} {s.last_name}</span>
                  <span className="text-xs text-gray-400">{s.admission_number}</span>
                </label>
              ))}
            </div>
          )}

          <button onClick={save} disabled={saving}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save selection
          </button>
        </div>
      )}
    </div>
  );
}
