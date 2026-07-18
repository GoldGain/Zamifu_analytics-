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
import {
  OFFICIAL_LINKS,
  GRADE_NINE_SUBJECTS,
  SCHEME_COLUMNS,
  LESSON_PLAN_SECTIONS,
  SAMPLE_PAPER_LIBRARY,
  buildSchemeRow,
  buildTermScheme,
  buildFullLessonPlan,
  buildExamBlueprint,
  findStrandContext,
  getStrandPacks,
  gradeDesignUrl,
  type SchemeRow,
  type FullLessonPlan,
  type ExamBlueprint,
} from '@/lib/kicd-knowledge';

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
  lesson_number?: number | string;
  strand?: string;
  sub_strand?: string;
  /** Specific Learning Outcomes (KICD column) */
  learning_objective: string;
  key_inquiry_questions?: string;
  /** Learning Experiences / Activities */
  learning_activities: string;
  learning_resources: string;
  assessment_methods: string;
  reflection?: string;
  core_competencies?: string;
  values?: string;
  pci?: string;
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
  // Full KICD fields (optional for backward compatibility)
  strand?: string;
  sub_strand?: string;
  key_inquiry_question?: string;
  specific_learning_outcomes?: string[];
  core_competencies?: string[];
  values?: string[];
  pci?: string[];
  learning_resources?: string[];
  organization_of_learning?: string;
  assessment?: string;
  extended_activities?: string;
  homework?: string;
  teacher_self_evaluation?: string;
  reflection?: string;
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
  // KICD 9-column Scheme of Work (landscape)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEME OF WORK — KICD / CBE FORMAT', 148.5, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Subject: ${subject}    Grade: ${grade}    Topic: ${topic.topic_name}`, 14, 20);
  doc.text(`Week: ${scheme.week_number}    Lesson: ${scheme.lesson_number || 1}`, 14, 26);
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Aligned to KICD curriculum design columns | Zamifu Analytics', 14, 32);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 36,
    head: [[
      'Week',
      'Lesson',
      'Strand',
      'Sub-Strand',
      'Specific Learning Outcomes',
      'Key Inquiry Questions',
      'Learning Experiences',
      'Learning Resources',
      'Assessment',
      'Reflection',
    ]],
    body: [[
      String(scheme.week_number || ''),
      String(scheme.lesson_number || '1'),
      scheme.strand || topic.topic_name,
      scheme.sub_strand || '',
      scheme.learning_objective || '',
      scheme.key_inquiry_questions || '',
      scheme.learning_activities || '',
      scheme.learning_resources || '',
      scheme.assessment_methods || '',
      scheme.reflection || 'To be completed after lesson delivery',
    ]],
    styles: { fontSize: 7, cellPadding: 2, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 14 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 40 },
      5: { cellWidth: 30 },
      6: { cellWidth: 40 },
      7: { cellWidth: 30 },
      8: { cellWidth: 28 },
      9: { cellWidth: 28 },
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;
  if (scheme.core_competencies || scheme.values || scheme.pci) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CBE Alignment', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    y += 5;
    if (scheme.core_competencies) { doc.text(`Core Competencies: ${scheme.core_competencies}`, 14, y); y += 5; }
    if (scheme.values) { doc.text(`Values: ${scheme.values}`, 14, y); y += 5; }
    if (scheme.pci) { doc.text(`PCIs: ${scheme.pci}`, 14, y); y += 5; }
  }
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Reference: KICD Curriculum Designs · schemesofwork.com samples · Generated by Zamifu Analytics', 148.5, 200, { align: 'center' });
  doc.save(`scheme_of_work_KICD_${topic.topic_name.replace(/\s+/g, '_')}.pdf`);
}



function downloadTermSchemePDF(rows: SchemeRow[], subject: string, grade: string, term: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`SCHEME OF WORK — ${subject.toUpperCase()} · ${grade} · ${term}`, 148.5, 10, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('KICD 9-column format | Generated by Zamifu Analytics Curriculum Navigator', 148.5, 16, { align: 'center' });
  autoTable(doc, {
    startY: 20,
    head: [SCHEME_COLUMNS as unknown as string[]],
    body: rows.map((r) => [
      String(r.week_number),
      String(r.lesson_number),
      r.strand,
      r.sub_strand,
      r.learning_objective,
      r.key_inquiry_questions,
      r.learning_activities,
      r.learning_resources,
      r.assessment_methods,
      r.reflection,
    ]),
    styles: { fontSize: 6, cellPadding: 1.2, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 6.5, fontStyle: 'bold' },
    margin: { left: 8, right: 8 },
  });
  doc.save(`term_scheme_${subject.replace(/\s+/g, '_')}_${grade.replace(/\s+/g, '_')}.pdf`);
}

