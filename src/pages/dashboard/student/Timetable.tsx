import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Clock } from 'lucide-react';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function StudentTimetable() {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<Record<string, any[]>>({});

  useEffect(() => { fetchTimetable(); }, []);

  const fetchTimetable = async () => {
    const { data: student } = await supabaseUntyped.from('students').select('class_id').or('is_active.eq.true,is_active.is.null').eq('profile_id', user?.id).single();
    if (student?.class_id) {
      const { data } = await supabaseUntyped.from('timetable').select('*, subjects(name)').eq('class_id', student.class_id).order('start_time');
      const grouped: Record<string, any[]> = {};
      days.forEach(d => grouped[d] = []);
      data?.forEach(item => { if (grouped[item.day_of_week]) grouped[item.day_of_week].push(item); });
      setTimetable(grouped);
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#111111]">My Timetable</h1><p className="text-sm text-[#666666]">Weekly class schedule</p></div>
      <div className="space-y-4">
        {days.map(day => (
          <div key={day} className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <h3 className="font-semibold text-[#111111] mb-3">{day}</h3>
            {timetable[day]?.length === 0 ? <p className="text-sm text-[#666666]">No classes</p> : (
              <div className="space-y-2">
                {timetable[day]?.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-[#2563EB] rounded-lg flex items-center justify-center text-white flex-shrink-0"><Clock className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.subjects?.name}</p>
                      <p className="text-xs text-[#666666]">{item.room && `Room ${item.room}`}</p>
                    </div>
                    <span className="text-xs font-medium text-[#2563EB]">{item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
