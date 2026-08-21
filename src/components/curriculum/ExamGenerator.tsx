import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, BookOpenCheck, Check, CheckCircle2, ChevronDown,
  Download, Edit3, Eye, FileImage, FileKey2, FileText, Flag, ImagePlus,
  Loader2, RefreshCw, Save, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabaseUntyped } from '@/lib/supabase/client';
import {
  CBC_QUESTION_TYPES,
  downloadExamPdf,
  questionTypeLabel,
  type Difficulty,
  type ExamFormat,
  type ExamGenerationRequest,
  type ExamPaper,
  type GeneratedExamQuestion,
  type QuestionType,
  type ExamPdfMode,
} from '@/lib/exam-generator';

export interface CurriculumTopicOption {
  id: string;
  topic_name: string;
}

export interface CurriculumSubStrandOption {
  id: string;
  sub_strand_name: string;
}

export interface CurriculumStrandOption {
  id: string;
  strand_name: string;
  sub_strands?: CurriculumSubStrandOption[];
}

interface SavedPaperSummary {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  total_marks: number;
  created_at: string;
  status?: 'draft' | 'reviewed' | 'approved' | 'archived';
  version_number?: number;
}

interface ExamGeneratorProps {
  gradeLevel: string;
  subject: string;
  schoolName?: string;
  schoolId?: string;
  strands: CurriculumStrandOption[];
  topics: CurriculumTopicOption[];
  initialTopic?: string;
  onGenerated?: (paper: ExamPaper) => void;
}

const formatOptions: Array<{ value: ExamFormat; label: string; description: string }> = [
  { value: 'cbe', label: 'CBE Class Assessment', description: 'Competency-based classroom assessment' },
  { value: 'kpsea', label: 'KPSEA Practice', description: 'Primary assessment practice format' },
  { value: 'kjsea', label: 'KJSEA Practice', description: 'Junior School assessment practice format' },
  { value: 'custom', label: 'Custom School Paper', description: 'Flexible internal assessment' },
];

function toggleValue<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

function apiErrorMessage(payload: unknown): string {
  return payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
    ? (payload as { error: string }).error
    : 'The paper could not be generated. Please try again.';
}

function questionBadgeClass(type: QuestionType): string {
  if (['multiple_choice', 'multiple_response', 'modified_true_false'].includes(type)) return 'bg-blue-50 text-blue-700 border-blue-100';
  if (['essay', 'case_study'].includes(type)) return 'bg-violet-50 text-violet-700 border-violet-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
}

