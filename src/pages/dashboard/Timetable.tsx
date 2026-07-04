import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Calendar, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
}

interface TimetableEntry {
  day_of_week: number;
  time_slot_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  is_break: boolean;
  is_lunch: boolean;
  is_activity: boolean;
  activity_name: string | null;
  classes?: { name: string };
  subjects?: { name: string };
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function Timetable() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [viewingClassId, setViewingClassId] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const { data: profile } = await supabaseUntyped
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (!profile?.school_id) {
        toast.error('No school assigned');
        return;
      }

      setSchoolId(profile.school_id);
      setUserRole(profile.role);

      // Fetch classes
      const { data: classesData } = await supabaseUntyped
        .from('classes')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('name');

      setClasses(classesData || []);

      if (classesData && classesData.length > 0) {
        setViewingClassId(classesData[0].id);
      }

      // Fetch time slots
      const { data: slotsData } = await supabaseUntyped
        .from('time_slots')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('slot_order');

      setTimeSlots(slotsData || []);

      // Fetch timetable entries
      const { data: entriesData } = await supabaseUntyped
        .from('timetable_entries')
        .select(`
          *,
          classes(name),
          subjects(name)
        `)
        .eq('school_id', profile.school_id);

      setEntries(entriesData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load timetable');
    }
    setLoading(false);
  };

  const getEntryForSlot = (dayOfWeek: number, timeSlotId: string, classId: string) => {
    return entries.find(
      e => e.day_of_week === dayOfWeek && e.time_slot_id === timeSlotId && e.class_id === classId
    );
  };

  const renderCellContent = (entry: TimetableEntry | undefined) => {
    if (!entry) return '-';
    if (entry.is_break) return 'BREAK';
    if (entry.is_lunch) return 'LUNCH';
    if (entry.is_activity) return entry.activity_name;
    return entry.subjects?.name || '-';
  };

  const exportPDF = async () => {
    if (!viewingClassId || timeSlots.length === 0) {
      toast.error('No timetable data to export');
      return;
    }

    setExporting(true);
    try {
      const doc = new jsPDF('landscape');
      const selectedClass = classes.find(c => c.id === viewingClassId);
      
      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Timetable - ${selectedClass?.name || 'Class'}`, 148, 15, { align: 'center' });

      // Create table data
      const tableData: string[][] = [];
      
      // Header row
      const header = ['Time', ...dayNames];
      tableData.push(header);

      // Data rows
      for (const slot of timeSlots) {
        const row = [`${slot.start_time}-${slot.end_time}`];
        for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
          const entry = getEntryForSlot(dayOfWeek, slot.id, viewingClassId);
          row.push(renderCellContent(entry));
        }
        tableData.push(row);
      }

      // Add table
      const tableConfig = {
        startY: 25,
        head: [tableData[0]],
        body: tableData.slice(1),
        theme: 'grid' as const,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 255] },
      };

      (doc as any).autoTable(tableConfig);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Zamifu Analytics School Management System', 148, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

      doc.save(`timetable_${selectedClass?.name || 'class'}.pdf`);
      toast.success('Timetable exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    }
    setExporting(false);
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Timetable</h1>
        <p className="text-sm text-[#666666]">View and download your school timetable</p>
      </div>

      {/* Class Selection */}
      {(userRole === 'school_admin' || userRole === 'super_admin') && classes.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <label className="block text-sm font-medium text-[#111111] mb-2">Select Class</label>
          <select
            value={viewingClassId}
            onChange={(e) => setViewingClassId(e.target.value)}
            className="w-full md:w-64 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Timetable View */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#111111] flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {classes.find(c => c.id === viewingClassId)?.name || 'Timetable'}
          </h2>
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export PDF
              </>
            )}
          </button>
        </div>

        {/* Timetable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="border border-gray-200 px-4 py-3 text-left font-bold text-[#111111]">Time</th>
                {dayNames.map(day => (
                  <th key={day} className="border border-gray-200 px-4 py-3 text-left font-bold text-[#111111]">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, idx) => (
                <tr key={slot.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-200 px-4 py-3 font-medium text-[#111111] whitespace-nowrap">
                    {slot.start_time}-{slot.end_time}
                  </td>
                  {dayNames.map((_, dayIdx) => {
                    const entry = getEntryForSlot(dayIdx + 1, slot.id, viewingClassId);
                    const content = renderCellContent(entry);
                    const isBreak = entry?.is_break;
                    const isLunch = entry?.is_lunch;
                    const isActivity = entry?.is_activity;

                    return (
                      <td
                        key={`${dayIdx}-${slot.id}`}
                        className={`border border-gray-200 px-4 py-3 text-center font-medium ${
                          isBreak || isLunch ? 'bg-yellow-50 text-yellow-900' :
                          isActivity ? 'bg-purple-50 text-purple-900' :
                          'text-[#111111]'
                        }`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
            <span className="text-[#666666]">Break/Lunch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-50 border border-purple-200 rounded"></div>
            <span className="text-[#666666]">Activity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border border-gray-200 rounded"></div>
            <span className="text-[#666666]">Lesson</span>
          </div>
        </div>
      </div>

      {/* Info */}
      {entries.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm text-blue-900">
            No timetable generated yet. Contact your school administrator to generate the timetable.
          </p>
        </div>
      )}
    </div>
  );
}
