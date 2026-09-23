import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle, AlertCircle, BarChart3, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  ASSESSMENT_LEVEL_OPTIONS,
  getAssessmentLevelLabel,
  getEffectiveGradeLevel,
  matchesAssessmentScope,
  resultBelongsToAssessment,
  resultHasMarks,
} from '@/lib/assessment-progress';
import { formatClassStream } from '@/lib/class-label';

const RESULTS_PAGE_SIZE = 1000;

type LearnerSummary = {
  id: string;
  name: string;
  admissionNumber: string;
};

type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  hasMarks: boolean;
  markedCount: number;
  expectedCount: number;
  missingLearners: LearnerSummary[];
};

interface ProgressData {
  assessmentId: string;
  assessmentName: string;
  assessmentType: string;
  className: string;
  classId: string;
  levelKey: string;
  levelLabel: string;
  termName: string;
  totalSubjects: number;
  enteredSubjects: number;
  pendingSubjects: number;
  enteredLearnerCells: number;
  totalLearnerCells: number;
  percentComplete: number;
  subjectProgress: SubjectProgress[];
}

type ResultRow = {
  class_id: string | null;
  subject_id: string | null;
  exam_id: string | null;
  term_id: string | null;
  student_id: string | null;
  marks: number | string | null;
  out_of: number | string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
  stream: string | null;
  stream_name: string | null;
  grade_level: number | string | null;
  level: number | string | null;
  curriculum: string | null;
};

type SubjectRow = { id: string; name: string; is_core: boolean | null };
type AssignmentRow = { class_id: string | null; subject_id: string | null };
type StudentRow = { id: string; class_id: string | null; first_name: string | null; last_name: string | null; admission_number: string | null };
type AssessmentRow = {
  id: string;
  name: string;
  type: string;
  term_id: string | null;
  target_type: string | null;
  target_class_id: string | null;
  target_grade_level: number | string | null;
  terms: { name: string | null; academic_year: string | null } | null;
};

async function fetchAllSchoolResults(schoolId: string) {
  const rows: ResultRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseUntyped
      .from('results')
      .select('class_id, subject_id, exam_id, term_id, student_id, marks, out_of')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })
      .range(from, from + RESULTS_PAGE_SIZE - 1);

    if (error) return { data: null, error };
    const page = (data || []) as ResultRow[];
    rows.push(...page);
    if (page.length < RESULTS_PAGE_SIZE) break;
    from += RESULTS_PAGE_SIZE;
  }

  return { data: rows, error: null };
}

export default function SchoolAdminAssessmentProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null);
  const [debugSubject, setDebugSubject] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState('all');

  const fetchProgress = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const schoolId = user.schoolId;
      const [classesRes, subjectsRes, examsRes, assignmentsRes, studentsRes] = await Promise.all([
        supabaseUntyped
          .from('classes')
          .select('id, name, stream, stream_name, grade_level, level, curriculum')
          .eq('school_id', schoolId)
          .eq('is_active', true),
        supabaseUntyped
          .from('subjects')
          .select('id, name, is_core')
          .eq('school_id', schoolId)
          .order('name'),
        supabaseUntyped
          .from('school_exams')
          .select('id, name, type, term_id, target_type, target_class_id, target_grade_level, terms(name, academic_year)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabaseUntyped
          .from('teacher_subject_assignments')
          .select('class_id, subject_id')
          .eq('school_id', schoolId)
          .eq('is_active', true),
        supabaseUntyped
          .from('students')
          .select('id, class_id, first_name, last_name, admission_number')
          .eq('school_id', schoolId)
          .eq('is_active', true),
      ]);

      const resultsRes = await fetchAllSchoolResults(schoolId);
      if (classesRes.error) throw classesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (examsRes.error) throw examsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const classes = (classesRes.data || []) as ClassRow[];
      const subjects = (subjectsRes.data || []) as SubjectRow[];
      const exams = (examsRes.data || []) as AssessmentRow[];
      const students = (studentsRes.data || []) as StudentRow[];
      const subjectName = new Map<string, string>(subjects.map((subject) => [subject.id, subject.name]));
      const studentsByClass = new Map<string, LearnerSummary[]>();

      students.forEach((student) => {
        if (!student.class_id) return;
        const learner: LearnerSummary = {
          id: String(student.id),
          name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unnamed learner',
          admissionNumber: student.admission_number || 'No admission number',
        };
        studentsByClass.set(student.class_id, [...(studentsByClass.get(student.class_id) || []), learner]);
      });

      const taughtByClass = new Map<string, Set<string>>();
      ((assignmentsRes.data || []) as AssignmentRow[]).forEach((assignment) => {
        if (!assignment.class_id || !assignment.subject_id) return;
        if (!taughtByClass.has(assignment.class_id)) taughtByClass.set(assignment.class_id, new Set());
        taughtByClass.get(assignment.class_id)!.add(assignment.subject_id);
      });

      const resultRowsByClassSubject = new Map<string, ResultRow[]>();
      ((resultsRes.data || []) as ResultRow[]).forEach((result) => {
        if (!result.class_id || !result.subject_id || !result.student_id || !resultHasMarks(result)) return;
        const key = `${result.class_id}-${result.subject_id}`;
        resultRowsByClassSubject.set(key, [...(resultRowsByClassSubject.get(key) || []), result]);
      });

      const coreSubjectIds = subjects.filter((subject) => subject.is_core !== false).map((subject) => subject.id);
      const progressData: ProgressData[] = [];

      for (const cls of classes) {
        const expectedLearners = studentsByClass.get(cls.id) || [];
        const taughtIds = [...(taughtByClass.get(cls.id) || new Set())];
        for (const exam of exams) {
          if (!matchesAssessmentScope(exam, cls)) continue;

          const classResultSubjectIds = Array.from(resultRowsByClassSubject.keys())
            .filter((key) => key.startsWith(`${cls.id}-`))
            .map((key) => key.slice(`${cls.id}-`.length));
          const enteredIds = classResultSubjectIds.filter((subjectId) =>
            (resultRowsByClassSubject.get(`${cls.id}-${subjectId}`) || [])
              .some((result) => resultBelongsToAssessment(result, exam)),
          );
          const baseIds = taughtIds.length > 0 ? taughtIds : coreSubjectIds;
          const allIds = Array.from(new Set([...baseIds, ...enteredIds]));
          const isReligiousId = (subjectId: string) => {
            const name = (subjectName.get(subjectId) || '').toUpperCase().replace(/[.\s]/g, '');
            return name === 'CRE' || name === 'IRE' || name === 'HRE' || name.includes('CHRISTIAN') || name.includes('ISLAMIC') || name.includes('HINDU') || name.includes('RELIGIOUS');
          };
          const religiousIds = allIds.filter(isReligiousId);
          const nonReligiousIds = allIds.filter((subjectId) => !isReligiousId(subjectId));

          const getMarkedLearnerIds = (subjectIds: string[]) => {
            const markedIds = new Set<string>();
            subjectIds.forEach((subjectId) => {
              (resultRowsByClassSubject.get(`${cls.id}-${subjectId}`) || [])
                .filter((result) => resultBelongsToAssessment(result, exam))
                .forEach((result) => markedIds.add(String(result.student_id)));
            });
            return markedIds;
          };

          const makeSubjectProgress = (subjectId: string, name: string, subjectIds = [subjectId]): SubjectProgress => {
            const markedIds = getMarkedLearnerIds(subjectIds);
            const missingLearners = expectedLearners.filter((learner) => !markedIds.has(learner.id));
            return {
              subjectId,
              subjectName: name,
              hasMarks: expectedLearners.length > 0 && missingLearners.length === 0,
              markedCount: markedIds.size,
              expectedCount: expectedLearners.length,
              missingLearners,
            };
          };

          let religiousLabel = '';
          if (religiousIds.length > 0) {
            const shortNames = Array.from(new Set(
              religiousIds
                .map((subjectId) => subjectName.get(subjectId) || subjectId)
                .filter(Boolean)
                .map((name) => {
                  const normalized = name.toUpperCase().replace(/[.\s]/g, '');
                  if (normalized === 'CRE' || normalized.includes('CHRISTIAN')) return 'CRE';
                  if (normalized === 'IRE' || normalized.includes('ISLAMIC')) return 'IRE';
                  if (normalized === 'HRE' || normalized.includes('HINDU')) return 'HRE';
                  return name;
                }),
            )).sort();
            religiousLabel = shortNames.join('/') || 'Religious Education';
          }

          const subjectProgress: SubjectProgress[] = [
            ...(religiousIds.length > 0 ? [makeSubjectProgress(religiousIds[0], religiousLabel, religiousIds)] : []),
            ...nonReligiousIds.map((subjectId) => makeSubjectProgress(subjectId, subjectName.get(subjectId) || subjectId)),
          ];
          const totalSubjects = subjectProgress.length;
          const enteredSubjects = subjectProgress.filter((subject) => subject.hasMarks).length;
          const enteredLearnerCells = subjectProgress.reduce((sum, subject) => sum + subject.markedCount, 0);
          const totalLearnerCells = subjectProgress.reduce((sum, subject) => sum + subject.expectedCount, 0);
          const level = getEffectiveGradeLevel(cls);
          const levelKey = level === null ? 'unknown' : String(level);
          const className = formatClassStream(cls);

          progressData.push({
            assessmentId: exam.id,
            assessmentName: exam.name,
            assessmentType: exam.type,
            className,
            classId: cls.id,
            levelKey,
            levelLabel: getAssessmentLevelLabel(cls),
            termName: `${exam.terms?.name || ''} ${exam.terms?.academic_year || ''}`.trim(),
            totalSubjects,
            enteredSubjects,
            pendingSubjects: totalSubjects - enteredSubjects,
            enteredLearnerCells,
            totalLearnerCells,
            percentComplete: totalLearnerCells > 0 ? Math.round((enteredLearnerCells / totalLearnerCells) * 100) : 0,
            subjectProgress,
          });
        }
      }

      progressData.sort((a, b) => a.className.localeCompare(b.className) || a.assessmentName.localeCompare(b.assessmentName));
      setProgress(progressData);
    } catch (err: unknown) {
      toast.error(`Failed to load progress: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // This effect synchronizes the page with the authenticated tenant's remote data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProgress();
  }, [fetchProgress]);

  const visible = useMemo(
    () => levelFilter === 'all' ? progress : progress.filter((item) => item.levelKey === levelFilter),
    [levelFilter, progress],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Assessment Progress</h1>
        <p className="text-sm text-[#666666]">Track marks entry progress for every learner, learning area, class, and assessment across your school.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
        <label className="text-sm font-semibold text-gray-700" htmlFor="school-admin-level-filter">Level</label>
        <select id="school-admin-level-filter" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          {ASSESSMENT_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="text-xs text-gray-500">{visible.length} assessment view{visible.length === 1 ? '' : 's'}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center"><div className="text-2xl font-bold text-blue-600">{visible.length}</div><div className="text-xs text-gray-500">Active Assessments</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center"><div className="text-2xl font-bold text-green-600">{visible.filter((item) => item.percentComplete === 100).length}</div><div className="text-xs text-gray-500">Complete</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center"><div className="text-2xl font-bold text-orange-600">{visible.filter((item) => item.percentComplete > 0 && item.percentComplete < 100).length}</div><div className="text-xs text-gray-500">In Progress</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center"><div className="text-2xl font-bold text-purple-600">{visible.reduce((sum, item) => sum + item.enteredSubjects, 0)}</div><div className="text-xs text-gray-500">Learning Areas Done</div></div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center"><AlertCircle className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="text-gray-500">No assessments found. Create assessments and assign learning areas to teachers to see progress.</p></div>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => {
            const key = `${item.assessmentId}-${item.classId}`;
            const isExpanded = expandedAssessment === key;
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <button onClick={() => setExpandedAssessment(isExpanded ? null : key)} className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100"><BarChart3 className="h-5 w-5 text-blue-600" /></div>
                    <div><p className="font-semibold text-[#111111]">{item.assessmentName}</p><p className="text-xs text-gray-500">{item.levelLabel} · {item.className} · {item.termName} · {item.assessmentType}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right"><p className="text-sm font-bold text-[#111111]">{item.percentComplete}%</p><p className="text-xs text-gray-500">{item.enteredSubjects}/{item.totalSubjects} areas · {item.enteredLearnerCells}/{item.totalLearnerCells} marks</p></div>
                    {item.percentComplete === 100 ? <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700"><CheckCircle className="h-3.5 w-3.5" /> Complete</span> : item.percentComplete > 0 ? <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700"><AlertCircle className="h-3.5 w-3.5" /> In Progress</span> : <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500"><AlertCircle className="h-3.5 w-3.5" /> Not entered</span>}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>
                <div className="px-5 pb-2"><div className="h-2 w-full overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full transition-all ${item.percentComplete === 100 ? 'bg-green-500' : item.percentComplete > 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${item.percentComplete}%` }} /></div></div>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase text-gray-500">Learning Area Progress</p><p className="text-xs text-gray-400">Complete means every active learner has a valid mark.</p></div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {item.subjectProgress.map((subject) => {
                        const debugKey = `${key}-${subject.subjectId}`;
                        const isDebugOpen = debugSubject === debugKey;
                        return (
                          <div key={subject.subjectId} className={`rounded-lg border p-2 ${subject.hasMarks ? 'border-green-100 bg-green-50' : subject.markedCount > 0 ? 'border-orange-100 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                            <div className="flex items-start gap-2">
                              {subject.hasMarks ? <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" /> : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />}
                              <div className="min-w-0 flex-1"><p className={`truncate text-sm ${subject.hasMarks ? 'text-green-800' : 'text-gray-700'}`}>{subject.subjectName}</p><p className="text-xs text-gray-500">{subject.hasMarks ? 'Complete' : subject.markedCount > 0 ? `${subject.markedCount}/${subject.expectedCount} learners marked` : 'Not entered'}</p></div>
                            </div>
                            {!subject.hasMarks && subject.missingLearners.length > 0 && (
                              <button type="button" onClick={() => setDebugSubject(isDebugOpen ? null : debugKey)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Bug className="h-3.5 w-3.5" />{isDebugOpen ? 'Hide missing learners' : `Show ${subject.missingLearners.length} missing learners`}</button>
                            )}
                            {isDebugOpen && (
                              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-blue-100 bg-white p-2 text-xs text-gray-600"><p className="mb-1 font-semibold text-gray-700">Missing marks</p><ul className="space-y-1">{subject.missingLearners.map((learner) => <li key={learner.id}>{learner.name} <span className="text-gray-400">({learner.admissionNumber})</span></li>)}</ul></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
