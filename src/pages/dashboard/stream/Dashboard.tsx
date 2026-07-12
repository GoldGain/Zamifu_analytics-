import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Users, Filter, Loader2, TrendingUp, Award, BookOpen, Search, ClipboardList } from 'lucide-react';
import { getSchoolLevelBand } from '@/lib/grading';

interface StudentRanking {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  avgPercentage: number | null;
  totalPoints: number | null;
  position: number | null;
  subjectResults: Record<string, { pct: number; grade: string }>;
}

interface SubjectSummary {
  id: string;
  name: string;
  average: number;
  highest: number;
  lowest: number;
  count: number;
}

export default function StreamDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [rankings, setRankings] = useState<StudentRanking[]>([]);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'rankings' | 'subjects'>('rankings');
  const [classInfo, setClassInfo] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');

  useEffect(() => {
    if (user?.schoolId) fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (selectedClass && selectedTerm) fetchStreamData();
  }, [selectedClass, selectedTerm, selectedExam]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: classesData } = await supabaseUntyped
        .from('classes')
        .select('*')
        .eq('school_id', user?.schoolId)
        .eq('is_active', true)
        .order('name');
      setClasses(classesData || []);
      if (classesData && classesData.length > 0) {
        setSelectedClass(classesData[0].id);
        setClassInfo(classesData[0]);
      }

      const { data: termsData } = await supabaseUntyped
        .from('terms')
        .select('*')
        .eq('school_id', user?.schoolId)
        .order('academic_year', { ascending: false });
      setTerms(termsData || []);
      if (termsData && termsData.length > 0) setSelectedTerm(termsData[0].id);

      const { data: examsData } = await supabaseUntyped
        .from('school_exams')
        .select('id, name, type, is_active')
        .eq('school_id', user?.schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setExams(examsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreamData = async () => {
    setLoadingData(true);
    try {
      const cls = classes.find(c => c.id === selectedClass);
      setClassInfo(cls);

      // Fetch all students in class
      const { data: students } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('class_id', selectedClass)
        .eq('is_active', true)
        .order('first_name');

      if (!students || students.length === 0) {
        setRankings([]);
        setSubjectSummaries([]);
        setLoadingData(false);
        return;
      }

      // Fetch all results for this class and term (optionally filtered by assessment)
      let resultsQuery = supabaseUntyped
        .from('results')
        .select('student_id, subject_id, marks, out_of, percentage, cbc_grade, cbc_sublevel, cbc_points, grade_, points_, exam_id, subjects(id, name)')
        .eq('class_id', selectedClass)
        .eq('term_id', selectedTerm);
      
      if (selectedExam) {
        resultsQuery = resultsQuery.eq('exam_id', selectedExam);
      }
      
      const { data: results } = await resultsQuery;

      const is = String(cls?.curriculum || '').toUpperCase() === '';

      // Build student performance map
      const studentMap: Record<string, { total: number; count: number; points: number; subjects: Record<string, any> }> = {};
      const subjectMap: Record<string, { name: string; values: number[]; id: string }> = {};

      (results || []).forEach((r: any) => {
        if (!studentMap[r.student_id]) {
          studentMap[r.student_id] = { total: 0, count: 0, points: 0, subjects: {} };
        }
        const pct = r.percentage ?? (r.out_of > 0 ? Math.round((r.marks / r.out_of) * 100) : 0);
        studentMap[r.student_id].total += pct;
        studentMap[r.student_id].count += 1;
        studentMap[r.student_id].points += r.cbc_points ?? r.points_ ?? 0;
        const grade = is ? (r.grade_ || '') : (r.cbc_sublevel || r.cbc_grade || '');
        const subName = r.subjects?.name || r.subject_id;
        studentMap[r.student_id].subjects[subName] = { pct, grade };

        // Subject summary
        const subId = r.subjects?.id || r.subject_id;
        if (!subjectMap[subId]) subjectMap[subId] = { name: subName, values: [], id: subId };
        subjectMap[subId].values.push(pct);
      });

      // Build rankings
      const rankList: StudentRanking[] = students.map((s: any) => {
        const data = studentMap[s.id];
        return {
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          admission_number: s.admission_number,
          avgPercentage: data ? Math.round(data.total / data.count) : null,
          totalPoints: data ? data.points : null,
          position: null,
          subjectResults: data?.subjects || {},
        };
      });

      // Sort and assign positions
      rankList.sort((a, b) => (b.avgPercentage ?? -1) - (a.avgPercentage ?? -1));
      rankList.forEach((s, i) => { if (s.avgPercentage !== null) s.position = i + 1; });
      setRankings(rankList);

      // Build subject summaries
      const summaries: SubjectSummary[] = Object.values(subjectMap).map(sub => ({
        id: sub.id,
        name: sub.name,
        average: sub.values.length > 0 ? Math.round(sub.values.reduce((a, b) => a + b, 0) / sub.values.length) : 0,
        highest: sub.values.length > 0 ? Math.max(...sub.values) : 0,
        lowest: sub.values.length > 0 ? Math.min(...sub.values) : 0,
        count: sub.values.length,
      })).sort((a, b) => b.average - a.average);
      setSubjectSummaries(summaries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const classAvg = rankings.filter(r => r.avgPercentage !== null).length > 0
    ? Math.round(rankings.filter(r => r.avgPercentage !== null).reduce((s, r) => s + (r.avgPercentage || 0), 0) / rankings.filter(r => r.avgPercentage !== null).length)
    : null;

  const gradeColor = (grade: string) => {
    if (grade?.startsWith('EE') || grade === 'A' || grade === 'A-') return 'bg-green-100 text-green-700';
    if (grade?.startsWith('ME') || grade?.startsWith('B')) return 'bg-blue-100 text-blue-700';
    if (grade?.startsWith('AE') || grade?.startsWith('C')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const avgColor = (avg: number) => {
    if (avg >= 75) return 'text-green-600';
    if (avg >= 50) return 'text-blue-600';
    if (avg >= 30) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredRankings = rankings.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Stream Dashboard</h1>
          <p className="text-sm text-[#666666]">Comparative performance analysis by stream / class</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedClass}
              onChange={e => {
                setSelectedClass(e.target.value);
                setClassInfo(classes.find(c => c.id === e.target.value));
              }}
              className="text-sm font-medium border-none focus:ring-0 bg-transparent"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {terms.length > 0 && (
            <select
              value={selectedTerm}
              onChange={e => { setSelectedTerm(e.target.value); setSelectedExam(''); }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
            </select>
          )}
          {exams.length > 0 && (
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="">All Assessments</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name} {e.type ? `(${e.type})` : ''}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-600" /><span className="text-xs text-gray-500">Students</span></div>
          <div className="text-2xl font-bold text-gray-900">{rankings.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-600" /><span className="text-xs text-gray-500">Stream Average</span></div>
          <div className="text-2xl font-bold text-gray-900">{classAvg !== null ? `${classAvg}%` : '—'}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><BookOpen className="w-4 h-4 text-purple-600" /><span className="text-xs text-gray-500">Subjects</span></div>
          <div className="text-2xl font-bold text-gray-900">{subjectSummaries.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-yellow-600" /><span className="text-xs text-gray-500">Results In</span></div>
          <div className="text-2xl font-bold text-gray-900">{rankings.filter(r => r.avgPercentage !== null).length}/{rankings.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['rankings', 'subjects'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'rankings' ? 'Student Rankings' : 'Subject Analysis'}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab === 'rankings' && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
      )}

      {/* Rankings Tab */}
      {activeTab === 'rankings' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Student Rankings — {classInfo?.name}</h3>
          </div>
          {loadingData ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : filteredRankings.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No results found for this stream and term.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Pos</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Student</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Adm No</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Avg %</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Subjects</th>
                    {subjectSummaries.slice(0, 4).map(sub => (
                      <th key={sub.id} className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">{sub.name.substring(0, 6)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRankings.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 px-6">
                        {s.position !== null ? (
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${s.position === 1 ? 'bg-yellow-100 text-yellow-700' : s.position === 2 ? 'bg-gray-200 text-gray-700' : s.position === 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>
                            {s.position}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-6 font-medium text-gray-900">{s.first_name} {s.last_name}</td>
                      <td className="py-3 px-6 text-gray-500">{s.admission_number}</td>
                      <td className={`py-3 px-6 font-bold ${s.avgPercentage !== null ? avgColor(s.avgPercentage) : 'text-gray-300'}`}>
                        {s.avgPercentage !== null ? `${s.avgPercentage}%` : '—'}
                      </td>
                      <td className="py-3 px-6 text-gray-500">{Object.keys(s.subjectResults).length}</td>
                      {subjectSummaries.slice(0, 4).map(sub => {
                        const sr = s.subjectResults[sub.name];
                        return (
                          <td key={sub.id} className="py-3 px-6">
                            {sr ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeColor(sr.grade)}`}>{sr.grade || `${sr.pct}%`}</span>
                            ) : <span className="text-gray-300">—</span>}
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
      )}

      {/* Subject Analysis Tab */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          {loadingData ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : subjectSummaries.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-300">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No results uploaded for this term yet.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjectSummaries.map(sub => (
                  <div key={sub.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="w-5 h-5 text-blue-600" /></div>
                      <span className={`text-lg font-bold ${avgColor(sub.average)}`}>{sub.average}%</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-3">{sub.name}</h4>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Highest</span><span className="font-semibold text-green-600">{sub.highest}%</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Lowest</span><span className="font-semibold text-red-600">{sub.lowest}%</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Students</span><span className="font-semibold">{sub.count}</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sub.average >= 75 ? 'bg-green-500' : sub.average >= 50 ? 'bg-blue-500' : sub.average >= 30 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${sub.average}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Subject ranking table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Subject Performance Ranking</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Average</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Highest</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Lowest</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Students</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {subjectSummaries.map((sub, i) => (
                        <tr key={sub.id} className="hover:bg-gray-50">
                          <td className="py-3 px-6 text-gray-500">{i + 1}</td>
                          <td className="py-3 px-6 font-medium text-gray-900">{sub.name}</td>
                          <td className={`py-3 px-6 font-bold ${avgColor(sub.average)}`}>{sub.average}%</td>
                          <td className="py-3 px-6 text-green-600 font-semibold">{sub.highest}%</td>
                          <td className="py-3 px-6 text-red-600 font-semibold">{sub.lowest}%</td>
                          <td className="py-3 px-6 text-gray-500">{sub.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
