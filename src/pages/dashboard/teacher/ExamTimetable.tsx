import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Download, Save, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ExamSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  room?: string;
  invigilator?: string;
}

interface ExamTimetableData {
  slots: ExamSlot[];
  conflicts: string[];
}

export default function ExamTimetable() {
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [examPeriod, setExamPeriod] = useState('Mid-term');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [examData, setExamData] = useState<ExamTimetableData>({ slots: [], conflicts: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({
    date: '',
    startTime: '',
    endTime: '',
    subject: '',
    room: '',
    invigilator: '',
  });

  useEffect(() => {
    fetchTeacherClasses();
    fetchTeacherSubjects();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchExamTimetable();
    }
  }, [selectedClass, examPeriod, selectedTerm, selectedYear]);

  const fetchTeacherClasses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('teacher_classes')
        .select('classes(id, name, grade_level)')
        .eq('teacher_id', user.id);

      if (error) throw error;
      setClasses(data?.map((tc: any) => tc.classes) || []);
    } catch (err: any) {
      toast.error('Failed to load classes');
    }
  };

  const fetchTeacherSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('teacher_subject_assignments')
        .select('subjects(id, name)')
        .eq('teacher_id', user.id);

      if (error) throw error;
      setSubjects(data?.map((ts: any) => ts.subjects) || []);
    } catch (err: any) {
      toast.error('Failed to load subjects');
    }
  };

  const fetchExamTimetable = async () => {
    if (!selectedClass) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('exam_timetables')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('exam_period', examPeriod)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYear)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setExamData(data.exam_schedule || { slots: [], conflicts: [] });
      } else {
        setExamData({ slots: [], conflicts: [] });
      }
    } catch (err: any) {
      toast.error('Failed to load exam timetable');
      setExamData({ slots: [], conflicts: [] });
    } finally {
      setLoading(false);
    }
  };

  const checkConflicts = (slots: ExamSlot[]): string[] => {
    const conflicts: string[] = [];

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i];
        const slot2 = slots[j];

        // Check if same date and overlapping times
        if (slot1.date === slot2.date) {
          const start1 = new Date(`2000-01-01 ${slot1.startTime}`);
          const end1 = new Date(`2000-01-01 ${slot1.endTime}`);
          const start2 = new Date(`2000-01-01 ${slot2.startTime}`);
          const end2 = new Date(`2000-01-01 ${slot2.endTime}`);

          if ((start1 < end2 && end1 > start2)) {
            conflicts.push(
              `⚠️ Conflict: ${slot1.subject} (${slot1.startTime}-${slot1.endTime}) overlaps with ${slot2.subject} (${slot2.startTime}-${slot2.endTime}) on ${slot1.date}`
            );
          }
        }
      }
    }

    return conflicts;
  };

  const addExamSlot = () => {
    if (!newSlot.date || !newSlot.startTime || !newSlot.endTime || !newSlot.subject) {
      toast.error('Please fill in all required fields');
      return;
    }

    const slot: ExamSlot = {
      id: `exam-${Date.now()}`,
      ...newSlot,
    };

    const updatedSlots = [...examData.slots, slot];
    const newConflicts = checkConflicts(updatedSlots);

    setExamData({
      slots: updatedSlots,
      conflicts: newConflicts,
    });

    setNewSlot({
      date: '',
      startTime: '',
      endTime: '',
      subject: '',
      room: '',
      invigilator: '',
    });

    setShowAddSlot(false);
    toast.success('Exam slot added');
  };

  const removeExamSlot = (id: string) => {
    const updatedSlots = examData.slots.filter(s => s.id !== id);
    const newConflicts = checkConflicts(updatedSlots);

    setExamData({
      slots: updatedSlots,
      conflicts: newConflicts,
    });
  };

  const saveExamTimetable = async () => {
    if (!selectedClass || examData.slots.length === 0) {
      toast.error('Please add at least one exam slot');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: school } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('exam_timetables')
        .upsert({
          school_id: school?.school_id,
          class_id: selectedClass,
          exam_period: examPeriod,
          term: selectedTerm,
          academic_year: selectedYear,
          exam_schedule: examData,
          created_by: user.id,
          is_published: false,
        }, {
          onConflict: 'school_id,class_id,exam_period,term,academic_year',
        });

      if (error) throw error;
      toast.success('Exam timetable saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save exam timetable');
    } finally {
      setSaving(false);
    }
  };

  const exportToPDF = () => {
    if (examData.slots.length === 0) {
      toast.error('Please add exam slots first');
      return;
    }

    const doc = new jsPDF();
    const selectedClassObj = classes.find(c => c.id === selectedClass);
    const title = `${selectedClassObj?.name} - Exam Timetable`;

    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Exam Period: ${examPeriod} | Term: ${selectedTerm} | Year: ${selectedYear}`, 14, 25);

    if (examData.conflicts.length > 0) {
      doc.setTextColor(255, 0, 0);
      doc.setFontSize(9);
      doc.text('⚠️ Conflicts Detected:', 14, 32);
      examData.conflicts.forEach((conflict, idx) => {
        doc.text(conflict, 14, 35 + idx * 5);
      });
      doc.setTextColor(0, 0, 0);
    }

    const tableData = examData.slots.map(slot => [
      slot.date,
      `${slot.startTime} - ${slot.endTime}`,
      slot.subject,
      slot.room || '-',
      slot.invigilator || '-',
    ]);

    (doc as any).autoTable({
      head: [['Date', 'Time', 'Subject', 'Room', 'Invigilator']],
      body: tableData,
      startY: examData.conflicts.length > 0 ? 50 : 35,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
    });

    doc.save(`${selectedClassObj?.name}-exam-timetable-${selectedYear}.pdf`);
    toast.success('Exam timetable exported to PDF');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Timetable</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage exam schedules with conflict detection</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchExamTimetable}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
          <button
            onClick={saveExamTimetable}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a class</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exam Period</label>
            <select
              value={examPeriod}
              onChange={e => setExamPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Mid-term">Mid-term</option>
              <option value="End-term">End-term</option>
              <option value="Mock">Mock</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Conflicts Alert */}
      {examData.conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">Scheduling Conflicts Detected</h3>
              <ul className="mt-2 space-y-1">
                {examData.conflicts.map((conflict, idx) => (
                  <li key={idx} className="text-sm text-red-700">{conflict}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Add Exam Slot Form */}
      {showAddSlot && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-medium text-gray-900 mb-4">Add Exam Slot</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                value={newSlot.date}
                onChange={e => setNewSlot({ ...newSlot, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
              <input
                type="time"
                value={newSlot.startTime}
                onChange={e => setNewSlot({ ...newSlot, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
              <input
                type="time"
                value={newSlot.endTime}
                onChange={e => setNewSlot({ ...newSlot, endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
              <input
                type="text"
                value={newSlot.subject}
                onChange={e => setNewSlot({ ...newSlot, subject: e.target.value })}
                placeholder="Subject"
                list="subjects-list"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Room</label>
              <input
                type="text"
                value={newSlot.room}
                onChange={e => setNewSlot({ ...newSlot, room: e.target.value })}
                placeholder="Room number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invigilator</label>
              <input
                type="text"
                value={newSlot.invigilator}
                onChange={e => setNewSlot({ ...newSlot, invigilator: e.target.value })}
                placeholder="Invigilator name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={addExamSlot}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Add Slot
            </button>
            <button
              onClick={() => setShowAddSlot(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Exam Slots Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : selectedClass ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-medium text-gray-900">Exam Schedule ({examData.slots.length} slots)</h3>
            {!showAddSlot && (
              <button
                onClick={() => setShowAddSlot(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" /> Add Slot
              </button>
            )}
          </div>

          {examData.slots.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Room</th>
                    <th className="px-4 py-3 font-medium">Invigilator</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {examData.slots.map(slot => (
                    <tr key={slot.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">{slot.date}</td>
                      <td className="px-4 py-3">{slot.startTime} - {slot.endTime}</td>
                      <td className="px-4 py-3 font-medium">{slot.subject}</td>
                      <td className="px-4 py-3">{slot.room || '-'}</td>
                      <td className="px-4 py-3">{slot.invigilator || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeExamSlot(slot.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No exam slots added yet</p>
              {!showAddSlot && (
                <button
                  onClick={() => setShowAddSlot(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Add First Slot
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Select a class to create or edit exam timetable</p>
        </div>
      )}

      {/* Subjects List for Autocomplete */}
      <datalist id="subjects-list">
        {subjects.map(subject => (
          <option key={subject.id} value={subject.name} />
        ))}
      </datalist>
    </div>
  );
}
