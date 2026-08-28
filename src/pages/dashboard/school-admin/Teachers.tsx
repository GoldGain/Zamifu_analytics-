import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { supabaseUntyped } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';
import { deleteScopedUser, syncTeacherAccount } from '@/lib/supabase/accountActions';
import { useAuth } from '@/contexts/AuthContext';
import { useTeachers } from '@/hooks/useSupabaseData';
import { Search, Plus, Loader2, KeyRound, Pencil, Trash2, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GenderType } from '@/types/database';

const DEFAULT_TEACHER_PASSWORD = 'Teacher@2025';
const TEACHER_TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

type AdminTeacherTimetableEntry = {
  teacher_id: string;
  day_of_week: number;
  entry_type?: string;
  activity_name?: string | null;
  timetable_time_slots?: { start_time?: string; end_time?: string } | null;
  subjects?: { name?: string } | null;
  classes?: { name?: string } | null;
};

const shortTime = (value?: string | null) => value ? value.toString().slice(0, 5) : '';

const teacherDisplayName = (teacher: any) => `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || 'Teacher';

const teacherSlotLabel = (entry: AdminTeacherTimetableEntry) => {
  const subject = entry.subjects?.name || entry.activity_name || (entry.entry_type === 'activity' ? 'Activity' : 'Learning Area');
  const className = entry.classes?.name || '';
  return className ? `${subject}\n${className}` : subject;
};

export default function SchoolAdminTeachers() {
  const { user, schoolData } = useAuth();
  const { teachers, loading, refetch } = useTeachers(user?.schoolId || undefined);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '' as GenderType,
    qualification: '',
    specialization: '',
    tsc_number: '',
  });

  // Edit state
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '' as GenderType,
    qualification: '',
    specialization: '',
    tsc_number: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingTeacher, setDeletingTeacher] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingTimetables, setExportingTimetables] = useState(false);

  const nextTeacherNumber = useMemo(() => {
    const maxNumber = teachers.reduce((max, teacher: any) => Math.max(max, Number(teacher.teacher_number || 0)), 0);
    return maxNumber + 1;
  }, [teachers]);

  const nextTeacherNumberLabel = String(nextTeacherNumber).padStart(2, '0');

  const exportAllTeacherTimetables = async () => {
    if (!user?.schoolId || teachers.length === 0) {
      toast.error('No teachers are available to export.');
      return;
    }
    setExportingTimetables(true);
    try {
      const { data: entries, error } = await supabaseUntyped
        .from('timetable_entries')
        .select('teacher_id, day_of_week, entry_type, activity_name, timetable_time_slots(start_time, end_time), subjects(name), classes(name)')
        .eq('school_id', user.schoolId)
        .not('teacher_id', 'is', null)
        .in('entry_type', ['lesson', 'class', 'activity']);
      if (error) throw error;

      const entriesByTeacher = new Map<string, AdminTeacherTimetableEntry[]>();
      (entries || []).forEach((entry: AdminTeacherTimetableEntry) => {
        const current = entriesByTeacher.get(entry.teacher_id) || [];
        current.push(entry);
        entriesByTeacher.set(entry.teacher_id, current);
      });

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      teachers.forEach((teacher: any, teacherIndex: number) => {
        if (teacherIndex > 0) doc.addPage();
        const teacherEntries = (entriesByTeacher.get(teacher.id) || []).sort((a, b) => {
          const dayDelta = (a.day_of_week || 0) - (b.day_of_week || 0);
          if (dayDelta !== 0) return dayDelta;
          return shortTime(a.timetable_time_slots?.start_time).localeCompare(shortTime(b.timetable_time_slots?.start_time));
        });
        const timeRanges = Array.from(new Set(teacherEntries.map((entry) => {
          const start = shortTime(entry.timetable_time_slots?.start_time);
          const end = shortTime(entry.timetable_time_slots?.end_time);
          return `${start}-${end}`;
        }).filter((range) => range !== '-'))).sort();
        const rowRanges = timeRanges.length > 0 ? timeRanges : [''];
        const rows = rowRanges.map((range) => {
          const [start, end] = range.split('-');
          const row = [range ? `${start} – ${end}` : 'No generated entries'];
          TEACHER_TIMETABLE_DAYS.forEach((day) => {
            const cellEntries = teacherEntries.filter((entry) => (
              DAY_NAMES[entry.day_of_week] === day
              && shortTime(entry.timetable_time_slots?.start_time) === start
              && shortTime(entry.timetable_time_slots?.end_time) === end
            ));
            row.push(cellEntries.map(teacherSlotLabel).join('\n'));
          });
          return row;
        });

        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 297, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('PERSONALISED TEACHER TIMETABLE', 14, 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${schoolData?.name || 'School'} · ${teacherDisplayName(teacher)} · Generated ${new Date().toLocaleDateString()}`, 14, 21);
        doc.setTextColor(0, 0, 0);

        autoTable(doc, {
          startY: 38,
          head: [['Time', ...TEACHER_TIMETABLE_DAYS]],
          body: rows,
          styles: { fontSize: 8, cellPadding: 3, valign: 'middle', lineColor: [210, 220, 235], lineWidth: 0.2 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', halign: 'center' },
          alternateRowStyles: { fillColor: [239, 246, 255] },
          columnStyles: { 0: { cellWidth: 31, fontStyle: 'bold' } },
          margin: { left: 12, right: 12 },
        });
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text('Zamifu Analytics School Management System', 148.5, 200, { align: 'center' });
      });

      doc.save(`personalised-teacher-timetables-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Personalised timetables exported for ${teachers.length} teachers.`);
    } catch (error: any) {
      toast.error(`Could not export teacher timetables: ${error.message || 'Unknown error'}`);
    } finally {
      setExportingTimetables(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) {
      toast.error('No school assigned to your account');
      return;
    }
    setAdding(true);
    try {
      const { data: existingTeachers, error: numberError } = await supabase
        .from('teachers')
        .select('teacher_number')
        .eq('school_id', user.schoolId)
        .order('teacher_number', { ascending: false })
        .limit(1);
      if (numberError) throw numberError;
      const actualNextTeacherNumber = existingTeachers && existingTeachers.length > 0
        ? Number(existingTeachers[0].teacher_number || 0) + 1
        : 1;
      const teacherNumberLabel = String(actualNextTeacherNumber).padStart(2, '0');
      const employeeNumber = `T${teacherNumberLabel}`;
      const authData = await createScopedUser({
        email: formData.email,
        password: DEFAULT_TEACHER_PASSWORD,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: 'teacher',
        school_id: user.schoolId,
        metadata: { teacher_number: actualNextTeacherNumber, employee_number: employeeNumber },
      });
      const { error: teacherError } = await supabase.from('teachers').insert([{
        employee_number: employeeNumber,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        gender: formData.gender || null,
        qualification: formData.qualification.trim() || null,
        specialization: formData.specialization.trim() || null,
        tsc_number: formData.tsc_number.trim() || null,
        profile_id: authData.user.id,
        school_id: user.schoolId,
        is_active: true,
        hire_date: new Date().toISOString().split('T')[0],
        teacher_number: actualNextTeacherNumber,
      }]);
      if (teacherError) throw new Error(`Teacher record failed: ${teacherError.message}`);

      // Send Welcome SMS to Teacher
      try {
        const { sendSMS, generateWelcomeSMS } = await import('@/lib/sms');
        const welcomeMsg = generateWelcomeSMS(
          formData.first_name.trim(),
          'Teacher',
          formData.email.trim().toLowerCase(),
          DEFAULT_TEACHER_PASSWORD,
          schoolData?.name
        );
        if (formData.phone) {
          const smsResult = await sendSMS(formData.phone, welcomeMsg, undefined, user?.schoolId || undefined);
          if (smsResult.success) {
            toast.success(`Welcome SMS sent to ${formData.first_name}`);
          } else {
            console.warn('SMS failed:', smsResult.error);
          }
        }
      } catch (smsErr) {
        console.warn('Failed to trigger SMS:', smsErr);
      }

      toast.success(`Teacher ${teacherNumberLabel} added. Login: ${formData.email.trim().toLowerCase()} | Password: ${DEFAULT_TEACHER_PASSWORD}`);
      setShowAdd(false);
      setFormData({ first_name: '', last_name: '', email: '', phone: '', gender: '' as GenderType, qualification: '', specialization: '', tsc_number: '' });
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add teacher');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    setEditForm({
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      gender: (teacher.gender || '') as GenderType,
      qualification: teacher.qualification || '',
      specialization: teacher.specialization || '',
      tsc_number: teacher.tsc_number || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setSaving(true);
    try {
      const result = await syncTeacherAccount({
        teacher_id: editingTeacher.id,
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim() || null,
        gender: editForm.gender || null,
        qualification: editForm.qualification.trim() || null,
        specialization: editForm.specialization.trim() || null,
        tsc_number: editForm.tsc_number.trim() || null,
      });
      toast.success(result?.created_auth_account ? 'Teacher updated and login account created.' : 'Teacher and login account updated successfully!');
      setEditingTeacher(null);
      refetch();
    } catch (err: any) {
      toast.error('Failed to update teacher: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTeacher) return;
    setDeleting(true);
    try {
      await deleteScopedUser({
        record_id: deletingTeacher.id,
        target_type: 'teacher',
        school_id: user?.schoolId,
      });
      toast.success(`Teacher "${deletingTeacher.first_name} ${deletingTeacher.last_name}" and login account deleted.`);
      setDeletingTeacher(null);
      refetch();
    } catch (err: any) {
      toast.error('Failed to delete teacher: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = teachers.filter((teacher: any) =>
    teacher.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    teacher.last_name?.toLowerCase().includes(search.toLowerCase()) ||
    teacher.email?.toLowerCase().includes(search.toLowerCase()) ||
    String(teacher.teacher_number || '').includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Teachers</h1>
          <p className="text-sm text-gray-500">{filtered.length} total teachers. New teachers receive automatic numbers like 01, 02, 03.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportAllTeacherTimetables}
            disabled={exportingTimetables || loading || teachers.length === 0}
            className="flex items-center gap-2 border border-[#2563EB] text-[#2563EB] px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 disabled:opacity-50"
          >
            {exportingTimetables ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportingTimetables ? 'Preparing PDF...' : 'Download All Timetables'}
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#1d4ed8]"><Plus className="w-4 h-4" /> Add Teacher</button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold">Add New Teacher</h3>
              <p className="text-sm text-gray-500">Only enter the teacher details. The number and password are generated automatically.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Next Number</p>
                <p className="text-3xl font-black text-blue-800">{nextTeacherNumberLabel}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-emerald-700 flex items-center gap-1"><KeyRound className="w-3 h-3" /> Default Password</p>
                <p className="text-lg font-black text-emerald-800">{DEFAULT_TEACHER_PASSWORD}</p>
              </div>
            </div>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input placeholder="First Name *" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-sm" required />
            <input placeholder="Last Name *" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-sm" required />
            <input placeholder="Email *" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-sm" type="email" required />
            <input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-sm" />
            <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })} className="w-full px-4 py-2 border rounded-xl text-sm bg-white">
              <option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option>
            </select>
            <input placeholder="Qualification" value={formData.qualification} onChange={(e) => setFormData({ ...formData, qualification: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-sm" />
            <input placeholder="Specialization" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-sm" />
            <input placeholder="TSC Number" value={formData.tsc_number} onChange={(e) => setFormData({ ...formData, tsc_number: e.target.value })} className="w-full px-4 py-2 border rounded-xl text-sm" />
            <div className="flex gap-3 md:col-span-3 pt-2">
              <button type="submit" disabled={adding} className="bg-[#2563EB] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Teacher {nextTeacherNumberLabel}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="border px-6 py-2 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search teachers by name, email, or number..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-4 text-xs font-black text-blue-700 uppercase">#</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Employee #</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Specialization</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-500">Loading...</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-500">No teachers found</td></tr> :
                filtered.map((teacher: any) => (
                  <tr key={teacher.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-4 text-center"><span className="text-blue-700 font-black text-xl">{teacher.teacher_number ? String(teacher.teacher_number).padStart(2, '0') : '—'}</span></td>
                    <td className="px-6 py-4"><div className="text-sm font-medium">{teacher.first_name} {teacher.last_name}</div><div className="text-xs text-gray-500">{teacher.email}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-600">{teacher.employee_number || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{teacher.specialization || '-'}</td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${teacher.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{teacher.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(teacher)} className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => setDeletingTeacher(teacher)} className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Teacher</h2>
              <button onClick={() => setEditingTeacher(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Employee: <strong>{editingTeacher.employee_number}</strong></p>
            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                <input value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
                <input value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gender</label>
                <select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value as GenderType})} className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white">
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Qualification</label>
                <input value={editForm.qualification} onChange={e => setEditForm({...editForm, qualification: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Specialization</label>
                <input value={editForm.specialization} onChange={e => setEditForm({...editForm, specialization: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">TSC Number</label>
                <input value={editForm.tsc_number} onChange={e => setEditForm({...editForm, tsc_number: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingTeacher(null)} className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Delete Teacher</h2>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deletingTeacher.first_name} {deletingTeacher.last_name}</strong> ({deletingTeacher.employee_number})?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingTeacher(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
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
