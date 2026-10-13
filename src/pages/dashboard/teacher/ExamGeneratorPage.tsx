/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ExamGenerator, {
  type CurriculumStrandOption,
  type CurriculumSubStrandOption,
  type CurriculumTopicOption,
} from '@/components/curriculum/ExamGenerator';
import { assessmentLevelForGrade } from '@/lib/exam-grade-policy';
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
interface Subject { id: string; subject_name: string; subject_code: string; curriculum_source_id?: string | null; memberSubjectIds?: string[]; isKpseaComposite?: boolean; }

const SENIOR_ASSESSMENT_LEVEL: AssessmentLevel = 'senior_secondary';
const normalizeSubjectName = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const approvedKicdDescription = (value: unknown): boolean => /\b(?:official\s+(?:source[- ]verified\s+)?kicd|source[- ]verified\s+kicd)\b/i.test(String(value??''));

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
  const subjectsRequestRef = useRef(0);
  const curriculumRequestRef = useRef(0);
  const database = supabaseUntyped as any;

  const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
  const selectedGradeMeta = grades.find(g => g.id === selectedGrade);
  const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';
  const schoolName = schoolData?.name?.trim() || '';
  const backPath = user?.role === 'school_admin' ? '/school-admin' : '/teacher/curriculum';

  const loadGrades = useCallback(async () => {
    setLoadingGrades(true);
    const { data } = await database
      .from('curriculum_grades')
      .select('*')
      .order('grade_number');
    const databaseGrades = (data || []) as Grade[];
    const seniorDatabaseGrades = databaseGrades.filter((grade) => grade.grade_number >= 10 && grade.grade_number <= 12);
    const seniorGradeIds = seniorDatabaseGrades.map((grade) => grade.id).filter(Boolean);
    const { data: seniorSubjectRows } = seniorGradeIds.length
      ? await database
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
    const sourceBackedSchoolGrades = databaseGrades.filter((grade) => grade.grade_number >= 6 && grade.grade_number <= 9)
      .map((grade) => ({
        ...grade,
        assessmentLevel: assessmentLevelForGrade(grade.grade_number),
      }));
    const availableGrades = [...sourceBackedSchoolGrades, ...seniorGrades]
      .sort((a: Grade, b: Grade) => a.grade_number - b.grade_number);
    setGrades(availableGrades);
    const requested = requestedGrade.toLowerCase().replace(/\s+/g, '');
    if (requested) {
      const match = availableGrades.find((grade) =>
        grade.id === requestedGrade || grade.grade_name.toLowerCase().replace(/\s+/g, '') === requested
      );
      if (match && match.seniorAvailable !== false) setSelectedGrade(match.id);
    }
    setLoadingGrades(false);
  }, [database, requestedGrade]);

  // Load grades on mount
  useEffect(() => {
    void loadGrades();
  }, [loadGrades]);

  // Load subjects when grade changes. Only approved/source-verified catalogue rows are shown;
  // no generic junior catalogue is substituted for a missing grade or senior catalogue.
  useEffect(() => {
    const requestId = ++subjectsRequestRef.current;
    if (!selectedGrade) {
      setSubjects([]);
      setSubjectMessage('');
      setLoadingSubjects(false);
      return;
    }
    const isSenior = selectedGradeMeta?.assessmentLevel === SENIOR_ASSESSMENT_LEVEL;
    setLoadingSubjects(true);
    setSubjectMessage('');
    setSelectedSubject('');
    setStrands([]);
    setCurriculumMessage('');
    void (async () => {
      try {
        const { data } = await database
          .from('curriculum_subjects')
          .select('*')
          .eq('grade_id', selectedGrade)
          .order('subject_name');
        if (requestId !== subjectsRequestRef.current) return;
        const allDatabaseSubjects = (data || [])
          .filter((subject: Subject) => subject.subject_name?.trim()) as Subject[];
        const subjectIds = allDatabaseSubjects.map((subject) => subject.id).filter(Boolean);
        const { data: strandRows } = subjectIds.length
          ? await database
            .from('curriculum_strands')
            .select('subject_id, strand_description, is_current')
            .in('subject_id', subjectIds)
          : { data: [] };
        if (requestId !== subjectsRequestRef.current) return;
        const approvedRows = (strandRows || []).filter((strand: { subject_id?: string; strand_description?: string | null; is_current?: boolean | null }) => strand.is_current === true && approvedKicdDescription(strand.strand_description)) as Array<{ subject_id?: string; strand_description?: string | null; is_current?: boolean | null }>;
        const sourceVerifiedSubjectIds = new Set(approvedRows
          .filter((strand) => /source[- ]verified/i.test(strand.strand_description || ''))
          .map((strand) => strand.subject_id)
          .filter(Boolean));
        const generalVerifiedSubjectIds = new Set(approvedRows.map((strand) => strand.subject_id).filter(Boolean));
        const preferredSubjectIds = sourceVerifiedSubjectIds.size > 0 && selectedGradeMeta?.grade_number !== 6
          ? sourceVerifiedSubjectIds
          : generalVerifiedSubjectIds;
        const approvedSubjects = allDatabaseSubjects.filter((subject) => preferredSubjectIds.has(subject.id));
        const gradeSixComposites: Subject[] = [];
        let availableSubjects = approvedSubjects;
        if (selectedGradeMeta?.grade_number === 6) {
          const findMember = (names: string[]) => approvedSubjects.find((subject) => names.includes(normalizeSubjectName(subject.subject_name)));
          const science = findMember(['sciencetechnology', 'scienceandtechnology', 'science', 'integratedscience']);
          const agriculture = findMember(['agriculturenutrition', 'agricultureandnutrition', 'agriculture']);
          if (science && agriculture) {
            gradeSixComposites.push({
              id: 'kpsea-composite:integrated-science',
              subject_name: 'Integrated Science',
              subject_code: 'KPSEA-COMPOSITE',
              memberSubjectIds: [science.id, agriculture.id],
              isKpseaComposite: true,
            });
          }
          const creative = findMember(['creativearts', 'creativeartsandsports']);
          const social = findMember(['socialstudies', 'socialstudy']);
          const religious = approvedSubjects.find((subject) => /religious|^(cre|ire|hre)$/.test(normalizeSubjectName(subject.subject_name)));
          if (creative && social && religious) {
            gradeSixComposites.push({
              id: 'kpsea-composite:creative-arts-social-studies',
              subject_name: 'Creative Arts & Social Studies',
              subject_code: 'KPSEA-COMPOSITE',
              memberSubjectIds: [creative.id, social.id, religious.id],
              isKpseaComposite: true,
            });
          }
          // Keep individual learning areas visible, but make the one whose name
          // collides with a composite explicitly school-based in this selector.
          availableSubjects = approvedSubjects.map((subject) => normalizeSubjectName(subject.subject_name) === 'integratedscience'
            ? { ...subject, subject_name: 'Integrated Science — school CBE' }
            : subject);
        }
        availableSubjects = [...availableSubjects, ...gradeSixComposites];
        setSubjects(availableSubjects);
        if (!availableSubjects.length) {
          setSubjectMessage(isSenior
            ? 'Approved Senior School subject catalogue unavailable for this grade. Senior generation remains disabled; no Junior subjects are substituted.'
            : `Approved curriculum subject catalogue unavailable for ${selectedGradeMeta?.grade_name || 'this grade'}. No generic subject fallback is used.`);
        }
        const requested = requestedSubject.toLowerCase().replace(/\s+/g, '');
        if (requested) {
          const match = availableSubjects.find((subject: Subject) =>
            subject.subject_name.toLowerCase().replace(/\s+/g, '') === requested
          );
          if (match) setSelectedSubject(match.id);
        }
      } catch {
        if (requestId === subjectsRequestRef.current) {
          setSubjects([]);
          setSubjectMessage(`Approved curriculum subject catalogue could not be loaded for ${selectedGradeMeta?.grade_name || 'this grade'}.`);
        }
      } finally {
        if (requestId === subjectsRequestRef.current) setLoadingSubjects(false);
      }
    })();
  }, [database, requestedSubject, selectedGrade, selectedGradeMeta?.assessmentLevel, selectedGradeMeta?.grade_number, selectedGradeMeta?.grade_name]);

  // Load the approved hierarchy in three bounded queries (strands, all sub-strands,
  // all topics), rather than issuing one request per strand and per sub-strand.
  const loadCurriculumTree = useCallback(async () => {
    const requestId = ++curriculumRequestRef.current;
    if (!selectedSubject) {
      setStrands([]);
      setCurriculumMessage('');
      setLoadingTree(false);
      return;
    }
    setLoadingTree(true);
    setCurriculumMessage('');
    try {
      const selectedSubjectRecord = subjects.find((subject) => subject.id === selectedSubject);
      const subjectIds = selectedSubjectRecord?.memberSubjectIds?.length
        ? selectedSubjectRecord.memberSubjectIds
        : [selectedSubject];
      const strandQuery = database
        .from('curriculum_strands')
        .select('id, subject_id, strand_name, strand_order, strand_description, is_current');
      const { data: strandsData, error: strandsError } = await (subjectIds.length > 1
        ? strandQuery.in('subject_id', subjectIds)
        : strandQuery.eq('subject_id', selectedSubject))
        .order('strand_order');
      if (requestId !== curriculumRequestRef.current) return;
      if (strandsError) throw strandsError;
      const approvedStrands = (strandsData || []).filter((strand: { strand_description?: string | null; is_current?: boolean | null }) =>
        strand.is_current === true && approvedKicdDescription(strand.strand_description)
      ) as Array<{ id: string; strand_name: string; strand_order?: number; strand_description?: string | null; is_current?: boolean | null }>;
      const sourceVerifiedStrands = approvedStrands.filter((strand) => /source[- ]verified/i.test(strand.strand_description || ''));
      const effectiveStrandsData = (sourceVerifiedStrands.length ? sourceVerifiedStrands : approvedStrands) as Array<{ id: string; strand_name: string; strand_order?: number }>;
      if (effectiveStrandsData.length === 0) {
        setStrands([]);
        setCurriculumMessage(`Approved KICD curriculum pack unavailable for ${subjectName || 'this subject'}; generation is disabled. No generic curriculum fallback is used.`);
        return;
      }

      const strandIds = effectiveStrandsData.map((strand) => strand.id);
      const { data: subStrandRows, error: subStrandError } = await database
        .from('curriculum_sub_strands')
        .select('id, strand_id, sub_strand_name, sub_strand_order')
        .in('strand_id', strandIds)
        .order('sub_strand_order');
      if (requestId !== curriculumRequestRef.current) return;
      if (subStrandError) throw subStrandError;
      const typedSubStrands = (subStrandRows || []) as Array<{ id: string; strand_id: string; sub_strand_name: string; sub_strand_order?: number }>;
      const subStrandIds = typedSubStrands.map((subStrand) => subStrand.id);
      const { data: topicRows, error: topicError } = subStrandIds.length
        ? await database
          .from('curriculum_topics')
          .select('id, sub_strand_id, topic_name, topic_order')
          .in('sub_strand_id', subStrandIds)
          .order('topic_order')
        : { data: [], error: null };
      if (requestId !== curriculumRequestRef.current) return;
      if (topicError) throw topicError;
      const typedTopics = (topicRows || []) as Array<{ id: string; sub_strand_id: string; topic_name: string; topic_order?: number }>;
      const topicsBySubStrand = new Map<string, CurriculumTopicOption[]>();
      typedTopics.forEach((topic) => {
        const subStrand = typedSubStrands.find((candidate) => candidate.id === topic.sub_strand_id);
        const strand = subStrand ? effectiveStrandsData.find((candidate) => candidate.id === subStrand.strand_id) : undefined;
        const current = topicsBySubStrand.get(topic.sub_strand_id) || [];
        current.push({ id: topic.id, topic_name: topic.topic_name, strand_id: strand?.id, sub_strand_id: topic.sub_strand_id });
        topicsBySubStrand.set(topic.sub_strand_id, current);
      });
      const subStrandsByStrand = new Map<string, CurriculumSubStrandOption[]>();
      typedSubStrands.forEach((subStrand) => {
        const current = subStrandsByStrand.get(subStrand.strand_id) || [];
        current.push({ id: subStrand.id, sub_strand_name: subStrand.sub_strand_name, topics: topicsBySubStrand.get(subStrand.id) || [] });
        subStrandsByStrand.set(subStrand.strand_id, current);
      });
      const enriched: CurriculumStrandOption[] = effectiveStrandsData.map((strand) => ({
        id: strand.id,
        strand_name: strand.strand_name,
        sub_strands: subStrandsByStrand.get(strand.id) || [],
      }));
      if (requestId !== curriculumRequestRef.current) return;
      if (!enriched.some((strand) => (strand.sub_strands || []).length > 0)) {
        setStrands([]);
        setCurriculumMessage(`Approved KICD curriculum pack unavailable for ${subjectName || 'this subject'}; generation is disabled. No generic curriculum fallback is used.`);
        return;
      }
      setStrands(enriched);
    } catch {
      if (requestId === curriculumRequestRef.current) {
        setStrands([]);
        setCurriculumMessage(`Approved KICD curriculum pack could not be loaded for ${subjectName || 'this subject'}; generation is disabled.`);
      }
    } finally {
      if (requestId === curriculumRequestRef.current) setLoadingTree(false);
    }
  }, [database, selectedSubject, subjectName, subjects]);

  useEffect(() => {
    void loadCurriculumTree();
  }, [loadCurriculumTree]);

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
