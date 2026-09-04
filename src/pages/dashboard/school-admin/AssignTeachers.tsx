import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Trash2, AlertCircle, CheckCircle, Users, BookOpen, Calendar, Save } from 'lucide-react';
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
type PriorityBand = 'auto' | 'none' | 'early_morning' | 'mid_morning' | 'late_morning' | 'afternoon';

const normalizePriorityBand = (value: unknown, isPriority = false): PriorityBand => {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'morning' || raw === 'early' || raw === 'early_morning') return 'early_morning';
  if (raw === 'mid' || raw === 'mid_morning') return 'mid_morning';
  if (raw === 'late' || raw === 'late_morning') return 'late_morning';
  if (raw === 'afternoon') return 'afternoon';
  if (raw === 'none') return 'none';
  if (raw === 'auto' || raw === 'automatic' || raw === 'default') return 'auto';
  if (isPriority) return 'early_morning';
  return 'auto';
};

// Subject-default priority mapping (mirrors timetable-generator getDefaultPriorityBand).
const subjectDefaultBand = (name: string): PriorityBand => {
  const n = (name || '').toLowerCase();
  if (/mathemat/.test(n) || /\benglish\b/.test(n)) return 'early_morning';
  if (/integrated\s*science|\bscience\b/.test(n)) return 'mid_morning';
  if (/agricultur|pre[\s-]*technical/.test(n)) return 'mid_morning';
  if (/kiswahili|\blanguages?\b|french|german|arabic/.test(n)) return 'late_morning';
  if (/social\s*stud|religious|\bcre\b|christian|islamic|creative\s*arts?/.test(n)) return 'afternoon';
  return 'none';
};

