import { useState, useEffect, useCallback } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen, ChevronDown, ChevronRight, FileText, Layers, BookMarked,
  Sparkles, ClipboardList, FolderOpen, Download, Printer, CheckCircle2,
  Circle, Loader2, Brain, Upload, X, Plus, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Grade { id: string; grade_number: number; grade_name: string; }
interface Subject { id: string; subject_name: string; subject_code: string; }
interface Strand { id: string; strand_name: string; strand_order: number; sub_strands?: SubStrand[]; }
interface SubStrand { id: string; sub_strand_name: string; sub_strand_order: number; topics?: Topic[]; }
interface Topic {
  id: string;
  topic_name: string;
  topic_description: string;
  learning_objectives: string[];
  topic_order: number;
  progress?: 'not_started' | 'taught';
}
interface SchemeOfWork {
  id?: string;
  week_number: number;
  learning_objective: string;
  learning_activities: string;
  learning_resources: string;
  assessment_methods: string;
}
interface LessonPlan {
  id?: string;
  lesson_objective: string;
  introduction: string;
  development: string;
  conclusion: string;
  teaching_aids: string[];
  competency_outcomes: string[];
  duration_minutes: number;
}
interface Resource {
  id: string;
  resource_type: string;
  resource_title: string;
  resource_url: string;
  resource_content: string;
}
interface ExamQuestion {
  question_text: string;
  question_type: 'multiple_choice' | 'short_answer' | 'essay';
  options?: string[];
  correct_answer: string;
  marks: number;
  difficulty: string;
}

