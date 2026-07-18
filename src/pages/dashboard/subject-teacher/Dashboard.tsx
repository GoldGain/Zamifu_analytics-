import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Users, Upload, Loader2, BarChart3, TrendingUp, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { getSchoolLevelBand } from '@/lib/grading';

interface Assignment {
  id: string;
  subjects: { id: string; name: string } | null;
  classes: { id: string; name: string; curriculum: string; grade_level: number | null; level: number | null } | null;
  class_id: string;
  subject_id: string;
}

interface StudentResult {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  marks: number | null;
  out_of: number | null;
  percentage: number | null;
  cbc_grade: string | null;
  cbc_sublevel: string | null;
  cbc_points: number | null;
  grade_: string | null;
}

export default function SubjectTeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [studentResults, setStudentResults] = useState<Record<string, StudentResult[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<Record<string, boolean>>({});
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [teacherRecord, setTeacherRecord] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get teacher record
      const { data: teacher } = await supabaseUntyped
        .from('teachers')
        .select('id, school_id')
        .eq('profile_id', user?.id)
        .maybeSingle();
      setTeacherRecord(teacher);

      if (!teacher) {
        toast.error('Teacher record not found');
        return;
      }

      // Fetch terms for this school
      const { data: termsData } = await supabaseUntyped
        .from('terms')
        .select('*')
        .eq('school_id', teacher.school_id)
        .order('academic_year', { ascending: false });
      setTerms(termsData || []);
      if (termsData && termsData.length > 0) {
        setSelectedTerm(termsData[0].id);
      }

      // Fetch assignments using teacher_subject_assignments table
      const { data, error } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('*, subjects(id, name), classes(id, name, curriculum, grade_level, level)')
        .eq('teacher_id', teacher.id)
        .eq('is_active', true);

      if (error) throw error;
      setAssignments((data || []) as Assignment[]);
    } catch (err: any) {
      console.error('Error fetching assignments:', err);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentResults = async (assignment: Assignment) => {
    const key = `${assignment.class_id}-${assignment.subject_id}`;
    if (studentResults[key] || !selectedTerm) return;

    setLoadingStudents(prev => ({ ...prev, [key]: true }));
    try {
      // Get all students in the class
      const { data: students } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('class_id', assignment.class_id)
        .eq('is_active', true)
        .order('first_name');

      if (!students) return;

      // Get results for this subject and term
      const { data: results } = await supabaseUntyped
        .from('results')
        .select('student_id, marks, out_of, percentage, cbc_grade, cbc_sublevel, cbc_points, grade_')
        .eq('class_id', assignment.class_id)
        .eq('subject_id', assignment.subject_id)
        .eq('term_id', selectedTerm);

      const resultMap: Record<string, any> = {};
      (results || []).forEach((r: any) => { resultMap[r.student_id] = r; });

      const combined: StudentResult[] = students.map((s: any) => ({
        student_id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        admission_number: s.admission_number,
        marks: resultMap[s.id]?.marks ?? null,
        out_of: resultMap[s.id]?.out_of ?? null,
        percentage: resultMap[s.id]?.percentage ?? null,
        cbc_grade: resultMap[s.id]?.cbc_grade ?? null,
        cbc_sublevel: resultMap[s.id]?.cbc_sublevel ?? null,
        cbc_points: resultMap[s.id]?.cbc_points ?? null,
        grade_: resultMap[s.id]?.grade_ ?? null,
      }));

      setStudentResults(prev => ({ ...prev, [key]: combined }));
    } catch (err: any) {
      toast.error('Failed to load student results');
    } finally {
      setLoadingStudents(prev => ({ ...prev, [key]: false }));
    }
  };

  const toggleCard = async (assignment: Assignment) => {
    const key = `${assignment.class_id}-${assignment.subject_id}`;
    if (expandedCard === key) {
      setExpandedCard(null);
    } else {
      setExpandedCard(key);
      await fetchStudentResults(assignment);
    }
  };

  const getDisplayGrade = (r: StudentResult, classData: any): string => {
    const is = String(classData?.curriculum || '').toUpperCase() === '';
    if (is) return r.grade_ || '—';
    return r.cbc_sublevel || r.cbc_grade || '—';
  };

  const getClassAverage = (key: string): number | null => {
    const rows = studentResults[key];
    if (!rows || rows.length === 0) return null;
    const withResults = rows.filter(r => r.percentage !== null);
    if (withResults.length === 0) return null;
    return Math.round(withResults.reduce((s, r) => s + (r.percentage || 0), 0) / withResults.length);
  };

  const gradeColor = (grade: string) => {
    if (grade?.startsWith('EE') || grade === 'A' || grade === 'A-') return 'bg-green-100 text-green-700';
    if (grade?.startsWith('ME') || grade?.startsWith('B')) return 'bg-blue-100 text-blue-700';
    if (grade?.startsWith('AE') || grade?.startsWith('C')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Subject Teacher Dashboard</h1>
          <p className="text-sm text-[#666666]">Your assigned subjects, classes, and student results</p>
        </div>
        {terms.length > 0 && (
          <select
            value={selectedTerm}
            onChange={e => { setSelectedTerm(e.target.value); setStudentResults({}); }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
          >
            {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
          </select>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Assigned Subjects</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{assignments.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-600">Classes</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {new Set(assignments.map(a => a.class_id)).size}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Upload Marks</span>
          </div>
          <Link to="/teacher/results/assigned" className="text-sm font-semibold text-blue-600 hover:underline">Upload Assigned →</Link>
        </div>
      </div>

      {/* Assignment cards */}
      <div className="space-y-4">
        {assignments.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-2xl border border-dashed border-gray-300">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No Subjects Assigned</h3>
            <p className="text-gray-500 mt-2">Ask your School Admin to assign subjects to you.</p>
          </div>
        ) : (
          assignments.map((assignment) => {
            const key = `${assignment.class_id}-${assignment.subject_id}`;
            const isExpanded = expandedCard === key;
            const classAvg = getClassAverage(key);
            const rows = studentResults[key] || [];
            const withResults = rows.filter(r => r.percentage !== null);

            return (
              <div key={key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card header */}
                <div
                  className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleCard(assignment)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{assignment.subjects?.name}</h3>
                      <p className="text-sm text-gray-500">{assignment.classes?.name} · {assignment.classes?.curriculum}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {classAvg !== null && (
                      <div className="text-right hidden sm:block">
                        <div className="text-lg font-bold text-blue-600">{classAvg}%</div>
                        <div className="text-xs text-gray-500">Class Avg</div>
                      </div>
                    )}
                    <Link
                      to="/teacher/results/assigned"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </Link>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded student list */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {loadingStudents[key] ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                    ) : rows.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-500">No students found in this class.</div>
                    ) : (
                      <>
                        {/* Summary bar */}
                        <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-4 text-sm">
                          <span className="text-gray-600">Total Students: <strong>{rows.length}</strong></span>
                          <span className="text-gray-600">Results Uploaded: <strong>{withResults.length}</strong></span>
                          {classAvg !== null && <span className="text-blue-600 font-semibold">Class Average: {classAvg}%</span>}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Adm No.</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marks</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">%</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows
                                .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1))
                                .map((s, idx) => (
                                  <tr key={s.student_id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-6 py-3 text-gray-500">{idx + 1}</td>
                                    <td className="px-6 py-3 font-medium text-gray-900">{s.first_name} {s.last_name}</td>
                                    <td className="px-6 py-3 text-gray-500">{s.admission_number}</td>
                                    <td className="px-6 py-3">{s.marks !== null ? `${s.marks}/${s.out_of ?? 100}` : <span className="text-gray-300">—</span>}</td>
                                    <td className="px-6 py-3 font-semibold">{s.percentage !== null ? `${s.percentage}%` : <span className="text-gray-300">—</span>}</td>
                                    <td className="px-6 py-3">
                                      {getDisplayGrade(s, assignment.classes) !== '—' ? (
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${gradeColor(getDisplayGrade(s, assignment.classes))}`}>
                                          {getDisplayGrade(s, assignment.classes)}
                                        </span>
                                      ) : <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