type LevelGroup = 'pre-primary' | 'lower-primary' | 'upper-primary' | 'combined-primary' | 'junior' | 'senior' | 'form-3-4';
const resolveLevelGroup = (grade: number | null | undefined): LevelGroup | null => {
  const g = Number(grade);
  if (Number.isNaN(g)) return null;
  if (g <= 0) return 'pre-primary';
  if (g <= 3) return 'lower-primary';
  if (g <= 6) return 'upper-primary';
  if (g <= 9) return 'junior';
  return 'senior';
};
const LEVEL_AFTER_LUNCH_DEFAULTS: Record<LevelGroup, number> = {
  'pre-primary': 0,
  'lower-primary': 0,
  'upper-primary': 1,
  'combined-primary': 1,
  junior: 2,
  senior: 3,
  'form-3-4': 3,
};
// Lessons 1-2, 3-4 and 5-6 always exist (fixed morning structure).
const FIXED_BAND_LESSONS = 2;

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
  priority_band: PriorityBand;
  is_double_lesson: boolean;
  double_lesson_days: string[];
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
    priority_band: 'auto' as PriorityBand,
    is_double_lesson: false,
    double_lesson_days: [...ALL_DAYS],
    available_days: [...ALL_DAYS],
  });

  // Track which assignment is being edited for availability
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [editingDays, setEditingDays] = useState<string[]>([...ALL_DAYS]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [editingDoubleLessonId, setEditingDoubleLessonId] = useState<string | null>(null);
  const [editingDoubleDays, setEditingDoubleDays] = useState<string[]>([...ALL_DAYS]);
  const [savingDoubleLesson, setSavingDoubleLesson] = useState(false);
  const [levelConfigs, setLevelConfigs] = useState<Record<string, { after_lunch_lessons?: number; lessons_per_day?: number }>>({});

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

      const { data: levelConfigsData, error: lcErr } = await (supabase as any)
        .from('timetable_level_configs')
        .select('level_group, lessons_per_day, after_lunch_lessons')
        .eq('school_id', user?.schoolId);
      if (!lcErr && levelConfigsData) {
        const lcMap: Record<string, { after_lunch_lessons?: number; lessons_per_day?: number }> = {};
        (levelConfigsData as any[]).forEach((lc: any) => { lcMap[lc.level_group] = lc; });
        setLevelConfigs(lcMap);
      }

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
        id, teacher_id, class_id, subject_id, lessons_per_week, is_priority, priority_band, is_double_lesson, double_lesson_days, available_days,
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
      priority_band: normalizePriorityBand(a.priority_band, a.is_priority === true),

      is_double_lesson: a.is_double_lesson === true,
      double_lesson_days: Array.isArray(a.double_lesson_days) && a.double_lesson_days.length > 0
        ? a.double_lesson_days
        : (a.is_double_lesson === true ? (Array.isArray(a.available_days) && a.available_days.length > 0 ? a.available_days : [...ALL_DAYS]) : []),
      available_days: Array.isArray(a.available_days) && a.available_days.length > 0
        ? a.available_days
        : [...ALL_DAYS],
    }));
    setAssignments(mapped.sort((a, b) => a.teacher_number - b.teacher_number));
  };

  // Feasibility guard: a shared teacher can only be in one class per period, so a
  // teacher's weekly lessons inside a priority window cannot exceed that window's
  // total teaching slots. This blocks impossible assignments at entry time instead
  // of letting them fail silently when the timetable is generated.
  const gradeByClassId = (classId: string): number | null => {
    const cls = classes.find((c) => c.id === classId);
    return cls ? Number(cls.level) : null;
  };

  const effectiveBand = (assignment: { priority_band: PriorityBand; subject_name: string }): PriorityBand | null => {
    if (assignment.priority_band === 'none') return null;
    if (assignment.priority_band === 'auto') {
      const resolved = subjectDefaultBand(assignment.subject_name);
      return resolved === 'none' ? null : resolved;
    }
    return assignment.priority_band;
  };

  const bandSlotCount = (band: PriorityBand, grade: number | null | undefined): number => {
    if (band === 'early_morning' || band === 'mid_morning' || band === 'late_morning') {
      return FIXED_BAND_LESSONS;
    }
    if (band === 'afternoon') {
      const grp = resolveLevelGroup(grade);
      const total = grp && typeof levelConfigs[grp]?.after_lunch_lessons === 'number'
        ? levelConfigs[grp].after_lunch_lessons as number
        : (grp ? LEVEL_AFTER_LUNCH_DEFAULTS[grp] : 2);
      return Math.max(0, total);
    }
    return 0;
  };

  const computeConflicts = (
    candidateAssignments: Array<{
      id?: string;
      teacher_id: string;
      teacher_name: string;
      class_id: string;
      subject_name: string;
      priority_band: PriorityBand;
      lessons_per_week: number;
    }>,
  ): Array<{ teacherName: string; band: PriorityBand; levelGroup: string; demand: number; capacity: number }> => {
    const byKey = new Map<string, { teacherName: string; band: PriorityBand; levelGroup: string; demand: number; capacity: number }>();
    for (const a of candidateAssignments) {
      const band = effectiveBand(a);
      if (!band) continue;
      const grade = gradeByClassId(a.class_id);
      const grp = resolveLevelGroup(grade);
      if (!grp) continue;
      const capacity = bandSlotCount(band, grade) * ALL_DAYS.length;
      const key = `${a.teacher_id}|${grp}|${band}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.demand += Math.max(0, Number(a.lessons_per_week) || 0);
      } else {
        byKey.set(key, { teacherName: a.teacher_name, band, levelGroup: grp, demand: Math.max(0, Number(a.lessons_per_week) || 0), capacity });
      }
    }
    return Array.from(byKey.values())
      .filter((e) => e.demand > e.capacity)
      .sort((a, b) => (b.demand - b.capacity) - (a.demand - a.capacity));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacher_id || !formData.class_id || !formData.subject_id) {
      setError('Please fill in all required fields.');
      return;
    }
    if (formData.is_double_lesson && formData.double_lesson_days.length === 0) {
      setError('Select at least one weekday for the double lesson.');
      return;
    }
    const teacher = teachers.find((t) => t.id === formData.teacher_id);
    const subject = subjects.find((sub) => sub.id === formData.subject_id);
    const pending = {
      teacher_id: formData.teacher_id,
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'This teacher',
      class_id: formData.class_id,
      subject_name: subject?.name || 'this learning area',
      priority_band: formData.priority_band,
      lessons_per_week: Math.max(0, Number(formData.lessons_per_week) || 0),
    };
    const existingOthers = assignments
      .filter((a) => !(a.teacher_id === formData.teacher_id && a.class_id === formData.class_id && a.subject_id === formData.subject_id))
      .map((a) => ({
        teacher_id: a.teacher_id,
        teacher_name: a.teacher_name,
        class_id: a.class_id,
        subject_name: a.subject_name,
        priority_band: a.priority_band,
        lessons_per_week: a.lessons_per_week,
      }));
    const saveConflicts = computeConflicts([...existingOthers, pending]);
    if (saveConflicts.length > 0) {
      const c = saveConflicts[0];
      setError(
        `Cannot save: ${c.teacherName} would have ${c.demand} lessons/week in the ${c.band.replace(/_/g, ' ')} window, but only ${c.capacity} teaching slots exist across the ${c.levelGroup.replace(/-/g, ' ')} classes. Reduce the weekly lessons or assign a different teacher.`,
      );
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
          is_priority: formData.priority_band !== 'none' && formData.priority_band !== 'auto',
          is_double_lesson: formData.is_double_lesson,
          double_lesson_days: formData.is_double_lesson ? formData.double_lesson_days : [],
          available_days: formData.available_days,
          assigned_by_admin: true,
          is_active: true,
          academic_year: '2026',
        }, { onConflict: 'teacher_id,class_id,subject_id' });

      if (insertError) throw insertError;

      setSuccess('Assignment saved successfully!');
      setFormData({ teacher_id: '', class_id: '', subject_id: '', lessons_per_week: 5, priority_band: 'auto', is_double_lesson: false, double_lesson_days: [...ALL_DAYS], available_days: [...ALL_DAYS] });
      await fetchAssignments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handlePriorityChange = async (assignment: TeacherAssignment, priorityBand: PriorityBand) => {
    const priorityCandidate = assignments.map((a) =>
      a.id === assignment.id ? { ...a, priority_band: priorityBand } : a,
    );
    const priorityConflicts = computeConflicts(priorityCandidate);
    if (priorityConflicts.length > 0) {
      const c = priorityConflicts[0];
      setError(
        `Cannot set priority: ${c.teacherName} would have ${c.demand} lessons/week in the ${c.band.replace(/_/g, ' ')} window, but only ${c.capacity} teaching slots exist across the ${c.levelGroup.replace(/-/g, ' ')} classes. Use a different window or assign a different teacher.`,
      );
      return;
    }
    try {
      const { error } = await supabase
        .from('teacher_subject_assignments')
        .update({ priority_band: priorityBand, is_priority: priorityBand !== 'none' && priorityBand !== 'auto' })
        .eq('id', assignment.id)
        .eq('school_id', user?.schoolId);
      if (error) throw error;
      setAssignments((prev) => prev.map((item) => item.id === assignment.id
        ? { ...item, priority_band: priorityBand, is_priority: priorityBand !== 'none' && priorityBand !== 'auto' }
        : item));
      setSuccess('Priority updated. Generate the timetable again to apply it.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority');
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
    setFormData(prev => {
      const isRemoving = prev.available_days.includes(day);
      return {
        ...prev,
        available_days: isRemoving
          ? prev.available_days.filter(d => d !== day)
          : [...prev.available_days, day],
        double_lesson_days: isRemoving
          ? prev.double_lesson_days.filter(d => d !== day)
          : prev.double_lesson_days,
      };
    });
  };

  const toggleFormDoubleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      double_lesson_days: prev.double_lesson_days.includes(day)
        ? prev.double_lesson_days.filter(d => d !== day)
        : [...prev.double_lesson_days, day],
    }));
  };

  const handleEditDoubleLesson = (assignment: TeacherAssignment) => {
    setEditingDoubleLessonId(assignment.id);
    setEditingDoubleDays(
      assignment.double_lesson_days.length > 0
        ? [...assignment.double_lesson_days]
        : [...(assignment.available_days.length > 0 ? assignment.available_days : ALL_DAYS)],
    );
  };

  const toggleEditingDoubleDay = (day: string) => {
    setEditingDoubleDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  };

  const handleSaveDoubleLesson = async (assignment: TeacherAssignment) => {
    if (editingDoubleDays.length === 0) {
      setError('Select at least one weekday for the double lesson.');
      return;
    }
    setSavingDoubleLesson(true);
    try {
      const { error } = await (supabase as any)
        .from('teacher_subject_assignments')
        .update({ is_double_lesson: true, double_lesson_days: editingDoubleDays })
        .eq('id', assignment.id);
      if (error) throw error;
      setAssignments(prev => prev.map(a => a.id === assignment.id
        ? { ...a, is_double_lesson: true, double_lesson_days: [...editingDoubleDays] }
        : a));
      setEditingDoubleLessonId(null);
      setSuccess('Double-lesson weekdays updated. Generate the timetable again to apply them.');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save double-lesson weekdays');
    } finally {
      setSavingDoubleLesson(false);
    }
  };

  const handleMakeSingleLesson = async (assignment: TeacherAssignment) => {
    setSavingDoubleLesson(true);
    try {
      const { error } = await (supabase as any)
        .from('teacher_subject_assignments')
        .update({ is_double_lesson: false, double_lesson_days: [] })
        .eq('id', assignment.id);
      if (error) throw error;
      setAssignments(prev => prev.map(a => a.id === assignment.id
        ? { ...a, is_double_lesson: false, double_lesson_days: [] }
        : a));
      setSuccess('Assignment changed back to single lessons.');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change lesson format');
    } finally {
      setSavingDoubleLesson(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentConflicts = computeConflicts(assignments);

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

      {currentConflicts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl">
          <p className="text-amber-800 text-sm font-bold mb-1 flex items-center gap-2">
            <AlertCircle size={16} /> Impossible assignment{currentConflicts.length > 1 ? 's' : ''} detected
          </p>
          <ul className="text-amber-700 text-xs list-disc pl-5 space-y-1">
            {currentConflicts.map((c, i) => (
              <li key={i}>
                {c.teacherName} - {c.band.replace(/_/g, ' ')} window needs {c.demand} lessons/week but only {c.capacity} teaching slots exist. Reduce lessons or use a different teacher.
              </li>
            ))}
          </ul>
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
                  onChange={(e) => {
                    const subjectId = e.target.value;
                    setFormData({
                      ...formData,
                      subject_id: subjectId,
                      priority_band: formData.priority_band,
                    });
                  }}
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
                  <option value="auto">Automatic subject default</option>
                  <option value="none">No fixed priority</option>
                  <option value="early_morning">Early Morning Priority (Lessons 1–2)</option>
                  <option value="mid_morning">Mid Morning Priority (Lessons 3–4)</option>
                  <option value="late_morning">Late Morning Priority (Lessons 5–6)</option>
                  <option value="afternoon">Afternoon Priority (Lesson 7+)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">Automatic defaults place Mathematics in Lesson 1, English in Lesson 2, Integrated Science, Agriculture, and Pre-Technical Studies in Lessons 3–4, languages such as Kiswahili in Lessons 5–6, and humanities or Creative Arts in Lesson 7 or later. You can change any assignment or choose No fixed priority.</p>
              </div>

              <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-3 text-sm text-purple-900">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_double_lesson}
                    onChange={(e) => setFormData({
                      ...formData,
                      is_double_lesson: e.target.checked,
                      double_lesson_days: e.target.checked
                        ? (formData.double_lesson_days.length > 0 ? formData.double_lesson_days : [...formData.available_days])
                        : [],
                    })}
                    className="mt-0.5 h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>
                    <span className="font-semibold">Use double lesson on selected days</span><span className="mt-1 block text-xs text-gray-500">Each selected day receives two consecutive lessons without a break or activity between them. Remaining weekly lessons stay single.</span>
                    <span className="block text-xs text-purple-700">
                      The two periods stay consecutive and cannot cross a break, lunch, or activity. Choose the exact weekdays below.
                    </span>
                  </span>
                </label>
                {formData.is_double_lesson && (
                  <div className="mt-3 border-t border-purple-200 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-purple-800 mb-2">Double-lesson days</p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_DAYS.map(day => {
                        const available = formData.available_days.includes(day);
                        const selected = formData.double_lesson_days.includes(day);
                        return (
                          <label key={day} className={`flex items-center gap-1.5 ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!available}
                              onChange={() => toggleFormDoubleDay(day)}
                              className="h-3.5 w-3.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs font-semibold">{day.substring(0, 3)}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-purple-700 mt-2">Selected: {formData.double_lesson_days.length ? formData.double_lesson_days.join(', ') : 'none'}</p>
                  </div>
                )}
              </div>

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
                            <select
                              value={a.priority_band}
                              onChange={(e) => handlePriorityChange(a, e.target.value as PriorityBand)}
                              className="max-w-[170px] rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700"
                              aria-label={`Priority for ${a.subject_name} in ${a.class_name}`}
                            >
                              <option value="auto">Automatic subject default</option>
                              <option value="none">No fixed priority</option>
                              <option value="early_morning">Early Morning · L1–2</option>
                              <option value="mid_morning">Mid Morning · L3–4</option>
                              <option value="late_morning">Late Morning · L5–6</option>
                              <option value="afternoon">Afternoon · L7+</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center align-top">
                            {editingDoubleLessonId === a.id ? (
                              <div className="min-w-[180px] space-y-2 text-left">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-purple-800">Double on:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ALL_DAYS.map(day => {
                                    const available = a.available_days.includes(day);
                                    return (
                                      <label key={day} className={`flex items-center gap-1 ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                        <input
                                          type="checkbox"
                                          checked={editingDoubleDays.includes(day)}
                                          disabled={!available}
                                          onChange={() => toggleEditingDoubleDay(day)}
                                          className="h-3.5 w-3.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className="text-[11px] font-semibold">{day.substring(0, 3)}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    onClick={() => handleSaveDoubleLesson(a)}
                                    disabled={savingDoubleLesson}
                                    className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-[11px] font-bold hover:bg-purple-700 disabled:opacity-50"
                                  >
                                    <Save size={11} /> {savingDoubleLesson ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditingDoubleLessonId(null)}
                                    className="px-2 py-1 border border-gray-300 text-gray-600 rounded text-[11px] hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : a.is_double_lesson ? (
                              <div className="min-w-[130px]">
                                <span className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">Double</span>
                                <p className="text-[11px] text-purple-700 mt-1 leading-tight">
                                  {(a.double_lesson_days.length > 0 ? a.double_lesson_days : ALL_DAYS).map(day => day.substring(0, 3)).join(' · ')}
                                </p>
                                <div className="flex justify-center gap-2 mt-1">
                                  <button
                                    onClick={() => handleEditDoubleLesson(a)}
                                    className="text-purple-600 hover:text-purple-800 text-[11px] font-semibold underline"
                                  >
                                    Edit days
                                  </button>
                                  <button
                                    onClick={() => handleMakeSingleLesson(a)}
                                    disabled={savingDoubleLesson}
                                    className="text-gray-500 hover:text-gray-700 text-[11px] font-semibold underline disabled:opacity-50"
                                  >
                                    Make single
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditDoubleLesson(a)}
                                className="text-purple-600 hover:text-purple-800 text-xs font-semibold underline"
                              >
                                Set double days
                              </button>
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
