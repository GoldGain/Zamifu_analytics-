import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList, Check, X, Loader2, Save, Printer, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolAdminAttendance() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.schoolId) {
      fetchClasses();
    }
  }, [user?.schoolId]);

  const fetchClasses = async () => {
    const { data } = await supabaseUntyped
      .from('classes')
      .select('*')
      .eq('school_id', user?.schoolId)
      .order('name', { ascending: true });
    setClasses(data || []);
  };

  const fetchStudents = async (classId: string) => {
    setLoading(true);
    try {
      const { data } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('first_name', { ascending: true });
      setStudents(data || []);

      // Check existing attendance
      const { data: existing } = await supabaseUntyped
        .from('attendance')
        .select('*')
        .eq('class_id', classId)
        .eq('date', selectedDate);
      
      const map: Record<string, string> = {};
      existing?.forEach(a => { map[a.student_id] = a.status; });
      setAttendance(map);
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setSaved(false);
    if (classId) fetchStudents(classId);
    else setStudents([]);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSaved(false);
    if (selectedClass) fetchStudents(selectedClass);
  };

  const toggleStatus = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: prev[studentId] === status ? '' : status }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      const records = Object.entries(attendance)
        .filter(([_, status]) => status)
        .map(([studentId, status]) => ({
          school_id: user?.schoolId,
          student_id: studentId,
          class_id: selectedClass,
          date: selectedDate,
          status,
          // For school admin, we don't necessarily have a teacher_id, 
          // but we can leave it null or find the class teacher
        }));
      
      // Delete existing for this date/class
      await supabaseUntyped
        .from('attendance')
        .delete()
        .eq('class_id', selectedClass)
        .eq('date', selectedDate);
      
      if (records.length > 0) {
        const { error } = await supabaseUntyped.from('attendance').insert(records);
        if (!error) {
          setSaved(true);
          toast.success(`Attendance saved for ${records.length} students!`);
        } else {
          throw error;
        }
      } else {
        toast.info('No attendance marked.');
      }
    } catch (err: any) {
      toast.error('Failed to save attendance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusConfig = [
    { key: 'present', label: 'Present', color: 'bg-green-500', icon: <Check className="w-3 h-3" /> },
    { key: 'absent', label: 'Absent', color: 'bg-red-500', icon: <X className="w-3 h-3" /> },
    { key: 'late', label: 'Late', color: 'bg-yellow-500', icon: <ClipboardList className="w-3 h-3" /> },
    { key: 'excused', label: 'Excused', color: 'bg-blue-500', icon: <ClipboardList className="w-3 h-3" /> },
  ];

  const summary = {
    present: students.filter(s => attendance[s.id] === 'present').length,
    absent: students.filter(s => attendance[s.id] === 'absent').length,
    late: students.filter(s => attendance[s.id] === 'late').length,
    excused: students.filter(s => attendance[s.id] === 'excused').length,
    unmarked: students.filter(s => !attendance[s.id]).length,
  };
  const markedCount = summary.present + summary.absent + summary.late + summary.excused;

  const handlePrint = () => {
    const className = classes.find(c => c.id === selectedClass)?.name || 'Unknown';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report - ${className}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .present { color: green; font-weight: bold; }
          .absent { color: red; font-weight: bold; }
          .late { color: orange; font-weight: bold; }
          .excused { color: blue; font-weight: bold; }
          .summary { margin-top: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px; font-size: 12px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>Attendance Report</h1>
        <div class="meta">
          <strong>Class:</strong> ${className} | 
          <strong>Date:</strong> ${selectedDate} | 
          <strong>Total Students:</strong> ${students.length}
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Admission #</th>
              <th>Student Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((s, i) => {
              const status = attendance[s.id] || 'Not Marked';
              const statusClass = attendance[s.id] || '';
              return \`<tr>
                <td>\${i + 1}</td>
                <td>\${s.admission_number || '-'}</td>
                <td>\${s.first_name} \${s.last_name}</td>
                <td class="\${statusClass}">\${status.charAt(0).toUpperCase() + status.slice(1)}</td>
              </tr>\`;
            }).join('')}
          </tbody>
        </table>
        <div class="summary">
          <strong>Summary:</strong> 
          Present: \${summary.present} | 
          Absent: \${summary.absent} | 
          Late: \${summary.late} | 
          Excused: \${summary.excused} | 
          Unmarked: \${summary.unmarked}
        </div>
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">Print Report</button>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">School Attendance</h1>
          <p className="text-sm text-[#666666]">Monitor and manage attendance across all classes</p>
        </div>
        {selectedClass && students.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        )}
      </div>
      
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Select Class</label>
            <select 
              value={selectedClass} 
              onChange={e => handleClassChange(e.target.value)} 
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="">-- Select Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.stream && `(${c.stream})`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Select Date</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => handleDateChange(e.target.value)} 
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
            />
          </div>
        </div>

        {selectedClass ? (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">No students found in this class.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{s.first_name} {s.last_name}</div>
                          <div className="text-xs text-gray-500">{s.admission_number}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {statusConfig.map(st => (
                          <button 
                            key={st.key} 
                            onClick={() => toggleStatus(s.id, st.key)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              attendance[s.id] === st.key 
                                ? `${st.color} text-white shadow-sm` 
                                : 'bg-white text-gray-400 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            {st.icon} {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-900">Summary ({markedCount}/{students.length} marked)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                      <div className="text-lg font-bold text-green-600">{summary.present}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Present</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                      <div className="text-lg font-bold text-red-600">{summary.absent}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Absent</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                      <div className="text-lg font-bold text-yellow-600">{summary.late}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Late</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                      <div className="text-lg font-bold text-blue-600">{summary.excused}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Excused</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                      <div className="text-lg font-bold text-gray-400">{summary.unmarked}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Unmarked</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="bg-[#2563EB] text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-md"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Attendance
                  </button>
                  {saved && <span className="text-sm text-green-600 font-bold flex items-center gap-1"><Check className="w-4 h-4" /> Changes Saved</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No Class Selected</h3>
            <p className="text-sm text-gray-500">Please select a class and date to view or mark attendance.</p>
          </div>
        )}
      </div>
    </div>
  );
}
