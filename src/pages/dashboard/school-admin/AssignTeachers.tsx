import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Trash2, AlertCircle, CheckCircle, Users, BookOpen, Calendar, Save } from 'lucide-react';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  teacher_name: string;
  teacher_number: number;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  lessons_per_week: number;
  is_priority: boolean;
  priority_band: 'none' | 'morning' | 'mid_morning' | 'afternoon';
  is_double_lesson: boolean;
  available_days: string[];
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  teacher_number: number;
}

interface Class {
  id: string;
  name: string;
  level: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

export default function AssignTeachers() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    teacher_id: '',
    class_id: '',
    subject_id: '',
    lessons_per_week: 5,
    priority_band: 'none' as const,
    is_double_lesson: false,
    available_days: [...ALL_DAYS],
  });

  // Track which assignment is being edited for availability
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [editingDays, setEditingDays] = useState<string[]>([...ALL_DAYS]);
  const [savingAvailability, setSavingAvailability] = useState(false);

  useEffect(() => {
    if (user?.schoolId) fetchData();
  }, [user?.schoolId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: teachersData, error: te } = await supabase
        .from('teachers')
        .select('id, first_name, last_name, teacher_number')
        .eq('school_id', user?.schoolId)
        .eq('is_active', true)
        .order('teacher_number');
      if (te) throw te;
      setTeachers(teachersData || []);

      const { data: classesData, error: ce } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', user?.schoolId)
        .order('level');
      if (ce) throw ce;
      setClasses(classesData || []);

      const { data: subjectsData, error: se } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('school_id', user?.schoolId)
        .order('name');
      if (se) throw se;
      setSubjects(subjectsData || []);

      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    const { data, error: ae } = await supabase
      .from('teacher_subject_assignments')
      .select(`
        id, teacher_id, class_id, subject_id, lessons_per_week, is_priority, priority_band, available_days,
        teachers(first_name, last_name, teacher_number),
        classes(name),
        subjects(name)
      `)
      .eq('school_id', user?.schoolId)
      .eq('is_active', true);

    if (ae) throw ae;

    const mapped: TeacherAssignment[] = (data || []).map((a: any) => ({
      id: a.id,
      teacher_id: a.teacher_id,
      teacher_name: `${a.teachers?.first_name} ${a.teachers?.last_name}`,
      teacher_number: a.teachers?.teacher_number || 0,
      class_id: a.class_id,
      class_name: a.classes?.name || '',
      subject_id: a.subject_id,
      subject_name: a.subjects?.name || '',
      lessons_per_week: a.lessons_per_week || 5,
      is_priority: a.is_priority || false,
      priority_band: a.priority_band || (a.is_priority ? 'morning' : 'none'),
      is_double_lesson: a.is_double_lesson || false,
      available_days: Array.isArray(a.available_days) && a.available_days.length > 0
        ? a.available_days
        : [...ALL_DAYS],
    }));
    setAssignments(mapped.sort((a, b) => a.teacher_number - b.teacher_number));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacher_id || !formData.class_id || !formData.subject_id) {
      setError('Please fill in all required fields.');
      return;
    }
    if (formData.is_double_lesson && formData.lessons_per_week % 2 !== 0) {
      setError('Double Lesson requires an even Lessons / Week total (for example, 4 periods = two practical blocks).');
      return;
    }
    try {
      setSaving(true);
      setError(null);

      const { error: insertError } = await supabase
        .from('teacher_subject_assignments')
        .upsert({
          school_id: user?.schoolId,
          teacher_id: formData.teacher_id,
          class_id: formData.class_id,
          subject_id: formData.subject_id,
          lessons_per_week: formData.lessons_per_week,
          priority_band: formData.priority_band,
          is_priority: formData.priority_band === 'morning',
          is_double_lesson: formData.is_double_lesson,
          available_days: formData.available_days,
          assigned_by_admin: true,
          is_active: true,
          academic_year: '2026',
        }, { onConflict: 'teacher_id,class_id,subject_id' });

      if (insertError) throw insertError;

      setSuccess('Assignment saved successfully!');
      setFormData({ teacher_id: '', class_id: '', subject_id: '', lessons_per_week: 5, priority_band: 'none', is_double_lesson: false, available_days: [...ALL_DAYS] });
      await fetchAssignments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      const { error } = await supabase.from('teacher_subject_assignments').delete().eq('id', id);
      if (error) throw error;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setSuccess('Assignment removed.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleEditAvailability = (assignment: TeacherAssignment) => {
    setEditingAvailabilityId(assignment.id);
    setEditingDays([...(assignment.available_days || ALL_DAYS)]);
  };

  const toggleEditingDay = (day: string) => {
    setEditingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSaveAvailability = async (assignmentId: string) => {
    setSavingAvailability(true);
    try {
      const { error } = await supabase
        .from('teacher_subject_assignments')
        .update({ available_days: editingDays })
        .eq('id', assignmentId);
      if (error) throw error;
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, available_days: editingDays } : a
      ));
      setEditingAvailabilityId(null);
      setSuccess('Availability updated!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability');
    } finally {
      setSavingAvailability(false);
    }
  };

  const toggleFormDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter(d => d !== day)
        : [...prev.available_days, day],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Assign Teachers to Learning Areas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Admin assigns teachers to subjects per class. Teachers appear in the timetable by their number (e.g. MATH<strong>3</strong> = Teacher #3 teaches Mathematics).
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
          <AlertCircle className="text-red-600 flex-shrink-0" size={18} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex gap-2">
          <CheckCircle className="text-green-600 flex-shrink-0" size={18} />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form + Teacher Numbers */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-black text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-blue-600" />
              New Assignment
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Teacher</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select teacher...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{String(t.teacher_number).padStart(2, '0')} — {t.first_name} {t.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Learning Area</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Lessons / Week</label>
                <input
                  type="number" min="1" max="10"
                  value={formData.lessons_per_week}
                  onChange={(e) => setFormData({ ...formData, lessons_per_week: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Timetable Priority Band</label>
                <select
                  value={formData.priority_band}
                  onChange={(e) => setFormData({ ...formData, priority_band: e.target.value as typeof formData.priority_band })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">No fixed priority</option>
                  <option value="morning">Priority Morning (Lessons 1–3)</option>
                  <option value="mid_morning">Priority Mid-Morning (Lessons 4–6)</option>
                  <option value="afternoon">Priority Afternoon (Lesson 7+)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">The generator prefers the selected band and only falls back when the band cannot fit all weekly lessons.</p>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-3 text-sm text-purple-900">
                <input
                  type="checkbox"
                  checked={formData.is_double_lesson}
                  onChange={(e) => setFormData({ ...formData, is_double_lesson: e.target.checked })}
                  className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <span>
                  <span className="font-semibold">Double Lesson</span>
                  <span className="block text-xs text-purple-700">
                    Consecutive 2-period practical block; never split by a break, lunch, or activity. Use an even weekly total.
                  </span>
                </span>
              </label>

              {/* Available Days */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <Calendar size={12} className="text-blue-600" /> Available Days
                </label>
                <p className="text-xs text-gray-500 mb-2">Uncheck days the teacher is unavailable.</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map(day => (
                    <label key={day} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.available_days.includes(day)}
                        onChange={() => toggleFormDay(day)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                      />
                      <span className={`text-xs font-medium ${formData.available_days.includes(day) ? 'text-blue-700' : 'text-gray-400 line-through'}`}>
                        {day.substring(0, 3)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : 'Add Assignment'}
              </button>
            </form>
          </div>

          {/* Teacher Number Reference */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-black text-gray-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <Users size={16} className="text-blue-600" />
              Teacher Numbers
            </h2>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {teachers.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-blue-700 font-black text-base w-8 flex-shrink-0">
                    {String(t.teacher_number).padStart(2, '0')}
                  </span>
                  <span className="text-gray-800 text-sm font-medium">
                    {t.first_name} {t.last_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assignments Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900 flex items-center gap-2">
                <BookOpen size={18} className="text-blue-600" />
                Current Assignments
              </h2>
              <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-2 py-1 rounded-full">
                {assignments.length} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">Teacher</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">Class</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">Learning Area</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-600 uppercase">Lessons</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-600 uppercase">Priority</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-600 uppercase">Lesson Format</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">Available Days</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-600 uppercase">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                        No assignments yet. Add one using the form.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <>
                        <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="text-blue-700 font-black text-base">
                              {String(a.teacher_number).padStart(2, '0')}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{a.teacher_name}</td>
                          <td className="px-4 py-3 text-gray-700">{a.class_name}</td>
                          <td className="px-4 py-3 text-gray-700">{a.subject_name}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{a.lessons_per_week}</td>
                          <td className="px-4 py-3 text-center">
                            {a.priority_band === 'morning' ? (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-bold">Morning · L1–3</span>
                            ) : a.priority_band === 'mid_morning' ? (
                              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">Mid-Morning · L4–6</span>
                            ) : a.priority_band === 'afternoon' ? (
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">Afternoon · L7+</span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {a.is_double_lesson ? (
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">2× consecutive</span>
                            ) : (
                              <span className="text-gray-400 text-xs">Single</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingAvailabilityId === a.id ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {ALL_DAYS.map(day => (
                                    <label key={day} className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={editingDays.includes(day)}
                                        onChange={() => toggleEditingDay(day)}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                                      />
                                      <span className={`text-xs font-medium ${editingDays.includes(day) ? 'text-blue-700' : 'text-gray-400 line-through'}`}>
                                        {day.substring(0, 3)}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveAvailability(a.id)}
                                    disabled={savingAvailability}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <Save size={11} /> {savingAvailability ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditingAvailabilityId(null)}
                                    className="px-2 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {ALL_DAYS.map(day => (
                                    <span
                                      key={day}
                                      className={`text-[10px] px-1 py-0.5 rounded font-bold ${
                                        a.available_days.includes(day)
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-gray-100 text-gray-300 line-through'
                                      }`}
                                      title={day}
                                    >
                                      {day.substring(0, 1)}
                                    </span>
                                  ))}
                                </div>
                                <button
                                  onClick={() => handleEditAvailability(a)}
                                  className="text-blue-500 hover:text-blue-700 transition p-0.5 rounded text-xs"
                                  title="Edit available days"
                                >
                                  <Calendar size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 transition p-1 rounded">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
