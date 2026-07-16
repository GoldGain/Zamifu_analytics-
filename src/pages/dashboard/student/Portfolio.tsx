// Issue 22: Learner Portfolio - Enhanced with recommendations and all results
import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Award, BookOpen, TrendingUp, Star, FileText, ChevronDown, ChevronUp, Loader2, Target, Lightbulb, GraduationCap, Calendar } from 'lucide-react';

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

function getPercentage(mark: number, outOf: number): number {
  if (!outOf) return 0;
  return Math.round((mark / outOf) * 100);
}

function getPathwayRecommendation(results: any[]): { text: string; focus: string[] } {
  if (!results.length) return { 
    text: 'Keep working hard and submitting assignments to unlock pathway recommendations. Your portfolio will grow as your teachers upload your results.',
    focus: ['Attend all classes regularly', 'Complete all assignments', 'Participate actively in class']
  };
  
  const validResults = results.filter(r => r.marks_obtained != null && (r.exams?.out_of || r.out_of));
  if (!validResults.length) return {
    text: 'Results are being processed. Continue working hard while your teachers finalize your marks.',
    focus: ['Review past exam papers', 'Seek help from teachers in challenging subjects', 'Form study groups with classmates']
  };

  const avgPct = validResults.reduce((sum, r) => {
    const outOf = r.exams?.out_of || r.out_of || 100;
    return sum + (r.marks_obtained / outOf) * 100;
  }, 0) / validResults.length;

  // Find strongest and weakest subjects
  const subjectScores: Record<string, number[]> = {};
  validResults.forEach(r => {
    const subName = r.subjects?.name || 'Unknown';
    const outOf = r.exams?.out_of || r.out_of || 100;
    const pct = (r.marks_obtained / outOf) * 100;
    if (!subjectScores[subName]) subjectScores[subName] = [];
    subjectScores[subName].push(pct);
  });
  
  const subjectAvgs = Object.entries(subjectScores).map(([name, scores]) => ({
    name,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length
  })).sort((a, b) => b.avg - a.avg);
  
  const bestSubjects = subjectAvgs.filter(s => s.avg >= 75).map(s => s.name);
  const weakSubjects = subjectAvgs.filter(s => s.avg < 50).map(s => s.name);

  if (avgPct >= 80) return {
    text: `Excellent performance ${avgPct.toFixed(0)}%! You are on track for competitive pathways including STEM, Medicine, Law, and Engineering. Your strong performance in ${bestSubjects.slice(0, 2).join(' and ')} positions you well for specialized programs.`,
    focus: ['Consider enrichment programs and competitions', 'Explore advanced coursework in your strong subjects', 'Research scholarship opportunities']
  };
  if (avgPct >= 60) return {
    text: `Good performance at ${avgPct.toFixed(0)}%! You qualify for most academic pathways. ${bestSubjects.length > 0 ? `Your strengths in ${bestSubjects.slice(0, 2).join(' and ')} can guide your subject selection.` : 'Continue building on your strengths.'}`,
    focus: weakSubjects.length > 0 ? [`Focus on improving: ${weakSubjects.slice(0, 2).join(', ')}`, 'Seek extra help in weaker areas', 'Set specific improvement targets'] : ['Maintain your current study habits', 'Explore extracurricular activities', 'Start thinking about career interests']
  };
  if (avgPct >= 40) return {
    text: `You are approaching expectations at ${avgPct.toFixed(0)}%. With targeted support and consistent effort, you can significantly improve your pathway options.`,
    focus: weakSubjects.length > 0 ? [`Priority improvement needed in: ${weakSubjects.slice(0, 3).join(', ')}`, 'Attend remedial classes', 'Form study groups with stronger classmates'] : ['Review your study techniques', 'Ask teachers for feedback', 'Set weekly study goals']
  };
  return {
    text: `Additional support is recommended. Your current average is ${avgPct.toFixed(0)}%. Talk to your teachers or counselor about a personalized improvement plan. Every learner has unique strengths that can be developed.`,
    focus: ['Meet with your class teacher for guidance', 'Identify one subject to improve first', 'Use the Zamifu Analytics resources section', 'Consider peer tutoring programs']
  };
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
      const { data: student } = await supabaseUntyped
        .from('students')
        .select('*, status, graduation_year, classes(name)')
        .eq('profile_id', user?.id)
        .maybeSingle();

      if (!student) { setLoading(false); return; }

      const [{ data: results }, { data: homework }, { data: assessments }] = await Promise.all([
        supabaseUntyped.from('results').select('*, subjects(name), school_exams(name, type), terms(name, academic_year)').eq('student_id', student.id).order('created_at', { ascending: false }),
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

  const validResults = results.filter(r => r.marks_obtained != null && (r.exams?.out_of || r.out_of));
  const avgPct = validResults.length
    ? Math.round(validResults.reduce((s, r) => {
        const outOf = r.exams?.out_of || r.out_of || 100;
        return s + (r.marks_obtained / outOf) * 100;
      }, 0) / validResults.length)
    : 0;
  const overallLevel = avgPct >= 80 ? 'EE' : avgPct >= 60 ? 'ME' : avgPct >= 40 ? 'AE' : 'BE';
  const pathway = getPathwayRecommendation(results);

  // Subject performance
  const subjectMap: Record<string, { name: string; marks: number[]; outOfs: number[]; examNames: string[] }> = {};
  results.forEach(r => {
    const name = r.subjects?.name || 'Unknown';
    if (!subjectMap[name]) subjectMap[name] = { name, marks: [], outOfs: [], examNames: [] };
    subjectMap[name].marks.push(r.marks_obtained || 0);
    subjectMap[name].outOfs.push(r.exams?.out_of || r.out_of || 100);
    if (r.exams?.name) subjectMap[name].examNames.push(r.exams.name);
  });

  const subjectPerformance = Object.values(subjectMap).map(s => {
    const avg = s.marks.reduce((sum, m, i) => sum + (m / s.outOfs[i]) * 100, 0) / s.marks.length;
    return { name: s.name, avg: Math.round(avg), level: getGradeFromMark(avg, 100), examCount: s.examNames.length };
  }).sort((a, b) => b.avg - a.avg);

  const toggle = (section: string) => setExpandedSection(expandedSection === section ? null : section);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Portfolio</h1>
        <p className="text-sm text-[#666666]">Your academic journey, achievements, and pathway recommendations</p>
      </div>

      {student?.status === 'graduated' && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          You are marked as graduated{student?.graduation_year ? ` (${student.graduation_year})` : ''}.
          Your historical results stay available here after graduation.
        </div>
      )}

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
          {validResults.length > 0 && (
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
            <p className="text-sm text-gray-600">{pathway.text}</p>
            {pathway.focus.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pathway.focus.map((f, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> {f}
                  </span>
                ))}
              </div>
            )}
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
                    style={{ width: `${Math.min(s.avg, 100)}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-medium text-gray-700">{s.avg}%</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PERFORMANCE_COLORS[s.level]}`}>{s.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Section - All results with assessment names */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <button
          onClick={() => toggle('results')}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold text-[#111111]">All Exam Results ({results.length})</span>
          </div>
          {expandedSection === 'results' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {expandedSection === 'results' && (
          <div className="border-t border-gray-100 p-5">
            {results.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No results yet</p>
            ) : (
              <div className="space-y-2">
                {/* Group by term */}
                {Object.entries(results.reduce((acc: Record<string, any[]>, r) => {
                  const termKey = r.terms ? `${r.terms.name} ${r.terms.academic_year}` : 'General';
                  if (!acc[termKey]) acc[termKey] = [];
                  acc[termKey].push(r);
                  return acc;
                }, {})).map(([termName, termResults]) => (
                  <div key={termName} className="mb-4">
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {termName}
                    </h4>
                    {termResults.map((r, i) => {
                      const outOf = r.exams?.out_of || r.out_of || 100;
                      const pct = getPercentage(r.marks_obtained || 0, outOf);
                      const level = getGradeFromMark(r.marks_obtained || 0, outOf);
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-1">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{r.subjects?.name}</p>
                            <p className="text-xs text-gray-500">{r.exams?.name || 'General Assessment'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-700">{r.marks_obtained}/{outOf} ({pct}%)</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PERFORMANCE_COLORS[level]}`}>{level}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
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

      {/* Recommendations Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border border-blue-100">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#111111] mb-2">Recommendations for Improvement</h3>
            <ul className="space-y-2">
              {subjectPerformance.filter(s => s.avg < 50).map(s => (
                <li key={s.name} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>Focus on <strong>{s.name}</strong> - consider extra practice, peer study groups, or asking your teacher for additional support.</span>
                </li>
              ))}
              {subjectPerformance.filter(s => s.avg >= 75).map(s => (
                <li key={s.name} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Great work in <strong>{s.name}</strong>! Maintain this excellence and consider mentoring classmates.</span>
                </li>
              ))}
              {subjectPerformance.length === 0 && (
                <li className="text-sm text-gray-500">Complete more assessments to receive personalized recommendations.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
