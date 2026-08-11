import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Download, Save, RefreshCw, Clock, Calendar, BookOpen, GraduationCap, Loader2, Eye, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject?: string;
  room?: string;
  class_name?: string;
}

interface TimetableData {
  [day: string]: TimeSlot[];
}

interface TeacherSlot {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  subject_name: string;
  class_name: string;
  room?: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { id: '1', day: '', startTime: '08:00', endTime: '08:40', subject: '', room: '' },
  { id: '2', day: '', startTime: '08:40', endTime: '09:20', subject: '', room: '' },
  { id: '3', day: '', startTime: '09:20', endTime: '10:00', subject: '', room: '' },
  { id: '4', day: '', startTime: '10:00', endTime: '10:30', subject: 'BREAK', room: '' },
  { id: '5', day: '', startTime: '10:30', endTime: '11:10', subject: '', room: '' },
  { id: '6', day: '', startTime: '11:10', endTime: '11:50', subject: '', room: '' },
  { id: '7', day: '', startTime: '11:50', endTime: '12:30', subject: '', room: '' },
  { id: '8', day: '', startTime: '12:30', endTime: '13:30', subject: 'LUNCH', room: '' },
  { id: '9', day: '', startTime: '13:30', endTime: '14:10', subject: '', room: '' },
  { id: '10', day: '', startTime: '14:10', endTime: '14:50', subject: '', room: '' },
];

// Grid rows are anchored to the unique start times of the teacher's actual lessons
// (every 30/40-minute lesson start is shown, so no lesson is ever hidden).
// Grid rows are anchored to the actual start times of the teacher's lessons so
// every lesson is visible even when schools use 40-minute periods. Simultaneous
// lessons (e.g. two classes starting at the same time) are stacked in the cell.
const getPersonalGridTimes = (slots: TeacherSlot[]): string[] => {
  const starts = Array.from(new Set(slots.map(s => s.start_time.substring(0, 5)))).sort();
  if (starts.length === 0) return VIEW_TIME_SLOTS;
  return starts;
};

const VIEW_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
];

