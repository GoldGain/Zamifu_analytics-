import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserCheck, Users, GraduationCap, Loader2, CheckCircle, AlertCircle, Save, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { createScopedUser } from '@/lib/supabase/createUser';
import { deleteScopedUser } from '@/lib/supabase/accountActions';
import { toast } from 'sonner';

interface Teacher {
  id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  employee_number: string;
  is_dean_of_studies?: boolean;
}

interface ClassInfo {
  id: string;
  name: string;
  level: number;
  class_teacher_id: string | null;
  class_teacher_name?: string;
}

interface SchoolInfo {
  id: string;
  dean_of_studies_id: string | null;
}

export default function AssignRoles() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingClass, setSavingClass] = useState<string | null>(null);
  const [savingDoS, setSavingDoS] = useState(false);
  const [selectedDoS, setSelectedDoS] = useState('');
  const [dosSet, setDosSet] = useState<Set<string>>(new Set());
  const [classTeacherMap, setClassTeacherMap] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminForm, setAdminForm] = useState({ first_name: '', last_name: '', email: '' });
  const [savingAdmin, setSavingAdmin] = useState(false);

  useEffect(() => {
    if (user?.schoolId) fetchData();
  }, [user?.schoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: teachersData }, { data: classesData }, { data: schoolData }] = await Promise.all([
        (supabase as any)
          .from('teachers')
          .select('id, profile_id, first_name, last_name, employee_number, is_dean_of_studies')
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('first_name'),
        (supabase as any)
          .from('classes')
          .select('id, name, level, class_teacher_id')
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('level'),
        (supabase as any)
          .from('schools')
          .select('id, dean_of_studies_id')
          .eq('id', user?.schoolId)
          .single(),
      ]);

      const teacherList: Teacher[] = teachersData || [];
      setTeachers(teacherList);
      setDosSet(new Set((teacherList as any[]).filter((t) => t.is_dean_of_studies).map((t) => String(t.id))));
      const { data: adminsData } = await (supabase as any)
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('school_id', user?.schoolId)
        .eq('role', 'school_admin')
        .order('first_name');
      setAdmins(adminsData || []);

      // Build teacher lookup maps:
      // - by teachers.id (for the dropdown value)
      // - by teachers.profile_id (for resolving class_teacher_id which is a profile_id FK)
      const teacherLookupById: Record<string, string> = {};
      const teacherLookupByProfileId: Record<string, string> = {};
      // Also map profile_id -> teacher.id for the dropdown initial value
      const profileIdToTeacherId: Record<string, string> = {};
      teacherList.forEach((t) => {
        teacherLookupById[t.id] = `${t.first_name} ${t.last_name}`;
        if (t.profile_id) {
          teacherLookupByProfileId[t.profile_id] = `${t.first_name} ${t.last_name}`;
          profileIdToTeacherId[t.profile_id] = t.id;
        }
      });

      // Enrich classes with teacher names
      // class_teacher_id stores profile_id (FK references profiles.id)
      const enrichedClasses: ClassInfo[] = (classesData || []).map((cls: any) => ({
        ...cls,
        class_teacher_name: cls.class_teacher_id
          ? teacherLookupByProfileId[cls.class_teacher_id] || 'Unknown'
          : null,
      }));
      setClasses(enrichedClasses);

      // Build initial class-teacher map using teachers.id (for dropdown)
      // class_teacher_id is profile_id, so we reverse-map it to teacher.id
      const ctMap: Record<string, string> = {};
      enrichedClasses.forEach((cls) => {
        const profileId = cls.class_teacher_id || '';
        ctMap[cls.id] = profileId ? (profileIdToTeacherId[profileId] || '') : '';
      });
      setClassTeacherMap(ctMap);

      // Set school and DoS
      if (schoolData) {
        setSchool(schoolData);
        setSelectedDoS(schoolData.dean_of_studies_id || '');
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.email || !adminForm.first_name || !adminForm.last_name) {
      toast.error('Name and email are required');
      return;
    }
    setSavingAdmin(true);
    try {
      await createScopedUser({
        email: adminForm.email.trim().toLowerCase(),
        password: 'SchoolAdmin@2025',
        first_name: adminForm.first_name.trim(),
        last_name: adminForm.last_name.trim(),
        role: 'school_admin',
        school_id: user?.schoolId,
      });
      toast.success(`School administrator added: ${adminForm.email}`);
      setAdminForm({ first_name: '', last_name: '', email: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add school administrator');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: string, email: string) => {
    if (!confirm(`Remove school administrator ${email}?`)) return;
    try {
      await deleteScopedUser({ target_user_id: id, target_type: 'school_admin' });
      toast.success('School administrator removed');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove school administrator');
    }
  };

  const handleAssignClassTeacher = async (classId: string) => {
    const teacherId = classTeacherMap[classId]; // This is teachers.id
    setSavingClass(classId);
    try {
      // FIX Issue 7: classes.class_teacher_id FK references profiles.id, NOT teachers.id
      // We must use the teacher's profile_id when updating classes.class_teacher_id
      let profileId: string | null = null;
      if (teacherId) {
        const teacher = teachers.find((t) => t.id === teacherId);
        profileId = teacher?.profile_id || null;
        if (!profileId) {
          throw new Error('Selected teacher does not have a linked profile. Please contact support.');
        }
      }

      // Update the classes table class_teacher_id using profile_id (matches FK constraint)
      const { error: classError } = await (supabase as any)
        .from('classes')
        .update({ class_teacher_id: profileId })
        .eq('id', classId);
      if (classError) throw classError;

      // If a teacher is selected, also update the teachers table
      if (teacherId) {
        // Mark previous class teachers as not class teacher (only if not DoS - allow DoS to be class teacher)
        await (supabase as any)
          .from('teachers')
          .update({ is_class_teacher: false, assigned_class_id: null })
          .eq('assigned_class_id', classId)
          .neq('id', teacherId);

        // Mark new class teacher (set is_class_teacher true, but preserve DoS role)
        await (supabase as any)
          .from('teachers')
          .update({ is_class_teacher: true, assigned_class_id: classId })
          .eq('id', teacherId);
      } else {
        // Clear any existing class teacher assignment for this class
        await (supabase as any)
          .from('teachers')
          .update({ is_class_teacher: false, assigned_class_id: null })
          .eq('assigned_class_id', classId);
      }

      toast.success(`Class teacher ${teacherId ? 'assigned' : 'removed'} for ${classes.find((c) => c.id === classId)?.name}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign class teacher');
    } finally {
      setSavingClass(null);
    }
  };

  const handleAssignDoS = async () => {
    setSavingDoS(true);
    try {
      const dosIds = Array.from(dosSet).filter((id) => teachers.some((t) => t.id === id));
      // Clear the flag on all teachers first, then set it for the selected set.
      await (supabase as any)
        .from('teachers')
        .update({ is_dean_of_studies: false })
        .eq('school_id', user?.schoolId);
      if (dosIds.length > 0) {
        await (supabase as any)
          .from('teachers')
          .update({ is_dean_of_studies: true })
          .in('id', dosIds);
      }
      // Keep the legacy single column pointing at the first selected DoS for
      // backward compatibility with any code still reading schools.dean_of_studies_id.
      const firstProfile = teachers.find((t) => t.id === dosIds[0])?.profile_id || null;
      await (supabase as any)
        .from('schools')
        .update({ dean_of_studies_id: firstProfile })
        .eq('id', user?.schoolId);
      toast.success(`Dean(s) of Studies saved (${dosIds.length} assigned)`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign Dean of Studies');
    } finally {
      setSavingDoS(false);
    }
  };

  const getTeacherName = (id: string) => {
    const t = teachers.find((t) => t.id === id);
    return t ? `${t.first_name} ${t.last_name}` : 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assign Roles</h1>
        <p className="text-sm text-gray-500 mt-1">Assign Class Teachers and Dean of Studies</p>
      </div>

      {/* Dean of Studies Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Dean of Studies (DoS)</h2>
            <p className="text-sm text-gray-500">Select one or more teachers. Each Dean of Studies can view all classes, monitor marks, and create assessments.</p>
          </div>
        </div>

        {school?.dean_of_studies_id && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-xl">
            <CheckCircle className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-800">
              Current DoS: <strong>{getTeacherName(school.dean_of_studies_id)}</strong>
            </span>
          </div>
        )}

        <div className="grid gap-2">
          {teachers.length === 0 ? (
            <p className="text-sm text-gray-500">No teachers found. Add teachers first.</p>
          ) : (
            teachers.map((t) => {
              const checked = dosSet.has(String(t.id));
              return (
                <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-purple-50/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setDosSet((prev) => {
                        const next = new Set(prev);
                        if (next.has(String(t.id))) next.delete(String(t.id));
                        else next.add(String(t.id));
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-800">{t.first_name} {t.last_name}</span>
                  {t.employee_number && <span className="text-xs text-gray-400">({t.employee_number})</span>}
                </label>
              );
            })
          )}
          <button
            onClick={handleAssignDoS}
            disabled={savingDoS}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {savingDoS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Deans of Studies
          </button>
        </div>
      </div>

      {/* Class Teachers Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Class Teachers</h2>
            <p className="text-sm text-gray-500">Assign a class teacher to each class. They can view all marks for their class.</p>
          </div>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No classes found. Create classes first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{cls.name}</p>
                  {cls.class_teacher_id && (
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                      <CheckCircle className="w-3 h-3" />
                      {cls.class_teacher_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={classTeacherMap[cls.id] || ''}
                    onChange={(e) =>
                      setClassTeacherMap({ ...classTeacherMap, [cls.id]: e.target.value })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px]"
                  >
                    <option value="">-- No class teacher --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssignClassTeacher(cls.id)}
                    disabled={savingClass === cls.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingClass === cls.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* School Administrators Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">School Administrators</h2>
            <p className="text-sm text-gray-500">Add multiple school administrators for this school.</p>
          </div>
        </div>

        {admins.length > 0 && (
          <div className="mb-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{a.first_name} {a.last_name}</span>
                  <span className="text-xs text-gray-500 ml-2">{a.email}</span>
                </div>
                <button
                  onClick={() => handleDeleteAdmin(a.id, a.email)}
                  className="text-red-500 hover:text-red-700 p-1.5 rounded-lg transition-colors"
                  title="Remove administrator"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddAdmin} className="grid gap-3 sm:grid-cols-3">
          <input
            placeholder="First name *"
            value={adminForm.first_name}
            onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            placeholder="Last name *"
            value={adminForm.last_name}
            onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            placeholder="Email *"
            type="email"
            value={adminForm.email}
            onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <button
            type="submit"
            disabled={savingAdmin}
            className="sm:col-span-3 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {savingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add School Administrator
          </button>
        </form>
      </div>
    </div>
  );
}
