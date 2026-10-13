import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
}

export default function StudentAttendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, excused: 0 });

  useEffect(() => { fetchAttendance(); }, []);

  const fetchAttendance = async () => {
    const { data: student } = await supabaseUntyped.from('students').select('id').or('is_active.eq.true,is_active.is.null').eq('profile_id', user?.id).single();
    if (student) {
      const { data } = await supabaseUntyped.from('attendance').select('*').eq('student_id', student.id).order('date', { ascending: false }).limit(30);
      const typed = (data || []) as AttendanceRecord[];
      setRecords(typed);
      setStats({
        present: typed.filter(a => a.status === 'present').length,
        absent: typed.filter(a => a.status === 'absent').length,
        late: typed.filter(a => a.status === 'late').length,
        excused: typed.filter(a => a.status === 'excused').length,
      });
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'absent': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'late': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'excused': return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const total = stats.present + stats.absent + stats.late + stats.excused;
  const presentRate = total ? Math.round((stats.present / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#111111]">My Attendance</h1><p className="text-sm text-[#666666]">Recent attendance records</p></div>
      
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-green-200 mb-2">
            <span className="text-2xl font-bold text-green-600">{presentRate}%</span>
          </div>
          <p className="text-sm text-[#666666]">Attendance Rate</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Present', count: stats.present, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Absent', count: stats.absent, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Late', count: stats.late, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Excused', count: stats.excused, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-xl p-3 text-center`}>
              <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
              <div className="text-[10px] text-[#666666]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Date</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Status</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Remarks</th>
            </tr></thead>
            <tbody>
              {records.length === 0 ? <tr><td colSpan={3} className="text-center py-8 text-sm text-[#666666]">No attendance records</td></tr> :
               records.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm">{new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                  <td className="px-6 py-4"><span className="flex items-center gap-1 text-sm font-medium capitalize">{statusIcon(r.status)}{r.status}</span></td>
                  <td className="px-6 py-4 text-sm text-[#666666]">{r.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