export default function TeacherTimetable() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'personal' | 'edit'>('personal');
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [timetableData, setTimetableData] = useState<TimetableData>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Personalized view state
  const [teacherSlots, setTeacherSlots] = useState<TeacherSlot[]>([]);
  const [teacherName, setTeacherName] = useState('');
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(true);

  useEffect(() => {
    fetchPersonalizedTimetable();
    fetchTeacherClasses();
    fetchTeacherSubjects();
  }, []);

  useEffect(() => {
    if (selectedClass && viewMode === 'edit') {
      fetchTimetable();
    }
  }, [selectedClass, selectedTerm, selectedYear, viewMode]);

  // Personalized timetable fetch (Issue 16)
  const fetchPersonalizedTimetable = async () => {
    setLoadingPersonal(true);
    try {
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id, first_name, last_name')
        .eq('profile_id', user?.id)
        .single();

      if (!teacherData) { setLoadingPersonal(false); return; }

      setTeacherName(`${teacherData.first_name || ''} ${teacherData.last_name || ''}`);

      // Show only active class-and-subject assignments belonging to this teacher.
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('class_id, subject_id, classes(name), subjects(name)')
        .eq('teacher_id', teacherData.id)
        .eq('is_active', true);

      setTeacherAssignments(assignments || []);

      // timetable_entries is the canonical generated timetable. Joining its time
      // slots ensures that this page contains only lessons assigned to this teacher.
      const { data: timetableEntries, error: timetableError } = await supabaseUntyped
        .from('timetable_entries')
        .select('id, day_of_week, teacher_id, timetable_time_slots(start_time, end_time), subjects(name), classes(name)')
        .eq('teacher_id', teacherData.id)
        .in('entry_type', ['lesson', 'class', 'activity'])
        .order('day_of_week');
      if (timetableError) throw timetableError;

      const dayNames: Record<number, string> = {
        1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday',
      };
      const mappedSlots: TeacherSlot[] = (timetableEntries || []).map((entry: any) => ({
        id: entry.id,
        day: dayNames[entry.day_of_week] || 'Monday',
        start_time: entry.timetable_time_slots?.start_time?.toString().substring(0, 5) || '',
        end_time: entry.timetable_time_slots?.end_time?.toString().substring(0, 5) || '',
        subject_name: entry.subjects?.name || 'Learning Area',
        class_name: entry.classes?.name || 'Class',
      })).sort((a, b) => a.day.localeCompare(b.day) || a.start_time.localeCompare(b.start_time));

      setTeacherSlots(mappedSlots);
    } catch (err) {
      console.error('Error fetching personalized timetable:', err);
    }
    setLoadingPersonal(false);
  };

  const fetchTeacherClasses = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      // Resolve the teacher's DB id from the teachers table using profile_id
      const { data: teacherRow } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', authUser.id)
        .maybeSingle();
      if (!teacherRow?.id) {
        // No teacher record found — show empty state instead of error
        setClasses([]);
        return;
      }
      const { data, error } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('classes(id, name, grade_level)')
        .eq('teacher_id', teacherRow.id)
        .eq('is_active', true);
      if (error) throw error;
      const uniqueClasses = Array.from(new Map((data || []).map((item: any) => [item.classes?.id, item.classes])).values());
      setClasses(uniqueClasses.filter(Boolean) || []);
    } catch (err) {
      console.error('Error loading classes:', err);
      // Show empty state rather than error toast — teacher may simply have no classes yet
      setClasses([]);
    }
  };

  const fetchTeacherSubjects = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      // Resolve the teacher's DB id from the teachers table using profile_id
      const { data: teacherRow } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', authUser.id)
        .maybeSingle();
      if (!teacherRow?.id) {
        setSubjects([]);
        return;
      }
      const { data, error } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('subjects(id, name)')
        .eq('teacher_id', teacherRow.id);
      if (error) throw error;
      setSubjects(data?.map((ts: any) => ts.subjects).filter(Boolean) || []);
    } catch (err) {
      console.error('Error loading subjects:', err);
      setSubjects([]);
    }
  };

  const fetchTimetable = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      // Get school_id from profile
      const { data: profileData } = await supabase.from('profiles').select('school_id').eq('id', authUser.id).single();
      const schoolId = profileData?.school_id;
      if (!schoolId) { setTimetableData(generateEmptyTimetable()); return; }

      // Fetch time slots for this school/class
      const { data: slots, error: slotError } = await supabaseUntyped
        .from('timetable_time_slots')
        .select('*')
        .eq('school_id', schoolId)
        .order('slot_order');
      if (slotError) throw slotError;

      // Fetch timetable entries for this class
      const { data: entries, error: entryError } = await supabaseUntyped
        .from('timetable_entries')
        .select('*, subjects(name)')
        .eq('class_id', selectedClass)
        .eq('school_id', schoolId);
      if (entryError) throw entryError;

      // Build timetable data from entries
      const dayMap: Record<string, string[]> = {
        'Monday': '08:00', 'Tuesday': '08:00', 'Wednesday': '08:00', 'Thursday': '08:00', 'Friday': '08:00'
      };
      const dayNames: Record<number, string> = {
        1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday'
      };
      const timetable: TimetableData = {};
      const slotsByTime: Map<string, { start_time: string; end_time: string }> = new Map();
      (slots || []).forEach((s: any) => {
        slotsByTime.set(s.id, { start_time: s.start_time?.toString().substring(0, 5) || '', end_time: s.end_time?.toString().substring(0, 5) || '' });
      });

      DAYS_OF_WEEK.forEach(day => { timetable[day] = []; });
      (entries || []).forEach((e: any) => {
        const dayName = dayNames[e.day_of_week] || 'Monday';
        const slot = slotsByTime.get(e.time_slot_id);
        timetable[dayName].push({
          id: e.id,
          day: dayName,
          startTime: slot?.start_time || '08:00',
          endTime: slot?.end_time || '08:40',
          subject: e.entry_type === 'class' ? (e.subjects?.name || e.activity_name || '') : (e.activity_name || e.entry_type || ''),
          room: undefined,
          class_name: selectedClass,
        });
      });

      // Sort each day by startTime
      DAYS_OF_WEEK.forEach(day => {
        timetable[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      setTimetableData(timetable);
    } catch { setTimetableData(generateEmptyTimetable()); }
    finally { setLoading(false); }
  };

  const generateEmptyTimetable = (): TimetableData => {
    const timetable: TimetableData = {};
    DAYS_OF_WEEK.forEach(day => {
      timetable[day] = DEFAULT_TIME_SLOTS.map((slot, idx) => ({ ...slot, id: `${day}-${idx}`, day }));
    });
    return timetable;
  };

  const handleSubjectChange = (day: string, slotId: string, subject: string) => {
    setTimetableData(prev => ({ ...prev, [day]: prev[day].map(slot => slot.id === slotId ? { ...slot, subject } : slot) }));
  };

  const saveTimetable = async () => {
    if (!selectedClass) { toast.error('Please select a class'); return; }
    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: school } = await supabase.from('profiles').select('school_id').eq('id', authUser.id).single();
      const schoolId = school?.school_id;
      if (!schoolId) { toast.error('No school found'); return; }

      // Get teacher_id from teachers table
      const { data: teacherInfo } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', authUser.id)
        .single();
      const teacherId = teacherInfo?.id;

      const dayToNum: Record<string, number> = {
        'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5
      };

      // Get subject IDs for the subjects we have
      const { data: allSubjects } = await supabaseUntyped
        .from('subjects')
        .select('id, name')
        .eq('school_id', schoolId);
      const subjectMap = new Map<string, string>();
      (allSubjects || []).forEach((s: any) => { subjectMap.set(s.name, s.id); });

      // Get time slot IDs for this school
      const { data: allSlots } = await supabaseUntyped
        .from('timetable_time_slots')
        .select('*')
        .eq('school_id', schoolId)
        .order('slot_order');
      const slotsByTime = new Map<string, any>();
      (allSlots || []).forEach((s: any) => {
        slotsByTime.set(s.start_time?.toString().substring(0, 5) || '', s);
      });

      // Build entries from timetableData
      const entries: any[] = [];
      DAYS_OF_WEEK.forEach(day => {
        const dayNum = dayToNum[day] || 1;
        const slots = timetableData[day] || [];
        slots.forEach(slot => {
          const subjectId = subjectMap.get(slot.subject || '') || null;
          const timeSlot = slotsByTime.get(slot.startTime || '');
          const entryType = (slot.subject === 'BREAK' || slot.subject === 'LUNCH' || !slot.subject) ? 'break' : 'class';
          entries.push({
            school_id: schoolId,
            day_of_week: dayNum,
            time_slot_id: timeSlot?.id || null,
            class_id: selectedClass,
            subject_id: subjectId,
            teacher_id: teacherId || null,
            entry_type: entryType,
            activity_name: slot.subject || null,
          });
        });
      });

      // Delete existing entries for this class and insert new ones
      await supabaseUntyped.from('timetable_entries').delete().eq('class_id', selectedClass).eq('school_id', schoolId);
      if (entries.length > 0) {
        const { error: insertError } = await supabaseUntyped.from('timetable_entries').insert(entries);
        if (insertError) throw insertError;
      }
      toast.success('Timetable saved successfully');
      // Refresh
      fetchTimetable();
    } catch (err: any) { toast.error(err.message || 'Failed to save timetable'); }
    finally { setSaving(false); }
  };

  const exportPersonalTimetablePDF = () => {
    if (teacherSlots.length === 0) {
      toast.error('No personal timetable entries are available to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 297, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('MY PERSONAL TIMETABLE', 14, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${teacherName || 'Teacher'} · Generated ${new Date().toLocaleDateString()}`, 14, 20);

    const timeRanges = Array.from(new Set(teacherSlots.map((slot) => `${slot.start_time}-${slot.end_time}`)))
      .sort((a, b) => a.localeCompare(b));
    const body = timeRanges.map((timeRange) => {
      const [startTime, endTime] = timeRange.split('-');
      const row = [`${startTime} – ${endTime}`];
      DAYS_OF_WEEK.forEach((day) => {
        const slot = teacherSlots.find((item) => item.day === day && item.start_time === startTime && item.end_time === endTime);
        row.push(slot ? `${slot.subject_name}\n${slot.class_name}${slot.room ? `\nRoom: ${slot.room}` : ''}` : '');
      });
      return row;
    });

    autoTable(doc, {
      startY: 35,
      head: [['Time', ...DAYS_OF_WEEK]],
      body,
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      margin: { left: 12, right: 12 },
    });
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Zamifu Analytics School Management System', 148.5, 200, { align: 'center' });
    doc.save(`my-personal-timetable-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Personal timetable exported as PDF.');
  };

  const exportToPDF = () => {
    if (!selectedClass || Object.keys(timetableData).length === 0) { toast.error('Please create a timetable first'); return; }
    const doc = new jsPDF();
    const selectedClassObj = classes.find(c => c.id === selectedClass);
    doc.setFontSize(16); doc.text(`${selectedClassObj?.name} - Teaching Timetable`, 14, 15);
    doc.setFontSize(10); doc.text(`Term: ${selectedTerm} | Year: ${selectedYear}`, 14, 25);
    const tableData: any[] = [];
    const timeSlots = timetableData[DAYS_OF_WEEK[0]] || [];
    timeSlots.forEach(slot => {
      const row = [`${slot.startTime} - ${slot.endTime}`];
      DAYS_OF_WEEK.forEach(day => {
        const daySlots = timetableData[day] || [];
        const daySlot = daySlots.find(s => s.startTime === slot.startTime);
        row.push(daySlot?.subject || '');
      });
      tableData.push(row);
    });
    autoTable(doc, { head: [['Time', ...DAYS_OF_WEEK]], body: tableData, startY: 35, styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [41, 128, 185], textColor: 255 }, alternateRowStyles: { fillColor: [240, 240, 240] } });
    doc.save(`${selectedClassObj?.name}-timetable-${selectedYear}.pdf`);
    toast.success('Timetable exported to PDF');
  };

  // Helper for personalized view
  // Slots for a day/time cell — grid rows are anchored to actual lesson start
  // times, so each lesson appears exactly once in its own start row; cells may
  // stack multiple simultaneous lessons (e.g. two classes at the same time).
  const getSlotsForDayTime = (day: string, time: string): TeacherSlot[] => {
    return teacherSlots.filter(s => {
      if (s.day.toLowerCase() !== day.toLowerCase()) return false;
      return s.start_time.substring(0, 5) === time;
    });
  };

  const getSlotForDayTime = (day: string, time: string): TeacherSlot | null => {
    return teacherSlots.find(s => {
      if (s.day.toLowerCase() !== day.toLowerCase()) return false;
      const slotStart = s.start_time.substring(0, 5);
      const slotEnd = s.end_time.substring(0, 5);
      return time >= slotStart && time < slotEnd;
    }) || null;
  };

  const getSubjectColor = (subject: string): string => {
    const colors: Record<string, string> = {
      'Mathematics': 'bg-blue-100 text-blue-700 border-blue-200',
      'English': 'bg-green-100 text-green-700 border-green-200',
      'Kiswahili': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Science': 'bg-purple-100 text-purple-700 border-purple-200',
      'Social Studies': 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return colors[subject] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Timetable</h1>
          <p className="text-gray-500 text-sm mt-1">
            {viewMode === 'personal' ? `Personalized schedule for ${teacherName || 'you'}` : 'Create and manage your weekly teaching schedule'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('personal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'personal' ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
          >
            <Eye className="w-4 h-4" /> My View
          </button>
          {/* Issue 12: Edit Timetable button removed - teachers cannot edit their timetable */}
        </div>
      </div>

      {/* PERSONALIZED VIEW (Issue 16) */}
      {viewMode === 'personal' && (
        <>
          {/* Teacher assignments summary */}
          {teacherAssignments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teacherAssignments.map((a, i) => (
                <div key={i} className="bg-white rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)] flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.subjects?.name}</p>
                    <p className="text-xs text-gray-500">{a.classes?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Personalized Timetable Grid */}
          <div className="flex justify-end">
            <button
              onClick={exportPersonalTimetablePDF}
              disabled={loadingPersonal || teacherSlots.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Download My Timetable (PDF)
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
            {loadingPersonal ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#2563EB] text-white">
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase w-20">
                        <Clock className="w-4 h-4 inline mr-1" />Time
                      </th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day} className="px-3 py-3 text-center text-xs font-semibold uppercase w-40">
                          <Calendar className="w-4 h-4 inline mr-1" />{day.substring(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getPersonalGridTimes(teacherSlots).map((time, idx) => (
                      <tr key={time} className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}>
                        <td className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-100">{time}</td>
                        {DAYS_OF_WEEK.map(day => {
                          const slots = getSlotsForDayTime(day, time);
                          return (
                            <td key={day} className="border border-gray-100 px-1 py-1">
                              {slots.map(s => (
                                <div key={s.id} className={`rounded-lg p-2 border ${getSubjectColor(s.subject_name)}`}>
                                  <p className="text-xs font-bold truncate">{s.subject_name}</p>
                                  <p className="text-xs flex items-center gap-1 mt-0.5">
                                    <GraduationCap className="w-3 h-3" /> {s.class_name}
                                  </p>
                                  {s.room && <p className="text-xs text-gray-500 mt-0.5">Rm: {s.room}</p>}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {teacherSlots.length === 0 && !loadingPersonal && (
            <div className="bg-white rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Timetable Generated Yet</h3>
              <p className="text-sm text-gray-500 mb-2">Your personalized timetable will appear here once your school admin generates the timetable.</p>
              {teacherAssignments.length > 0 ? (
                <p className="text-xs text-blue-500">You have {teacherAssignments.length} class/subject assignment(s). Ask your admin to generate the timetable.</p>
              ) : (
                <p className="text-xs text-gray-400">No class assignments found. Please contact your school admin to assign you to classes.</p>
              )}
            </div>
          )}
        </>
      )}

      {/* EDIT VIEW */}
      {/* Issue 12: Edit mode removed - teachers cannot edit their timetable */}
      {false && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : selectedClass ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium min-w-24">Time</th>
                      {DAYS_OF_WEEK.map(day => <th key={day} className="px-4 py-3 font-medium min-w-32">{day}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(timetableData[DAYS_OF_WEEK[0]] || []).map((slot, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700 bg-gray-50">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{slot.startTime} - {slot.endTime}
                          </div>
                        </td>
                        {DAYS_OF_WEEK.map(day => {
                          const daySlot = (timetableData[day] || [])[idx];
                          const isBreak = daySlot?.subject === 'BREAK' || daySlot?.subject === 'LUNCH';
                          return (
                            <td key={day} className={`px-4 py-3 ${isBreak ? 'bg-yellow-50' : ''}`}>
                              {isBreak ? (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">{daySlot?.subject}</span>
                              ) : (
                                <input type="text" value={daySlot?.subject || ''} list="subjects-list"
                                  onChange={e => handleSubjectChange(day, daySlot?.id || '', e.target.value)}
                                  placeholder="Subject"
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a class to create or edit your timetable</p>
            </div>
          )}

          <datalist id="subjects-list">
            {subjects.map(subject => <option key={subject.id} value={subject.name} />)}
          </datalist>
        </>
      )}
    </div>
  );
}
