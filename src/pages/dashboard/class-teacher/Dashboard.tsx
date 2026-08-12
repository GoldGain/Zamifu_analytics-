import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, FileText, Loader2, BookOpen, TrendingUp, Award, BarChart3,
  Search, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Download, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateCompetencyGrade, getSchoolLevelBand } from '@/lib/grading';
import { MarksProgress } from '@/components/MarksProgress';

interface StudentPerformance {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  avgPercentage: number | null;
  totalMarks: number | null;
  totalOutOf: number | null;
  totalPoints: number | null;
  position: number | null;
  subjectResults: Record<string, { pct: number; grade: string; marks: number | null; out_of: number | null }>;
  hasAllMarks: boolean;
}

interface SubjectInfo {
  id: string;
  name: string;
  teacher_name: string;
  teacher_profile_id: string | null;
  entered_count: number;
}

export default function ClassTeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignedClass, setAssignedClass] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [performance, setPerformance] = useState<StudentPerformance[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [search, setSearch] = useState('');
  const [remindingSubjectId, setRemindingSubjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'marks-progress' | 'students' | 'performance'>('overview');

  useEffect(() => {
    if (user?.id) fetchTeacherData();
  }, [user]);

  useEffect(() => {
    if (selectedTerm && assignedClass) fetchPerformance();
  }, [selectedTerm, assignedClass]);

  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      const { data: teacherData, error: teacherError } = await supabaseUntyped
        .from('teachers')
        .select('*, assigned_class_id')
        .eq('profile_id', user?.id)
        .maybeSingle();

      if (teacherError) throw teacherError;

      // Determine the class: use assigned_class_id or class_teacher_id lookup
      let classId = teacherData?.assigned_class_id;
      if (!classId) {
        const { data: cls } = await supabaseUntyped
          .from('classes')
          .select('*')
          .eq('class_teacher_id', user?.id)
          .maybeSingle();
        if (cls) classId = cls.id;
      }

      if (!classId) {
        setLoading(false);
        return;
      }

      const { data: classData } = await supabaseUntyped
        .from('classes')
        .select('*')
        .eq('id', classId)
        .maybeSingle();

      setAssignedClass(classData);

      if (classData) {
        const [{ data: studentsData }, { data: subjectsData }, { data: termsData }] = await Promise.all([
          supabaseUntyped
            .from('students')
            .select('id, first_name, last_name, admission_number, gender')
            .eq('class_id', classId)
            .eq('is_active', true)
            .order('first_name'),
          supabaseUntyped
            .from('teacher_subject_assignments')
            .select('subject_id, subjects(name), teachers(profile_id, first_name, last_name)')
            .eq('class_id', classId)
            .eq('school_id', user?.schoolId)
            .eq('is_active', true),
          supabaseUntyped
            .from('terms')
            .select('*')
            .eq('school_id', user?.schoolId)
            .order('academic_year', { ascending: false }),
        ]);

        setStudents(studentsData || []);
        setSubjects(
          (subjectsData || []).map((a: any) => ({
            id: a.subject_id,
            name: (a.subjects?.name || 'Unknown') === 'Creative Arts' ? 'C-Arts' : (a.subjects?.name || 'Unknown'),
            teacher_name: a.teachers ? `${a.teachers.first_name} ${a.teachers.last_name}` : 'Unassigned',
            teacher_profile_id: a.teachers?.profile_id || null,
            entered_count: 0,
          }))
        );

        const allTerms = termsData || [];
        setTerms(allTerms);
        const current = allTerms.find((t: any) => t.is_current);
        if (current) setSelectedTerm(current.id);
        else if (allTerms.length > 0) setSelectedTerm(allTerms[0].id);
      }
    } catch (err) {
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async () => {
    if (!assignedClass || !selectedTerm) return;
    setLoadingPerf(true);
    try {
      const { data: results } = await supabaseUntyped
        .from('results')
        .select('student_id, subject_id, marks, out_of, percentage, cbc_grade, grade_844')
        .eq('class_id', assignedClass.id)
        .eq('term_id', selectedTerm)
        .eq('school_id', user?.schoolId);

      const resultsMap: Record<string, Record<string, any>> = {};
      (results || []).forEach((r: any) => {
        if (!resultsMap[r.student_id]) resultsMap[r.student_id] = {};
        resultsMap[r.student_id][r.subject_id] = {
          pct: r.percentage ?? 0,
          grade: r.cbc_grade || r.grade_844 || '—',
          marks: r.marks,
          out_of: r.out_of,
        };
      });

      // Update subject entered counts
      const updatedSubjects = subjects.map((s) => {
        const count = (results || []).filter((r: any) => r.subject_id === s.id).length;
        return { ...s, entered_count: count };
      });
      setSubjects(updatedSubjects);

      const perf: StudentPerformance[] = students.map((student) => {
        const sResults = resultsMap[student.id] || {};
        const pcts = Object.values(sResults).map((r: any) => r.pct).filter((p) => p != null && p > 0);
        const avgPct = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
        
        const marks = Object.values(sResults).map((r: any) => r.marks).filter((m) => m != null);
        const outOfs = Object.values(sResults).map((r: any) => r.out_of).filter((o) => o != null);
        const totalMarks = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) : null;
        const totalOutOf = outOfs.length > 0 ? outOfs.reduce((a, b) => a + b, 0) : null;
        
        const hasAllMarks = subjects.length > 0 && Object.keys(sResults).length >= subjects.length;

        return {
          ...student,
          avgPercentage: avgPct,
          totalMarks,
          totalOutOf,
          totalPoints: null,
          position: null,
          subjectResults: sResults,
          hasAllMarks,
        };
      });

      // Rank by average
      const ranked = [...perf]
        .filter((p) => p.avgPercentage !== null)
        .sort((a, b) => (b.avgPercentage ?? 0) - (a.avgPercentage ?? 0));
      ranked.forEach((p, i) => { p.position = i + 1; });

      setPerformance(perf);
    } catch (err) {
      toast.error('Failed to load performance data');
    } finally {
      setLoadingPerf(false);
    }
  };

  const filteredStudents = performance.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.admission_number}`.toLowerCase().includes(search.toLowerCase())
  );

  const missingMarksSubjects = subjects.filter((s) => s.entered_count < students.length);
  const completeSubjects = subjects.filter((s) => s.entered_count >= students.length);
  const studentsWithAllMarks = performance.filter((s) => s.hasAllMarks).length;
  const studentsWithNoMarks = performance.filter((s) => Object.keys(s.subjectResults).length === 0).length;

  const overallPct = subjects.length > 0 && students.length > 0
    ? Math.round((subjects.reduce((sum, s) => sum + s.entered_count, 0) / (subjects.length * students.length)) * 100)
    : 0;
  const missingLearnerRows = performance
    .map((learner) => ({
      ...learner,
      missingSubjects: subjects.filter((subject) => !learner.subjectResults[subject.id]),
    }))
    .filter((learner) => learner.missingSubjects.length > 0);
  const analyzedLearners = performance.filter((learner) => learner.avgPercentage !== null);
  const classAverage = analyzedLearners.length > 0
    ? analyzedLearners.reduce((sum, learner) => sum + (learner.avgPercentage || 0), 0) / analyzedLearners.length
    : 0;
  const classBand = getSchoolLevelBand(assignedClass || {});
  const classMeanGrade = calculateCompetencyGrade(classAverage, classBand);
  const gradeDistribution = analyzedLearners.reduce<Record<string, number>>((distribution, learner) => {
    const grade = calculateCompetencyGrade(learner.avgPercentage || 0, classBand).subLevel;
    distribution[grade] = (distribution[grade] || 0) + 1;
    return distribution;
  }, {});

  const remindTeacher = async (subject: SubjectInfo) => {
    if (!subject.teacher_profile_id) {
      toast.error(`No teacher account is linked to ${subject.name}.`);
      return;
    }
    if (!assignedClass || !user?.id || !user?.schoolId) return;

    const missingCount = Math.max(students.length - subject.entered_count, 0);
    const selectedTermName = terms.find((term: any) => term.id === selectedTerm)?.name || 'the selected term';
    setRemindingSubjectId(subject.id);
    try {
      const body = `Reminder: ${missingCount} learner${missingCount === 1 ? '' : 's'} in ${assignedClass.name} still need ${subject.name} marks for ${selectedTermName}. Please complete the marks entry.`;
      const { error } = await supabaseUntyped.from('teacher_messages').insert({
        school_id: user.schoolId,
        sender_id: user.id,
        recipient_id: subject.teacher_profile_id,
        subject: `Pending marks: ${assignedClass.name} — ${subject.name}`,
        body,
      });
      if (error) throw error;

      await supabaseUntyped.from('notifications').insert({
        user_id: subject.teacher_profile_id,
        school_id: user.schoolId,
        title: 'Marks entry reminder',
        message: body,
        type: 'marks_reminder',
        is_read: false,
        action_url: '/teacher/results/assigned',
      });
      toast.success(`Reminder sent to ${subject.teacher_name}.`);
    } catch (err: any) {
      toast.error(err.message || 'Could not send the reminder.');
    } finally {
      setRemindingSubjectId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!assignedClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Class Assigned</h2>
        <p className="text-gray-500 max-w-sm">
          You have not been assigned as a class teacher yet. Please ask the School Admin to assign you to a class via the "Assign Roles" page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Teacher Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {assignedClass.name} · {students.length} learners · {subjects.length} learning areas
          </p>
        </div>
        <select
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Term</option>
          {terms.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.academic_year}){t.is_current ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{students.length}</p>
          <p className="text-xs text-gray-500">Total Learners</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <BookOpen className="w-6 h-6 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
          <p className="text-xs text-gray-500">Learning Areas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{completeSubjects.length}</p>
          <p className="text-xs text-gray-500">Subjects Complete</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{missingMarksSubjects.length}</p>
          <p className="text-xs text-gray-500">Subjects Missing</p>
        </div>
      </div>

      {/* Overall marks progress bar */}
      {selectedTerm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Overall Marks Entry Progress</span>
            <span className="text-lg font-bold text-gray-900">{overallPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                overallPct === 100 ? 'bg-green-500' : overallPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {studentsWithAllMarks} learners have all marks · {studentsWithNoMarks} learners have no marks
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
          { key: 'marks-progress', label: 'Marks Progress', icon: <CheckCircle className="w-4 h-4" /> },
          { key: 'students', label: 'Raw Marks', icon: <Users className="w-4 h-4" /> },
          { key: 'performance', label: 'Results Analysis', icon: <TrendingUp className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Missing Marks — Action Required</h2>
          {missingMarksSubjects.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-800">All marks have been entered!</p>
              <p className="text-sm text-green-600 mt-1">Every subject has complete marks for all learners.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-red-100">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b border-red-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-red-700">Learning Area</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-red-700">Teacher</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-red-700">Uploaded</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-red-700">Pending</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-red-700">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-red-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {missingMarksSubjects.map((subject) => (
                    <tr key={subject.id} className="border-b border-red-50 bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{subject.name}</td>
                      <td className="px-4 py-3 text-gray-600">{subject.teacher_name}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{subject.entered_count}/{students.length}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{Math.max(students.length - subject.entered_count, 0)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Pending</span></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => remindTeacher(subject)}
                          disabled={remindingSubjectId === subject.id || !subject.teacher_profile_id}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {remindingSubjectId === subject.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Remind
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {missingLearnerRows.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Learners With Missing Marks</h3>
              <div className="overflow-x-auto rounded-xl border border-amber-100">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b border-amber-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-800">Learner</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-800">Missing Learning Areas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-amber-800">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingLearnerRows.map((learner) => (
                      <tr key={learner.id} className="border-b border-amber-50 bg-white">
                        <td className="px-4 py-3 font-medium text-gray-900">{learner.first_name} {learner.last_name}</td>
                        <td className="px-4 py-3 text-gray-600">{learner.missingSubjects.map((subject) => subject.name).join(', ')}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setSearch(`${learner.first_name} ${learner.last_name}`); setActiveTab('students'); }}
                            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Review Marks
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {completeSubjects.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Completed Subjects</h3>
              <div className="space-y-2">
                {completeSubjects.map((s) => (
                  <div key={s.id} className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-gray-900">{s.name}</span>
                    <span className="ml-auto text-xs text-green-600 font-medium">{s.entered_count}/{students.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'marks-progress' && selectedTerm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Detailed Marks Entry Progress</h2>
          <MarksProgress
            classId={assignedClass.id}
            className={assignedClass.name}
            termId={selectedTerm}
            schoolId={user?.schoolId || ''}
          />
        </div>
      )}

      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search learners..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Learner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Adm No.</th>
                  {subjects.map((s) => (
                    <th key={s.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {s.name.substring(0, 8)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {(loadingPerf ? students : filteredStudents).map((student, idx) => {
                  const perf = performance.find((p) => p.id === student.id);
                  return (
                    <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{student.admission_number}</td>
                      {subjects.map((s) => {
                        const result = perf?.subjectResults?.[s.id];
                        return (
                          <td key={s.id} className="px-3 py-3 text-center">
                            {result ? (
                              <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                {result.marks != null ? result.marks : result.grade}
                              </span>
                            ) : (
                              <span className="text-xs text-red-400">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        {perf?.hasAllMarks ? (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Complete</span>
                        ) : (
                          <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Incomplete</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-medium text-blue-700">Class Average</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{classAverage.toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
              <p className="text-xs font-medium text-violet-700">Class Mean Grade</p>
              <p className="mt-1 text-2xl font-bold text-violet-900">{classMeanGrade.subLevel}</p>
              <p className="text-xs text-violet-700">{classMeanGrade.descriptor}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-700">Performance Distribution</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">{Object.entries(gradeDistribution).length ? Object.entries(gradeDistribution).map(([grade, count]) => `${grade}: ${count}`).join(' · ') : 'No analyzed marks yet'}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loadingPerf ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pos</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Learner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Adm No.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Total Marks</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Avg %</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Mean Grade</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {performance
                    .sort((a, b) => (b.avgPercentage ?? -1) - (a.avgPercentage ?? -1))
                    .map((student, idx) => (
                      <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 font-medium">
                          {student.avgPercentage !== null ? idx + 1 : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{student.admission_number}</td>
                        <td className="px-4 py-3 text-center text-gray-600 font-medium">
                          {student.totalMarks !== null ? `${student.totalMarks} / ${student.totalOutOf}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {student.avgPercentage !== null ? (
                            <span className={`text-sm font-bold ${
                              student.avgPercentage >= 70 ? 'text-green-600' :
                              student.avgPercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {student.avgPercentage}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {student.avgPercentage !== null ? (
                            <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">
                              {calculateCompetencyGrade(student.avgPercentage, classBand).subLevel}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-500">
                            {Object.keys(student.subjectResults).length}/{subjects.length}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