function downloadExamBlueprintPDF(exam: ExamBlueprint, schoolName: string, subject: string, grade: string, includeMarking: boolean) {
  const doc = new jsPDF();
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text((schoolName || 'SCHOOL').toUpperCase(), 105, 14, { align: 'center' });
  doc.setFontSize(12);
  doc.text(exam.title.toUpperCase(), 105, 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Subject: ${subject}    Grade: ${grade}    Total: ${exam.totalMarks} marks`, 105, 30, { align: 'center' });
  doc.line(14, 34, 196, 34);
  let y = 40;
  doc.setFont('helvetica', 'bold');
  doc.text('INSTRUCTIONS', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  exam.instructions.forEach((ins, i) => {
    doc.text(`${i + 1}. ${ins}`, 14, y);
    y += 5;
  });
  y += 4;

  for (const section of exam.sections) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(section.name, 14, y);
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(section.description, 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const q of section.questions) {
      if (y > 260) { doc.addPage(); y = 20; }
      const stem = doc.splitTextToSize(`${q.number}. ${q.text} (${q.marks} mark${q.marks > 1 ? 's' : ''})`, 182);
      doc.text(stem, 14, y);
      y += stem.length * 5 + 2;
      if (q.options) {
        const labels = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, i) => {
          doc.text(`   ${labels[i]}) ${opt}`, 18, y);
          y += 5;
        });
      }
      y += 3;
    }
    y += 4;
  }

  if (includeMarking) {
    doc.addPage();
    y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MARKING SCHEME', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    for (const section of exam.sections) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text(section.name, 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      for (const q of section.questions) {
        if (y > 270) { doc.addPage(); y = 20; }
        const ans = doc.splitTextToSize(`Q${q.number}. ${q.answer}  [${q.marks} marks]`, 182);
        doc.text(ans, 14, y);
        y += ans.length * 5 + 3;
      }
      y += 4;
    }
  }

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Zamifu Analytics · KICD-aligned exam blueprint', 105, 290, { align: 'center' });
  doc.save(`exam_${subject.replace(/\s+/g, '_')}_${grade.replace(/\s+/g, '_')}.pdf`);
}

function downloadLessonPlanAsPDF(plan: LessonPlan, topic: Topic, subject: string, grade: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LESSON PLAN — KICD / CBE FORMAT', 105, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Aligned to KICD curriculum design · Zamifu Analytics', 105, 20, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  let y = 36;
  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value || '—', 130);
    doc.text(lines, 60, y);
    y += Math.max(7, lines.length * 5 + 2);
    if (y > 270) { doc.addPage(); y = 20; }
  };

  line('Subject:', subject);
  line('Grade:', grade);
  line('Topic:', topic.topic_name);
  line('Strand:', plan.strand || '');
  line('Sub-Strand:', plan.sub_strand || '');
  line('Duration:', `${plan.duration_minutes || 40} minutes`);
  line('Key Inquiry:', plan.key_inquiry_question || '');

  doc.setDrawColor(37, 99, 235);
  doc.line(14, y, 196, y);
  y += 8;

  const sections: [string, string][] = [
    ['Specific Learning Outcomes', (plan.specific_learning_outcomes || []).join('\n') || plan.lesson_objective],
    ['Core Competencies', (plan.core_competencies || plan.competency_outcomes || []).join('; ')],
    ['Values', (plan.values || []).join('; ')],
    ['PCIs', (plan.pci || []).join('; ')],
    ['Learning Resources', (plan.learning_resources || plan.teaching_aids || []).join('; ')],
    ['Organisation of Learning', plan.organization_of_learning || ''],
    ['Introduction', plan.introduction],
    ['Development / Learning Experiences', plan.development],
    ['Conclusion', plan.conclusion],
    ['Assessment', plan.assessment || 'Formative oral and written checks aligned to SLOs'],
    ['Extended Activities', plan.extended_activities || ''],
    ['Homework', plan.homework || ''],
    ['Teacher Self-Evaluation', plan.teacher_self_evaluation || ''],
    ['Reflection', plan.reflection || ''],
  ];

  for (const [title, body] of sections) {
    if (!body) continue;
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text(title.toUpperCase(), 14, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(body, 182);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 6;
  }

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Reference: KICD Curriculum Designs · schemesofwork.com format · Zamifu Analytics', 105, 290, { align: 'center' });
  doc.save(`lesson_plan_KICD_${topic.topic_name.replace(/\s+/g, '_')}.pdf`);
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
  const [termSchemeRows, setTermSchemeRows] = useState<SchemeRow[]>([]);
  const [examBlueprint, setExamBlueprint] = useState<ExamBlueprint | null>(null);

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
      let strandName = '';
      let subStrandName = '';
      for (const st of strands) {
        for (const ss of st.sub_strands || []) {
          if ((ss.topics || []).some((t) => t.id === selectedTopic.id)) {
            strandName = st.strand_name;
            subStrandName = ss.sub_strand_name;
          }
        }
      }
      const kb = findStrandContext(subjectName, selectedTopic.topic_name);
      if (!strandName) strandName = kb.strand;
      if (!subStrandName) subStrandName = kb.subStrand;

      // Always build a strong KICD offline base first
      const base = buildSchemeRow({
        subject: subjectName,
        grade: gradeName,
        topic: selectedTopic.topic_name,
        week: 1,
        lesson: 1,
        term: selectedTerm,
        learningObjectives: selectedTopic.learning_objectives?.length
          ? selectedTopic.learning_objectives
          : kb.slos,
        strand: strandName,
        subStrand: subStrandName,
      });

      try {
        const prompt = `You are a senior Kenyan CBE curriculum designer following KICD designs and schemesofwork.com 9-column format.
Improve this scheme of work JSON for:
Grade: ${gradeName}
Subject: ${subjectName}
Topic: ${selectedTopic.topic_name}
Strand: ${strandName}
Sub-strand: ${subStrandName}
Term: ${selectedTerm}
Curriculum SLOs: ${(selectedTopic.learning_objectives || kb.slos).join('; ')}

Return ONLY valid JSON with keys:
week_number, lesson_number, strand, sub_strand, learning_objective, key_inquiry_questions,
learning_activities, learning_resources, assessment_methods, reflection, core_competencies, values, pci

Base draft to improve:
${JSON.stringify(base)}`;
        const raw = await callAI(prompt);
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = { ...base, ...JSON.parse(cleaned) } as SchemeOfWork;
        setScheme(parsed);
        await supabaseUntyped.from('curriculum_schemes_of_work').insert({
          topic_id: selectedTopic.id,
          week_number: parsed.week_number,
          learning_objective: parsed.learning_objective,
          learning_activities: parsed.learning_activities,
          learning_resources: parsed.learning_resources,
          assessment_methods: parsed.assessment_methods,
        });
        toast.success('KICD Scheme of Work generated (AI + knowledge base)!');
      } catch {
        setScheme(base as SchemeOfWork);
        await supabaseUntyped.from('curriculum_schemes_of_work').insert({
          topic_id: selectedTopic.id,
          week_number: base.week_number,
          learning_objective: base.learning_objective,
          learning_activities: base.learning_activities,
          learning_resources: base.learning_resources,
          assessment_methods: base.assessment_methods,
        });
        toast.success('KICD Scheme of Work generated from curriculum knowledge base!');
      }
    } catch (e: any) {
      toast.error('Failed to generate scheme: ' + (e.message || 'Unknown error'));
    }
    setGeneratingScheme(false);
  };

  const generateTermScheme = async () => {
    const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || 'Junior School';
    const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || 'Subject';
    const topicNames = allTopics.map(t => t.topic_name);
    const rows = buildTermScheme({
      subject: subjectName,
      grade: gradeName,
      term: selectedTerm,
      weeks: 10,
      lessonsPerWeek: 1,
      topics: topicNames.length ? topicNames : undefined,
    });
    setTermSchemeRows(rows);
    downloadTermSchemePDF(rows, subjectName, gradeName, selectedTerm);
    toast.success(`Downloaded ${rows.length}-row term scheme (KICD 9-column)!`);
    // keep last generated rows for UI summary
    if (rows.length) {/* stored in termSchemeRows */}
  };

  // ── Generate Lesson Plan ───────────────────────────────────────────────────
  const generateLessonPlan = async () => {
    if (!selectedTopic) return;
    setGeneratingLesson(true);
    try {
      const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
      const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';
      let strandName = '';
      let subStrandName = '';
      for (const st of strands) {
        for (const ss of st.sub_strands || []) {
          if ((ss.topics || []).some((t) => t.id === selectedTopic.id)) {
            strandName = st.strand_name;
            subStrandName = ss.sub_strand_name;
          }
        }
      }
      const full = buildFullLessonPlan({
        subject: subjectName,
        grade: gradeName,
        topic: selectedTopic.topic_name,
        learningObjectives: selectedTopic.learning_objectives,
        strand: strandName || undefined,
        subStrand: subStrandName || undefined,
      });

      try {
        const prompt = `You are a KICD master teacher. Improve this CBE lesson plan JSON for Kenyan schools.
Grade ${gradeName}, Subject ${subjectName}, Topic ${selectedTopic.topic_name}.
Keep all keys. Return ONLY JSON.
Draft: ${JSON.stringify(full)}`;
        const raw = await callAI(prompt);
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = { ...full, ...JSON.parse(cleaned) } as FullLessonPlan;
        const lp: LessonPlan = {
          lesson_objective: parsed.lesson_objective,
          introduction: parsed.introduction,
          development: parsed.development,
          conclusion: parsed.conclusion,
          teaching_aids: parsed.teaching_aids || parsed.learning_resources || [],
          competency_outcomes: parsed.competency_outcomes || parsed.core_competencies || [],
          duration_minutes: parsed.duration_minutes || 40,
          strand: parsed.strand,
          sub_strand: parsed.sub_strand,
          key_inquiry_question: parsed.key_inquiry_question,
          specific_learning_outcomes: parsed.specific_learning_outcomes,
          core_competencies: parsed.core_competencies,
          values: parsed.values,
          pci: parsed.pci,
          learning_resources: parsed.learning_resources,
          organization_of_learning: parsed.organization_of_learning,
          assessment: parsed.assessment,
          extended_activities: parsed.extended_activities,
          homework: parsed.homework,
          teacher_self_evaluation: parsed.teacher_self_evaluation,
          reflection: parsed.reflection,
        };
        setLessonPlan(lp);
        await supabaseUntyped.from('curriculum_lesson_plans').insert({
          topic_id: selectedTopic.id,
          lesson_objective: lp.lesson_objective,
          introduction: lp.introduction,
          development: lp.development,
          conclusion: lp.conclusion,
          teaching_aids: lp.teaching_aids,
          competency_outcomes: lp.competency_outcomes,
          duration_minutes: lp.duration_minutes,
        });
        toast.success('Full KICD Lesson Plan generated!');
      } catch {
        const lp: LessonPlan = {
          lesson_objective: full.lesson_objective,
          introduction: full.introduction,
          development: full.development,
          conclusion: full.conclusion,
          teaching_aids: full.teaching_aids,
          competency_outcomes: full.competency_outcomes,
          duration_minutes: full.duration_minutes,
          strand: full.strand,
          sub_strand: full.sub_strand,
          key_inquiry_question: full.key_inquiry_question,
          specific_learning_outcomes: full.specific_learning_outcomes,
          core_competencies: full.core_competencies,
          values: full.values,
          pci: full.pci,
          learning_resources: full.learning_resources,
          organization_of_learning: full.organization_of_learning,
          assessment: full.assessment,
          extended_activities: full.extended_activities,
          homework: full.homework,
          teacher_self_evaluation: full.teacher_self_evaluation,
          reflection: full.reflection,
        };
        setLessonPlan(lp);
        await supabaseUntyped.from('curriculum_lesson_plans').insert({
          topic_id: selectedTopic.id,
          lesson_objective: lp.lesson_objective,
          introduction: lp.introduction,
          development: lp.development,
          conclusion: lp.conclusion,
          teaching_aids: lp.teaching_aids,
          competency_outcomes: lp.competency_outcomes,
          duration_minutes: lp.duration_minutes,
        });
        toast.success('Full KICD Lesson Plan generated from knowledge base!');
      }
    } catch (e: any) {
      toast.error('Lesson plan failed: ' + (e.message || 'error'));
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
    const gradeName = grades.find(g => g.id === selectedGrade)?.grade_name || '';
    const subjectName = subjects.find(s => s.id === selectedSubject)?.subject_name || '';
    const selected = allTopics.filter(t => examTopics.has(t.id));
    const topicNames = selected.length
      ? selected.map(t => t.topic_name)
      : (selectedTopic ? [selectedTopic.topic_name] : getStrandPacks(subjectName).flatMap(p => p.subStrands.flatMap(s => s.topics)).slice(0, 6));

    if (!topicNames.length) {
      toast.error('Select at least one topic or pick a subject with curriculum content');
      return;
    }

    setGeneratingExam(true);
    try {
      const blueprint = buildExamBlueprint({
        subject: subjectName,
        grade: gradeName,
        topics: topicNames,
        title: examTitle || `${subjectName} — ${gradeName} ${selectedTerm} Assessment`,
        totalMarks: examTotalMarks,
        difficulty: examDifficulty,
      });

      // Try AI enrichment of questions
      try {
        const prompt = `You are a Kenyan junior school examiner. Improve this exam JSON for ${subjectName} ${gradeName}.
Keep the same section structure and total marks near ${examTotalMarks}. Difficulty: ${examDifficulty}.
Topics: ${topicNames.join(', ')}.
Return ONLY valid JSON with the same shape (title, instructions, sections, totalMarks).
Draft: ${JSON.stringify(blueprint).slice(0, 6000)}`;
        const raw = await callAI(prompt);
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned) as ExamBlueprint;
        if (parsed?.sections?.length) {
          setExamBlueprint(parsed);
          // Also map into legacy generatedExam format for existing UI
          const flat = parsed.sections.flatMap(s => s.questions.map(q => ({
            question_text: q.text,
            question_type: q.type,
            options: q.options,
            correct_answer: q.answer,
            marks: q.marks,
            difficulty: q.difficulty || examDifficulty,
          })));
          setGeneratedExam(flat);
          toast.success('Exam paper + marking scheme ready (AI + KICD blueprint)!');
        } else {
          throw new Error('bad shape');
        }
      } catch {
        setExamBlueprint(blueprint);
        const flat = blueprint.sections.flatMap(s => s.questions.map(q => ({
          question_text: q.text,
          question_type: q.type,
          options: q.options,
          correct_answer: q.answer,
          marks: q.marks,
          difficulty: q.difficulty || examDifficulty,
        })));
        setGeneratedExam(flat);
        toast.success('Exam paper + marking scheme generated from KICD blueprint!');
      }
    } catch (e: any) {
      toast.error('Exam generation failed: ' + (e.message || 'error'));
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

      {/* World-class resource hub */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-1">Zamifu Curriculum Intelligence</p>
            <h2 className="text-lg font-bold">KICD designs · Schemes · Lesson plans · Exam blueprints</h2>
            <p className="text-sm text-blue-100/80 mt-1">
              Built on the official KICD 9-column scheme format and full CBE lesson structure. Open official designs, generate term schemes,
              and download Section A/B/C papers with marking schemes — even offline via the embedded knowledge base.
            </p>
            <p className="text-[11px] text-blue-200/70 mt-2">
              Tip: Use your personal login on schemesofwork.com for paid samples. Zamifu never stores third-party passwords.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateTermScheme}
              disabled={!selectedSubject && !selectedGrade}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Download Term Scheme PDF
            </button>
            <a
              href={gradeDesignUrl(gradeName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20"
            >
              <BookOpen className="w-3.5 h-3.5" /> Open KICD Designs
            </a>
            <a
              href={OFFICIAL_LINKS.schemesOfWorkHome}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20"
            >
              <ClipboardList className="w-3.5 h-3.5" /> schemesofwork.com
            </a>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { t: '9-column schemes', d: 'Week→Reflection KICD layout' },
            { t: 'Full lesson plans', d: `${LESSON_PLAN_SECTIONS.length} CBE sections` },
            { t: 'Exam generator', d: 'MCQ + Structured + Essay' },
            { t: 'Grade 9 areas', d: `${GRADE_NINE_SUBJECTS.length} learning areas` },
          ].map((c) => (
            <div key={c.t} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <p className="text-xs font-semibold text-white">{c.t}</p>
              <p className="text-[11px] text-blue-100/70">{c.d}</p>
            </div>
          ))}
        </div>
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
                        Scheme of Work (KICD 9-Column)
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {scheme && (
                          <button
                            onClick={() => downloadSchemeAsPDF(scheme, selectedTopic, subjectName, gradeName)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Lesson PDF
                          </button>
                        )}
                        <button
                          onClick={generateTermScheme}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Full Term Scheme
                        </button>
                        <button
                          onClick={generateScheme}
                          disabled={generatingScheme}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          {generatingScheme ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {scheme ? 'Regenerate' : 'Generate KICD Scheme'}
                        </button>
                      </div>
                    </div>
                    {!scheme ? (
                      <div className="text-center py-8 text-gray-400">
                        <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Click "Generate with AI" to create a KICD 9-column scheme of work</p>
                        <p className="text-xs mt-2 text-gray-400">Week · Lesson · Strand · Sub-Strand · SLOs · KIQ · Experiences · Resources · Assessment · Reflection</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">Week {scheme.week_number}</span>
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">Lesson {scheme.lesson_number || 1}</span>
                          {scheme.strand && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">Strand: {scheme.strand}</span>}
                          {scheme.sub_strand && <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium">Sub-Strand: {scheme.sub_strand}</span>}
                        </div>
                        {[
                          { label: 'Specific Learning Outcomes (SLOs)', value: scheme.learning_objective },
                          { label: 'Key Inquiry Questions', value: scheme.key_inquiry_questions },
                          { label: 'Learning Experiences', value: scheme.learning_activities },
                          { label: 'Learning Resources', value: scheme.learning_resources },
                          { label: 'Assessment', value: scheme.assessment_methods },
                          { label: 'Reflection (after delivery)', value: scheme.reflection },
                          { label: 'Core Competencies', value: scheme.core_competencies },
                          { label: 'Values', value: scheme.values },
                          { label: 'PCIs', value: scheme.pci },
                        ].filter(row => !!row.value).map(row => (
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
                        Lesson Plan (Full KICD / CBE)
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
                        <p className="text-sm">Generate a full KICD lesson plan (SLOs, KIQ, competencies, PCI, 3-part lesson, assessment, reflection)</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Lesson Objective</p>
                          <p className="text-sm text-gray-800">{lessonPlan.lesson_objective}</p>
                          <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                            <span className="px-2 py-0.5 rounded-full bg-white text-purple-700 border border-purple-100">Duration: {lessonPlan.duration_minutes} min</span>
                            {lessonPlan.strand && <span className="px-2 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-100">Strand: {lessonPlan.strand}</span>}
                            {lessonPlan.sub_strand && <span className="px-2 py-0.5 rounded-full bg-white text-teal-700 border border-teal-100">Sub-strand: {lessonPlan.sub_strand}</span>}
                          </div>
                          {lessonPlan.key_inquiry_question && (
                            <p className="text-xs text-purple-900 mt-2"><span className="font-semibold">KIQ:</span> {lessonPlan.key_inquiry_question}</p>
                          )}
                        </div>
                        {lessonPlan.specific_learning_outcomes && lessonPlan.specific_learning_outcomes.length > 0 && (
                          <div className="rounded-lg p-3 bg-indigo-50">
                            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Specific Learning Outcomes</p>
                            <ul className="space-y-1">
                              {lessonPlan.specific_learning_outcomes.map((s, i) => (
                                <li key={i} className="text-sm text-gray-700">• {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {[
                          { label: 'Organisation of Learning', value: lessonPlan.organization_of_learning, color: 'bg-slate-50 text-slate-600' },
                          { label: 'Introduction', value: lessonPlan.introduction, color: 'bg-blue-50 text-blue-600' },
                          { label: 'Development / Learning Experiences', value: lessonPlan.development, color: 'bg-green-50 text-green-600' },
                          { label: 'Conclusion', value: lessonPlan.conclusion, color: 'bg-orange-50 text-orange-600' },
                          { label: 'Assessment', value: lessonPlan.assessment, color: 'bg-amber-50 text-amber-700' },
                          { label: 'Extended Activities', value: lessonPlan.extended_activities, color: 'bg-cyan-50 text-cyan-700' },
                          { label: 'Homework', value: lessonPlan.homework, color: 'bg-rose-50 text-rose-700' },
                          { label: 'Teacher Self-Evaluation', value: lessonPlan.teacher_self_evaluation, color: 'bg-gray-50 text-gray-600' },
                          { label: 'Reflection', value: lessonPlan.reflection, color: 'bg-violet-50 text-violet-700' },
                        ].filter(s => !!s.value).map(section => (
                          <div key={section.label} className={`rounded-lg p-3 ${section.color.split(' ')[0]}`}>
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${section.color.split(' ')[1]}`}>{section.label}</p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{section.value}</p>
                          </div>
                        ))}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Teaching Aids / Resources</p>
                            <ul className="space-y-1">
                              {(lessonPlan.learning_resources?.length ? lessonPlan.learning_resources : lessonPlan.teaching_aids || []).map((aid, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />{aid}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Competencies · Values · PCIs</p>
                            <ul className="space-y-1">
                              {(lessonPlan.core_competencies || lessonPlan.competency_outcomes || []).map((outcome, i) => (
                                <li key={`c-${i}`} className="text-xs text-gray-700 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />{outcome}
                                </li>
                              ))}
                              {(lessonPlan.values || []).map((v, i) => (
                                <li key={`v-${i}`} className="text-xs text-gray-700">♥ {v}</li>
                              ))}
                              {(lessonPlan.pci || []).map((p, i) => (
                                <li key={`p-${i}`} className="text-xs text-gray-700">◆ {p}</li>
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
                      Teaching Resources & Official Libraries
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                      <a href={OFFICIAL_LINKS.curriculumDesigns} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100/70">
                        <p className="text-sm font-semibold text-blue-900">KICD Curriculum Designs</p>
                        <p className="text-xs text-blue-700/80">All grades · Regular & SNE designs</p>
                      </a>
                      <a href={gradeDesignUrl(gradeName)} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100/70">
                        <p className="text-sm font-semibold text-indigo-900">Designs for {gradeName || 'selected grade'}</p>
                        <p className="text-xs text-indigo-700/80">Opens the matching KICD grade hub</p>
                      </a>
                      <a href={OFFICIAL_LINKS.schemesOfWorkHome} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100/70">
                        <p className="text-sm font-semibold text-emerald-900">schemesofwork.com dashboard</p>
                        <p className="text-xs text-emerald-700/80">Login for paid downloadable samples (your account)</p>
                      </a>
                      <a href={OFFICIAL_LINKS.kenyaEducationCloud} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl border border-amber-100 bg-amber-50 hover:bg-amber-100/70">
                        <p className="text-sm font-semibold text-amber-900">Kenya Education Cloud</p>
                        <p className="text-xs text-amber-800/80">Curriculum-relevant digital content</p>
                      </a>
                    </div>

                    <div className="mb-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Embedded sample paper formats</p>
                      <div className="space-y-2">
                        {SAMPLE_PAPER_LIBRARY.map((p) => (
                          <div key={p.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{p.title}</p>
                              <p className="text-xs text-gray-500">{p.description}</p>
                              <p className="text-[11px] text-blue-600 mt-0.5">{p.format}</p>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
                              onClick={() => {
                                const bp = buildExamBlueprint({
                                  subject: p.subject,
                                  grade: gradeName || 'Junior School',
                                  topics: getStrandPacks(p.subject).flatMap(s => s.subStrands.flatMap(ss => ss.topics)).slice(0, 5),
                                  title: p.title,
                                  totalMarks: 50,
                                  difficulty: examDifficulty,
                                });
                                setExamBlueprint(bp);
                                downloadExamBlueprintPDF(bp, schoolName, p.subject, gradeName || 'Junior School', true);
                                toast.success('Sample paper + marking scheme downloaded');
                              }}
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Knowledge base strands for {subjectName || 'subject'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {getStrandPacks(subjectName || 'Mathematics').map((s) => (
                          <span key={s.strand} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">{s.strand}</span>
                        ))}
                      </div>
                    </div>

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

                    <p className="text-xs text-gray-500 mb-3">
                      Generates a full paper: <strong>Section A</strong> MCQs, <strong>Section B</strong> structured, <strong>Section C</strong> extended response + optional marking scheme.
                      If no topics are ticked, Zamifu uses the embedded KICD strand packs for this subject.
                    </p>
                    <button
                      onClick={generateExam}
                      disabled={generatingExam || !selectedSubject}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 mb-4"
                    >
                      {generatingExam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {generatingExam ? 'Generating Exam...' : 'Generate Full Paper + Marking Scheme'}
                    </button>

                    {/* Generated exam preview */}
                    {generatedExam && (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <p className="text-sm font-semibold text-gray-700">
                            Generated: {generatedExam.length} questions • {generatedExam.reduce((s, q) => s + q.marks, 0)} marks
                            {examBlueprint ? ` · ${examBlueprint.sections.length} sections` : ''}
                          </p>
                          <div className="flex gap-2">
                            {examBlueprint && (
                              <button
                                onClick={() => downloadExamBlueprintPDF(
                                  examBlueprint,
                                  schoolName,
                                  subjectName,
                                  gradeName,
                                  includeMarkingScheme
                                )}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Paper + MS (KICD)
                              </button>
                            )}
                            <button
                              onClick={() => downloadExamAsPDF(
                                generatedExam,
                                examTitle || `${subjectName} Exam - ${selectedTerm} 2026`,
                                schoolName,
                                subjectName,
                                gradeName,
                                examTotalMarks,
                                includeMarkingScheme
                              )}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Classic PDF
                            </button>
                          </div>
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
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Brain className="w-14 h-14 text-blue-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">KICD Curriculum Intelligence</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Select a Grade and Subject above to explore the CBE curriculum tree, generate lesson plans, schemes of work, and AI-powered exams.
            </p>
          </div>
          <KICDDesignUploadPanel schoolId={user?.schoolId || ''} />
        </div>
      )}

      {/* Always available official resources + school uploads */}
      {selectedTopic && (
        <div className="mt-6">
          <KICDDesignUploadPanel schoolId={user?.schoolId || ''} />
        </div>
      )}
    </div>
  );
}

// Issue 20: KICD Curriculum Design Upload Panel
function KICDDesignUploadPanel({ schoolId }: { schoolId: string }) {
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', grade: '', subject: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const { user } = useAuth();

  useEffect(() => { fetchDesigns(); }, []);

  const fetchDesigns = async () => {
    setLoading(true);
    const { data } = await supabaseUntyped.from('kicd_curriculum_designs').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
    setDesigns(data || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !form.description) { toast.error('Please add a file or description'); return; }
    setUploading(true);
    try {
      let fileUrl = null;
      if (file) {
        const { supabase } = await import('@/lib/supabase/client');
        const ext = file.name.split('.').pop();
        const path = `kicd_designs/${schoolId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('school-files').upload(path, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('school-files').getPublicUrl(path);
        fileUrl = publicUrl;
      }
      const { error } = await supabaseUntyped.from('kicd_curriculum_designs').insert({
        school_id: schoolId,
        uploaded_by: user?.id,
        title: form.title,
        grade: form.grade,
        subject: form.subject,
        description: form.description,
        file_url: fileUrl,
        file_type: file ? file.name.split('.').pop() : null,
      });
      if (error) throw error;
      toast.success('Curriculum design uploaded!');
      setShowAdd(false);
      setForm({ title: '', grade: '', subject: '', description: '' });
      setFile(null);
      fetchDesigns();
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this curriculum design?')) return;
    await supabaseUntyped.from('kicd_curriculum_designs').delete().eq('id', id);
    toast.success('Deleted');
    fetchDesigns();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">KICD Curriculum Designs & Official Resources</h3>
            <p className="text-xs text-gray-500">Upload school copies or open official KICD designs and scheme samples</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700">
          <Upload className="w-4 h-4" /> Upload Design
        </button>
      </div>

      {/* Official external resources */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <a
          href="https://kicd.ac.ke/cbc-materials/curriculum-designs/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50/60 hover:bg-blue-50 transition-colors"
        >
          <BookOpen className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">KICD Curriculum Designs</p>
            <p className="text-xs text-blue-700/80">Official CBC/CBE designs for all grades (PP1–Grade 12), including Grade 9 learning areas.</p>
          </div>
        </a>
        <a
          href="https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50 transition-colors"
        >
          <Layers className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">Grade 9 Designs</p>
            <p className="text-xs text-indigo-700/80">Agriculture, English, Mathematics, Integrated Science, Pre-Technical, Social Studies, and more.</p>
          </div>
        </a>
        <a
          href="https://schemesofwork.com/home"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-xl border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50 transition-colors"
        >
          <ClipboardList className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">schemesofwork.com</p>
            <p className="text-xs text-emerald-700/80">Login for downloadable scheme samples and term schemes (use your schemesofwork.com account).</p>
          </div>
        </a>
        <a
          href="https://schemesofwork.com/schemes-of-work-2026"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-xl border border-teal-100 bg-teal-50/60 hover:bg-teal-50 transition-colors"
        >
          <Download className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-teal-900">2026 Schemes Catalogue</p>
            <p className="text-xs text-teal-700/80">Browse grade/subject/term schemes to compare against Zamifu KICD-format exports.</p>
          </div>
        </a>
      </div>

      {showAdd && (
        <form onSubmit={handleUpload} className="border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" required />
            <input placeholder="Grade (e.g. Grade 4)" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <textarea placeholder="Description / notes" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm" accept=".pdf,.doc,.docx,.ppt,.pptx" />
          <div className="flex gap-3">
            <button type="submit" disabled={uploading} className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="border px-5 py-2 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
      ) : designs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No KICD curriculum designs uploaded yet. Upload PDF or document files to share with teachers.</p>
      ) : (
        <div className="grid gap-3">
          {designs.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.title}</p>
                  <p className="text-xs text-gray-500">{[d.grade, d.subject].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {d.file_url && (
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600">
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