export default function ExamGenerator({
  gradeLevel,
  subject,
  schoolName,
  schoolId,
  strands,
  topics,
  initialTopic,
  onGenerated,
}: ExamGeneratorProps) {
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('Term 1');
  const [format, setFormat] = useState<ExamFormat>('cbe');
  const [totalMarks, setTotalMarks] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [selectedStrands, setSelectedStrands] = useState<Set<string>>(new Set());
  const [selectedSubStrands, setSelectedSubStrands] = useState<Set<string>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<Set<QuestionType>>(
    new Set<QuestionType>(['multiple_choice', 'short_answer', 'essay']),
  );
  const [includeImages, setIncludeImages] = useState(false);
  const [includeMarkingScheme, setIncludeMarkingScheme] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [recentPapers, setRecentPapers] = useState<SavedPaperSummary[]>([]);
  const [exportMode, setExportMode] = useState<ExamPdfMode>('student');
  const [approvingPaper, setApprovingPaper] = useState(false);
  const [openingPaper, setOpeningPaper] = useState<string | null>(null);

  const availableSubStrands = useMemo(() => strands
    .filter((strand) => selectedStrands.size === 0 || selectedStrands.has(strand.id))
    .flatMap((strand) => strand.sub_strands || []), [selectedStrands, strands]);

  const canGenerate = Boolean(gradeLevel && subject && selectedQuestionTypes.size);

  useEffect(() => {
    setPaper(null);
    setSelectedStrands(new Set());
    setSelectedSubStrands(new Set());
    setSelectedTopics(new Set());
  }, [gradeLevel, subject]);

  useEffect(() => {
    if (!initialTopic || !topics.length) return;
    const requested = initialTopic.toLowerCase().trim();
    const match = topics.find((topic) => topic.topic_name.toLowerCase().trim() === requested);
    if (match) setSelectedTopics(new Set([match.id]));
  }, [initialTopic, topics]);

  useEffect(() => {
    if (!schoolId) return;
    void loadRecentPapers();
  }, [schoolId, subject, gradeLevel]);

  async function loadRecentPapers() {
    if (!schoolId) return;
    const { data } = await supabaseUntyped
      .from('exam_papers')
      .select('id, title, subject, grade_level, total_marks, created_at, status, version_number')
      .eq('school_id', schoolId)
      .eq('subject', subject)
      .eq('grade_level', gradeLevel)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentPapers((data || []) as SavedPaperSummary[]);
  }

  async function openSavedPaper(paperId: string) {
    setOpeningPaper(paperId);
    try {
      const { data: saved, error: paperError } = await supabaseUntyped
        .from('exam_papers')
        .select('id, title, school_id, grade_level, subject, term, year, duration_minutes, total_marks, instructions, marking_scheme, format, created_at, status, version_number, blueprint, validation_results, questions')
        .eq('id', paperId)
        .single();
      if (paperError || !saved) throw paperError || new Error('The saved paper could not be found.');

      const questionIds = Array.isArray(saved.questions) ? saved.questions.filter((id): id is string => typeof id === 'string') : [];
      if (!questionIds.length) throw new Error('The saved paper has no questions to open.');
      const { data: questionRows, error: questionError } = await supabaseUntyped
        .from('exam_questions')
        .select('id, question_type, question_text, options, correct_answer, marking_scheme, marks, difficulty, strand, sub_strand, topic, learning_outcome, competency, cognitive_level, image_url, metadata, review_status')
        .in('id', questionIds)
        .limit(200);
      if (questionError) throw questionError;
      const byId = new Map((questionRows || []).map((row: any) => [row.id, row]));
      const questions = questionIds.map((id, index) => {
        const row: any = byId.get(id);
        if (!row) throw new Error(`Question ${index + 1} could not be loaded from the saved paper.`);
        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const visualSpec = metadata.visual_spec && typeof metadata.visual_spec === 'object' ? metadata.visual_spec : null;
        return {
          id: row.id,
          question_number: index + 1,
          question_type: row.question_type,
          question_text: row.question_text,
          options: Array.isArray(row.options) ? row.options : [],
          correct_answer: row.correct_answer || '',
          marking_scheme: row.marking_scheme || '',
          marks: Number(row.marks || 1),
          difficulty: row.difficulty || 'medium',
          strand: row.strand || undefined,
          sub_strand: row.sub_strand || undefined,
          topic: row.topic || undefined,
          learning_outcome: row.learning_outcome || undefined,
          competency: row.competency || undefined,
          cognitive_level: row.cognitive_level || undefined,
          image_url: row.image_url || (typeof visualSpec?.rendered_data_url === 'string' ? visualSpec.rendered_data_url : null),
          visual_spec: visualSpec,
          review_status: row.review_status || 'draft',
        } as GeneratedExamQuestion;
      });
      const instructions = typeof saved.instructions === 'string'
        ? saved.instructions.split(/\r?\n/).map((item: string) => item.trim()).filter(Boolean)
        : Array.isArray(saved.instructions) ? saved.instructions : [];
      const loadedPaper: ExamPaper = {
        id: saved.id,
        title: saved.title,
        school_name: schoolName,
        grade_level: saved.grade_level,
        subject: saved.subject,
        term: saved.term || undefined,
        year: Number(saved.year || new Date().getFullYear()),
        duration_minutes: Number(saved.duration_minutes || 60),
        total_marks: Number(saved.total_marks || 0),
        instructions,
        questions,
        marking_scheme: saved.marking_scheme || undefined,
        format: saved.format as ExamFormat,
        generated_at: saved.created_at,
        status: saved.status || 'draft',
        version_number: saved.version_number || 1,
        blueprint: saved.blueprint || undefined,
        validation_results: Array.isArray(saved.validation_results) ? saved.validation_results : [],
      };
      setPaper(loadedPaper);
      toast.success('Saved assessment opened for review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The saved paper could not be opened.');
    } finally {
      setOpeningPaper(null);
    }
  }

  async function generate() {
    if (!canGenerate) {
      toast.error('Select a grade, subject, and at least one question type.');
      return;
    }
    setGenerating(true);
    try {
      const { data: sessionData } = await supabaseUntyped.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const request: ExamGenerationRequest = {
        title,
        gradeLevel,
        subject,
        strands: strands.filter((strand) => selectedStrands.has(strand.id)).map((strand) => strand.strand_name),
        subStrands: availableSubStrands.filter((subStrand) => selectedSubStrands.has(subStrand.id)).map((subStrand) => subStrand.sub_strand_name),
        topics: topics.filter((topic) => selectedTopics.has(topic.id)).map((topic) => topic.topic_name),
        questionTypes: Array.from(selectedQuestionTypes),
        totalMarks,
        durationMinutes,
        difficulty,
        includeImages,
        includeMarkingScheme,
        format,
        term,
        schoolName,
      };
      const response = await fetch('/api/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(payload));
      const generated = payload?.paper as ExamPaper | undefined;
      if (!generated?.questions?.length) throw new Error('The exam service returned no questions.');
      setPaper(generated);
      onGenerated?.(generated);
      await loadRecentPapers();
      toast.success(`${generated.questions.length} questions generated and saved securely.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The exam could not be generated.');
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPaper() {
    if (!paper) return;
    const critical = (paper.validation_results || []).filter((issue) => issue.severity === 'critical');
    if (critical.length) {
      toast.error('Resolve all critical validation issues before exporting this paper.');
      return;
    }
    setDownloading(true);
    try {
      await downloadExamPdf(paper, exportMode);
      toast.success(`${exportMode === 'student' ? 'Student paper' : exportMode === 'marking_scheme' ? 'Marking scheme' : 'Answer key'} PDF downloaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The PDF could not be created.');
    } finally {
      setDownloading(false);
    }
  }

  async function getAccessToken(): Promise<string> {
    const { data: sessionData } = await supabaseUntyped.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Your session has expired. Please sign in again.');
    return token;
  }

  async function updateQuestion(question: GeneratedExamQuestion, patch: Record<string, unknown>) {
    if (!question.id) throw new Error('This question is not linked to a saved paper.');
    const { error } = await (supabaseUntyped as any).from('exam_questions').update(patch).eq('id', question.id);
    if (error) throw error;
    setPaper((current) => current ? { ...current, questions: current.questions.map((entry) => entry.id === question.id ? { ...entry, ...patch } as GeneratedExamQuestion : entry) } : current);
  }

  async function reviewQuestion(question: GeneratedExamQuestion, status: 'approved' | 'flagged' | 'draft') {
    try {
      await updateQuestion(question, { review_status: status, reviewed_at: new Date().toISOString() });
      toast.success(status === 'approved' ? 'Question approved.' : status === 'flagged' ? 'Question flagged for revision.' : 'Question returned to draft.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Question review could not be saved.');
    }
  }

  async function editQuestion(question: GeneratedExamQuestion, questionText: string) {
    const cleaned = questionText.trim();
    if (!cleaned) { toast.error('Question text cannot be empty.'); return; }
    try {
      await updateQuestion(question, { question_text: cleaned, review_status: 'draft', reviewed_at: null });
      toast.success('Question edited and returned to draft review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Question edit could not be saved.');
    }
  }

  async function regenerateQuestion(question: GeneratedExamQuestion) {
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `${paper?.title || subject} — replacement question`, gradeLevel, subject,
          strands: question.strand ? [question.strand] : [], subStrands: question.sub_strand ? [question.sub_strand] : [],
          topics: question.topic ? [question.topic] : [], questionTypes: [question.question_type],
          totalMarks: question.marks, durationMinutes: Math.max(10, Math.min(30, durationMinutes)), difficulty: question.difficulty,
          includeImages: Boolean(question.visual_spec), includeMarkingScheme: true, format, term, schoolName,
          blueprint: { total_marks: question.marks, sections: [{ id: `replacement-${Date.now()}`, question_type: question.question_type, count: 1, marks_per_question: question.marks, difficulty: question.difficulty, strand: question.strand, sub_strand: question.sub_strand, topic: question.topic }] },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(payload));
      const replacement = payload?.paper?.questions?.[0] as GeneratedExamQuestion | undefined;
      if (!replacement) throw new Error('The regeneration service returned no replacement question.');
      await updateQuestion(question, {
        question_text: replacement.question_text, options: replacement.options || [], correct_answer: replacement.correct_answer,
        marking_scheme: replacement.marking_scheme, marks: replacement.marks, difficulty: replacement.difficulty,
        strand: replacement.strand || null, sub_strand: replacement.sub_strand || null, topic: replacement.topic || null,
        learning_outcome: replacement.learning_outcome || null, competency: replacement.competency || null, cognitive_level: replacement.cognitive_level || null,
        image_url: replacement.image_url || null, metadata: { visual_spec: replacement.visual_spec || null }, review_status: 'draft', reviewed_at: null,
      });
      toast.success('Question regenerated and returned to draft review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Question regeneration failed.');
    }
  }

  async function approvePaper() {
    if (!paper?.id) return;
    const critical = (paper.validation_results || []).filter((issue) => issue.severity === 'critical');
    if (critical.length) { toast.error('Resolve all critical validation issues before approving.'); return; }
    setApprovingPaper(true);
    try {
      const { data: sessionData } = await supabaseUntyped.auth.getSession();
      const userId = sessionData.session?.user?.id;
      const { error } = await (supabaseUntyped as any).from('exam_papers').update({ status: 'approved', approved_by: userId, approved_at: new Date().toISOString() }).eq('id', paper.id);
      if (error) throw error;
      setPaper((current) => current ? { ...current, status: 'approved' } : current);
      await loadRecentPapers();
      toast.success('Paper approved and ready for controlled distribution.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Paper approval failed.');
    } finally {
      setApprovingPaper(false);
    }
  }

  async function attachImage(question: GeneratedExamQuestion, file: File | undefined) {
    if (!file || !question.id || !schoolId) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Use an image smaller than 5 MB.');
      return;
    }
    setUploadingQuestionId(question.id);
    try {
      const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
      const path = `exam_images/${schoolId}/${question.id}/${Date.now()}.${extension}`;
      const storage = supabaseUntyped.storage.from('exam-assets');
      const { error: uploadError } = await storage.upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: signedData, error: signedUrlError } = await storage.createSignedUrl(path, 60 * 60 * 24);
      if (signedUrlError || !signedData?.signedUrl) throw signedUrlError || new Error('Could not create a secure image preview.');
      const imageUrl = signedData.signedUrl;
      const database = supabaseUntyped as any;
      const { error: questionError } = await database.from('exam_questions').update({ image_url: imageUrl }).eq('id', question.id);
      if (questionError) throw questionError;
      const { error: imageError } = await database.from('exam_question_images').insert({
        school_id: schoolId,
        question_id: question.id,
        storage_path: path,
        alt_text: `Instructional visual for ${subject} ${gradeLevel}`,
      });
      if (imageError) throw imageError;
      setPaper((current) => current ? {
        ...current,
        questions: current.questions.map((entry) => entry.id === question.id ? { ...entry, image_url: imageUrl } : entry),
      } : current);
      toast.success('Question image attached. It will appear in the PDF paper.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The image could not be attached.');
    } finally {
      setUploadingQuestionId(null);
    }
  }

  const validationIssues = paper?.validation_results || [];
  const criticalIssueCount = validationIssues.filter((issue) => issue.severity === 'critical').length;
  const warningIssueCount = validationIssues.filter((issue) => issue.severity === 'warning').length;

  return (
    <section className="space-y-5" aria-label="CBC exam generator">
      <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-white via-white to-red-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">CBC Assessment Studio</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Build original, structured assessments for {subject || 'your selected subject'} and {gradeLevel || 'your selected grade'}, then review, enrich with school-owned visuals, and export a polished paper.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            Secure teacher workflow
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-slate-900">Assessment blueprint</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">Paper title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${subject || 'Subject'} ${gradeLevel || 'Grade'} Assessment`} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Assessment format
              <select value={format} onChange={(event) => setFormat(event.target.value as ExamFormat)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100">
                {formatOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">Term
              <select value={term} onChange={(event) => setTerm(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100">
                <option>Term 1</option><option>Term 2</option><option>Term 3</option><option>End of Year</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">Difficulty
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100">
                <option value="mixed">Mixed / balanced</option><option value="easy">Foundation</option><option value="medium">On-level</option><option value="hard">Extension</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">Total marks
              <select value={totalMarks} onChange={(event) => setTotalMarks(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100">
                {[10, 20, 30, 50, 60, 80, 100].map((marks) => <option key={marks} value={marks}>{marks} marks</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">Duration
              <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100">
                {[30, 45, 60, 75, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Question types</p>
              <span className="text-xs text-slate-500">{selectedQuestionTypes.size} selected</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CBC_QUESTION_TYPES.map((type) => (
                <label key={type.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-white px-2.5 py-2 text-xs text-slate-700 transition hover:border-red-100 hover:bg-red-50">
                  <input type="checkbox" checked={selectedQuestionTypes.has(type.value)} onChange={() => setSelectedQuestionTypes((current) => toggleValue(current, type.value))} className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
                  <span className="flex-1">{type.label}</span><span className="text-slate-400">{type.defaultMarks}m</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <SelectionPanel title="Strands" count={selectedStrands.size}>
              {strands.length ? strands.map((strand) => <SelectableRow key={strand.id} checked={selectedStrands.has(strand.id)} label={strand.strand_name} onChange={() => setSelectedStrands((current) => toggleValue(current, strand.id))} />) : <EmptySelection label="Select a grade and subject first." />}
            </SelectionPanel>
            <SelectionPanel title="Sub-strands" count={selectedSubStrands.size}>
              {availableSubStrands.length ? availableSubStrands.map((subStrand) => <SelectableRow key={subStrand.id} checked={selectedSubStrands.has(subStrand.id)} label={subStrand.sub_strand_name} onChange={() => setSelectedSubStrands((current) => toggleValue(current, subStrand.id))} />) : <EmptySelection label="Choose a strand to narrow the selection." />}
            </SelectionPanel>
            <SelectionPanel title="Topics" count={selectedTopics.size}>
              {topics.length ? topics.map((topic) => <SelectableRow key={topic.id} checked={selectedTopics.has(topic.id)} label={topic.topic_name} onChange={() => setSelectedTopics((current) => toggleValue(current, topic.id))} />) : <EmptySelection label="No topic records are available for this selection." />}
            </SelectionPanel>
          </div>

          <div className="mt-5 space-y-2 rounded-xl border border-amber-100 bg-amber-50 p-3.5 text-xs text-amber-900">
            <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} className="mt-0.5 rounded border-amber-300 text-red-600 focus:ring-red-500" /><span><strong>Plan for visual questions.</strong> After generation, attach licensed or school-owned diagrams and images to individual questions.</span></label>
            <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={includeMarkingScheme} onChange={(event) => setIncludeMarkingScheme(event.target.checked)} className="mt-0.5 rounded border-amber-300 text-red-600 focus:ring-red-500" /><span><strong>Include marking scheme</strong> in the exported PDF.</span></label>
          </div>

          <button type="button" onClick={() => void generate()} disabled={!canGenerate || generating} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generating secure assessment…' : 'Generate assessment paper'}
          </button>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Generated paper</h3><p className="mt-1 text-xs leading-5 text-slate-500">Review every question, validate the blueprint, then approve before sharing with learners.</p></div>{paper && <PaperStatusBadge status={paper.status || 'draft'} />}</div>
              {paper && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-slate-700">Quality gate:</span><span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">{criticalIssueCount} critical</span><span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">{warningIssueCount} warnings</span>{criticalIssueCount === 0 ? <span className="font-medium text-emerald-700">Ready for review</span> : <span className="font-medium text-red-700">Export and approval locked</span>}</div>{validationIssues.length > 0 && <div className="mt-2 space-y-1">{validationIssues.slice(0, 4).map((issue, issueIndex) => <p key={`${issue.code}-${issueIndex}`} className={`text-[11px] leading-4 ${issue.severity === 'critical' ? 'text-red-700' : issue.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>{issue.severity === 'critical' ? 'Critical' : issue.severity === 'warning' ? 'Warning' : 'Info'}: {issue.message}</p>)}</div>}</div>}
              {paper && <div className="flex flex-wrap items-center gap-2"><select value={exportMode} onChange={(event) => setExportMode(event.target.value as ExamPdfMode)} disabled={criticalIssueCount > 0} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><option value="student">Student paper PDF</option><option value="marking_scheme">Marking scheme PDF</option><option value="answer_key">Compact answer key PDF</option><option value="combined">Student paper + marking scheme</option></select><button type="button" onClick={() => void downloadPaper()} disabled={downloading || criticalIssueCount > 0} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Export</button><button type="button" onClick={() => void approvePaper()} disabled={approvingPaper || criticalIssueCount > 0 || paper.status === 'approved'} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{approvingPaper ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}{paper.status === 'approved' ? 'Approved' : 'Approve paper'}</button></div>}
            </div>

            {!paper ? <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center"><FileText className="h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">Your paper preview will appear here.</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Choose the curriculum focus and question types, then generate a structured CBC assessment.</p></div> : <>
              <div className="mb-3 rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-800">{paper.title}</p><p className="mt-1 text-xs text-slate-500">{paper.questions.length} questions · {paper.total_marks} marks · {paper.duration_minutes} minutes</p></div>
              <div className="max-h-[660px] space-y-3 overflow-y-auto pr-1">
                {paper.questions.map((question, index) => <QuestionPreview key={question.id || `${question.question_text}-${index}`} question={question} index={index} includeImages={includeImages} uploading={uploadingQuestionId === question.id} onAttach={(file) => void attachImage(question, file)} validationIssues={validationIssues.filter((issue) => issue.questionIndex === index)} onReview={(status) => void reviewQuestion(question, status)} onEdit={(text) => void editQuestion(question, text)} onRegenerate={() => void regenerateQuestion(question)} />)}
              </div>
            </>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-slate-500" /><h3 className="text-sm font-semibold text-slate-900">Recent papers</h3></div><button type="button" onClick={() => void loadRecentPapers()} className="text-xs font-semibold text-red-600 hover:text-red-700">Refresh</button></div>
            {recentPapers.length ? <div className="mt-3 divide-y divide-slate-100">{recentPapers.map((savedPaper) => <button type="button" key={savedPaper.id} onClick={() => void openSavedPaper(savedPaper.id)} disabled={openingPaper === savedPaper.id} className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-700">{savedPaper.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{savedPaper.total_marks} marks · {new Date(savedPaper.created_at).toLocaleDateString()}</p></div><div className="flex shrink-0 items-center gap-2">{savedPaper.status && <PaperStatusBadge status={savedPaper.status} />} {openingPaper === savedPaper.id ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</div></button>)}</div> : <p className="mt-3 text-xs text-slate-500">No papers have been saved for this grade and subject yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectionPanel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">{title}</p><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span></div><div className="max-h-32 space-y-1 overflow-y-auto pr-1">{children}</div></div>;
}

function SelectableRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <label className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-1 text-[11px] leading-4 text-slate-600 hover:bg-slate-50"><input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500" /><span>{label}</span></label>;
}

function EmptySelection({ label }: { label: string }) { return <p className="px-1 py-2 text-[11px] leading-4 text-slate-400">{label}</p>; }

function PaperStatusBadge({ status }: { status: 'draft' | 'reviewed' | 'approved' | 'archived' }) {
  const styles = status === 'approved' ? 'bg-emerald-100 text-emerald-700' : status === 'reviewed' ? 'bg-blue-100 text-blue-700' : status === 'archived' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}><BadgeCheck className="h-3.5 w-3.5" />{status}</span>;
}

function QuestionPreview({ question, index, includeImages, uploading, onAttach, validationIssues, onReview, onEdit, onRegenerate }: {
  question: GeneratedExamQuestion;
  index: number;
  includeImages: boolean;
  uploading: boolean;
  onAttach: (file: File | undefined) => void;
  validationIssues: Array<{ code: string; severity: 'critical' | 'warning' | 'info'; message: string }>;
  onReview: (status: 'approved' | 'flagged' | 'draft') => void;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
}) {
  const [showMarking, setShowMarking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftStem, setDraftStem] = useState(question.question_text);
  const [busy, setBusy] = useState(false);
  const options = Array.isArray(question.options) ? question.options : [];
  const visualSpec = question.visual_spec || {};
  const visualCaption = typeof visualSpec.caption === 'string' ? visualSpec.caption : '';
  async function handleRegenerate() {
    setBusy(true);
    try { await onRegenerate(); } finally { setBusy(false); }
  }
  return <article className="rounded-xl border border-slate-200 bg-white p-3.5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{editing ? <textarea value={draftStem} onChange={(event) => setDraftStem(event.target.value)} rows={3} className="w-full rounded-lg border border-red-200 px-2.5 py-2 text-sm leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-red-100" /> : <p className="text-sm leading-6 text-slate-800"><span className="mr-1 font-bold">{index + 1}.</span>{question.question_text}</p>}</div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${questionBadgeClass(question.question_type)}`}>{question.marks}m</span>
    </div>
    {validationIssues.length > 0 && <div className="mt-2 space-y-1">{validationIssues.map((issue) => <p key={issue.code} className={`flex items-start gap-1 text-[11px] leading-4 ${issue.severity === 'critical' ? 'text-red-700' : issue.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>{issue.severity === 'critical' ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> : <Eye className="mt-0.5 h-3 w-3 shrink-0" />}{issue.message}</p>)}</div>}
    {options.length > 0 && <div className="mt-2 grid gap-1 sm:grid-cols-2">{options.map((option, optionIndex) => <p key={`${option}-${optionIndex}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{String.fromCharCode(65 + optionIndex)}. {option}</p>)}</div>}
    {question.image_url ? <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2"><img src={question.image_url} alt={visualCaption || `Automatically rendered visual for question ${index + 1}`} className="max-h-48 w-full rounded object-contain" />{visualCaption && <p className="mt-1 text-center text-[11px] italic text-slate-500">{visualCaption}</p>}</div> : includeImages ? <div className="mt-3 space-y-2"><div className="rounded-lg border border-dashed border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Automatic visual pending or not required for this question.</div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:border-red-300 hover:bg-red-50"><input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => onAttach(event.target.files?.[0])} />{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}{uploading ? 'Attaching image…' : 'Attach school-owned visual as a fallback'}</label></div> : null}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5"><div className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${questionBadgeClass(question.question_type)}`}>{questionTypeLabel(question.question_type)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${question.review_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : question.review_status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{question.review_status || 'draft'}</span></div><div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => setShowMarking((current) => !current)} className="text-[11px] font-semibold text-red-600 hover:text-red-700">{showMarking ? 'Hide marking' : 'View marking'}</button>{editing ? <><button type="button" onClick={() => { onEdit(draftStem); setEditing(false); }} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white"><Save className="h-3 w-3" />Save</button><button type="button" onClick={() => { setDraftStem(question.question_text); setEditing(false); }} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"><X className="h-3 w-3" />Cancel</button></> : <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"><Edit3 className="h-3 w-3" />Edit</button>}<button type="button" onClick={() => void handleRegenerate()} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-violet-200 px-2 py-1 text-[11px] font-semibold text-violet-700 disabled:opacity-60"><RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />Regenerate</button><button type="button" onClick={() => onReview('approved')} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700"><Check className="h-3 w-3" />Approve</button><button type="button" onClick={() => onReview('flagged')} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700"><Flag className="h-3 w-3" />Flag</button></div></div>
    {showMarking && <div className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-xs leading-5 text-emerald-900"><p className="font-semibold">Expected response</p><p>{question.marking_scheme || question.correct_answer}</p>{question.learning_outcome && <p className="mt-1"><strong>Learning outcome:</strong> {question.learning_outcome}</p>}{question.competency && <p><strong>Competency:</strong> {question.competency}</p>}</div>}
  </article>;
}
