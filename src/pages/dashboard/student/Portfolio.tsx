// Issue 22: Learner Portfolio
import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Award, BookOpen, TrendingUp, Star, FileText, ChevronDown, ChevronUp, Loader2, Target } from 'lucide-react';

interface PortfolioData {
  student: any;
  results: any[];
  homework: any[];
  assessments: any[];
  attendance: any;
}

const PERFORMANCE_COLORS: Record<string, string> = {
  EE: 'bg-purple-100 text-purple-700 border-purple-200',
  ME: 'bg-green-100 text-green-700 border-green-200',
  AE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  BE: 'bg-red-100 text-red-700 border-red-200',
};

const PERFORMANCE_LABELS: Record<string, string> = {
  EE: 'Exceeds Expectation',
  ME: 'Meets Expectation',
  AE: 'Approaches Expectation',
  BE: 'Below Expectation',
};

function getGradeFromMark(mark: number, outOf: number): string {
  if (!outOf) return '';
  const pct = (mark / outOf) * 100;
  if (pct >= 80) return 'EE';
  if (pct >= 60) return 'ME';
  if (pct >= 40) return 'AE';
  return 'BE';
}

function getPathwayRecommendation(results: any[]): string {
  if (!results.length) return 'Keep working hard and submitting assignments to unlock pathway recommendations.';
  const avgPct = results.reduce((sum, r) => {
    const mark = r.marks_obtained || 0;
    const outOf = r.out_of || 100;
    return sum + (mark / outOf) * 100;
  }, 0) / results.length;

  if (avgPct >= 80) return 'Excellent performance! You are on track for STEM, Medicine, Law, or any competitive pathway. Consider enrichment programs and competitions.';
  if (avgPct >= 60) return 'Good performance! You qualify for most pathways. Focus on strengthening weaker subjects to open more options.';
  if (avgPct >= 40) return 'You are approaching expectations. With targeted support in key subjects, you can improve your pathway options significantly.';
  return 'You need additional support. Talk to your teacher or counselor about a personalized improvement plan.';
}

