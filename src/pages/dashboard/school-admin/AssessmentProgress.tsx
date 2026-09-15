import { useState, useEffect, useMemo } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { ASSESSMENT_LEVEL_OPTIONS, getAssessmentLevelLabel, getEffectiveGradeLevel, matchesAssessmentScope, resultBelongsToAssessment, resultHasMarks } from '@/lib/assessment-progress';

interface ProgressData {
  assessmentId: string; assessmentName: string; assessmentType: string;
  className: string; classId: string; levelKey: string; levelLabel: string; termName: string;
  totalSubjects: number; enteredSubjects: number; pendingSubjects: number; percentComplete: number;
  subjectProgress: { subjectId: string; subjectName: string; hasMarks: boolean; studentCount: number }[];
}

export default function SchoolAdminAssessmentProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState('all');

  useEffect(() => { if (user?.schoolId) fetchProgress(); }, [user?.schoolId]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const schoolId = user?.schoolId as string;
      const [classesRes, subjectsRes, examsRes, assignmentsRes, resultsRes] = await Promise.all([
        supabaseUntyped.from('classes').select('id, name, stream, stream_name, grade_level, level, curriculum').eq('school_id', schoolId).eq('is_active', true),
        supabaseUntyped.from('subjects').select('id, name, is_core').eq('school_id', schoolId).order('name'),
        supabaseUntyped.from('school_exams').select('id, name, type, term_id, target_type, target_class_id, target_grade_level, terms(name, academic_year)').eq('school_id', schoolId).eq('is_active', true).order('created_at', { ascending: false }),
        supabaseUntyped.from('teacher_subject_assignments').select('class_id, subject_id').eq('school_id', schoolId).eq('is_active', true),
        supabaseUntyped.from('results').select('class_id, subject_id, exam_id, term_id, marks, out_of').eq('school_id', schoolId),
      ]);
      const classes = (classesRes.data || []) as any[];
      const subjects = (subjectsRes.data || []) as any[];
      const exams = (examsRes.data || []) as any[];
      const subjectName = new Map<string, string>(subjects.map((s: any) => [s.id, s.name]));
      const taughtByClass = new Map<string, Set<string>>();
      (assignmentsRes.data || []).forEach((a: any) => { if (!a.class_id) return; if (!taughtByClass.has(a.class_id)) taughtByClass.set(a.class_id, new Set()); taughtByClass.get(a.class_id)!.add(a.subject_id); });
      const resultRowsByClassSubject = new Map<string, any[]>();
      (resultsRes.data || []).forEach((r: any) => {
        if (!r.class_id || !r.subject_id || !resultHasMarks(r)) return;
        const key = `${r.class_id}-${r.subject_id}`;
        resultRowsByClassSubject.set(key, [...(resultRowsByClassSubject.get(key) || []), r]);
      });
      const coreSubjectIds = subjects.filter((s: any) => s.is_core !== false).map((s: any) => s.id);
      const progressData: ProgressData[] = [];
      for (const cls of classes) {
        const taughtIds = [...(taughtByClass.get(cls.id) || new Set())];
        for (const exam of exams) {
          if (!matchesAssessmentScope(exam, cls)) continue;
          const classResultSubjectIds = Array.from(resultRowsByClassSubject.keys())
            .filter((key) => key.startsWith(`${cls.id}-`))
            .map((key) => key.slice(`${cls.id}-`.length));
          const enteredIds = classResultSubjectIds.filter((subjectId) =>
            (resultRowsByClassSubject.get(`${cls.id}-${subjectId}`) || []).some((result) => resultBelongsToAssessment(result, exam)),
          );
          const baseIds = taughtIds.length > 0 ? taughtIds : coreSubjectIds;
          const allIds = Array.from(new Set([...baseIds, ...enteredIds]));
          const enteredSet = new Set(enteredIds);
          const isReligiousId = (sid: string) => {
            const n = (subjectName.get(sid) || '').toUpperCase().replace(/[.\s]/g, '');
            return n === 'CRE' || n === 'IRE' || n === 'HRE' || n.includes('CHRISTIAN') || n.includes('ISLAMIC') || n.includes('HINDU') || n.includes('RELIGIOUS');
          };
          const religiousIds = allIds.filter(isReligiousId);
          const nonReligiousIds = allIds.filter((sid) => !isReligiousId(sid));
          // A learner takes only one religious-education variant (CRE, IRE or HRE),
          // so collapse every religious learning area into a single slot that is
          // counted as entered when ANY of its variants has marks. This stops the
          // other variants from being reported as "missing results".
          let religiousLabel = '';
          if (religiousIds.length > 0) {
            const shortNames = Array.from(new Set(religiousIds.map((sid) => subjectName.get(sid) || sid).filter(Boolean))).map((n) => { const u = n.toUpperCase().replace(/[.\s]/g, ''); if (u === 'CRE' || u.includes('CHRISTIAN')) return 'CRE'; if (u === 'IRE' || u.includes('ISLAMIC')) return 'IRE'; if (u === 'HRE' || u.includes('HINDU')) return 'HRE'; return n; });
            religiousLabel = Array.from(new Set(shortNames)).sort().join('/');
          }
          const subjectProgress: { subjectId: string; subjectName: string; hasMarks: boolean; studentCount: number }[] = [
            ...(religiousIds.length > 0 ? [{
              subjectId: religiousIds[0],
              subjectName: religiousLabel || 'Religious Education',
              hasMarks: religiousIds.some((sid) => enteredSet.has(sid)),
              studentCount: 0,
            }] : []),
            ...nonReligiousIds.map((sid) => ({ subjectId: sid, subjectName: subjectName.get(sid) || sid, hasMarks: enteredSet.has(sid), studentCount: 0 })),
          ];
          const totalSubjects = subjectProgress.length;
          const enteredSubjects = subjectProgress.filter((s) => s.hasMarks).length;
          const level = getEffectiveGradeLevel(cls);
          const levelKey = level === null ? 'unknown' : String(level);
          const streamPart = String(cls.stream || cls.stream_name || '').trim();
          const className = `${cls.name || 'Unknown'}${streamPart ? ` ${streamPart}` : ''}`;
          progressData.push({ assessmentId: exam.id, assessmentName: exam.name, assessmentType: exam.type, className, classId: cls.id, levelKey, levelLabel: getAssessmentLevelLabel(cls), termName: `${exam.terms?.name || ''} ${exam.terms?.academic_year || ''}`.trim(), totalSubjects, enteredSubjects, pendingSubjects: totalSubjects - enteredSubjects, percentComplete: totalSubjects > 0 ? Math.round((enteredSubjects / totalSubjects) * 100) : 0, subjectProgress });
        }
      }
      progressData.sort((a, b) => a.className.localeCompare(b.className) || a.assessmentName.localeCompare(b.assessmentName));
      setProgress(progressData);
    } catch (err: any) { toast.error('Failed to load progress: ' + err.message); }
    finally { setLoading(false); }
  };

  const visible = useMemo(() => levelFilter === 'all' ? progress : progress.filter((p) => p.levelKey === levelFilter), [levelFilter, progress]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Assessment Progress</h1>
        <p className="text-sm text-[#666666]">Track marks entry progress for every class and assessment across your school.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
        <label className="text-sm font-semibold text-gray-700" htmlFor="school-admin-level-filter">Level</label>
        <select id="school-admin-level-filter" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          {ASSESSMENT_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="text-xs text-gray-500">{visible.length} assessment view{visible.length === 1 ? '' : 's'}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center"><div className="text-2xl font-bold text-blue-600">{visible.length}</div><div className="text-xs text-gray-500">Active Assessments</div></div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center"><div className="text-2xl font-bold text-green-600">{visible.filter((p) => p.percentComplete === 100).length}</div><div className="text-xs text-gray-500">Complete</div></div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center"><div className="text-2xl font-bold text-orange-600">{visible.filter((p) => p.percentComplete > 0 && p.percentComplete < 100).length}</div><div className="text-xs text-gray-500">In Progress</div></div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center"><div className="text-2xl font-bold text-purple-600">{visible.reduce((sum, p) => sum + p.enteredSubjects, 0)}</div><div className="text-xs text-gray-500">Learning Areas Done</div></div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100"><AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No assessments found. Create assessments and assign learning areas to teachers to see progress.</p></div>
      ) : (
        <div className="space-y-4">
          {visible.map((p) => {
            const key = `${p.assessmentId}-${p.classId}`;
            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button onClick={() => setExpandedAssessment(expandedAssessment === key ? null : key)} className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><BarChart3 className="w-5 h-5 text-blue-600" /></div>
                    <div className="text-left"><p className="font-semibold text-[#111111]">{p.assessmentName}</p><p className="text-xs text-gray-500">{p.levelLabel} &middot; {p.className} &middot; {p.termName} &middot; {p.assessmentType}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right"><p className="text-sm font-bold text-[#111111]">{p.percentComplete}%</p><p className="text-xs text-gray-500">{p.enteredSubjects}/{p.totalSubjects} learning areas</p></div>
                    {p.percentComplete === 100 ? <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full border border-green-200 whitespace-nowrap"><CheckCircle className="w-3.5 h-3.5" /> Completed</span> : p.percentComplete > 0 ? <span className="flex items-center gap-1 text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full border border-orange-200 whitespace-nowrap"><AlertCircle className="w-3.5 h-3.5" /> In Progress</span> : <span className="flex items-center gap-1 text-xs font-bold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full border border-gray-200 whitespace-nowrap"><AlertCircle className="w-3.5 h-3.5" /> Not Started</span>}
                  </div>
                </button>
                <div className="px-5 pb-2"><div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${p.percentComplete === 100 ? 'bg-green-500' : p.percentComplete > 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${p.percentComplete}%` }} /></div></div>
                {expandedAssessment === key && (
                  <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Learning Area Progress</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {p.subjectProgress.map((sp) => (
                        <div key={sp.subjectId} className={`flex items-center gap-2 p-2 rounded-lg ${sp.hasMarks ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                          {sp.hasMarks ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                          <div className="flex-1 min-w-0"><p className={`text-sm truncate ${sp.hasMarks ? 'text-green-800' : 'text-gray-600'}`}>{sp.subjectName}</p><p className="text-xs text-gray-400">{sp.hasMarks ? 'Marks entered' : 'Pending'}</p></div>
                        </div>
                      ))}
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
