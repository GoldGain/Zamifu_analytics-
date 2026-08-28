import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Link } from 'react-router';
import { Award, CreditCard, ClipboardList, BookOpen, Bell } from 'lucide-react';
import PhotoZoomModal from '@/components/PhotoZoomModal';

interface StudentRecord {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  classes: { name: string } | null;
}

interface ResultRecord {
  id: string;
  marks: number | null;
  cbc_grade: string | null;
  grade_: string | null;
  subjects: { name: string } | null;
}

interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  type: string | null;
}

interface HomeworkRecord {
  id: string;
  title: string;
  due_date: string;
  subjects: { name: string } | null;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentRecord | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<ResultRecord[]>([]);
  const [feeBalance, setFeeBalance] = useState(0);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [homework, setHomework] = useState<HomeworkRecord[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: student } = await supabaseUntyped.from('students').select('*, classes(name)').eq('profile_id', user?.id).single();
    if (student) {
      setStudentData(student as unknown as StudentRecord);
      
      const sid = student.id ?? '';
      const clId = student.class_id ?? '';
      const schId = user?.schoolId ?? '';
      const [{ data: results }, { data: invoices }, { data: anns }, { data: hw }] = await Promise.all([
        supabaseUntyped.from('results').select('*, subjects(name), terms(name)').eq('student_id', sid).order('created_at', { ascending: false }).limit(5),
        supabaseUntyped.from('fee_invoices').select('*').eq('student_id', sid).is('deleted_at', null),
        supabaseUntyped.from('announcements').select('*').eq('school_id', schId).eq('is_published', true).order('created_at', { ascending: false }).limit(3),
        supabaseUntyped.from('homework').select('*, subjects(name)').eq('class_id', clId).eq('is_active', true).order('due_date').limit(3),
      ]);
      
      setRecentResults((results || []) as unknown as ResultRecord[]);
      setFeeBalance(((invoices ?? []) as any[]).reduce((sum: number, inv: any) => sum + Number(inv.balance ?? Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0))), 0) || 0);
      setAnnouncements((anns || []) as unknown as AnnouncementRecord[]);
      setHomework((hw || []) as unknown as HomeworkRecord[]);
    }
  };

  const gradeColor = (grade: string | null) => {
    if (!grade) return 'bg-gray-100 text-gray-700';
    if (grade.startsWith('EE')) return 'bg-green-100 text-green-700';
    if (grade.startsWith('ME')) return 'bg-blue-100 text-blue-700';
    if (grade.startsWith('AE')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#2563EB] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          {zoomPhoto && <PhotoZoomModal photoUrl={zoomPhoto} altText={studentData?.first_name} onClose={() => setZoomPhoto(null)} />}
          {studentData?.photo_url && (
            <img
              src={studentData.photo_url}
              alt={`${studentData.first_name} ${studentData.last_name}`}
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg cursor-zoom-in hover:opacity-90 transition-opacity"
              onClick={() => setZoomPhoto(studentData.photo_url!)}
              title="Click to zoom"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">Welcome, {user?.firstName}!</h1>
            <p className="text-white/80 mt-1">{studentData?.classes?.name} | {studentData?.admission_number}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/student/results" className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.12)] transition-all">
          <Award className="w-6 h-6 text-purple-500 mb-2" />
          <div className="text-lg font-bold text-[#111111]">{recentResults.length}</div>
          <div className="text-xs text-[#666666]">Recent Results</div>
        </Link>
        <Link to="/student/fees" className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.12)] transition-all">
          <CreditCard className="w-6 h-6 text-orange-500 mb-2" />
          <div className="text-lg font-bold text-red-500">Ksh {feeBalance.toLocaleString()}</div>
          <div className="text-xs text-[#666666]">Fee Balance</div>
        </Link>
        <Link to="/student/attendance" className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.12)] transition-all">
          <ClipboardList className="w-6 h-6 text-green-500 mb-2" />
          <div className="text-lg font-bold text-[#111111]">View</div>
          <div className="text-xs text-[#666666]">Attendance</div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#111111]">Recent Results</h3>
            <Link to="/student/results" className="text-sm text-[#2563EB] hover:underline">View All</Link>
          </div>
          {recentResults.length === 0 ? <p className="text-sm text-[#666666] text-center py-4">No results yet</p> : (
            <div className="space-y-3">
              {recentResults.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium">{r.subjects?.name}</p>
                    <p className="text-xs text-[#666666]">{r.percentage !== undefined && r.percentage !== null ? r.percentage : r.marks}%</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColor(r.cbc_grade || r.grade_)}`}>{r.cbc_grade || r.grade_}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#111111]">Upcoming Homework</h3>
            <Link to="/student/homework" className="text-sm text-[#2563EB] hover:underline">View All</Link>
          </div>
          {homework.length === 0 ? <p className="text-sm text-[#666666] text-center py-4">No homework</p> : (
            <div className="space-y-3">
              {homework.map(h => (
                <div key={h.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <BookOpen className="w-4 h-4 text-purple-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{h.title}</p>
                    <p className="text-xs text-[#666666]">{h.subjects?.name} | Due: {h.due_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4">School Announcements</h3>
        {announcements.length === 0 ? <p className="text-sm text-[#666666] text-center py-4">No announcements</p> : (
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <Bell className="w-4 h-4 text-[#2563EB] mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-[#666666] line-clamp-2">{a.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
