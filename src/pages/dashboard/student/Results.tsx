import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Award, Download, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StudentResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [classPosition, setClassPosition] = useState<number | null>(null);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [previousAvg, setPreviousAvg] = useState<number | null>(null);
  const [currentAvg, setCurrentAvg] = useState<number>(0);

  useEffect(() => { fetchInitial(); }, []);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      const { data: studentData } = await supabaseUntyped
        .from('students')
        .select('id, class_id, school_id, status, graduation_year, classes(name)')
        .eq('profile_id', user?.id)
        .maybeSingle();
      if (studentData) {
        setStudent(studentData);
        // Fetch terms
        const { data: termsData } = await supabaseUntyped
          .from('terms')
          .select('*')
          .eq('school_id', studentData.school_id)
          .order('academic_year', { ascending: false });
        const allTerms = termsData || [];
        setTerms(allTerms);
        // Default to most recent term
        if (allTerms.length > 0) {
          setSelectedTerm(allTerms[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching student:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (student && selectedTerm) {
      fetchResults();
    }
  }, [student, selectedTerm]);

  const fetchResults = async () => {
    if (!student || !selectedTerm) return;
    setLoading(true);
    try {
      const { data } = await supabaseUntyped
        .from('results')
        .select('*, subjects(name), terms(name), school_exams(name, type)')
        .eq('student_id', student.id)
        .eq('term_id', selectedTerm)
        .order('created_at', { ascending: false });
      const currentResults = data || [];
      setResults(currentResults);

      // Calculate current average
      if (currentResults.length > 0) {
        const totalPct = currentResults.reduce((s: number, r: any) => s + (r.percentage || r.marks || 0), 0);
        const avg = totalPct / currentResults.length;
        setCurrentAvg(avg);

        // Get class position
        const storedPosition = currentResults.find((r: any) => r.class_position)?.class_position;
        if (storedPosition) {
          setClassPosition(storedPosition);
        } else if (student.class_id) {
          const { data: classResults } = await supabaseUntyped
            .from('results')
            .select('student_id, marks, out_of')
            .eq('class_id', student.class_id)
            .eq('term_id', selectedTerm);
          if (classResults && classResults.length > 0) {
            const studentTotals: Record<string, { totalPct: number; count: number }> = {};
            (classResults as any[]).forEach((r: any) => {
              const pct = r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0;
              if (!studentTotals[r.student_id]) studentTotals[r.student_id] = { totalPct: 0, count: 0 };
              studentTotals[r.student_id].totalPct += pct;
              studentTotals[r.student_id].count += 1;
            });
            const ranked = Object.entries(studentTotals)
              .map(([sid, v]) => ({ studentId: sid, avg: v.totalPct / v.count }))
              .sort((a, b) => b.avg - a.avg);
            const position = ranked.findIndex(r => r.studentId === student.id) + 1;
            setClassPosition(position || null);
          }
        }
      } else {
        setCurrentAvg(0);
        setClassPosition(null);
      }

      // Fetch previous term average for deviation
      await fetchPreviousTermAvg();
    } catch (err) {
      console.error('Error fetching results:', err);
    }
    setLoading(false);
  };

  const fetchPreviousTermAvg = async () => {
    if (!student || !selectedTerm || terms.length === 0) { setPreviousAvg(null); return; }
    const sortedTerms = [...terms].sort((a, b) => {
      if (a.academic_year !== b.academic_year) return Number(a.academic_year) - Number(b.academic_year);
      const termNum = (n: string) => n.includes('1') ? 1 : n.includes('2') ? 2 : 3;
      return termNum(a.name) - termNum(b.name);
    });
    const currentIdx = sortedTerms.findIndex(t => t.id === selectedTerm);
    if (currentIdx <= 0) { setPreviousAvg(null); return; }
    const prevTerm = sortedTerms[currentIdx - 1];
    const { data: prevResults } = await supabaseUntyped
      .from('results')
      .select('marks, out_of, percentage')
      .eq('student_id', student.id)
      .eq('term_id', prevTerm.id);
    if (!prevResults || prevResults.length === 0) { setPreviousAvg(null); return; }
    const totalPct = prevResults.reduce((s: number, r: any) => s + (r.percentage || (r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0)), 0);
    setPreviousAvg(totalPct / prevResults.length);
  };

  const gradeColor = (grade: string) => {
    if (grade?.startsWith('EE')) return 'bg-green-100 text-green-700';
    if (grade?.startsWith('ME')) return 'bg-blue-100 text-blue-700';
    if (grade?.startsWith('AE')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const gradeDescriptor = (grade: string) => {
    if (grade?.startsWith('EE')) return 'Exceeding Expectation';
    if (grade?.startsWith('ME')) return 'Meeting Expectation';
    if (grade?.startsWith('AE')) return 'Approaching Expectation';
    return 'Below Expectation';
  };

  // Determine the display grade for a result row, respecting primary vs junior/senior
  const getDisplayGrade = (r: any): string => {
    const is = String(r.curriculum || '').toUpperCase() === '';
    if (is) return r.grade_ || '';
    // For CBE: primary uses cbc_grade (EE/ME/AE/BE), junior/senior uses cbc_sublevel (EE1/ME1/etc.)
    return r.cbc_sublevel || r.cbc_grade || '';
  };

  const getDisplayPoints = (r: any): number | null => {
    const is = String(r.curriculum || '').toUpperCase() === '';
    if (is) return r.points_ != null ? Number(r.points_) : null;
    const pts = r.cbc_points != null ? Number(r.cbc_points) : null;
    return pts && pts > 0 ? pts : null;
  };

  const filtered = filter === 'all' ? results : results.filter(r => {
    const grade = getDisplayGrade(r);
    return grade.startsWith(filter);
  });

  const overallAvg = results.length ? Math.round(results.reduce((s, r) => s + (r.percentage || (r.out_of > 0 ? (r.marks / r.out_of) * 100 : r.marks || 0)), 0) / results.length) : 0;
  const totalPoints = results.reduce((s, r) => s + (r.cbc_points || r.points_ || 0), 0);

  const getOverallGrade = () => {
    if (results.length === 0) return 'N/A';
    const avgPoints = totalPoints / results.length;
    if (avgPoints >= 10) return 'EE';
    if (avgPoints >= 8) return 'ME';
    if (avgPoints >= 6) return 'AE';
    return 'BE';
  };

  // Deviation calculation
  const deviation = previousAvg !== null ? currentAvg - previousAvg : null;

  return (
    <div className="space-y-6 -m-2 p-2 sm:p-4 rounded-3xl bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/50 min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Results</h1>
        <p className="text-sm text-[#666666]">View your academic performance and progress</p>
      </div>

      {student?.status === 'graduated' && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Graduated learner record{student?.graduation_year ? ` (${student.graduation_year})` : ''}. Published results remain available here.
        </div>
      )}

      {/* Term Selector */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] border border-white/80">
        <label className="block text-sm font-medium text-[#666666] mb-2">Select Term</label>
        <select
          value={selectedTerm}
          onChange={e => setSelectedTerm(e.target.value)}
          className="w-full md:w-64 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
        >
          <option value="">Select Term</option>
          {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
        </select>
      </div>

      {/* Overall Summary */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] border border-white/80">
        <h3 className="font-semibold text-[#111111] mb-4">Performance Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">{overallAvg}%</div>
            <div className="text-xs text-blue-400 mt-1">Overall Average</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="text-2xl font-bold text-green-600">{totalPoints}</div>
            <div className="text-xs text-green-400 mt-1">Total Points</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <div className="text-2xl font-bold text-purple-600">{getOverallGrade()}</div>
            <div className="text-xs text-purple-400 mt-1">Overall Grade</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-xl">
            <div className="text-2xl font-bold text-orange-600">
              {classPosition ? `${classPosition}${classPosition === 1 ? 'st' : classPosition === 2 ? 'nd' : classPosition === 3 ? 'rd' : 'th'}` : 'N/A'}
            </div>
            <div className="text-xs text-orange-400 mt-1">Class Position</div>
          </div>
        </div>
      </div>

      {/* Deviation Card */}
      {selectedTerm && (
        <div className={`rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] ${
          deviation === null ? 'bg-gray-50 border border-gray-200' :
          deviation >= 0 ? 'bg-green-50 border border-green-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {deviation === null ? (
              <Minus className="w-8 h-8 text-gray-400" />
            ) : deviation >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
            <div>
              <div className={`text-lg font-bold ${
                deviation === null ? 'text-gray-600' :
                deviation >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {deviation === null
                  ? 'First Term — No previous data to compare'
                  : deviation >= 0
                    ? `You improved by ${deviation.toFixed(1)}% compared to last term!`
                    : `Your performance dropped by ${Math.abs(deviation).toFixed(1)}% compared to last term.`
                }
              </div>
              {deviation !== null && previousAvg !== null && (
                <div className="text-sm text-gray-500 mt-0.5">
                  Previous term average: {previousAvg.toFixed(1)}% → Current: {currentAvg.toFixed(1)}%
                  {deviation >= 0
                    ? ' — Keep up the great work!'
                    : ' — Focus and you will bounce back next term.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CBE Summary */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] border border-white/80">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-[#2563EB]" />
          <h3 className="font-semibold text-[#111111]">CBE Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[#666666] mb-1">Total Points</p>
            <p className="text-2xl font-bold text-[#111111]">{totalPoints}</p>
          </div>
          <div>
            <p className="text-xs text-[#666666] mb-1">Average Points</p>
            <p className="text-2xl font-bold text-[#111111]">{results.length ? (totalPoints / results.length).toFixed(1) : 0}</p>
          </div>
          <div>
            <p className="text-xs text-[#666666] mb-1">Overall Grade</p>
            <span className={`text-lg font-bold px-3 py-1 rounded-full inline-block ${gradeColor(getOverallGrade())}`}>
              {getOverallGrade()}
            </span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-[#666666]" />
        {['all', 'EE', 'ME', 'AE', 'BE'].map(g => (
          <button key={g} onClick={() => setFilter(g)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === g ? 'bg-[#2563EB] text-white' : 'bg-white text-[#666666] hover:bg-gray-100'}`}>
            {g === 'all' ? 'All' : g}
          </button>
        ))}
      </div>

      {/* Results Table */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] overflow-hidden border border-white/80">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Learning Area</th> {/* Issue 26 */}
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Assessment</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Marks</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">%</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Grade</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Points</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Descriptor</th>
                <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Term</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-[#666666]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-[#666666]">No results found for this term</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                          <Award className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">{r.subjects?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#444]">
                      {r.school_exams?.name || r.exams?.name || '—'}
                      {r.school_exams?.type ? (
                        <span className="ml-1 text-xs text-blue-600">({r.school_exams.type})</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{r.marks}</td>
                    <td className="px-6 py-4 text-sm font-medium">{r.percentage !== undefined && r.percentage !== null ? r.percentage : Math.round((r.marks / (r.out_of || 100)) * 100)}%</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColor(getDisplayGrade(r))}`}>
                        {getDisplayGrade(r)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#666666]">{getDisplayPoints(r) ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-[#666666]">{gradeDescriptor(getDisplayGrade(r))}</td>
                    <td className="px-6 py-4 text-sm text-[#666666]">{r.terms?.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Download Report Card Button */}
      <a href="/student/report-card" className="w-full bg-[#E6F24B] text-[#111111] py-3 rounded-xl text-sm font-semibold hover:bg-[#d4e044] flex items-center justify-center gap-2 no-underline">
        <Download className="w-4 h-4" /> Download Report Card (PDF)
      </a>
    </div>
  );
}
