import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { Link } from 'react-router';
import { Users, CreditCard, Award, Bell, BookOpen } from 'lucide-react';
import PhotoZoomModal from '@/components/PhotoZoomModal';

interface ChildRecord {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
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
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildRecord | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [childResults, setChildResults] = useState<ResultRecord[]>([]);
  const [childFees, setChildFees] = useState(0);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: linked } = await supabaseUntyped.from('parent_student_links').select('*, students(*, classes(name))').eq('parent_id', user?.id);
    if (linked) {
      const kids = linked.map(l => l.students as unknown as ChildRecord);
      setChildren(kids);
      if (kids.length > 0) selectChild(kids[0]);
    }
    const { data: anns } = await supabaseUntyped.from('announcements').select('*').eq('school_id', user?.schoolId).eq('is_published', true).order('created_at', { ascending: false }).limit(3);
    setAnnouncements((anns || []) as unknown as AnnouncementRecord[]);
  };

  const selectChild = async (child: ChildRecord) => {
    setSelectedChild(child);
    const [{ data: results }, { data: invoices }] = await Promise.all([
      supabase.from('results').select('*, subjects(name)').eq('student_id', child.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('fee_invoices').select('balance, total_amount, amount_paid').eq('student_id', child.id).is('deleted_at', null),
    ]);
    setChildResults((results || []) as unknown as ResultRecord[]);
    setChildFees(((invoices as any[]) || []).reduce((s, i: any) => s + Number(i.balance ?? Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0))), 0) || 0);
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
      <div><h1 className="text-2xl font-bold text-[#111111]">Parent Dashboard</h1><p className="text-sm text-[#666666]">Welcome, {user?.firstName}</p></div>

      {children.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <p className="text-sm text-[#666666] mb-2">Select Child</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {children.map((child, i) => (
              <button key={i} onClick={() => selectChild(child)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all flex-shrink-0 ${selectedChild?.id === child.id ? 'bg-[#2563EB] text-white' : 'bg-gray-100 text-[#111111] hover:bg-gray-200'}`}>
                {child.photo_url ? (
                  <img src={child.photo_url} alt={`${child.first_name} ${child.last_name}`} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedChild?.id === child.id ? 'bg-white/20' : 'bg-blue-100'}`}>
                    {child.first_name[0]}{child.last_name[0]}
                  </div>
                )}
                <span className="text-sm font-medium">{child.first_name} {child.last_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedChild && (
        <>
          <div className="bg-[#2563EB] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-4">
              {zoomPhoto && <PhotoZoomModal photoUrl={zoomPhoto} altText={selectedChild.first_name} onClose={() => setZoomPhoto(null)} />}
              {selectedChild.photo_url && (
                <img
                  src={selectedChild.photo_url}
                  alt={`${selectedChild.first_name} ${selectedChild.last_name}`}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                  onClick={() => setZoomPhoto(selectedChild.photo_url!)}
                  title="Click to zoom"
                />
              )}
              <div>
                <h2 className="text-lg font-semibold">{selectedChild.first_name} {selectedChild.last_name}</h2>
                <p className="text-white/80 text-sm">{selectedChild.classes?.name} | {selectedChild.admission_number}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/parent/children" className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <Award className="w-6 h-6 text-purple-500 mb-2" />
              <div className="text-lg font-bold text-[#111111]">{childResults.length}</div>
              <div className="text-xs text-[#666666]">Results</div>
            </Link>
            <Link to="/parent/fees" className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <CreditCard className="w-6 h-6 text-orange-500 mb-2" />
              <div className="text-lg font-bold text-red-500">Ksh {childFees.toLocaleString()}</div>
              <div className="text-xs text-[#666666]">Fee Balance</div>
            </Link>
            <Link to="/parent/children" className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <Users className="w-6 h-6 text-green-500 mb-2" />
              <div className="text-lg font-bold text-[#111111]">View</div>
              <div className="text-xs text-[#666666]">Attendance</div>
            </Link>
            <Link to="/parent/conferences" className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <BookOpen className="w-6 h-6 text-blue-500 mb-2" />
              <div className="text-lg font-bold text-[#111111]">Book</div>
              <div className="text-xs text-[#666666]">Conference</div>
            </Link>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <h3 className="font-semibold text-[#111111] mb-4">Recent Results - {selectedChild.first_name}</h3>
            {childResults.length === 0 ? <p className="text-sm text-[#666666]">No results yet</p> : (
              <div className="space-y-3">
                {childResults.slice(0, 3).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div><p className="text-sm font-medium">{r.subjects?.name}</p><p className="text-xs text-[#666666]">{r.percentage !== undefined && r.percentage !== null ? r.percentage : r.marks}%</p></div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColor(r.cbc_grade || r.grade_)}`}>{r.cbc_grade || r.grade_}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4">School Announcements</h3>
        {announcements.length === 0 ? <p className="text-sm text-[#666666]">No announcements</p> : (
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <Bell className="w-4 h-4 text-[#2563EB] mt-0.5" />
                <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-[#666666] line-clamp-2">{a.content}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