export default function StudentPortfolio() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('results');

  useEffect(() => { fetchPortfolio(); }, []);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      // Get student profile
      const { data: student } = await supabaseUntyped
        .from('students')
        .select('*, classes(name)')
        .eq('profile_id', user?.id)
        .single();

      if (!student) { setLoading(false); return; }

      // Fetch results, homework submissions, assessments
      const [{ data: results }, { data: homework }, { data: assessments }] = await Promise.all([
        supabaseUntyped.from('results').select('*, subjects(name), exams(name, out_of)').eq('student_id', student.id).order('created_at', { ascending: false }),
        supabaseUntyped.from('homework_submissions').select('*, homework(title, subjects(name))').eq('student_id', student.id).order('submitted_at', { ascending: false }),
        supabaseUntyped.from('assessment_results').select('*, assessments(name, max_mark, assessment_type)').eq('student_id', student.id).order('created_at', { ascending: false }),
      ]);

      setPortfolio({
        student,
        results: results || [],
        homework: homework || [],
        assessments: assessments || [],
        attendance: null,
      });
    } catch (err) {
      console.error('Portfolio load error:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="text-center py-20 text-gray-500">
        <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>Portfolio not available. Please contact your school administrator.</p>
      </div>
    );
  }

  const { student, results, homework, assessments } = portfolio;

  // Compute overall performance
  const allMarks = results.map(r => ({ mark: r.marks_obtained || 0, outOf: r.exams?.out_of || 100 }));
  const avgPct = allMarks.length
    ? Math.round(allMarks.reduce((s, m) => s + (m.mark / m.outOf) * 100, 0) / allMarks.length)
    : 0;
  const overallLevel = avgPct >= 80 ? 'EE' : avgPct >= 60 ? 'ME' : avgPct >= 40 ? 'AE' : 'BE';
  const pathway = getPathwayRecommendation(results);

  // Subject performance
  const subjectMap: Record<string, { name: string; marks: number[]; outOfs: number[] }> = {};
  results.forEach(r => {
    const name = r.subjects?.name || 'Unknown';
    if (!subjectMap[name]) subjectMap[name] = { name, marks: [], outOfs: [] };
    subjectMap[name].marks.push(r.marks_obtained || 0);
    subjectMap[name].outOfs.push(r.exams?.out_of || 100);
  });

  const subjectPerformance = Object.values(subjectMap).map(s => {
    const avg = s.marks.reduce((sum, m, i) => sum + (m / s.outOfs[i]) * 100, 0) / s.marks.length;
    return { name: s.name, avg: Math.round(avg), level: getGradeFromMark(avg, 100) };
  }).sort((a, b) => b.avg - a.avg);

  const toggle = (section: string) => setExpandedSection(expandedSection === section ? null : section);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Portfolio</h1>
        <p className="text-sm text-[#666666]">Your academic journey, achievements, and pathway recommendations</p>
      </div>

      {/* Profile Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
            {student.first_name?.[0]}{student.last_name?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{student.first_name} {student.last_name}</h2>
            <p className="text-blue-100 text-sm">{student.classes?.name} · Adm: {student.admission_number}</p>
          </div>
          {allMarks.length > 0 && (
            <div className="text-right">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-sm ${PERFORMANCE_COLORS[overallLevel]}`}>
                <Award className="w-4 h-4" />
                {overallLevel} — {PERFORMANCE_LABELS[overallLevel]}
              </div>
              <p className="text-blue-100 text-xs mt-1">Overall Average: {avgPct}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Pathway Recommendation */}
      <div className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border-l-4 border-blue-500">
        <div className="flex items-start gap-3">
          <Target className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#111111] mb-1">Pathway Recommendation</h3>
            <p className="text-sm text-gray-600">{pathway}</p>
          </div>
        </div>
      </div>

      {/* Subject Performance */}
      {subjectPerformance.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Learning Area Performance
          </h3>
          <div className="space-y-3">
            {subjectPerformance.map(s => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-32 text-sm text-gray-700 truncate">{s.name}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${s.level === 'EE' ? 'bg-purple-500' : s.level === 'ME' ? 'bg-green-500' : s.level === 'AE' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${s.avg}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-medium text-gray-700">{s.avg}%</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PERFORMANCE_COLORS[s.level]}`}>{s.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <button
          onClick={() => toggle('results')}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold text-[#111111]">Exam Results ({results.length})</span>
          </div>
          {expandedSection === 'results' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {expandedSection === 'results' && (
          <div className="border-t border-gray-100 p-5">
            {results.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No results yet</p>
            ) : (
              <div className="space-y-2">
                {results.slice(0, 20).map((r, i) => {
                  const pct = r.exams?.out_of ? Math.round((r.marks_obtained / r.exams.out_of) * 100) : 0;
                  const level = getGradeFromMark(r.marks_obtained || 0, r.exams?.out_of || 100);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.subjects?.name}</p>
                        <p className="text-xs text-gray-500">{r.exams?.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700">{r.marks_obtained}/{r.exams?.out_of} ({pct}%)</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PERFORMANCE_COLORS[level]}`}>{level}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Homework Section */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <button
          onClick={() => toggle('homework')}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-green-500" />
            <span className="font-semibold text-[#111111]">Homework Submissions ({homework.length})</span>
          </div>
          {expandedSection === 'homework' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {expandedSection === 'homework' && (
          <div className="border-t border-gray-100 p-5">
            {homework.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No homework submissions yet</p>
            ) : (
              <div className="space-y-2">
                {homework.slice(0, 20).map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{h.homework?.title}</p>
                      <p className="text-xs text-gray-500">{h.homework?.subjects?.name} · {new Date(h.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.is_graded ? (
                        <>
                          {h.marks_awarded && <span className="text-sm font-semibold text-gray-700">{h.marks_awarded} marks</span>}
                          {h.performance_level && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PERFORMANCE_COLORS[h.performance_level]}`}>{h.performance_level}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Submitted</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assessment Section */}
      {assessments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
          <button
            onClick={() => toggle('assessments')}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-[#111111]">Assessments ({assessments.length})</span>
            </div>
            {expandedSection === 'assessments' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {expandedSection === 'assessments' && (
            <div className="border-t border-gray-100 p-5">
              <div className="space-y-2">
                {assessments.slice(0, 20).map((a, i) => {
                  const pct = a.assessments?.max_mark ? Math.round((a.marks_obtained / a.assessments.max_mark) * 100) : 0;
                  const level = getGradeFromMark(a.marks_obtained || 0, a.assessments?.max_mark || 100);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.assessments?.name}</p>
                        <p className="text-xs text-gray-500">{a.assessments?.assessment_type}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700">{a.marks_obtained}/{a.assessments?.max_mark} ({pct}%)</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PERFORMANCE_COLORS[level]}`}>{level}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
