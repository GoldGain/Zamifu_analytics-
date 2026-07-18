import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Link } from 'react-router';
import { Upload, ClipboardList, BookOpen, Users, Clock, Trophy } from 'lucide-react';
import { computeBestPerSubject } from '@/lib/bestPerSubject';
import type { BestInSubject } from '@/lib/bestPerSubject';

interface TimetableEntry {
  id: string;
  start_time: string;
  end_time: string;
  room: string | null;
  subjects: { name: string } | null;
  classes: { name: string } | null;
}

interface SubjectBestMap {
  className: string;
  classId: string;
  classData: any;
  subjectName: string;
  termName: string;
  bests: BestInSubject[];
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [todayClasses, setTodayClasses] = useState<TimetableEntry[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [homeworkCount, setHomeworkCount] = useState(0);
  const [subjectBests, setSubjectBests] = useState<SubjectBestMap[]>([]);
  const [loadingBests, setLoadingBests] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const teacherId = user?.id;
    const schoolId = user?.schoolId;

    const { data: teacherData } = await supabaseUntyped
      .from('teachers')
      .select('id')
      .eq('profile_id', teacherId)
      .single();

    if (teacherData) {
      const tId = teacherData.id;
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const { data: classes } = await supabaseUntyped
        .from('timetable')
        .select('*, subjects(name), classes(name)')
        .eq('teacher_id', tId)
        .eq('day_of_week', today.charAt(0).toUpperCase() + today.slice(1));
      setTodayClasses((classes || []) as unknown as TimetableEntry[]);

      const { count: sCount } = await supabaseUntyped
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId);
      setStudentCount(sCount || 0);

      const { count: hCount } = await supabaseUntyped
        .from('homework')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', tId);
      setHomeworkCount(hCount || 0);

      // ── Fetch best student per subject for each class this teacher teaches ──
      await fetchBestPerSubject(tId, schoolId);
    }
  };

  const fetchBestPerSubject = async (teacherId: string, schoolId: string) => {
    setLoadingBests(true);
    try {
      // Get all subject-class assignments for this teacher
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('*, subjects(name), classes(id, name, level, grade_level, curriculum)')
        .eq('teacher_id', teacherId);

      if (!assignments || assignments.length === 0) {
        setLoadingBests(false);
        return;
      }

      // Get the latest term for this school
      const { data: terms } = await supabaseUntyped
        .from('terms')
        .select('*')
        .eq('school_id', schoolId)
        .order('academic_year', { ascending: false })
        .limit(3);

      const latestTerm = terms?.[0];
      if (!latestTerm) { setLoadingBests(false); return; }

      const bests: SubjectBestMap[] = [];

      for (const assignment of assignments) {
        const classId = assignment.classes?.id || assignment.class_id;
        const subjectId = assignment.subject_id;
        const classData = assignment.classes;

        if (!classId || !subjectId) continue;

        const { data: results } = await supabaseUntyped
          .from('results')
          .select('*, students(id, first_name, last_name), subjects(name)')
          .eq('class_id', classId)
          .eq('subject_id', subjectId)
          .eq('term_id', latestTerm.id)
          .eq('school_id', schoolId);

        if (!results || results.length === 0) continue;

        const computed = computeBestPerSubject(results, classData);
        if (computed.length > 0) {
          bests.push({
            className: classData?.name || 'Class',
            classId,
            classData,
            subjectName: assignment.subjects?.name || 'Subject',
            termName: `${latestTerm.name} ${latestTerm.academic_year}`,
            bests: computed,
          });
        }
      }

      setSubjectBests(bests);
    } catch (err) {
      console.error('Failed to fetch best per subject:', err);
    }
    setLoadingBests(false);
  };

  const quickActions = [
    { label: 'Assigned Uploads', icon: <Upload className="w-5 h-5" />, link: '/teacher/results/assigned', color: 'bg-blue-50 text-blue-600' },
    { label: 'Mark Attendance', icon: <ClipboardList className="w-5 h-5" />, link: '/teacher/attendance', color: 'bg-green-50 text-green-600' },
    { label: 'Add Homework', icon: <BookOpen className="w-5 h-5" />, link: '/teacher/homework', color: 'bg-purple-50 text-purple-600' },
    { label: 'My Students', icon: <Users className="w-5 h-5" />, link: '/teacher/students', color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={`${user.firstName} ${user.lastName}`}
            className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl border-4 border-white shadow-md">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Teacher Dashboard</h1>
          <p className="text-sm text-[#666666]">Welcome back, {user?.firstName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, i) => (
          <Link key={i} to={action.link} className={`${action.color} rounded-2xl p-5 hover:opacity-80 transition-opacity`}>
            <div className="mb-3">{action.icon}</div>
            <div className="text-sm font-semibold">{action.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#2563EB]" />
            <h3 className="font-semibold text-[#111111]">Today&apos;s Schedule</h3>
          </div>
          {todayClasses.length === 0 ? (
            <p className="text-sm text-[#666666] py-4 text-center">No classes scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-[#2563EB] rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    {c.subjects?.name?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.subjects?.name}</p>
                    <p className="text-xs text-[#666666]">{c.classes?.name} {c.room && `| Room ${c.room}`}</p>
                  </div>
                  <span className="text-xs font-medium text-[#2563EB]">{c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4">Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600">{studentCount}</div>
              <div className="text-xs text-blue-400 mt-1">My Students</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl text-center">
              <div className="text-2xl font-bold text-purple-600">{homeworkCount}</div>
              <div className="text-xs text-purple-400 mt-1">Homework Set</div>
            </div>
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <div className="text-2xl font-bold text-green-600">{todayClasses.length}</div>
              <div className="text-xs text-green-400 mt-1">Classes Today</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-xl text-center">
              <div className="text-2xl font-bold text-orange-600">0</div>
              <div className="text-xs text-orange-400 mt-1">Pending Grading</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Best Student Per Subject Section ── */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-[#111111]">Best Student Per Subject (Latest Term)</h3>
        </div>
        {loadingBests ? (
          <p className="text-sm text-[#666666] py-4 text-center">Loading top performers...</p>
        ) : subjectBests.length === 0 ? (
          <p className="text-sm text-[#666666] py-4 text-center">No results uploaded yet for your subjects.</p>
        ) : (
          <div className="space-y-3">
            {subjectBests.map((item, idx) => (
              <div key={idx} className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">
                    {item.className} — {item.subjectName}
                  </span>
                  <span className="text-xs text-gray-400">{item.termName}</span>
                </div>
                {item.bests.map((b, bi) => (
                  <div key={bi} className="flex items-center gap-2 mt-1">
                    <span className="text-base">🏆</span>
                    <span className="text-sm font-medium text-[#111111]">
                      Best in {b.subjectName}: <span className="text-blue-700">{b.studentName}</span>
                    </span>
                    <span className="ml-auto text-xs font-bold text-green-700">
                      {b.percentage}% — {b.gradeLabel}
                      {b.points !== null ? ` (${b.points} pts)` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
