import { useCallback, useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ExamGenerator, {
  type CurriculumStrandOption,
  type CurriculumSubStrandOption,
} from '@/components/curriculum/ExamGenerator';
import {
  juniorExamSubjects,
  getStrandPacks,
} from '@/lib/kicd-knowledge';
import type { AssessmentLevel } from '@/lib/exam-schema';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

interface Grade {
  id: string;
  grade_number: number;
  grade_name: string;
  assessmentLevel?: AssessmentLevel;
  seniorAvailable?: boolean;
  seniorDisabledReason?: string;
}
interface Subject { id: string; subject_name: string; subject_code: string; }
interface Strand { id: string; strand_name: string; strand_order: number; sub_strands?: SubStrand[]; }
interface SubStrand { id: string; sub_strand_name: string; sub_strand_order: number; }
function displaySubjectName(name: string): string {
  return /agriculture\s+and\s+nutrition/i.test(name) ? 'Agriculture' : name;
}

const SENIOR_ASSESSMENT_LEVEL: AssessmentLevel = 'senior_secondary';

export default function ExamGeneratorPage() {
  const { user, schoolData } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedGrade = searchParams.get('grade') || '';
  const requestedSubject = searchParams.get('subject') || '';
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [strands, setStrands] = useState<CurriculumStrandOption[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [subjectMessage, setSubjectMessage] = useState('');
  const [curriculumMessage, setCurriculumMessage] = useState('');

  const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
  const selectedGradeMeta = grades.find(g => g.id === selectedGrade);
  const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';
  const schoolName = schoolData?.name?.trim() || '';
  const backPath = user?.role === 'school_admin' ? '/school-admin' : '/teacher/curriculum';

  // Load grades on mount
  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    setLoadingGrades(true);
    const { data } = await supabaseUntyped
      .from('curriculum_grades')
      .select('*')
      .order('grade_number');
    const databaseGrades = (data || []) as Grade[];
    const seniorDatabaseGrades = databaseGrades.filter((grade) => grade.grade_number >= 10 && grade.grade_number <= 12);
    const seniorGradeIds = seniorDatabaseGrades.map((grade) => grade.id).filter(Boolean);
    const { data: seniorSubjectRows } = seniorGradeIds.length
      ? await supabaseUntyped
        .from('curriculum_subjects')
        .select('id, grade_id, subject_name, subject_code')
        .in('grade_id', seniorGradeIds)
      : { data: [] };
    const seniorSubjectCounts = new Map<number, number>();
    (seniorSubjectRows || []).forEach((subject: { grade_id?: string; subject_name?: string | null }) => {
      const grade = seniorDatabaseGrades.find((candidate) => candidate.id === subject.grade_id);
      if (grade && subject.subject_name?.trim()) seniorSubjectCounts.set(grade.grade_number, (seniorSubjectCounts.get(grade.grade_number) || 0) + 1);
    });
    const seniorGrades: Grade[] = [10, 11, 12].map((gradeNumber) => {
      const databaseGrade = seniorDatabaseGrades.find((grade) => grade.grade_number === gradeNumber);
      const hasSubjectCatalogue = Boolean(databaseGrade && (seniorSubjectCounts.get(gradeNumber) || 0) > 0);
      return {
        id: databaseGrade?.id || `senior-grade-${gradeNumber}`,
        grade_number: gradeNumber,
        grade_name: databaseGrade?.grade_name || `Grade ${gradeNumber}`,
        assessmentLevel: SENIOR_ASSESSMENT_LEVEL,
        seniorAvailable: hasSubjectCatalogue,
        seniorDisabledReason: hasSubjectCatalogue
          ? undefined
          : 'No authoritative Senior School subject catalogue is configured for this grade.',
      };
    });
    const juniorGrades = databaseGrades.filter((grade) => grade.grade_number >= 7 && grade.grade_number <= 9);
    const availableGrades = juniorGrades.length
      ? [...juniorGrades, ...seniorGrades].sort((a: Grade, b: Grade) => a.grade_number - b.grade_number)
      : [
        { id: 'g7', grade_number: 7, grade_name: 'Grade 7' },
        { id: 'g8', grade_number: 8, grade_name: 'Grade 8' },
        { id: 'g9', grade_number: 9, grade_name: 'Grade 9' },
        ...seniorGrades,
      ];
    setGrades(availableGrades);
    const requested = requestedGrade.toLowerCase().replace(/\s+/g, '');
    if (requested) {
      const match = availableGrades.find((grade) =>
        grade.id === requestedGrade || grade.grade_name.toLowerCase().replace(/\s+/g, '') === requested
      );
      if (match && match.seniorAvailable !== false) setSelectedGrade(match.id);
    }
    setLoadingGrades(false);
  };

  // Load subjects when grade changes
  useEffect(() => {
    if (!selectedGrade) { setSubjects([]); setSubjectMessage(''); return; }
    const isSenior = selectedGradeMeta?.assessmentLevel === SENIOR_ASSESSMENT_LEVEL;
    setLoadingSubjects(true);
    setSubjectMessage('');
    supabaseUntyped
      .from('curriculum_subjects')
      .select('*')
      .eq('grade_id', selectedGrade)
      .order('subject_name')
      .then(({ data }) => {
        const juniorSubjectNames = new Set(juniorExamSubjects());
        const databaseSubjects = (data || [])
          .filter((subject: Subject) => subject.subject_name?.trim())
          .filter((subject: Subject) => juniorSubjectNames.has(subject.subject_name) || /agriculture\s+and\s+nutrition/i.test(subject.subject_name))
          .map((subject: Subject) => ({ ...subject, subject_name: displaySubjectName(subject.subject_name) }));
        const seniorSubjects = (data || [])
          .filter((subject: Subject) => subject.subject_name?.trim()) as Subject[];
        const availableSubjects: Subject[] = isSenior
          ? seniorSubjects
          : databaseSubjects.length
          ? databaseSubjects as Subject[]
          : juniorExamSubjects().map((name, idx) => ({
            id: `local-${selectedGrade}-${idx}`,
            subject_name: name,
            subject_code: name.slice(0, 4).toUpperCase(),
          }));
        setSubjects(availableSubjects);
        if (isSenior && !availableSubjects.length) {
          setSubjectMessage('Senior School subject catalogue unavailable for this grade. Senior generation remains disabled; no Junior subjects are substituted.');
        }
        const requested = requestedSubject.toLowerCase().replace(/\s+/g, '');
        if (requested) {
          const match = availableSubjects.find((subject: Subject) =>
            subject.subject_name.toLowerCase().replace(/\s+/g, '') === requested
          );
          if (match) setSelectedSubject(match.id);
        }
        setLoadingSubjects(false);
      });
    setSelectedSubject('');
    setStrands([]);
    setCurriculumMessage('');
  }, [selectedGrade, selectedGradeMeta?.assessmentLevel]);

  // Load curriculum tree when subject changes
  const loadCurriculumTree = useCallback(async () => {
    if (!selectedSubject) return;
    setLoadingTree(true);
    setCurriculumMessage('');
    const isSenior = selectedGradeMeta?.assessmentLevel === SENIOR_ASSESSMENT_LEVEL;

    const { data: strandsData } = await supabaseUntyped
      .from('curriculum_strands')
      .select('id, strand_name, strand_order, strand_description')
      .eq('subject_id', selectedSubject)
      .order('strand_order');

    // Prefer rows explicitly marked as source-verified KICD when a subject also
    // contains legacy generic curriculum rows. This keeps the selector truthful
    // without deleting legacy records that may be referenced by school content.
    const sourceVerifiedStrands = (strandsData || []).filter((strand: { strand_description?: string | null }) =>
      /(?:official|source-verified)\s+kicd/i.test(strand.strand_description || '')
    );
    const effectiveStrandsData = isSenior
      ? sourceVerifiedStrands
      : sourceVerifiedStrands.length > 0 ? sourceVerifiedStrands : (strandsData || []);

    if (effectiveStrandsData.length === 0) {
      if (isSenior) {
        setStrands([]);
        setCurriculumMessage(`Senior subject pack unavailable for ${subjectName || 'this subject'}; generation is disabled. No Junior or generic curriculum fallback is used.`);
        setLoadingTree(false);
        return;
      }
      // Fallback to embedded KICD knowledge — build the strand and sub-strand tree.
      const packs = getStrandPacks(subjectName);
      const localStrands: CurriculumStrandOption[] = packs.map((pack, si) => {
        const subStrands: CurriculumSubStrandOption[] = pack.subStrands.map((ss, ssi) => ({
          id: `local-ss-${si}-${ssi}`,
          sub_strand_name: ss.name,
        }));
        return {
          id: `local-strand-${si}`,
          strand_name: pack.strand,
          sub_strands: subStrands,
        };
      });
      setStrands(localStrands);
      setLoadingTree(false);
      return;
    }

    // Load from database — fetch sub-strands for each strand and nest them
    const enriched: CurriculumStrandOption[] = [];

    for (const strand of effectiveStrandsData) {
      const { data: ssData } = await supabaseUntyped
        .from('curriculum_sub_strands')
        .select('id, sub_strand_name, sub_strand_order')
        .eq('strand_id', strand.id)
        .order('sub_strand_order');

      const subStrands: CurriculumSubStrandOption[] = (ssData || []).map((ss: { id: string; sub_strand_name: string }) => ({
        id: ss.id,
        sub_strand_name: ss.sub_strand_name,
      }));

      enriched.push({
        id: strand.id,
        strand_name: strand.strand_name,
        sub_strands: subStrands,
      });

    }

    if (isSenior && !enriched.some((strand) => (strand.sub_strands || []).length > 0)) {
      setStrands([]);
      setCurriculumMessage(`Senior subject pack unavailable for ${subjectName || 'this subject'}; generation is disabled. No Junior or generic curriculum fallback is used.`);
      setLoadingTree(false);
      return;
    }

    setStrands(enriched);
    setLoadingTree(false);
  }, [selectedGradeMeta?.assessmentLevel, selectedSubject, subjectName]);

  useEffect(() => { loadCurriculumTree(); }, [loadCurriculumTree]);

  if (loadingGrades) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={backPath} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-red-600 transition">
          <ArrowLeft className="h-4 w-4" /> Back to Curriculum
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Exam Generator</h1>
      </div>

      {/* Grade and Subject Selectors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Grade</label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          >
            <option value="">Select a grade</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id} disabled={g.seniorAvailable === false}>
                {g.grade_name}{g.assessmentLevel === SENIOR_ASSESSMENT_LEVEL ? ' — Senior School' : ''}{g.seniorAvailable === false ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
          {grades.some((grade) => grade.assessmentLevel === SENIOR_ASSESSMENT_LEVEL && grade.seniorAvailable === false) && (
            <p className="mt-1.5 text-[11px] leading-4 text-amber-700">Senior School Grades 10–12 are shown but disabled until an authoritative subject catalogue is configured. Junior subjects are never substituted.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={!selectedGrade || loadingSubjects}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.subject_name}</option>
            ))}
          </select>
          {subjectMessage && <p className="mt-1.5 text-[11px] leading-4 text-amber-700">{subjectMessage}</p>}
        </div>
      </div>

      {loadingTree && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          <span className="ml-2 text-sm text-slate-600">Loading curriculum data...</span>
        </div>
      )}

      {selectedGrade && selectedSubject && !loadingTree && !curriculumMessage && (
        <ExamGenerator
          gradeLevel={gradeName}
          subject={subjectName}
          schoolName={schoolName}
          schoolId={user?.schoolId || ''}
          strands={strands}
          assessmentLevel={selectedGradeMeta?.assessmentLevel}
        />
      )}

      {curriculumMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{curriculumMessage}</div>
      )}

      {!selectedGrade && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Select Grade and Subject</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Choose a grade and subject above to start generating CBC assessments.
          </p>
        </div>
      )}
    </div>
  );
}
