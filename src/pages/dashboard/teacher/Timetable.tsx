import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Download, Save, RefreshCw, Clock, Calendar, BookOpen, GraduationCap, Loader2, Eye, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

      // Get teacher's assignments
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('class_id, subject_id, classes(name), subjects(name)')
        .eq('teacher_id', teacherData.id);

      setTeacherAssignments(assignments || []);

      // Fetch timetable slots for this teacher
      const { data: timetableSlots } = await supabaseUntyped
        .from('timetable_slots')
        .select('*, subjects(name), classes(name)')
        .eq('teacher_id', teacherData.id)
        .order('day')
        .order('start_time');

      // Also check if teacher is a class teacher
      const { data: teacherInfo } = await supabaseUntyped
        .from('teachers')
        .select('class_id')
        .eq('id', teacherData.id)
        .single();

      let allSlots: any[] = timetableSlots || [];

      if (teacherInfo?.class_id) {
        const { data: classSlots } = await supabaseUntyped
          .from('timetable_slots')
          .select('*, subjects(name), classes(name)')
          .eq('class_id', teacherInfo.class_id)
          .order('day')
          .order('start_time');
        if (classSlots) {
          const existingIds = new Set(allSlots.map((s: any) => s.id));
          classSlots.forEach((s: any) => { if (!existingIds.has(s.id)) allSlots.push(s); });
        }
      }

      const mappedSlots: TeacherSlot[] = allSlots.map((s: any) => ({
        id: s.id,
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
        subject_name: s.subjects?.name || s.subject_name || 'Unknown',
        class_name: s.classes?.name || s.class_name || 'Unknown',
        room: s.room,
        teacher_id: s.teacher_id,
      }));

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
      const { data, error } = await supabase
        .from('teacher_classes')
        .select('classes(id, name, grade_level)')
        .eq('teacher_id', authUser.id);
      if (error) throw error;
      setClasses(data?.map((tc: any) => tc.classes) || []);
    } catch { toast.error('Failed to load classes'); }
  };

  const fetchTeacherSubjects = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data, error } = await supabase
        .from('teacher_subject_assignments')
        .select('subjects(id, name)')
        .eq('teacher_id', authUser.id);
      if (error) throw error;
      setSubjects(data?.map((ts: any) => ts.subjects) || []);
    } catch { toast.error('Failed to load subjects'); }
  };

  const fetchTimetable = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data, error } = await supabase
        .from('teacher_timetables')
        .select('*')
        .eq('teacher_id', authUser.id)
        .eq('class_id', selectedClass)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYear)
        .single();
      if (error && (error as any).code !== 'PGRST116') throw error;
      if (data) { setTimetableData(data.timetable_data || generateEmptyTimetable()); }
      else { setTimetableData(generateEmptyTimetable()); }
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
      const { error } = await supabase.from('teacher_timetables').upsert({
        teacher_id: authUser.id, school_id: school?.school_id, class_id: selectedClass,
        term: selectedTerm, academic_year: selectedYear, timetable_data: timetableData, is_published: false,
      }, { onConflict: 'teacher_id,class_id,term,academic_year' });
      if (error) throw error;
      toast.success('Timetable saved successfully');
    } catch (err: any) { toast.error(err.message || 'Failed to save timetable'); }
    finally { setSaving(false); }
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
    (doc as any).autoTable({ head: [['Time', ...DAYS_OF_WEEK]], body: tableData, startY: 35, styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [41, 128, 185], textColor: 255 }, alternateRowStyles: { fillColor: [240, 240, 240] } });
    doc.save(`${selectedClassObj?.name}-timetable-${selectedYear}.pdf`);
    toast.success('Timetable exported to PDF');
  };

  // Helper for personalized view
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
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'edit' ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
          >
            <Edit3 className="w-4 h-4" /> Edit Timetable
          </button>
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
                    {VIEW_TIME_SLOTS.map((time, idx) => (
                      <tr key={time} className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}>
                        <td className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-100">{time}</td>
                        {DAYS_OF_WEEK.map(day => {
                          const slot = getSlotForDayTime(day, time);
                          const isStart = slot && slot.start_time.substring(0, 5) === time;
                          if (slot && !isStart) return <td key={day} className="border border-gray-100" />;
                          return (
                            <td key={day} className="border border-gray-100 px-1 py-1">
                              {slot ? (
                                <div className={`rounded-lg p-2 border ${getSubjectColor(slot.subject_name)}`}>
                                  <p className="text-xs font-bold truncate">{slot.subject_name}</p>
                                  <p className="text-xs flex items-center gap-1 mt-0.5">
                                    <GraduationCap className="w-3 h-3" /> {slot.class_name}
                                  </p>
                                  {slot.room && <p className="text-xs text-gray-500 mt-0.5">Rm: {slot.room}</p>}
                                </div>
                              ) : null}
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
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Timetable Found</h3>
              <p className="text-sm text-gray-500 mb-2">Your personalized timetable will appear here once your school admin sets it up.</p>
              <p className="text-xs text-gray-400">You have {teacherAssignments.length} class/subject assignment(s).</p>
            </div>
          )}
        </>
      )}

      {/* EDIT VIEW */}
      {viewMode === 'edit' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select a class</option>
                  {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[2024, 2025, 2026, 2027].map(year => <option key={year} value={year.toString()}>{year}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={fetchTimetable} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
              <Download className="w-4 h-4" /> Export PDF
            </button>
            <button onClick={saveTimetable} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

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
