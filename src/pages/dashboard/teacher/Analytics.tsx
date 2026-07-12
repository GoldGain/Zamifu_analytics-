import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, TrendingUp, Award, Users, BookOpen, School, Shield, Eye, Lock } from 'lucide-react';

type TeacherRole = 'subject_teacher' | 'class_teacher' | 'dean_of_studies' | 'admin' | null;

interface TeacherAssignment {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
}

export default function TeacherAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teacherRole, setTeacherRole] = useState<TeacherRole>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherClassId, setTeacherClassId] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalResults: 0, avgMarks: 0, topGrade: 0, studentsCount: 0 });
  const [subjectPerformance, setSubjectPerformance] = useState<any[]>([]);
  const [classPerformance, setClassPerformance] = useState<any[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState({ EE: 0, ME: 0, AE: 0, BE: 0 });
  const [viewMode, setViewMode] = useState<'class' | 'subject'>('class');
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => { fetchTeacherProfileAndAnalytics(); }, []);

  const getPct = (r: any) => {
    if (r.percentage !== undefined && r.percentage !== null) return Number(r.percentage);
    return r.out_of > 0 ? (r.marks / r.out_of) * 100 : (r.marks || 0);
  };

  const detectTeacherRole = (teacherData: any, assignments: TeacherAssignment[]): TeacherRole => {
    // Check if user is admin
    if (user?.role === 'school_admin' || user?.role === 'admin') return 'admin';
    // Check dean_of_studies role from assignments or teacher data
    if (teacherData?.role === 'dean_of_studies' || user?.role === 'dean_of_studies') return 'dean_of_studies';
    // If has class assignments, could be class teacher
    const hasClassAssignments = assignments.some(a => a.class_id);
    const hasSubjectAssignments = assignments.some(a => a.subject_id);
    // Check if they are a class teacher (has a specific class they're responsible for)
    if (teacherData?.class_id || (hasClassAssignments && assignments.length <= 3)) return 'class_teacher';
    // Default to subject teacher
    if (hasSubjectAssignments) return 'subject_teacher';
    return 'subject_teacher';
  };

  const fetchTeacherProfileAndAnalytics = async () => {
    setLoading(true);
    const schoolId = user?.schoolId;

    try {
      // Get teacher record
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id, role, class_id')
        .eq('profile_id', user?.id)
        .single();

      // Get teacher's subject/class assignments
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('class_id, subject_id, classes(name), subjects(name)')
        .eq('teacher_id', teacherData?.id);

      const mappedAssignments: TeacherAssignment[] = (assignments || []).map((a: any) => ({
        class_id: a.class_id,
        class_name: a.classes?.name || '',
        subject_id: a.subject_id,
        subject_name: a.subjects?.name || '',
      }));

      setTeacherAssignments(mappedAssignments);
      setTeacherClassId(teacherData?.class_id || null);

      const role = detectTeacherRole(teacherData, mappedAssignments);
      setTeacherRole(role);

      // Determine access scope based on role
      const assignedClassIds = [...new Set(mappedAssignments.map(a => a.class_id).filter(Boolean))];
      const assignedSubjectIds = [...new Set(mappedAssignments.map(a => a.subject_id).filter(Boolean))];

      // Build query based on role
      let resultsQuery = supabaseUntyped
        .from('results')
        .select('*, subjects(name), classes(id, name, level, grade_level, curriculum), students(id, first_name, last_name)')
        .eq('school_id', schoolId);

      if (role === 'subject_teacher') {
        // Subject teacher: can only view their assigned subjects' performance
        if (assignedSubjectIds.length > 0) {
          resultsQuery = resultsQuery.in('subject_id', assignedSubjectIds);
        } else {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      } else if (role === 'class_teacher') {
        // Class teacher: can only view their assigned class
        const classIdsToFilter = teacherData?.class_id 
          ? [teacherData.class_id, ...assignedClassIds] 
          : assignedClassIds;
        if (classIdsToFilter.length > 0) {
          resultsQuery = resultsQuery.in('class_id', [...new Set(classIdsToFilter)]);
        } else {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }
      // dean_of_studies and admin: no filter, can view all

      const [
        { data: results },
        { count: sCount },
        { data: cls },
        { data: subs },
      ] = await Promise.all([
        resultsQuery,
        supabaseUntyped.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabaseUntyped.from('classes').select('id, name, level').eq('school_id', schoolId).order('level'),
        supabaseUntyped.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
      ]);

      // Filter classes and subjects based on role
      let filteredClasses = cls || [];
      let filteredSubjects = subs || [];

      if (role === 'class_teacher') {
        const allowedClassIds = [...new Set([teacherData?.class_id, ...assignedClassIds].filter(Boolean))];
        filteredClasses = filteredClasses.filter((c: any) => allowedClassIds.includes(c.id));
      } else if (role === 'subject_teacher') {
        filteredSubjects = filteredSubjects.filter((s: any) => assignedSubjectIds.includes(s.id));
      }

      setClasses(filteredClasses);
      setSubjects(filteredSubjects);

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
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
    setLoading(false);
  };

  const totalGrades = gradeDistribution.EE + gradeDistribution.ME + gradeDistribution.AE + gradeDistribution.BE;

  const getRoleLabel = (role: TeacherRole): string => {
    switch (role) {
      case 'admin': return 'School Admin';
      case 'dean_of_studies': return 'Dean of Studies';
      case 'class_teacher': return 'Class Teacher';
      case 'subject_teacher': return 'Subject Teacher';
      default: return 'Teacher';
    }
  };

  const getRoleDescription = (role: TeacherRole): string => {
    switch (role) {
      case 'admin': return 'Viewing all classes and subjects';
      case 'dean_of_studies': return 'Viewing all classes and subjects';
      case 'class_teacher': return 'Viewing only your assigned class';
      case 'subject_teacher': return 'Viewing only your assigned subjects';
      default: return '';
    }
  };

  if (accessDenied) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Analytics</h1>
          <p className="text-sm text-[#666666]">Performance overview</p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] text-center">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Access Restricted</h3>
          <p className="text-sm text-gray-500">You do not have any assigned classes or subjects to view analytics for.</p>
          <p className="text-xs text-gray-400 mt-2">Please contact your school administrator to assign you to classes and subjects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Analytics</h1>
        <p className="text-sm text-[#666666]">Performance overview organized by class and learning area</p>
      </div>

      {/* Role badge */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 text-sm">
        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div>
          <p className="font-bold text-blue-900">{getRoleLabel(teacherRole)}</p>
          <p className="text-blue-700">{getRoleDescription(teacherRole)}</p>
        </div>
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

      {/* View mode toggle */}
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
      </div>

      {/* Assigned subjects/classes info */}
      {teacherRole === 'subject_teacher' && teacherAssignments.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Eye className="w-4 h-4" /> Your Assigned Subjects</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(teacherAssignments.map(a => a.subject_name).filter(Boolean))].map((sub, i) => (
              <span key={i} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full font-medium">{sub}</span>
            ))}
          </div>
        </div>
      )}

      {teacherRole === 'class_teacher' && (
        <div className="bg-white rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Eye className="w-4 h-4" /> Your Class</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set([teacherClassId, ...teacherAssignments.map(a => a.class_id)].filter(Boolean))].map((cid, i) => {
              const cls = classes.find(c => c.id === cid);
              return cls ? (
                <span key={i} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full font-medium">{cls.name}</span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Class performance breakdown */}
      {viewMode === 'class' && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2"><School className="w-4 h-4" /> Performance by Grade</h3>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
          ) : classPerformance.length === 0 ? (
            <p className="text-sm text-[#666666] text-center py-4">No data available for your assigned classes</p>
          ) : (
            <div className="space-y-5">
              {classPerformance.map((cls, i) => (
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

      {/* Subject performance breakdown */}
      {viewMode === 'subject' && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Performance by Learning Area</h3>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
          ) : subjectPerformance.length === 0 ? (
            <p className="text-sm text-[#666666] text-center py-4">No data available for your assigned subjects</p>
          ) : (
            <div className="space-y-5">
              {subjectPerformance.map((sub, i) => (
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
      {stats.totalResults > 0 && (
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
      )}
    </div>
  );
}
