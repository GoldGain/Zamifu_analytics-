import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, TrendingUp, Award, Users, BookOpen, School, Filter } from 'lucide-react';

// Issue 18: Analytics organized per class and per subject

export default function TeacherAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalResults: 0, avgMarks: 0, topGrade: 0, studentsCount: 0 });
  const [subjectPerformance, setSubjectPerformance] = useState<any[]>([]);
  const [classPerformance, setClassPerformance] = useState<any[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState({ EE: 0, ME: 0, AE: 0, BE: 0 });
  const [viewMode, setViewMode] = useState<'class' | 'subject'>('class');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');

  useEffect(() => { fetchAnalytics(); }, []);

  const getPct = (r: any) => {
    if (r.percentage !== undefined && r.percentage !== null) return Number(r.percentage);
    return r.out_of > 0 ? (r.marks / r.out_of) * 100 : (r.marks || 0);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    const schoolId = user?.schoolId;
    const [
      { data: results },
      { count: sCount },
      { data: cls },
      { data: subs },
      { data: trms },
    ] = await Promise.all([
      supabaseUntyped.from('results').select('*, subjects(name), classes(id, name, level, grade_level, curriculum), students(id, first_name, last_name)').eq('school_id', schoolId),
      supabaseUntyped.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabaseUntyped.from('classes').select('id, name, level').eq('school_id', schoolId).order('level'),
      supabaseUntyped.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
      supabaseUntyped.from('terms').select('id, name, academic_year').eq('school_id', schoolId).order('academic_year', { ascending: false }),
    ]);

    setClasses(cls || []);
    setSubjects(subs || []);
    setTerms(trms || []);

    if (results && results.length > 0) {
      const avg = results.reduce((sum: number, r: any) => sum + getPct(r), 0) / results.length;
      const top = Math.max(...results.map((r: any) => getPct(r)));

      // Group by subject
      const bySubject: Record<string, { name: string; total: number; count: number; classBreakdown: Record<string, { total: number; count: number }> }> = {};
      results.forEach((r: any) => {
        const name = r.subjects?.name || 'Unknown';
        const className = r.classes?.name || 'Unknown';
        if (!bySubject[name]) bySubject[name] = { name, total: 0, count: 0, classBreakdown: {} };
        bySubject[name].total += getPct(r);
        bySubject[name].count++;
        if (!bySubject[name].classBreakdown[className]) bySubject[name].classBreakdown[className] = { total: 0, count: 0 };
        bySubject[name].classBreakdown[className].total += getPct(r);
        bySubject[name].classBreakdown[className].count++;
      });
      setSubjectPerformance(
        Object.values(bySubject)
          .map(s => ({
            ...s,
            avg: Math.round(s.total / s.count),
            classBreakdown: Object.entries(s.classBreakdown).map(([cls, d]) => ({ cls, avg: Math.round((d as any).total / (d as any).count), count: (d as any).count })),
          }))
          .sort((a, b) => b.avg - a.avg)
      );

      // Group by class
      const byClass: Record<string, { name: string; total: number; count: number; subjectBreakdown: Record<string, { total: number; count: number }> }> = {};
      results.forEach((r: any) => {
        const className = r.classes?.name || 'Unknown';
        const subjectName = r.subjects?.name || 'Unknown';
        if (!byClass[className]) byClass[className] = { name: className, total: 0, count: 0, subjectBreakdown: {} };
        byClass[className].total += getPct(r);
        byClass[className].count++;
        if (!byClass[className].subjectBreakdown[subjectName]) byClass[className].subjectBreakdown[subjectName] = { total: 0, count: 0 };
        byClass[className].subjectBreakdown[subjectName].total += getPct(r);
        byClass[className].subjectBreakdown[subjectName].count++;
      });
      setClassPerformance(
        Object.values(byClass)
          .map(c => ({
            ...c,
            avg: Math.round(c.total / c.count),
            subjectBreakdown: Object.entries(c.subjectBreakdown).map(([sub, d]) => ({ sub, avg: Math.round((d as any).total / (d as any).count), count: (d as any).count })),
          }))
          .sort((a, b) => b.avg - a.avg)
      );

      // Grade distribution
      const dist = { EE: 0, ME: 0, AE: 0, BE: 0 };
      results.forEach((r: any) => {
        const pct = getPct(r);
        const grade = r.cbc_grade || (pct >= 75 ? 'EE' : pct >= 41 ? 'ME' : pct >= 21 ? 'AE' : 'BE');
        if (grade?.startsWith('EE')) dist.EE++;
        else if (grade?.startsWith('ME')) dist.ME++;
        else if (grade?.startsWith('AE')) dist.AE++;
        else dist.BE++;
      });
      setGradeDistribution(dist);
      setStats({ totalResults: results.length, avgMarks: Math.round(avg), topGrade: Math.round(top), studentsCount: sCount || 0 });
    } else {
      setStats({ totalResults: 0, avgMarks: 0, topGrade: 0, studentsCount: sCount || 0 });
    }
    setLoading(false);
  };

  const totalGrades = gradeDistribution.EE + gradeDistribution.ME + gradeDistribution.AE + gradeDistribution.BE;

  // Filtered data based on selections
  const displayedClassPerformance = selectedSubject
    ? classPerformance.map(c => ({
        ...c,
        subjectBreakdown: c.subjectBreakdown.filter((s: any) => subjects.find((sub: any) => sub.name === s.sub && sub.id === selectedSubject)),
      })).filter(c => c.subjectBreakdown.length > 0)
    : classPerformance;

  const displayedSubjectPerformance = selectedClass
    ? subjectPerformance.map(s => ({
        ...s,
        classBreakdown: s.classBreakdown.filter((c: any) => classes.find((cls: any) => cls.name === c.cls && cls.id === selectedClass)),
      })).filter(s => s.classBreakdown.length > 0)
    : subjectPerformance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Analytics</h1>
        <p className="text-sm text-[#666666]">Performance overview organized by class and learning area</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Results', value: stats.totalResults, icon: <BarChart3 className="w-5 h-5" />, color: 'bg-blue-500' },
          { label: 'Average Score', value: `${stats.avgMarks}%`, icon: <TrendingUp className="w-5 h-5" />, color: 'bg-green-500' },
          { label: 'Top Score', value: `${stats.topGrade}%`, icon: <Award className="w-5 h-5" />, color: 'bg-purple-500' },
          { label: 'Learners', value: stats.studentsCount, icon: <Users className="w-5 h-5" />, color: 'bg-orange-500' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center text-white mb-3`}>{card.icon}</div>
            <div className="text-2xl font-bold text-[#111111]">{card.value}</div>
            <div className="text-xs text-[#666666] mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Issue 18: View mode toggle and filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('class')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'class' ? 'bg-white shadow-sm text-[#111111]' : 'text-gray-500 hover:text-[#111111]'}`}
          >
            <School className="w-4 h-4" /> By Grade
          </button>
          <button
            onClick={() => setViewMode('subject')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'subject' ? 'bg-white shadow-sm text-[#111111]' : 'text-gray-500 hover:text-[#111111]'}`}
          >
            <BookOpen className="w-4 h-4" /> By Learning Area
          </button>
        </div>
        {viewMode === 'class' && (
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="px-3 py-2 border rounded-xl text-sm bg-white">
            <option value="">All Learning Areas</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {viewMode === 'subject' && (
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="px-3 py-2 border rounded-xl text-sm bg-white">
            <option value="">All Grades</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Issue 18: Class performance breakdown */}
      {viewMode === 'class' && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2"><School className="w-4 h-4" /> Performance by Grade</h3>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
          ) : displayedClassPerformance.length === 0 ? (
            <p className="text-sm text-[#666666] text-center py-4">No data yet</p>
          ) : (
            <div className="space-y-5">
              {displayedClassPerformance.map((cls, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-[#111111]">{cls.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${cls.avg >= 75 ? 'bg-green-100 text-green-700' : cls.avg >= 41 ? 'bg-blue-100 text-blue-700' : cls.avg >= 21 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                      {cls.avg}% avg
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${cls.avg >= 75 ? 'bg-green-500' : cls.avg >= 41 ? 'bg-blue-500' : cls.avg >= 21 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${Math.min(cls.avg, 100)}%` }} />
                  </div>
                  {cls.subjectBreakdown.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {cls.subjectBreakdown.map((s: any, j: number) => (
                        <div key={j} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                          <div className="font-medium text-gray-700 truncate">{s.sub}</div>
                          <div className="text-gray-500">{s.avg}% ({s.count} results)</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Issue 18: Subject performance breakdown */}
      {viewMode === 'subject' && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Performance by Learning Area</h3>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
          ) : displayedSubjectPerformance.length === 0 ? (
            <p className="text-sm text-[#666666] text-center py-4">No data yet</p>
          ) : (
            <div className="space-y-5">
              {displayedSubjectPerformance.map((sub, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-[#111111]">{sub.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${sub.avg >= 75 ? 'bg-green-100 text-green-700' : sub.avg >= 41 ? 'bg-blue-100 text-blue-700' : sub.avg >= 21 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                      {sub.avg}% avg
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${sub.avg >= 75 ? 'bg-green-500' : sub.avg >= 41 ? 'bg-blue-500' : sub.avg >= 21 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${Math.min(sub.avg, 100)}%` }} />
                  </div>
                  {sub.classBreakdown.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {sub.classBreakdown.map((c: any, j: number) => (
                        <div key={j} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                          <div className="font-medium text-gray-700 truncate">{c.cls}</div>
                          <div className="text-gray-500">{c.avg}% ({c.count} results)</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CBE Grade Distribution */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4">CBE Grade Distribution</h3>
        <div className="flex items-end gap-3 h-40">
          {[
            { grade: 'EE', label: 'Exceeding', count: gradeDistribution.EE, color: 'bg-green-500' },
            { grade: 'ME', label: 'Meeting', count: gradeDistribution.ME, color: 'bg-blue-500' },
            { grade: 'AE', label: 'Approaching', count: gradeDistribution.AE, color: 'bg-orange-500' },
            { grade: 'BE', label: 'Below', count: gradeDistribution.BE, color: 'bg-red-500' },
          ].map((g, i) => {
            const pct = totalGrades > 0 ? Math.round((g.count / totalGrades) * 100) : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-[#111111]">{pct}%</span>
                <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '100px' }}>
                  <div className={`w-full ${g.color} rounded-t-lg absolute bottom-0 transition-all duration-700`} style={{ height: `${pct}px` }} />
                </div>
                <span className="text-xs font-bold text-[#666666]">{g.grade}</span>
                <span className="text-[10px] text-gray-400 text-center">{g.label}</span>
                <span className="text-[10px] text-gray-500">{g.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
