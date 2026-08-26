import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarDays, Check, ClipboardList, FileText, Loader2, Printer, Save, ShieldCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';

type LearnerSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  unmarked: number;
};

const emptySummary = (): LearnerSummary => ({ total: 0, present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 });

const teacherStatusOptions = [
  { key: 'present', label: 'Present', color: 'bg-green-500', icon: <Check className="w-3 h-3" /> },
  { key: 'absent', label: 'Absent', color: 'bg-red-500', icon: <X className="w-3 h-3" /> },
  { key: 'late', label: 'Late', color: 'bg-yellow-500', icon: <ClipboardList className="w-3 h-3" /> },
  { key: 'excused', label: 'Excused', color: 'bg-blue-500', icon: <ClipboardList className="w-3 h-3" /> },
  { key: 'on_leave', label: 'On leave', color: 'bg-purple-500', icon: <ClipboardList className="w-3 h-3" /> },
];

export default function SchoolAdminAttendance() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [classSummaries, setClassSummaries] = useState<Record<string, LearnerSummary>>({});
  const [teacherRows, setTeacherRows] = useState<any[]>([]);
  const [teacherAttendance, setTeacherAttendance] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'learners' | 'teachers'>('learners');
  const [loading, setLoading] = useState(false);
  const [teacherSaving, setTeacherSaving] = useState(false);

  useEffect(() => {
    if (user?.schoolId) {
      fetchClasses(user.schoolId);
      fetchClassSummaries(user.schoolId, selectedDate);
      fetchTeacherAttendance(user.schoolId, selectedDate);
    }
  }, [user?.schoolId, selectedDate]);

  const fetchClasses = async (schoolId: string) => {
    const { data, error } = await supabaseUntyped
      .from('classes')
      .select('id, name, stream, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) toast.error(`Failed to load classes: ${error.message}`);
    setClasses(data || []);
  };

  const fetchClassSummaries = async (schoolId: string, date: string) => {
    const [{ data: learnerRows }, { data: attendanceRows }] = await Promise.all([
      supabaseUntyped.from('students').select('id, class_id').eq('school_id', schoolId).eq('is_active', true),
      supabaseUntyped.from('attendance').select('student_id, class_id, status').eq('school_id', schoolId).eq('date', date),
    ]);
    const summary: Record<string, LearnerSummary> = {};
    const studentClassById = new Map<string, string>();
    (learnerRows || []).forEach((learner: any) => {
      studentClassById.set(learner.id, learner.class_id);
      const current = summary[learner.class_id] || emptySummary();
      current.total += 1;
      current.unmarked += 1;
      summary[learner.class_id] = current;
    });
    const countedStudents = new Set<string>();
    (attendanceRows || []).forEach((record: any) => {
      const classId = record.class_id || studentClassById.get(record.student_id);
      if (!classId) return;
      const current = summary[classId] || emptySummary();
      if (!countedStudents.has(record.student_id)) {
        current.unmarked = Math.max(0, current.unmarked - 1);
        countedStudents.add(record.student_id);
      }
      if (record.status === 'present') current.present += 1;
      else if (record.status === 'absent') current.absent += 1;
      else if (record.status === 'late') current.late += 1;
      else if (record.status === 'excused') current.excused += 1;
      summary[classId] = current;
    });
    setClassSummaries(summary);
  };

  const fetchTeacherAttendance = async (schoolId: string, date: string) => {
    const [{ data: teacherData }, { data: existing }] = await Promise.all([
      supabaseUntyped
        .from('teachers')
        .select('id, first_name, last_name, teacher_number, is_active')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('teacher_number'),
      supabaseUntyped
        .from('teacher_attendance')
        .select('teacher_id, status, remarks')
        .eq('school_id', schoolId)
        .eq('date', date),
    ]);
    const map: Record<string, string> = {};
    (existing || []).forEach((record: any) => { map[record.teacher_id] = record.status; });
    setTeacherRows(teacherData || []);
    setTeacherAttendance(map);
  };

  const fetchStudents = async (classId: string, date: string) => {
    setLoading(true);
    try {
      const [{ data: studentRows }, { data: existing }] = await Promise.all([
        supabaseUntyped
          .from('students')
          .select('id, first_name, last_name, admission_number')
          .eq('class_id', classId)
          .eq('is_active', true)
          .order('admission_number'),
        supabaseUntyped
          .from('attendance')
          .select('student_id, status')
          .eq('class_id', classId)
          .eq('date', date),
      ]);
      const map: Record<string, string> = {};
      (existing || []).forEach((record: any) => { map[record.student_id] = record.status; });
      setStudents(studentRows || []);
      setAttendance(map);
    } catch (error: any) {
      toast.error(`Failed to load learner attendance: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setStudents([]);
    setAttendance({});
    if (classId) fetchStudents(classId, selectedDate);
  };

  const saveTeacherAttendance = async () => {
    if (!user?.schoolId) return;
    setTeacherSaving(true);
    try {
      const { error: deleteError } = await supabaseUntyped
        .from('teacher_attendance')
        .delete()
        .eq('school_id', user.schoolId)
        .eq('date', selectedDate);
      if (deleteError) throw deleteError;

      const records = Object.entries(teacherAttendance)
        .filter(([_, status]) => status)
        .map(([teacherId, status]) => ({
          school_id: user.schoolId,
          teacher_id: teacherId,
          date: selectedDate,
          status,
          marked_by: user.id,
        }));
      if (records.length > 0) {
        const { error: insertError } = await supabaseUntyped.from('teacher_attendance').insert(records);
        if (insertError) throw insertError;
      }
      toast.success(`Teacher attendance saved for ${records.length} teachers.`);
      await fetchTeacherAttendance(user.schoolId, selectedDate);
    } catch (error: any) {
      toast.error(`Failed to save teacher attendance: ${error.message}`);
    } finally {
      setTeacherSaving(false);
    }
  };

  const handlePrint = () => {
    if (!selectedClass) return;
    const className = classes.find((classRow) => classRow.id === selectedClass)?.name || 'Unknown';
    const selectedSummary = classSummaries[selectedClass] || emptySummary();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html><html><head><title>Attendance Report - ${className}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px;margin-bottom:5px}.meta{font-size:12px;color:#666;margin-bottom:15px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:bold}.summary{margin-top:15px;padding:10px;background:#f9f9f9;border-radius:5px;font-size:12px}@media print{.no-print{display:none}}</style>
      </head><body><h1>Attendance Report</h1><div class="meta"><strong>Class:</strong> ${className} | <strong>Date:</strong> ${selectedDate} | <strong>Total Students:</strong> ${students.length}</div>
      <table><thead><tr><th>#</th><th>Admission #</th><th>Student Name</th><th>Status</th></tr></thead><tbody>
      ${students.map((student, index) => { const status = attendance[student.id] || 'Not Marked'; return `<tr><td>${index + 1}</td><td>${student.admission_number || '-'}</td><td>${student.first_name} ${student.last_name}</td><td>${status.charAt(0).toUpperCase() + status.slice(1)}</td></tr>`; }).join('')}
      </tbody></table><div class="summary"><strong>Summary:</strong> Present: ${selectedSummary.present} | Absent: ${selectedSummary.absent} | Late: ${selectedSummary.late} | Excused: ${selectedSummary.excused} | Unmarked: ${selectedSummary.unmarked}</div>
      <div class="no-print" style="margin-top:20px;text-align:center"><button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer">Print Report</button></div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const markedTeacherCount = Object.values(teacherAttendance).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Attendance</h1>
          <p className="text-sm text-[#666666]">Review learner attendance across all classes and mark the teacher register.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600"><CalendarDays className="w-4 h-4" /> {selectedDate}</div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        <button onClick={() => setActiveTab('learners')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${activeTab === 'learners' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}><Users className="inline w-4 h-4 mr-1" /> Learner summaries</button>
        <button onClick={() => setActiveTab('teachers')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${activeTab === 'teachers' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}><ShieldCheck className="inline w-4 h-4 mr-1" /> Teacher attendance register</button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <label className="block text-xs font-medium text-gray-500 mb-1">Attendance date</label>
        <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-full sm:w-64 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
      </div>

      {activeTab === 'learners' ? (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100"><h2 className="font-bold text-gray-900">All-class learner attendance summary</h2><p className="text-xs text-gray-500 mt-1">School Admin can review all classes here. Learner attendance is marked only by the assigned class teacher.</p></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-gray-50 border-b"><th className="px-4 py-3">Class</th><th className="px-4 py-3">Learners</th><th className="px-4 py-3 text-green-700">Present</th><th className="px-4 py-3 text-red-700">Absent</th><th className="px-4 py-3 text-yellow-700">Late</th><th className="px-4 py-3 text-blue-700">Excused</th><th className="px-4 py-3 text-gray-500">Unmarked</th></tr></thead><tbody>
              {classes.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-500">No active classes found.</td></tr> : classes.map((classRow) => { const summary = classSummaries[classRow.id] || emptySummary(); return <tr key={classRow.id} className="border-b last:border-0 hover:bg-gray-50"><td className="px-4 py-3 font-semibold">{classRow.name}{classRow.stream ? ` (${classRow.stream})` : ''}</td><td className="px-4 py-3">{summary.total}</td><td className="px-4 py-3 text-green-700">{summary.present}</td><td className="px-4 py-3 text-red-700">{summary.absent}</td><td className="px-4 py-3 text-yellow-700">{summary.late}</td><td className="px-4 py-3 text-blue-700">{summary.excused}</td><td className="px-4 py-3 text-gray-500">{summary.unmarked}</td></tr>; })}
            </tbody></table></div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div><h2 className="font-bold text-gray-900">Class attendance detail</h2><p className="text-xs text-gray-500 mt-1">This view is read-only for School Admin.</p></div><div className="flex gap-2"><select value={selectedClass} onChange={(event) => handleClassChange(event.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"><option value="">Select class</option>{classes.map((classRow) => <option key={classRow.id} value={classRow.id}>{classRow.name}{classRow.stream ? ` (${classRow.stream})` : ''}</option>)}</select>{selectedClass && students.length > 0 && <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200"><Printer className="w-4 h-4" /> Print</button>}</div></div>
            {!selectedClass ? <div className="text-center py-10 text-sm text-gray-500">Select a class to view learner attendance details.</div> : loading ? <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div> : students.length === 0 ? <div className="text-center py-10 text-sm text-gray-500">No learners found in this class.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-gray-50 border-b"><th className="px-3 py-2">#</th><th className="px-3 py-2">Admission #</th><th className="px-3 py-2">Learner</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{students.map((student, index) => <tr key={student.id} className="border-b last:border-0"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2">{student.admission_number}</td><td className="px-3 py-2 font-medium">{student.first_name} {student.last_name}</td><td className="px-3 py-2">{attendance[student.id] || 'Not Marked'}</td></tr>)}</tbody></table></div>}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div><h2 className="font-bold text-gray-900">Teacher attendance register</h2><p className="text-xs text-gray-500 mt-1">School Admin records attendance for active teachers on the selected date.</p></div><button onClick={saveTeacherAttendance} disabled={teacherSaving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{teacherSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {teacherSaving ? 'Saving...' : `Save register (${markedTeacherCount}/${teacherRows.length})`}</button></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-gray-50 border-b"><th className="px-3 py-3">#</th><th className="px-3 py-3">Teacher</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{teacherRows.length === 0 ? <tr><td colSpan={3} className="text-center py-10 text-gray-500">No active teachers found.</td></tr> : teacherRows.map((teacher) => <tr key={teacher.id} className="border-b last:border-0"><td className="px-3 py-3">{teacher.teacher_number ? String(teacher.teacher_number).padStart(2, '0') : '—'}</td><td className="px-3 py-3 font-medium">{teacher.first_name} {teacher.last_name}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2">{teacherStatusOptions.map((status) => <button key={status.key} onClick={() => setTeacherAttendance((current) => ({ ...current, [teacher.id]: current[teacher.id] === status.key ? '' : status.key }))} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${teacherAttendance[teacher.id] === status.key ? `${status.color} text-white` : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>{status.icon}{status.label}</button>)}</div></td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  );
}
