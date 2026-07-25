import { useCallback, useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ExamGenerator, {
  type CurriculumStrandOption,
  type CurriculumSubStrandOption,
  type CurriculumTopicOption,
} from '@/components/curriculum/ExamGenerator';
import {
  juniorExamSubjects,
  getStrandPacks,
} from '@/lib/kicd-knowledge';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Grade { id: string; grade_number: number; grade_name: string; }
interface Subject { id: string; subject_name: string; subject_code: string; }
interface Strand { id: string; strand_name: string; strand_order: number; sub_strands?: SubStrand[]; }
interface SubStrand { id: string; sub_strand_name: string; sub_strand_order: number; topics?: Topic[]; }
interface Topic { id: string; topic_name: string; topic_description: string; learning_objectives: string[]; topic_order: number; }

export default function ExamGeneratorPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [strands, setStrands] = useState<CurriculumStrandOption[]>([]);
  const [topics, setTopics] = useState<CurriculumTopicOption[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);

  const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
  const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';
  const schoolName = 'Zamifu Analytics School';

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
    const junior = (data || []).filter((g: Grade) => g.grade_number >= 7 && g.grade_number <= 9);
    if (junior.length) {
      setGrades(junior);
    } else {
      setGrades([
        { id: 'g7', grade_number: 7, grade_name: 'Grade 7' },
        { id: 'g8', grade_number: 8, grade_name: 'Grade 8' },
        { id: 'g9', grade_number: 9, grade_name: 'Grade 9' },
      ]);
    }
    setLoadingGrades(false);
  };

  // Load subjects when grade changes
  useEffect(() => {
    if (!selectedGrade) { setSubjects([]); return; }
    setLoadingSubjects(true);
    supabaseUntyped
      .from('curriculum_subjects')
      .select('*')
      .eq('grade_id', selectedGrade)
      .order('subject_name')
      .then(({ data }) => {
        if (data && data.length) {
          setSubjects(data);
        } else {
          setSubjects(
            juniorExamSubjects().map((name, idx) => ({
              id: `local-${selectedGrade}-${idx}`,
              subject_name: name,
              subject_code: name.slice(0, 4).toUpperCase(),
            }))
          );
        }
        setLoadingSubjects(false);
      });
    setSelectedSubject('');
    setStrands([]);
    setTopics([]);
  }, [selectedGrade]);

  // Load curriculum tree when subject changes
  const loadCurriculumTree = useCallback(async () => {
    if (!selectedSubject) return;
    setLoadingTree(true);

    const { data: strandsData } = await supabaseUntyped
      .from('curriculum_strands')
      .select('id, strand_name, strand_order')
      .eq('subject_id', selectedSubject)
      .order('strand_order');

    if (!strandsData || strandsData.length === 0) {
      // Fallback to embedded KICD knowledge — build full strand+sub-strand+topic tree
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
      // Build flat topics list
      const localTopics: CurriculumTopicOption[] = [];
      let topicIdx = 0;
      for (const pack of packs) {
        for (const ss of pack.subStrands) {
          for (const topicName of ss.topics) {
            localTopics.push({
              id: `local-topic-${topicIdx}`,
              topic_name: topicName,
            });
            topicIdx++;
          }
        }
      }
      setStrands(localStrands);
      setTopics(localTopics);
      setLoadingTree(false);
      return;
    }

    // Load from database — fetch sub-strands for each strand and nest them
    const enriched: CurriculumStrandOption[] = [];
    const allTopics: CurriculumTopicOption[] = [];

    for (const strand of strandsData) {
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

      for (const ss of ssData || []) {
        const { data: topicsData } = await supabaseUntyped
          .from('curriculum_topics')
          .select('id, topic_name')
          .eq('sub_strand_id', ss.id)
          .order('topic_order');

        for (const topic of topicsData || []) {
          allTopics.push({
            id: topic.id,
            topic_name: topic.topic_name,
          });
        }
      }
    }

    // If DB strands have no sub-strands at all, supplement with KICD embedded knowledge
    const hasSubStrands = enriched.some(s => s.sub_strands && s.sub_strands.length > 0);
    if (!hasSubStrands) {
      const packs = getStrandPacks(subjectName);
      for (const strand of enriched) {
        const matchingPack = packs.find(p =>
          p.strand.toLowerCase().includes(strand.strand_name.toLowerCase()) ||
          strand.strand_name.toLowerCase().includes(p.strand.toLowerCase())
        );
        if (matchingPack) {
          strand.sub_strands = matchingPack.subStrands.map((ss, ssi) => ({
            id: `kicd-ss-${strand.id}-${ssi}`,
            sub_strand_name: ss.name,
          }));
          if (allTopics.length === 0) {
            let topicIdx = 0;
            for (const ss of matchingPack.subStrands) {
              for (const topicName of ss.topics) {
                allTopics.push({ id: `kicd-topic-${topicIdx}`, topic_name: topicName });
                topicIdx++;
              }
            }
          }
        }
      }
    }

    setStrands(enriched);
    setTopics(allTopics);
    setLoadingTree(false);
  }, [selectedSubject, subjectName]);

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
        <Link to="/teacher/curriculum" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-red-600 transition">
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
              <option key={g.id} value={g.id}>{g.grade_name}</option>
            ))}
          </select>
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
        </div>
      </div>

      {loadingTree && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          <span className="ml-2 text-sm text-slate-600">Loading curriculum data...</span>
        </div>
      )}

      {selectedGrade && selectedSubject && !loadingTree && (
        <ExamGenerator
          gradeLevel={gradeName}
          subject={subjectName}
          schoolName={schoolName}
          schoolId={user?.schoolId || ''}
          strands={strands}
          topics={topics}
        />
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
