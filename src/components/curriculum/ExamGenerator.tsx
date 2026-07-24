import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck, CheckCircle2, ChevronDown, Download, FileImage, FileText,
  ImagePlus, Loader2, RefreshCw, ShieldCheck, Sparkles, X,
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
}

interface ExamGeneratorProps {
  gradeLevel: string;
  subject: string;
  schoolName?: string;
  schoolId?: string;
  strands: CurriculumStrandOption[];
  topics: CurriculumTopicOption[];
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
    if (!schoolId) return;
    void loadRecentPapers();
  }, [schoolId, subject, gradeLevel]);

  async function loadRecentPapers() {
    if (!schoolId) return;
    const { data } = await supabaseUntyped
      .from('exam_papers')
      .select('id, title, subject, grade_level, total_marks, created_at')
      .eq('school_id', schoolId)
      .eq('subject', subject)
      .eq('grade_level', gradeLevel)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentPapers((data || []) as SavedPaperSummary[]);
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
    setDownloading(true);
    try {
      await downloadExamPdf(paper, includeMarkingScheme);
      toast.success('Professional PDF paper downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The PDF could not be created.');
    } finally {
      setDownloading(false);
    }
  }

  async function attachImage(question: GeneratedExamQuestion, file: File | undefined) {
    if (!file || !question.id || !schoolId) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
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
      const { error: uploadError } = await supabaseUntyped.storage.from('school-files').upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabaseUntyped.storage.from('school-files').getPublicUrl(path);
      const imageUrl = publicData.publicUrl;
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
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><h3 className="font-semibold text-slate-900">Generated paper</h3><p className="mt-1 text-xs leading-5 text-slate-500">Review the generated questions before sharing with learners.</p></div>
              {paper && <button type="button" onClick={() => void downloadPaper()} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">{downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Export PDF</button>}
            </div>

            {!paper ? <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center"><FileText className="h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">Your paper preview will appear here.</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Choose the curriculum focus and question types, then generate a structured CBC assessment.</p></div> : <>
              <div className="mb-3 rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-800">{paper.title}</p><p className="mt-1 text-xs text-slate-500">{paper.questions.length} questions · {paper.total_marks} marks · {paper.duration_minutes} minutes</p></div>
              <div className="max-h-[660px] space-y-3 overflow-y-auto pr-1">
                {paper.questions.map((question, index) => <QuestionPreview key={question.id || `${question.question_text}-${index}`} question={question} index={index} includeImages={includeImages} uploading={uploadingQuestionId === question.id} onAttach={(file) => void attachImage(question, file)} />)}
              </div>
            </>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-slate-500" /><h3 className="text-sm font-semibold text-slate-900">Recent papers</h3></div><button type="button" onClick={() => void loadRecentPapers()} className="text-xs font-semibold text-red-600 hover:text-red-700">Refresh</button></div>
            {recentPapers.length ? <div className="mt-3 divide-y divide-slate-100">{recentPapers.map((savedPaper) => <div key={savedPaper.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-700">{savedPaper.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{savedPaper.total_marks} marks · {new Date(savedPaper.created_at).toLocaleDateString()}</p></div><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /></div>)}</div> : <p className="mt-3 text-xs text-slate-500">No papers have been saved for this grade and subject yet.</p>}
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

function QuestionPreview({ question, index, includeImages, uploading, onAttach }: { question: GeneratedExamQuestion; index: number; includeImages: boolean; uploading: boolean; onAttach: (file: File | undefined) => void }) {
  const [showMarking, setShowMarking] = useState(false);
  const options = Array.isArray(question.options) ? question.options : [];
  return <article className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex items-start justify-between gap-3"><p className="text-sm leading-6 text-slate-800"><span className="mr-1 font-bold">{index + 1}.</span>{question.question_text}</p><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${questionBadgeClass(question.question_type)}`}>{question.marks}m</span></div>{options.length > 0 && <div className="mt-2 grid gap-1 sm:grid-cols-2">{options.map((option, optionIndex) => <p key={`${option}-${optionIndex}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{String.fromCharCode(65 + optionIndex)}. {option}</p>)}</div>}{question.image_url ? <img src={question.image_url} alt="Question visual" className="mt-3 max-h-48 rounded-lg border border-slate-200 object-contain" /> : includeImages && <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:border-red-300 hover:bg-red-50"><input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => onAttach(event.target.files?.[0])} />{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}{uploading ? 'Attaching image…' : 'Attach school-owned visual'}</label>}<div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${questionBadgeClass(question.question_type)}`}>{questionTypeLabel(question.question_type)}</span><button type="button" onClick={() => setShowMarking((current) => !current)} className="text-[11px] font-semibold text-red-600 hover:text-red-700">{showMarking ? 'Hide marking' : 'View marking'}</button></div>{showMarking && <div className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-xs leading-5 text-emerald-900"><p className="font-semibold">Expected response</p><p>{question.marking_scheme || question.correct_answer}</p></div>}</article>;
}