// ─── AI Helper ───────────────────────────────────────────────────────────────
async function callAI(prompt: string): Promise<string> {
  const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
  const OPENAI_BASE = import.meta.env.VITE_OPENAI_API_BASE || 'https://api.openai.com/v1';
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error('AI request failed');
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── PDF Helpers ──────────────────────────────────────────────────────────────
function downloadSchemeAsPDF(scheme: SchemeOfWork, topic: Topic, subject: string, grade: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEME OF WORK', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Subject: ${subject}   Grade: ${grade}   Topic: ${topic.topic_name}`, 14, 35);
  doc.text(`Week: ${scheme.week_number}`, 14, 45);
  autoTable(doc, {
    startY: 55,
    head: [['Field', 'Details']],
    body: [
      ['Learning Objective', scheme.learning_objective],
      ['Learning Activities', scheme.learning_activities],
      ['Learning Resources', scheme.learning_resources],
      ['Assessment Methods', scheme.assessment_methods],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });
  doc.save(`scheme_of_work_${topic.topic_name.replace(/\s+/g, '_')}.pdf`);
}

function downloadLessonPlanAsPDF(plan: LessonPlan, topic: Topic, subject: string, grade: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LESSON PLAN', 105, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Subject: ${subject}   Grade: ${grade}   Topic: ${topic.topic_name}`, 14, 32);
  doc.text(`Duration: ${plan.duration_minutes} minutes`, 14, 42);
  autoTable(doc, {
    startY: 50,
    head: [['Section', 'Content']],
    body: [
      ['Lesson Objective', plan.lesson_objective],
      ['Introduction (5 min)', plan.introduction],
      ['Development (25 min)', plan.development],
      ['Conclusion (10 min)', plan.conclusion],
      ['Teaching Aids', plan.teaching_aids.join(', ')],
      ['CBE Competency Outcomes', plan.competency_outcomes.join('\n')],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });
  doc.save(`lesson_plan_${topic.topic_name.replace(/\s+/g, '_')}.pdf`);
}

function downloadExamAsPDF(
  questions: ExamQuestion[],
  examTitle: string,
  schoolName: string,
  subject: string,
  grade: string,
  totalMarks: number,
  includeMarkingScheme: boolean
) {
  const doc = new jsPDF();
  const mcqs = questions.filter(q => q.question_type === 'multiple_choice');
  const structured = questions.filter(q => q.question_type === 'short_answer');
  const essays = questions.filter(q => q.question_type === 'essay');

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), 105, 18, { align: 'center' });
  doc.setFontSize(12);
  doc.text(examTitle.toUpperCase(), 105, 28, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Subject: ${subject}   Grade: ${grade}`, 105, 38, { align: 'center' });
  doc.text(`Total Marks: ${totalMarks}   Duration: ${Math.ceil(totalMarks * 1.5)} minutes`, 105, 46, { align: 'center' });
  doc.line(14, 52, 196, 52);

  let y = 60;
  let qNum = 1;

  if (mcqs.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`SECTION A: OBJECTIVE (${mcqs.reduce((s, q) => s + q.marks, 0)} marks)`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Answer ALL questions in this section.', 14, y + 7);
    y += 16;
    for (const q of mcqs) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text} (${q.marks} mark${q.marks > 1 ? 's' : ''})`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 6 + 2;
      if (q.options) {
        const opts = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, i) => {
          doc.text(`   ${opts[i]}) ${opt}`, 14, y);
          y += 6;
        });
      }
      y += 4;
      qNum++;
    }
  }

  if (structured.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`SECTION B: STRUCTURED (${structured.reduce((s, q) => s + q.marks, 0)} marks)`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Show your working clearly.', 14, y + 7);
    y += 16;
    for (const q of structured) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text} (${q.marks} marks)`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 6 + 14;
      qNum++;
    }
  }

  if (essays.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`SECTION C: ESSAY (${essays.reduce((s, q) => s + q.marks, 0)} marks)`, 14, y);
    y += 14;
    for (const q of essays) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text} (${q.marks} marks)`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 6 + 20;
      qNum++;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.text('--- END OF EXAM ---', 105, y + 10, { align: 'center' });
  doc.text('Good luck!', 105, y + 18, { align: 'center' });

  if (includeMarkingScheme) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MARKING SCHEME', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${examTitle} - ${subject} - ${grade}`, 105, 30, { align: 'center' });
    autoTable(doc, {
      startY: 40,
      head: [['Q#', 'Question', 'Answer', 'Marks']],
      body: questions.map((q, i) => [
        `${i + 1}`,
        q.question_text.substring(0, 60) + (q.question_text.length > 60 ? '...' : ''),
        q.correct_answer,
        `${q.marks}`,
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [22, 163, 74] },
    });
  }

  doc.save(`${examTitle.replace(/\s+/g, '_')}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CurriculumNavigator() {
  const { user } = useAuth();

  // Filters
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');

  // Curriculum tree
  const [strands, setStrands] = useState<Strand[]>([]);
  const [expandedStrands, setExpandedStrands] = useState<Set<string>>(new Set());
  const [expandedSubStrands, setExpandedSubStrands] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(false);

  // Selected topic
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [activeSection, setActiveSection] = useState<'scheme' | 'lesson' | 'resources' | 'exam'>('scheme');

  // Scheme of Work
  const [scheme, setScheme] = useState<SchemeOfWork | null>(null);
  const [generatingScheme, setGeneratingScheme] = useState(false);

  // Lesson Plan
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState(false);

  // Resources
  const [resources, setResources] = useState<Resource[]>([]);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [newResource, setNewResource] = useState({ type: 'Notes', title: '', content: '' });

  // Exam Generator
  const [examTopics, setExamTopics] = useState<Set<string>>(new Set());
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [examDifficulty, setExamDifficulty] = useState('Medium');
  const [examTotalMarks, setExamTotalMarks] = useState(50);
  const [examTitle, setExamTitle] = useState('');
  const [includeMarkingScheme, setIncludeMarkingScheme] = useState(true);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<ExamQuestion[] | null>(null);

  // Progress
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});

  // School info
  const [schoolName, setSchoolName] = useState('Zamifu Analytics School');

  // ── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    loadGrades();
    loadTeacherInfo();
    loadSchoolInfo();
  }, []);

  const loadGrades = async () => {
    const { data } = await supabaseUntyped
      .from('curriculum_grades')
      .select('*')
      .order('grade_number');
    setGrades(data || []);
  };

  const loadTeacherInfo = async () => {
    if (!user?.id) return;
    const { data: t } = await supabaseUntyped.from('teachers').select('id, school_id').eq('profile_id', user.id).single();
    if (t) {
      setTeacherId(t.id);
      const { data: cls } = await supabaseUntyped.from('classes').select('id, name').eq('school_id', t.school_id);
      setClasses(cls || []);
      if (cls && cls.length > 0) setClassId(cls[0].id);
    }
  };

  const loadSchoolInfo = async () => {
    if (!user?.schoolId) return;
    const { data } = await supabaseUntyped.from('schools').select('name').eq('id', user.schoolId).single();
    if (data) setSchoolName(data.name);
  };

  // ── Load subjects when grade changes ──────────────────────────────────────
  useEffect(() => {
    if (!selectedGrade) { setSubjects([]); return; }
    supabaseUntyped
      .from('curriculum_subjects')
      .select('*')
      .eq('grade_id', selectedGrade)
      .order('subject_name')
      .then(({ data }) => setSubjects(data || []));
    setSelectedSubject('');
    setStrands([]);
    setSelectedTopic(null);
  }, [selectedGrade]);

  // ── Load curriculum tree ───────────────────────────────────────────────────
  const loadCurriculumTree = useCallback(async () => {
    if (!selectedSubject) return;
    setLoadingTree(true);
    const { data: strandsData } = await supabaseUntyped
      .from('curriculum_strands')
      .select('id, strand_name, strand_order')
      .eq('subject_id', selectedSubject)
      .order('strand_order');

    if (!strandsData) { setLoadingTree(false); return; }

    const enriched: Strand[] = await Promise.all(
      strandsData.map(async (strand) => {
        const { data: ssData } = await supabaseUntyped
          .from('curriculum_sub_strands')
          .select('id, sub_strand_name, sub_strand_order')
          .eq('strand_id', strand.id)
          .order('sub_strand_order');

        const subStrands: SubStrand[] = await Promise.all(
          (ssData || []).map(async (ss) => {
            const { data: topicsData } = await supabaseUntyped
              .from('curriculum_topics')
              .select('id, topic_name, topic_description, learning_objectives, topic_order')
              .eq('sub_strand_id', ss.id)
              .order('topic_order');
            return { ...ss, topics: topicsData || [] };
          })
        );
        return { ...strand, sub_strands: subStrands };
      })
    );

    setStrands(enriched);

    // Collect all topics for exam generator
    const topics: Topic[] = enriched.flatMap(s =>
      (s.sub_strands || []).flatMap(ss => ss.topics || [])
    );
    setAllTopics(topics);

    // Load progress
    if (teacherId && classId) {
      const topicIds = topics.map(t => t.id);
      const { data: prog } = await supabaseUntyped
        .from('curriculum_topic_progress')
        .select('topic_id, status')
        .in('topic_id', topicIds)
        .eq('teacher_id', teacherId)
        .eq('class_id', classId);
      const map: Record<string, string> = {};
      (prog || []).forEach((p: { topic_id: string; status: string }) => { map[p.topic_id] = p.status; });
      setProgressMap(map);
    }

    setLoadingTree(false);
  }, [selectedSubject, teacherId, classId]);

  useEffect(() => { loadCurriculumTree(); }, [loadCurriculumTree]);

  // ── Select topic ───────────────────────────────────────────────────────────
  const handleSelectTopic = async (topic: Topic) => {
    setSelectedTopic(topic);
    setActiveSection('scheme');
    setScheme(null);
    setLessonPlan(null);
    setGeneratedExam(null);

    // Load existing scheme
    const { data: s } = await supabaseUntyped
      .from('curriculum_schemes_of_work')
      .select('*')
      .eq('topic_id', topic.id)
      .single();
    if (s) setScheme(s);

    // Load existing lesson plan
    const { data: lp } = await supabaseUntyped
      .from('curriculum_lesson_plans')
      .select('*')
      .eq('topic_id', topic.id)
      .single();
    if (lp) setLessonPlan(lp);

    // Load resources
    const { data: res } = await supabaseUntyped
      .from('curriculum_resources')
      .select('*')
      .eq('topic_id', topic.id);
    setResources(res || []);
  };

  // ── Generate Scheme of Work ────────────────────────────────────────────────
  const generateScheme = async () => {
    if (!selectedTopic) return;
    setGeneratingScheme(true);
    try {
      const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
      const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';
      const prompt = `Generate a detailed Scheme of Work for a Kenyan CBE school.
Grade: ${gradeName}
Subject: ${subjectName}
Topic: ${selectedTopic.topic_name}
Term: ${selectedTerm}
Learning Objectives: ${selectedTopic.learning_objectives?.join(', ')}

Respond ONLY with a valid JSON object (no markdown):
{
  "week_number": 3,
  "learning_objective": "...",
  "learning_activities": "...",
  "learning_resources": "...",
  "assessment_methods": "..."
}`;
      const raw = await callAI(prompt);
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setScheme(parsed);

      // Save to DB
      await supabaseUntyped.from('curriculum_schemes_of_work').insert({
        topic_id: selectedTopic.id,
        ...parsed,
      });
      toast.success('Scheme of Work generated!');
    } catch (e) {
      // Fallback: generate without AI
      const fallback: SchemeOfWork = {
        week_number: 3,
        learning_objective: `By the end of the lesson, learners should be able to ${selectedTopic.learning_objectives?.[0] || 'understand ' + selectedTopic.topic_name}`,
        learning_activities: `1. Introduction and review of prior knowledge\n2. Teacher demonstration of ${selectedTopic.topic_name}\n3. Guided practice with worked examples\n4. Group activities and peer learning\n5. Individual practice exercises`,
        learning_resources: `Textbooks, Charts, Worksheets, Manipulatives, Digital resources, KICD curriculum materials`,
        assessment_methods: `Oral questions, Written exercises, Group work observation, Portfolio assessment, Formative assessment`,
      };
      setScheme(fallback);
      await supabaseUntyped.from('curriculum_schemes_of_work').insert({
        topic_id: selectedTopic.id,
        ...fallback,
      });
      toast.success('Scheme of Work generated (offline mode)!');
    }
    setGeneratingScheme(false);
  };

  // ── Generate Lesson Plan ───────────────────────────────────────────────────
  const generateLessonPlan = async () => {
    if (!selectedTopic) return;
    setGeneratingLesson(true);
    try {
      const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
      const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';
      const prompt = `Generate a detailed CBE-aligned Lesson Plan for a Kenyan school.
Grade: ${gradeName}
Subject: ${subjectName}
Topic: ${selectedTopic.topic_name}
Duration: 40 minutes
Learning Objectives: ${selectedTopic.learning_objectives?.join(', ')}

Respond ONLY with a valid JSON object (no markdown):
{
  "lesson_objective": "...",
  "introduction": "5-minute introduction activity...",
  "development": "25-minute main teaching activity...",
  "conclusion": "10-minute conclusion and assessment...",
  "teaching_aids": ["aid1", "aid2", "aid3"],
  "competency_outcomes": ["outcome1", "outcome2", "outcome3"],
  "duration_minutes": 40
}`;
      const raw = await callAI(prompt);
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setLessonPlan(parsed);
      await supabaseUntyped.from('curriculum_lesson_plans').insert({
        topic_id: selectedTopic.id,
        ...parsed,
      });
      toast.success('Lesson Plan generated!');
    } catch {
      const fallback: LessonPlan = {
        lesson_objective: `By the end of the lesson, learners should be able to ${selectedTopic.learning_objectives?.[0] || 'understand ' + selectedTopic.topic_name}`,
        introduction: `Begin with a review of prior knowledge. Ask learners what they already know about ${selectedTopic.topic_name}. Use questioning techniques to activate prior knowledge and create interest. (5 minutes)`,
        development: `Present the concept of ${selectedTopic.topic_name} using visual aids and real-life examples. Demonstrate key concepts step by step. Engage learners in guided practice. Have learners work in pairs to solve problems. Monitor and provide feedback. (25 minutes)`,
        conclusion: `Summarize key learning points. Ask learners to explain what they have learned. Assign homework for further practice. Conduct a quick formative assessment using oral questions. (10 minutes)`,
        teaching_aids: ['Textbooks', 'Charts and diagrams', 'Worksheets', 'Manipulatives', 'Whiteboard and markers'],
        competency_outcomes: [
          'Communication and collaboration',
          'Critical thinking and problem solving',
          'Self-efficacy',
          'Digital literacy',
          'Citizenship',
        ],
        duration_minutes: 40,
      };
      setLessonPlan(fallback);
      await supabaseUntyped.from('curriculum_lesson_plans').insert({
        topic_id: selectedTopic.id,
        ...fallback,
      });
      toast.success('Lesson Plan generated (offline mode)!');
    }
    setGeneratingLesson(false);
  };

  // ── Toggle topic progress ──────────────────────────────────────────────────
  const toggleProgress = async (topicId: string) => {
    if (!teacherId || !classId) {
      toast.error('Please select a class first');
      return;
    }
    const current = progressMap[topicId] || 'not_started';
    const next = current === 'taught' ? 'not_started' : 'taught';
    setProgressMap(prev => ({ ...prev, [topicId]: next }));

    const { data: existing } = await supabaseUntyped
      .from('curriculum_topic_progress')
      .select('id')
      .eq('topic_id', topicId)
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .single();

    if (existing) {
      await supabaseUntyped
        .from('curriculum_topic_progress')
        .update({ status: next, taught_at: next === 'taught' ? new Date().toISOString() : null })
        .eq('id', existing.id);
    } else {
      await supabaseUntyped.from('curriculum_topic_progress').insert({
        topic_id: topicId,
        teacher_id: teacherId,
        class_id: classId,
        status: next,
        taught_at: next === 'taught' ? new Date().toISOString() : null,
      });
    }
    toast.success(next === 'taught' ? 'Topic marked as taught!' : 'Topic unmarked');
  };

  // ── Upload resource ────────────────────────────────────────────────────────
  const uploadResource = async () => {
    if (!selectedTopic || !newResource.title) return;
    setUploadingResource(true);
    const { data } = await supabaseUntyped.from('curriculum_resources').insert({
      topic_id: selectedTopic.id,
      resource_type: newResource.type,
      resource_title: newResource.title,
      resource_content: newResource.content,
      uploaded_by: user?.id,
    }).select().single();
    if (data) {
      setResources(prev => [...prev, data]);
      setNewResource({ type: 'Notes', title: '', content: '' });
      toast.success('Resource uploaded!');
    }
    setUploadingResource(false);
  };

  // ── Generate Exam ──────────────────────────────────────────────────────────
  const generateExam = async () => {
    if (examTopics.size === 0) { toast.error('Select at least one topic'); return; }
    setGeneratingExam(true);
    try {
      const selectedTopicNames = allTopics.filter(t => examTopics.has(t.id)).map(t => t.topic_name);
      const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
      const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';

      const mcqCount = Math.floor(examTotalMarks * 0.4 / 2);
      const shortCount = Math.floor(examTotalMarks * 0.4 / 5);
      const essayCount = Math.floor(examTotalMarks * 0.2 / 10);

      const prompt = `Generate a CBE-aligned exam for a Kenyan school.
Grade: ${gradeName}
Subject: ${subjectName}
Topics: ${selectedTopicNames.join(', ')}
Difficulty: ${examDifficulty}
Total Marks: ${examTotalMarks}

Generate:
- ${mcqCount} multiple choice questions (2 marks each)
- ${shortCount} short answer questions (5 marks each)
- ${essayCount} essay questions (10 marks each)

Respond ONLY with a valid JSON array (no markdown):
[
  {
    "question_text": "...",
    "question_type": "multiple_choice",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correct_answer": "B) option2",
    "marks": 2,
    "difficulty": "${examDifficulty}"
  },
  ...
]`;
      const raw = await callAI(prompt);
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed: ExamQuestion[] = JSON.parse(cleaned);
      setGeneratedExam(parsed);
      toast.success(`Exam generated with ${parsed.length} questions!`);
    } catch {
      // Fallback exam
      const topicNames = allTopics.filter(t => examTopics.has(t.id)).map(t => t.topic_name);
      const fallback: ExamQuestion[] = [
        {
          question_text: `Which of the following best describes ${topicNames[0]}?`,
          question_type: 'multiple_choice',
          options: ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'],
          correct_answer: 'B) Option B',
          marks: 2,
          difficulty: examDifficulty,
        },
        {
          question_text: `Explain the concept of ${topicNames[0]} in your own words.`,
          question_type: 'short_answer',
          options: undefined,
          correct_answer: `A clear explanation of ${topicNames[0]} with relevant examples.`,
          marks: 5,
          difficulty: examDifficulty,
        },
        {
          question_text: `Discuss the importance of ${topicNames[0]} in real life, giving at least three examples.`,
          question_type: 'essay',
          options: undefined,
          correct_answer: `A comprehensive essay discussing ${topicNames[0]} with real-life examples and clear reasoning.`,
          marks: 10,
          difficulty: examDifficulty,
        },
      ];
      setGeneratedExam(fallback);
      toast.success('Exam generated (offline mode)!');
    }
    setGeneratingExam(false);
  };

  // ── Progress stats ─────────────────────────────────────────────────────────
  const taughtCount = allTopics.filter(t => progressMap[t.id] === 'taught').length;
  const progressPct = allTopics.length > 0 ? Math.round((taughtCount / allTopics.length) * 100) : 0;

  const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
  const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] flex items-center gap-2">
            <Brain className="w-7 h-7 text-blue-600" />
            KICD Curriculum Navigator
          </h1>
          <p className="text-sm text-[#666666] mt-1">CBE-aligned curriculum intelligence for Kenyan schools</p>
        </div>
        {allTopics.length > 0 && (
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{taughtCount}/{allTopics.length} topics taught</p>
            <div className="w-40 bg-gray-200 rounded-full h-2 mt-1">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{progressPct}% complete</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
            <select
              value={selectedGrade}
              onChange={e => setSelectedGrade(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Grade</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>{g.grade_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!selectedGrade}
            >
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option>Term 1</option>
              <option>Term 2</option>
              <option>Term 3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Class (for progress)</label>
            <select
              value={classId || ''}
              onChange={e => setClassId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main content: tree + topic panel */}
      {selectedSubject && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Curriculum Tree */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-2">
              <Layers className="w-5 h-5" />
              <span className="font-semibold text-sm">Curriculum Tree</span>
              {loadingTree && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
            </div>
            <div className="p-3 max-h-[600px] overflow-y-auto">
              {strands.length === 0 && !loadingTree && (
                <p className="text-sm text-gray-400 text-center py-8">No curriculum data found</p>
              )}
              {strands.map(strand => (
                <div key={strand.id} className="mb-2">
                  <button
                    onClick={() => setExpandedStrands(prev => {
                      const next = new Set(prev);
                      next.has(strand.id) ? next.delete(strand.id) : next.add(strand.id);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold text-sm transition-colors"
                  >
                    {expandedStrands.has(strand.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <BookOpen className="w-4 h-4" />
                    <span className="text-left">{strand.strand_name}</span>
                  </button>

                  {expandedStrands.has(strand.id) && (
                    <div className="ml-4 mt-1 space-y-1">
                      {(strand.sub_strands || []).map(ss => (
                        <div key={ss.id}>
                          <button
                            onClick={() => setExpandedSubStrands(prev => {
                              const next = new Set(prev);
                              next.has(ss.id) ? next.delete(ss.id) : next.add(ss.id);
                              return next;
                            })}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors"
                          >
                            {expandedSubStrands.has(ss.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <BookMarked className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-left">{ss.sub_strand_name}</span>
                          </button>

                          {expandedSubStrands.has(ss.id) && (
                            <div className="ml-6 mt-1 space-y-0.5">
                              {(ss.topics || []).map(topic => (
                                <div key={topic.id} className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleProgress(topic.id)}
                                    className="flex-shrink-0 p-0.5"
                                    title={progressMap[topic.id] === 'taught' ? 'Mark as not taught' : 'Mark as taught'}
                                  >
                                    {progressMap[topic.id] === 'taught'
                                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                      : <Circle className="w-4 h-4 text-gray-300" />}
                                  </button>
                                  <button
                                    onClick={() => handleSelectTopic(topic)}
                                    className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${
                                      selectedTopic?.id === topic.id
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    <FileText className="w-3 h-3 flex-shrink-0" />
                                    {topic.topic_name}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Topic Detail Panel */}
          <div className="lg:col-span-3 space-y-4">
            {!selectedTopic ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Select a topic from the curriculum tree</p>
                <p className="text-gray-400 text-sm mt-1">Click any topic to view Scheme of Work, Lesson Plan, Resources, and Exam Generator</p>
              </div>
            ) : (
              <>
                {/* Topic header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-4">
                  <h2 className="text-lg font-bold">{selectedTopic.topic_name}</h2>
                  <p className="text-blue-100 text-sm mt-0.5">{gradeName} • {subjectName} • {selectedTerm}</p>
                  {selectedTopic.learning_objectives?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-blue-200 font-medium uppercase tracking-wide">Learning Objectives</p>
                      <ul className="mt-1 space-y-0.5">
                        {selectedTopic.learning_objectives.map((obj, i) => (
                          <li key={i} className="text-sm text-blue-100 flex items-start gap-1.5">
                            <span className="text-blue-300 mt-0.5">•</span>{obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Section tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {[
                    { id: 'scheme', label: 'Scheme of Work', icon: <ClipboardList className="w-4 h-4" /> },
                    { id: 'lesson', label: 'Lesson Plan', icon: <Sparkles className="w-4 h-4" /> },
                    { id: 'resources', label: 'Resources', icon: <FolderOpen className="w-4 h-4" /> },
                    { id: 'exam', label: 'Exam Generator', icon: <FileText className="w-4 h-4" /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSection(tab.id as typeof activeSection)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeSection === tab.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* ── SECTION 1: Scheme of Work ── */}
                {activeSection === 'scheme' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        Scheme of Work
                      </h3>
                      <div className="flex gap-2">
                        {scheme && (
                          <button
                            onClick={() => downloadSchemeAsPDF(scheme, selectedTopic, subjectName, gradeName)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                        )}
                        <button
                          onClick={generateScheme}
                          disabled={generatingScheme}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          {generatingScheme ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {scheme ? 'Regenerate' : 'Generate with AI'}
                        </button>
                      </div>
                    </div>
                    {!scheme ? (
                      <div className="text-center py-8 text-gray-400">
                        <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Click "Generate with AI" to create a scheme of work</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-600 w-36">Week Number:</span>
                          <span className="text-gray-800">Week {scheme.week_number}</span>
                        </div>
                        {[
                          { label: 'Learning Objective', value: scheme.learning_objective },
                          { label: 'Learning Activities', value: scheme.learning_activities },
                          { label: 'Learning Resources', value: scheme.learning_resources },
                          { label: 'Assessment Methods', value: scheme.assessment_methods },
                        ].map(row => (
                          <div key={row.label} className="border-t pt-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{row.label}</p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SECTION 2: Lesson Plan ── */}
                {activeSection === 'lesson' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        Lesson Plan
                      </h3>
                      <div className="flex gap-2">
                        {lessonPlan && (
                          <>
                            <button
                              onClick={() => downloadLessonPlanAsPDF(lessonPlan, selectedTopic, subjectName, gradeName)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </button>
                            <button
                              onClick={() => window.print()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print
                            </button>
                          </>
                        )}
                        <button
                          onClick={generateLessonPlan}
                          disabled={generatingLesson}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          {generatingLesson ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {lessonPlan ? 'Regenerate' : 'Generate with AI'}
                        </button>
                      </div>
                    </div>
                    {!lessonPlan ? (
                      <div className="text-center py-8 text-gray-400">
                        <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Click "Generate with AI" to create a lesson plan</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Lesson Objective</p>
                          <p className="text-sm text-gray-800">{lessonPlan.lesson_objective}</p>
                          <p className="text-xs text-gray-500 mt-1">Duration: {lessonPlan.duration_minutes} minutes</p>
                        </div>
                        {[
                          { label: 'Introduction (5 min)', value: lessonPlan.introduction, color: 'bg-blue-50 text-blue-600' },
                          { label: 'Development (25 min)', value: lessonPlan.development, color: 'bg-green-50 text-green-600' },
                          { label: 'Conclusion (10 min)', value: lessonPlan.conclusion, color: 'bg-orange-50 text-orange-600' },
                        ].map(section => (
                          <div key={section.label} className={`rounded-lg p-3 ${section.color.split(' ')[0]}`}>
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${section.color.split(' ')[1]}`}>{section.label}</p>
                            <p className="text-sm text-gray-700">{section.value}</p>
                          </div>
                        ))}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Teaching Aids</p>
                            <ul className="space-y-1">
                              {lessonPlan.teaching_aids.map((aid, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />{aid}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">CBE Competency Outcomes</p>
                            <ul className="space-y-1">
                              {lessonPlan.competency_outcomes.map((outcome, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />{outcome}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── SECTION 3: Teaching Resources ── */}
                {activeSection === 'resources' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                      <FolderOpen className="w-5 h-5 text-orange-500" />
                      Teaching Resources
                    </h3>
                    {/* Upload form */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upload New Resource</p>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <select
                          value={newResource.type}
                          onChange={e => setNewResource(p => ({ ...p, type: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        >
                          {['Notes', 'Worksheet', 'Diagram', 'Video', 'Activity'].map(t => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          value={newResource.title}
                          onChange={e => setNewResource(p => ({ ...p, title: e.target.value }))}
                          placeholder="Resource title"
                          className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                      <textarea
                        value={newResource.content}
                        onChange={e => setNewResource(p => ({ ...p, content: e.target.value }))}
                        placeholder="Resource content or URL..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs mb-2"
                      />
                      <button
                        onClick={uploadResource}
                        disabled={uploadingResource || !newResource.title}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                      >
                        {uploadingResource ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Upload Resource
                      </button>
                    </div>
                    {/* Resource list */}
                    {resources.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No resources yet. Upload the first one!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {resources.map(r => (
                          <div key={r.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              r.resource_type === 'Notes' ? 'bg-blue-100 text-blue-700' :
                              r.resource_type === 'Worksheet' ? 'bg-green-100 text-green-700' :
                              r.resource_type === 'Video' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{r.resource_type}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">{r.resource_title}</p>
                              {r.resource_content && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{r.resource_content}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SECTION 4: Exam Generator ── */}
                {activeSection === 'exam' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-red-500" />
                      Exam Generator
                    </h3>

                    {/* Topic selection */}
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Topics (multi-select)</p>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                        {allTopics.map(t => (
                          <label key={t.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={examTopics.has(t.id)}
                              onChange={e => {
                                setExamTopics(prev => {
                                  const next = new Set(prev);
                                  e.target.checked ? next.add(t.id) : next.delete(t.id);
                                  return next;
                                });
                              }}
                              className="rounded text-blue-600"
                            />
                            <span className="text-xs text-gray-700">{t.topic_name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{examTopics.size} topic(s) selected</p>
                    </div>

                    {/* Exam settings */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Exam Title</label>
                        <input
                          value={examTitle}
                          onChange={e => setExamTitle(e.target.value)}
                          placeholder={`${subjectName} Exam - ${selectedTerm} 2025`}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                        <select
                          value={examDifficulty}
                          onChange={e => setExamDifficulty(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        >
                          <option>Easy</option>
                          <option>Medium</option>
                          <option>Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Total Marks</label>
                        <select
                          value={examTotalMarks}
                          onChange={e => setExamTotalMarks(Number(e.target.value))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                        >
                          {[10, 20, 30, 50, 100].map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeMarkingScheme}
                            onChange={e => setIncludeMarkingScheme(e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span className="text-xs text-gray-600">Include Marking Scheme</span>
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={generateExam}
                      disabled={generatingExam || examTopics.size === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 mb-4"
                    >
                      {generatingExam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {generatingExam ? 'Generating Exam...' : 'Generate Exam with AI'}
                    </button>

                    {/* Generated exam preview */}
                    {generatedExam && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-gray-700">
                            Generated: {generatedExam.length} questions • {generatedExam.reduce((s, q) => s + q.marks, 0)} marks
                          </p>
                          <button
                            onClick={() => downloadExamAsPDF(
                              generatedExam,
                              examTitle || `${subjectName} Exam - ${selectedTerm} 2025`,
                              schoolName,
                              subjectName,
                              gradeName,
                              examTotalMarks,
                              includeMarkingScheme
                            )}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download PDF
                          </button>
                        </div>
                        <div className="border border-gray-200 rounded-lg divide-y max-h-64 overflow-y-auto">
                          {generatedExam.map((q, i) => (
                            <div key={i} className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-gray-700 flex-1">
                                  <span className="font-semibold text-gray-900">{i + 1}.</span> {q.question_text}
                                </p>
                                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                                  q.question_type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' :
                                  q.question_type === 'short_answer' ? 'bg-green-100 text-green-700' :
                                  'bg-purple-100 text-purple-700'
                                }`}>{q.marks}m</span>
                              </div>
                              {q.options && (
                                <div className="mt-1 grid grid-cols-2 gap-0.5">
                                  {q.options.map((opt, j) => (
                                    <p key={j} className="text-xs text-gray-500">{opt}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!selectedSubject && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Brain className="w-14 h-14 text-blue-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">KICD Curriculum Intelligence</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Select a Grade and Subject above to explore the CBE curriculum tree, generate lesson plans, schemes of work, and AI-powered exams.
          </p>
        </div>
      )}
    </div>
  );
}
