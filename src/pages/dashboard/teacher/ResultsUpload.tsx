import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Upload, Download, FileText, Loader2, CheckCircle, AlertCircle, ClipboardEdit, Plus, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { calculateResultGrades, gradeDisplayLabel, getSchoolLevelBand } from '@/lib/grading';

// ─── Pre-populated subjects by curriculum level ───────────────────────────────

const PRE_PRIMARY_SUBJECTS = [
  'Mathematics Activities', 'English language Activities', 'Environment Activities',
  'Creative Arts activities', 'Religious Studies Activities', 'Kiswahili Activities',
];

const PRIMARY_SUBJECTS = [
  'English', 'English Composition', 'English Grammar', 'Kiswahili', 'Kiswahili Insha',
  'Kiswahili Sarufi', 'Mathematics', 'Science and Technology', 'Social Studies',
  'Religious Education', 'Creative Arts', 'Physical and Health Education', 'Indigenous Languages',
];
// Issue 28: Computer Studies only available from Grade 4 onwards
const PRIMARY_SUBJECTS_GRADE4_PLUS = [
  ...PRIMARY_SUBJECTS,
  'Computer Studies',
];

// Junior School: 9 learning areas as per CBE curriculum
const JUNIOR_SUBJECTS = [
  'English', 'Kiswahili', 'Mathematics', 'Integrated Science', 'Social Studies',
  'Creative Arts and Sports', 'Religious Education', 'Pre-Technical and Pre-Career Studies',
  'Community Service Learning',
];

const SENIOR_SUBJECTS = [
  'English', 'Kiswahili', 'Mathematics', 'Biology', 'Chemistry', 'Physics',
  'History', 'Geography', 'Business Studies', 'Agriculture', 'Computer Studies',
  'Home Science', 'Physical Education', 'Religious Education', 'Community Service Learning',
];

const SUBJECTS_ = [
  'English', 'Kiswahili', 'Mathematics', 'Biology', 'Chemistry', 'Physics',
  'History', 'Geography', 'CRE', 'IRE', 'HRE', 'Business Studies',
  'Agriculture', 'Computer Studies',
];

function getPresetSubjectsForBand(band: string, className: string = '', gradeLevel?: number | string | null): string[] {
  if (band === '') return SUBJECTS_;
  if (band === 'senior') return SENIOR_SUBJECTS;
  if (band === 'junior') return JUNIOR_SUBJECTS;
  // Distinguish between PP1/PP2 and Primary
  if (/pp1|pp2|pre.?primary/i.test(className)) {
    return PRE_PRIMARY_SUBJECTS;
  }
  // Issue 28: Computer Studies only from Grade 4 onwards
  const gl = Number(gradeLevel || 0);
  if (gl >= 4) return PRIMARY_SUBJECTS_GRADE4_PLUS;
  return PRIMARY_SUBJECTS; // primary (default)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessedRow {
  student_id: string;
  name: string;
  admission_number: string;
  marks: number;
  out_of: number;
  percentage: number;
  cbcGrade: ReturnType<typeof calculateResultGrades>['cbeGrade'];
  position?: number;
}

interface ManualRow {
  student_id: string;
  name: string;
  admission_number: string;
  marks: string; // string for input control
}

export default function TeacherResultsUpload() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  // Issue 8: Store full assignments to filter subjects per selected class
  const [teacherAssignments, setTeacherAssignments] = useState<{class_id: string; subject_id: string}[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [outOf, setOutOf] = useState(100);

  // Subject selection: 'db' = from DB, 'preset' = from pre-populated list, 'manual' = typed
  const [subjectMode, setSubjectMode] = useState<'db' | 'preset' | 'manual'>('preset');
  const [manualSubjectName, setManualSubjectName] = useState('');
  const [savingManualSubject, setSavingManualSubject] = useState(false);

  // CSV mode
  const [csvData, setCsvData] = useState<ProcessedRow[]>([]);
  const [preview, setPreview] = useState(false);
  // Manual mode
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [manualPreview, setManualPreview] = useState<ProcessedRow[]>([]);
  const [manualPreviewReady, setManualPreviewReady] = useState(false);
  // Shared
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const schoolId = user?.schoolId ?? '';
      const [{ data: c }, { data: s }, { data: t }, { data: ex }] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', schoolId).order('level'),
        supabase.from('subjects').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('terms').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
        (supabase as any).from('school_exams').select('id, name, type, term_id').eq('school_id', schoolId).eq('is_active', true).order('created_at', { ascending: false }),
      ]);
      // Issue 8: Filter classes and subjects to only those assigned to this teacher (per class)
      let filteredClasses = c || [];
      const allSubjectsData = s || [];
      try {
        const { data: teacherRec } = await (supabase as any).from('teachers').select('id').eq('profile_id', user?.id).maybeSingle();
        if (teacherRec?.id) {
          const { data: assignments } = await (supabase as any)
            .from('teacher_subject_assignments')
            .select('class_id, subject_id')
            .eq('teacher_id', teacherRec.id);
          if (assignments && assignments.length > 0) {
            const assignedClassIds = [...new Set(assignments.map((a: any) => a.class_id).filter(Boolean))];
            if (assignedClassIds.length > 0) filteredClasses = (c || []).filter((cls: any) => assignedClassIds.includes(cls.id));
            // Store full assignments for per-class subject filtering
            setTeacherAssignments(assignments);
          }
        }
      } catch (assignErr) { console.warn('Could not filter teacher assignments:', assignErr); }
      setClasses(filteredClasses);
      setAllSubjects(allSubjectsData);
      // Initially show no subjects until a class is selected
      setSubjects([]);
      setExams(ex || []);

      // Auto-create default terms if none exist
      let termsData = t || [];
      if (termsData.length === 0 && schoolId) {
        const currentYear = new Date().getFullYear();
        const defaultTerms = [
          { school_id: schoolId, name: 'Term 1', term_number: 1, academic_year: String(currentYear), start_date: `${currentYear}-01-01`, end_date: `${currentYear}-04-15`, is_active: true },
          { school_id: schoolId, name: 'Term 2', term_number: 2, academic_year: String(currentYear), start_date: `${currentYear}-05-01`, end_date: `${currentYear}-08-15`, is_active: false },
          { school_id: schoolId, name: 'Term 3', term_number: 3, academic_year: String(currentYear), start_date: `${currentYear}-09-01`, end_date: `${currentYear}-12-15`, is_active: false },
        ];
        const { data: insertedTerms, error: insertError } = await supabase.from('terms').insert(defaultTerms).select('*');
        if (!insertError && insertedTerms) {
          termsData = insertedTerms;
          toast.success('Default terms (Term 1, Term 2, Term 3) created automatically');
        }
      }
      setTerms(termsData);
    };
    fetchData();
  }, [user?.schoolId]);

  useEffect(() => {
    if (!selectedClass) return;
    const fetchStudents = async () => {
      const { data } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('class_id', selectedClass)
        .eq('is_active', true)
        .order('first_name');
      const studs = data || [];
      setStudents(studs);
      setManualRows(studs.map((s: any) => ({
        student_id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        admission_number: s.admission_number,
        marks: '',
      })));
      setManualPreviewReady(false);
      setManualPreview([]);
    };
    fetchStudents();
    // Reset subject selection when class changes
    setSelectedSubject('');
    setManualSubjectName('');
    // Issue 8: Filter subjects to only those assigned to this teacher FOR THIS CLASS
    if (selectedClass && teacherAssignments.length > 0) {
      const classSubjectIds = teacherAssignments
        .filter((a) => a.class_id === selectedClass)
        .map((a) => a.subject_id)
        .filter(Boolean);
      if (classSubjectIds.length > 0) {
        setSubjects(allSubjects.filter((sub: any) => classSubjectIds.includes(sub.id)));
      } else {
        // No specific assignments for this class — show all school subjects as fallback
        setSubjects(allSubjects);
      }
    } else if (allSubjects.length > 0) {
      setSubjects(allSubjects);
    }
  }, [selectedClass, teacherAssignments, allSubjects]);

  // ── Derived: current class data & band ──────────────────────────────────────
  const currentClassData = classes.find((c: any) => c.id === selectedClass);
  const currentBand = getSchoolLevelBand(currentClassData);
  const currentGradeLabel = gradeDisplayLabel(currentBand);
  const presetSubjects = getPresetSubjectsForBand(currentBand, currentClassData?.name || '', currentClassData?.grade_level ?? currentClassData?.level); // Issue 28

  // DB subjects filtered to match the class curriculum
  const dbSubjectsFiltered = subjects.filter((s: any) => {
    if (!currentClassData) return true;
    if (currentBand === '') return s.curriculum === '';
    return s.curriculum === 'CBE';
  });

  // ── Resolve the effective subject name & id for submission ───────────────────
  const getEffectiveSubjectId = () => {
    if (subjectMode === 'db') return selectedSubject;
    return selectedSubject; // preset also stores the DB id after save
  };

  // Save a manually-typed subject to DB and select it
  const saveManualSubject = async () => {
    if (!manualSubjectName.trim()) { toast.error('Enter a learning area name'); return; }
    setSavingManualSubject(true);
    // Check if already exists
    const existing = subjects.find(s => s.name.toLowerCase() === manualSubjectName.trim().toLowerCase() && s.curriculum === (currentBand === '' ? '' : 'CBE'));
    if (existing) {
      setSelectedSubject(existing.id);
      toast.info(`"${existing.name}" already exists — selected!`);
      setSavingManualSubject(false);
      return;
    }
    const { data, error } = await supabaseUntyped.from('subjects').insert([{
      school_id: user?.schoolId,
      name: manualSubjectName.trim(),
      curriculum: currentBand === '' ? '' : 'CBE',
      class_levels: [],
    }]).select('*').single();
    if (error) {
      toast.error('Failed to save learning area: ' + error.message);
    } else {
      toast.success(`Learning Area "${data.name}" saved and selected!`);
      setSubjects(prev => [...prev, data]);
      setSelectedSubject(data.id);
      setManualSubjectName('');
      setSubjectMode('preset');
    }
    setSavingManualSubject(false);
  };

  // When a preset subject name or ID is selected, find or create its DB record
  const handlePresetSubjectSelect = async (value: string) => {
    if (!value) { setSelectedSubject(''); return; }
    
    // Check if value is already a UUID (from DB subjects list)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (isUUID) {
      setSelectedSubject(value);
      return;
    }

    // Otherwise it's a preset name, try to find in DB
    const existing = subjects.find(s => s.name.toLowerCase() === value.toLowerCase() && s.curriculum === (currentBand === '' ? '' : 'CBE'));
    if (existing) {
      setSelectedSubject(existing.id);
      return;
    }
    
    // Auto-create in DB so results can be linked
    const { data, error } = await supabaseUntyped.from('subjects').insert([{
      school_id: user?.schoolId,
      name: value.trim(),
      curriculum: currentBand === '' ? '' : 'CBE',
      class_levels: [],
    }]).select('*').single();
    
    if (error) {
      toast.error('Could not auto-create subject: ' + error.message);
    } else {
      setSubjects(prev => [...prev, data]);
      setSelectedSubject(data.id);
    }
  };

  // ── Manual Entry helpers ─────────────────────────────────────────────────────
  const updateManualMark = (idx: number, value: string) => {
    // Issue 24: Prevent marks above max
    const numVal = parseFloat(value);
    if (value !== '' && !isNaN(numVal) && numVal > outOf) {
      toast.error(`Mark cannot exceed maximum of ${outOf}`);
      return;
    }
    setManualRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], marks: value };
      return updated;
    });
    setManualPreviewReady(false);
  };

  // Issue 23: Excel-like keyboard navigation for marks cells
  const handleMarkKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    const total = manualRows.length;
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextIdx = (idx + 1) % total;
      const nextInput = document.querySelector<HTMLInputElement>(`[data-mark-idx="${nextIdx}"]`);
      nextInput?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (idx - 1 + total) % total;
      const prevInput = document.querySelector<HTMLInputElement>(`[data-mark-idx="${prevIdx}"]`);
      prevInput?.focus();
    } else if (e.key === 'Tab') {
      const nextIdx = e.shiftKey ? (idx - 1 + total) % total : (idx + 1) % total;
      const nextInput = document.querySelector<HTMLInputElement>(`[data-mark-idx="${nextIdx}"]`);
      if (nextInput) { e.preventDefault(); nextInput.focus(); }
    }
  };

  const calculateManualGrades = () => {
    const filled = manualRows.filter(r => r.marks !== '' && !isNaN(parseFloat(r.marks)));
    if (filled.length === 0) { toast.error('Please enter marks for at least one student'); return; }
    const processed: ProcessedRow[] = filled.map(r => {
      const marks = parseFloat(r.marks);
      const percentage = Math.round((marks / outOf) * 100);
      const grades = calculateResultGrades(percentage, currentClassData);
      return {
        student_id: r.student_id,
        name: r.name,
        admission_number: r.admission_number,
        marks,
        out_of: outOf,
        percentage,
        cbcGrade: grades.cbeGrade,
      };
    });
    const sorted = [...processed].sort((a, b) => b.percentage - a.percentage);
    sorted.forEach((row, i) => { row.position = i + 1; });
    setManualPreview(sorted);
    setManualPreviewReady(true);
    toast.success(`Grades calculated for ${sorted.length} students!`);
  };

  // ── Download helpers ─────────────────────────────────────────────────────────
  const getMainGrade = (row: ProcessedRow) => row.cbcGrade.subLevel;
  const getMainPoints = (row: ProcessedRow) => row.cbcGrade.points;

  const downloadManualPDF = () => {
    if (!manualPreview.length) return;
    const doc = new jsPDF();
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || 'Subject';
    const className = classes.find(c => c.id === selectedClass)?.name || 'Class';
    const termName = terms.find(t => t.id === selectedTerm)?.name || 'Term';
    doc.setFontSize(16);
    doc.text('Zamifu Analytics - Results Report', 14, 15);
    doc.setFontSize(11);
    doc.text(`Class: ${className} | Learning Area: ${subjectName} | Term: ${termName}`, 14, 25);
    doc.text(`Out of: ${outOf} marks | Date: ${new Date().toLocaleDateString()}`, 14, 32);
    autoTable(doc, {
      startY: 40,
      head: [['Pos', 'Student Name', 'Adm #', 'Marks', 'Out Of', '%', currentGradeLabel, 'Points']],
      body: manualPreview.map(row => [
        row.position, row.name, row.admission_number, row.marks, row.out_of,
        `${row.percentage}%`, getMainGrade(row), getMainPoints(row),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`results_${className}_${subjectName}.pdf`);
  };

  const downloadManualExcel = () => {
    if (!manualPreview.length) return;
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || 'Subject';
    const className = classes.find(c => c.id === selectedClass)?.name || 'Class';
    const ws = XLSX.utils.json_to_sheet(manualPreview.map(row => ({
      Position: row.position,
      'Student Name': row.name,
      'Admission #': row.admission_number,
      Marks: row.marks,
      'Out Of': row.out_of,
      'Percentage (%)': row.percentage,
      [currentGradeLabel]: getMainGrade(row),
      Points: getMainPoints(row),
      Descriptor: row.cbcGrade.descriptor,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `results_${className}_${subjectName}.xlsx`);
  };

  // ── Calculate class mean ────────────────────────────────────────────────────
  const calculateClassMean = (data: ProcessedRow[]): number => {
    if (data.length === 0) return 0;
    const total = data.reduce((sum, r) => sum + r.percentage, 0);
    return Math.round((total / data.length) * 100) / 100;
  };

  // ── Check for duplicate subject entries ──────────────────────────────────────
  const checkDuplicateSubject = async (): Promise<boolean> => {
    if (!selectedClass || !selectedSubject || !selectedTerm) return false;
    try {
      const { data: existing } = await supabaseUntyped
        .from('results')
        .select('id')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term_id', selectedTerm)
        .limit(1);
      return (existing || []).length > 0;
    } catch {
      return false;
    }
  };

  // ── Submit or Save Draft results ────────────────────────────────────────────
  const handleSubmit = async (dataToSubmit: ProcessedRow[], asDraft: boolean = false) => {
    if (!selectedClass || !selectedSubject || !selectedTerm) {
      toast.error('Please select class, learning area, and term');
      return;
    }

    // Check for duplicates (only on submit, not draft)
    if (!asDraft) {
      const isDuplicate = await checkDuplicateSubject();
      if (isDuplicate) {
        toast.error('Marks for this learning area already exist. Please use "Edit" from My Marks page.');
        return;
      }
    }

    setUploading(true);
    setError('');
    try {
      // Get teacher record — create one if not exists (for DoS who may not have a teacher record)
      let { data: teacherData } = await supabaseUntyped.from('teachers').select('id').eq('profile_id', user?.id).single();
      if (!teacherData) {
        // Create teacher record for this user (needed for DoS)
        const { data: newTeacher, error: createError } = await supabaseUntyped.from('teachers').insert({
          profile_id: user?.id,
          school_id: user?.schoolId,
          first_name: user?.firstName || '',
          last_name: user?.lastName || '',
          employee_number: '',
          is_active: true,
        }).select('id').single();
        if (createError) {
          toast.error('Could not create teacher record: ' + createError.message);
          setUploading(false);
          return;
        }
        teacherData = newTeacher;
      }
      const teacherId = teacherData?.id ?? '';
      // Primary (Grades 1-6): cbc_sublevel MUST be null (enum only accepts EE1/ME1 etc.)
      // Primary grades use cbc_grade (EE/ME/AE/BE) with no sub-level and no points.
      const isPrimaryClass = currentBand === 'primary';
      const records = dataToSubmit.map((row) => ({
        school_id: user?.schoolId ?? '',
        student_id: row.student_id,
        class_id: selectedClass,
        subject_id: selectedSubject,
        teacher_id: teacherId,
        term_id: selectedTerm,
        academic_year: new Date().getFullYear().toString(),
        curriculum: currentClassData?.curriculum || 'CBE',
        marks: row.marks,
        out_of: row.out_of,
        percentage: row.percentage,
        converted_marks: row.percentage,
        // For primary: sub-level is null (no EE1/ME1 etc.) and points are null
        cbc_sublevel: isPrimaryClass ? null : (row.cbcGrade.subLevel || null),
        cbc_grade: row.cbcGrade.grade,
        cbc_points: isPrimaryClass ? null : row.cbcGrade.points,
        cbc_descriptor: row.cbcGrade.descriptor,
        grade_844: row.cbcGrade.grade,
        exam_id: selectedExam || null,
        position: row.position,
        status: asDraft ? 'draft' as const : 'submitted' as const,
        submitted_at: new Date().toISOString(),
      }));

      // Use exam_id in conflict key so different assessments don't overwrite each other
      // If exam_id is set, use the exam-specific unique index; otherwise use the no-exam index
      const conflictKey = selectedExam
        ? 'student_id,subject_id,term_id,exam_id'
        : 'student_id,subject_id,term_id';
      const { error: insertError } = await supabaseUntyped.from('results').upsert(records, {
        onConflict: conflictKey,
        ignoreDuplicates: false,
      });
      if (insertError) {
        // Fallback: try insert (handles cases where constraint doesn't exist yet)
        const { error: insertError2 } = await supabaseUntyped.from('results').insert(records);
        if (insertError2) throw new Error(insertError2.message);
      }

      // Recalculate class positions (only on final submit)
      if (!asDraft) {
        try {
          const { data: allResults } = await supabaseUntyped
            .from('results')
            .select('id, student_id, marks, out_of')
            .eq('class_id', selectedClass)
            .eq('term_id', selectedTerm);
          if (allResults && allResults.length > 0) {
            const studentTotals: Record<string, { totalPct: number; count: number }> = {};
            allResults.forEach((r: any) => {
              const pct = r.out_of > 0 ? (r.marks / r.out_of) * 100 : 0;
              if (!studentTotals[r.student_id]) studentTotals[r.student_id] = { totalPct: 0, count: 0 };
              studentTotals[r.student_id].totalPct += pct;
              studentTotals[r.student_id].count += 1;
            });
            const ranked = Object.entries(studentTotals)
              .map(([sid, v]) => ({ student_id: sid, avg: v.totalPct / v.count }))
              .sort((a, b) => b.avg - a.avg);
            for (let i = 0; i < ranked.length; i++) {
              await supabaseUntyped
                .from('results')
                .update({ class_position: i + 1 })
                .eq('student_id', ranked[i].student_id)
                .eq('class_id', selectedClass)
                .eq('term_id', selectedTerm);
            }
          }
        } catch (posErr) {
          console.warn('Position recalculation warning:', posErr);
        }
      }

      setSuccess(true);
      setCsvData([]);
      setPreview(false);
      setManualPreview([]);
      setManualPreviewReady(false);
      setManualRows(prev => prev.map(r => ({ ...r, marks: '' })));
      if (asDraft) {
        toast.success(`${records.length} results saved as draft! You can edit them later.`);
      } else {
        toast.success(`${records.length} results submitted successfully! Class positions recalculated.`);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  // ── CSV helpers ──────────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    if (!students.length) { toast.error('Please select a class first'); return; }
    const rows = students.map(s => ({
      student_id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      admission_number: s.admission_number,
      marks: '',
      out_of: outOf,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_template_${selectedClass}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded!');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const valid = (results.data as any[]).filter((row: any) => row.student_id && row.marks !== '');
        if (!valid.length) { setError('No valid rows found. Ensure marks column is filled.'); return; }
        const processed: ProcessedRow[] = valid.map((row: any) => {
          const marks = parseFloat(row.marks) || 0;
          const rowOutOf = parseFloat(row.out_of) || outOf;
          const percentage = Math.round((marks / rowOutOf) * 100);
          const grades = calculateResultGrades(percentage, currentClassData);
          return {
            student_id: row.student_id,
            name: row.name || '',
            admission_number: row.admission_number || '',
            marks,
            out_of: rowOutOf,
            percentage,
            cbcGrade: grades.cbeGrade,
          };
        });
        const sorted = [...processed].sort((a, b) => b.percentage - a.percentage);
        sorted.forEach((row, i) => { row.position = i + 1; });
        setCsvData(sorted);
        setPreview(true);
      },
    });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || 'Subject';
    const className = classes.find(c => c.id === selectedClass)?.name || 'Class';
    const termName = terms.find(t => t.id === selectedTerm)?.name || 'Term';
    doc.setFontSize(16);
    doc.text('Zamifu Analytics - Results Report', 14, 15);
    doc.setFontSize(11);
    doc.text(`Class: ${className} | Learning Area: ${subjectName} | Term: ${termName}`, 14, 25);
    doc.text(`Out of: ${outOf} marks | Date: ${new Date().toLocaleDateString()}`, 14, 32);
    autoTable(doc, {
      startY: 40,
      head: [['Pos', 'Student Name', 'Adm #', 'Marks', 'Out Of', '%', currentGradeLabel, 'Points']],
      body: csvData.map(row => [
        row.position, row.name, row.admission_number, row.marks, row.out_of,
        `${row.percentage}%`, getMainGrade(row), getMainPoints(row),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`results_${className}_${subjectName}.pdf`);
  };

  const downloadExcel = () => {
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || 'Subject';
    const className = classes.find(c => c.id === selectedClass)?.name || 'Class';
    const ws = XLSX.utils.json_to_sheet(csvData.map(row => ({
      Position: row.position,
      'Student Name': row.name,
      'Admission #': row.admission_number,
      Marks: row.marks,
      'Out Of': row.out_of,
      'Percentage (%)': row.percentage,
      [currentGradeLabel]: getMainGrade(row),
      Points: getMainPoints(row),
      Descriptor: row.cbcGrade.descriptor,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `results_${className}_${subjectName}.xlsx`);
  };

  const gradeColor = (grade: string) => {
    if (grade?.startsWith('EE') || grade === 'A' || grade === 'A-') return 'bg-green-100 text-green-700';
    if (grade?.startsWith('ME') || grade.startsWith('B') || grade === 'C+') return 'bg-blue-100 text-blue-700';
    if (grade?.startsWith('AE') || grade === 'C' || grade === 'C-' || grade.startsWith('D')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  // Band label for display
  const isPP = /pp1|pp2|pre.?primary/i.test(currentClassData?.name || '');
  const bandLabel = currentBand === '' ? ' (Form 3–4)' : currentBand === 'senior' ? 'Senior CBE (Gr 10–12)' : currentBand === 'junior' ? 'Junior CBE (Gr 7–9)' : (isPP ? 'Pre-Primary CBE (PP1–PP2)' : 'Primary CBE (Gr 1–6)');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Upload Results</h1>
        <p className="text-sm text-[#666666]">Enter or upload learner results with automatic Primary CBE, Junior CBE, Senior CBE grading</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Results saved successfully!</span>
          <button onClick={() => setSuccess(false)} className="ml-auto text-green-600 hover:text-green-800 text-sm">Enter More</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Step 1: Select Class, Subject, Term */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4">Step 1: Select Class, Learning Area, Term &amp; Assessment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Class selector */}
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
          >
            <option value="">Select Class</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}{c.stream ? ` (${c.stream})` : ''}</option>
            ))}
          </select>

          {/* Learning Area selector — smart, level-aware */}
          <div className="space-y-1">
            {selectedClass && (
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">{bandLabel}</span>
              </div>
            )}
            {subjectMode !== 'manual' ? (
              <div className="flex gap-2">
                <select
                  value={selectedSubject}
                  onChange={e => handlePresetSubjectSelect(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                  disabled={!selectedClass}
                >
                  <option value="">Select Learning Area</option>
                  {/* Pre-populated subjects for this level */}
                  {selectedClass && (
                    <optgroup label={`Standard ${bandLabel} Learning Areas`}>
                      {presetSubjects.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </optgroup>
                  )}
                  {/* DB subjects already added by admin */}
                  {dbSubjectsFiltered.length > 0 && (
                    <optgroup label="Other School Learning Areas">
                      {dbSubjectsFiltered
                        .filter(s => !presetSubjects.includes(s.name))
                        .map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </optgroup>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => setSubjectMode('manual')}
                  title="Add subject manually"
                  className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Other
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type learning area name…"
                  value={manualSubjectName}
                  onChange={e => setManualSubjectName(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveManualSubject(); } }}
                />
                <button
                  type="button"
                  onClick={saveManualSubject}
                  disabled={savingManualSubject}
                  className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingManualSubject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setSubjectMode('preset'); setManualSubjectName(''); }}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
            {selectedSubject && subjectMode !== 'manual' && (
              <p className="text-xs text-green-600">✓ {subjects.find(s => s.id === selectedSubject)?.name || ''} selected</p>
            )}
          </div>

          {/* Term selector */}
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
          >
            <option value="">Select Term</option>
            {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
          </select>

          {/* Assessment / Exam selector */}
          <select
            value={selectedExam}
            onChange={e => setSelectedExam(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
          >
            <option value="">Select Assessment (optional)</option>
            {exams.filter(ex => !selectedTerm || ex.term_id === selectedTerm || !ex.term_id).map((ex: any) => (
              <option key={ex.id} value={ex.id}>{ex.name} {ex.type ? `(${ex.type})` : ''}</option>
            ))}
          </select>

          {/* Out of */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Out of (max marks)</label>
            <input
              type="number"
              value={outOf}
              onChange={e => setOutOf(parseInt(e.target.value) || 100)}
              min={1}
              max={1000}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="e.g. 30, 50, 100"
            />
          </div>
        </div>
        {students.length > 0 && (
          <p className="text-xs text-green-600 mt-2">{students.length} students found in this class</p>
        )}
      </div>

      {/* Step 2: Choose Entry Method */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'manual' ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-blue-50/50' : 'text-[#666666] hover:text-[#111111]'}`}
          >
            <ClipboardEdit className="w-4 h-4" />
            Manual Entry (Type Marks)
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'csv' ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-blue-50/50' : 'text-[#666666] hover:text-[#111111]'}`}
          >
            <Upload className="w-4 h-4" />
            CSV Upload
          </button>
        </div>

        {/* ── MANUAL ENTRY TAB ── */}
        {activeTab === 'manual' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#111111]">
                {students.length > 0 ? `Enter marks for ${students.length} students (out of ${outOf})` : 'Select a class to load students'}
              </h3>
              {manualPreviewReady && (
                <div className="flex items-center gap-2">
                  <button onClick={downloadManualPDF} className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button onClick={downloadManualExcel} className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">
                    <Download className="w-3 h-3" /> Excel
                  </button>
                </div>
              )}
            </div>

            {students.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#666666]">
                Select a class above to load students for manual mark entry.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">#</th>
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Learner Name</th> {/* Issue 26 */}
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Adm #</th>
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Marks (out of {outOf})</th>
                        {manualPreviewReady && (
                          <>
                            <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">%</th>
                            <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">{currentGradeLabel}</th>
                            <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Points</th>
                            <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Rank</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {manualRows.map((row, idx) => {
                        const previewRow = manualPreview.find(p => p.student_id === row.student_id);
                        return (
                          <tr key={row.student_id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 text-gray-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium">{row.name}</td>
                            <td className="py-2 px-3 text-gray-500">{row.admission_number}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                max={outOf}
                                value={row.marks}
                                onChange={e => updateManualMark(idx, e.target.value)}
                                onKeyDown={e => handleMarkKeyDown(e, idx)}
                                data-mark-idx={idx}
                                placeholder={`0 - ${outOf}`}
                                className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-center"
                                title="Use Arrow Up/Down or Enter to navigate between students"
                              />
                            </td>
                            {manualPreviewReady && previewRow && (
                              <>
                                <td className="py-2 px-3 font-semibold">{previewRow.percentage}%</td>
                                <td className="py-2 px-3">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColor(getMainGrade(previewRow))}`}>
                                    {getMainGrade(previewRow)}
                                  </span>
                                </td>
                                <td className="py-2 px-3">{getMainPoints(previewRow)}</td>
                                <td className="py-2 px-3">
                                  {previewRow.position === 1 && <span className="text-yellow-500 font-bold">🥇 1st</span>}
                                  {previewRow.position === 2 && <span className="text-gray-400 font-bold">🥈 2nd</span>}
                                  {previewRow.position === 3 && <span className="text-orange-400 font-bold">🥉 3rd</span>}
                                  {(previewRow.position || 0) > 3 && <span className="text-gray-500">#{previewRow.position}</span>}
                                </td>
                              </>
                            )}
                            {manualPreviewReady && !previewRow && (
                              <td colSpan={4} className="py-2 px-3 text-xs text-gray-400 italic">No marks entered</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={calculateManualGrades}
                    className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600"
                  >
                    <ClipboardEdit className="w-4 h-4" />
                    Calculate Grades &amp; Preview
                  </button>
                  {manualPreviewReady && (
                    <>
                      {/* Mean Calculation Display */}
                      <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-xl">
                        <span className="text-sm text-blue-700">
                          <strong>Class Mean: {calculateClassMean(manualPreview)}%</strong>
                        </span>
                        <span className="text-xs text-blue-500">
                          ({manualPreview.length} learners)
                        </span>
                      </div>
                      <button
                        onClick={() => handleSubmit(manualPreview, true)}
                        disabled={uploading}
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50 border border-gray-300"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardEdit className="w-4 h-4" />}
                        {uploading ? 'Saving...' : 'Save as Draft'}
                      </button>
                      <button
                        onClick={() => handleSubmit(manualPreview, false)}
                        disabled={uploading}
                        className="flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {uploading ? 'Saving...' : `Submit ${manualPreview.length} Results`}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CSV UPLOAD TAB ── */}
        {activeTab === 'csv' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-[#111111] mb-3">Step 2: Download CSV Template</h3>
              <button
                onClick={downloadTemplate}
                disabled={!students.length}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Download CSV Template ({students.length} students)
              </button>
            </div>

            <div>
              <h3 className="font-semibold text-[#111111] mb-3">Step 3: Upload Filled Template</h3>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#2563EB] transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-[#666666] mb-3">Drag and drop your CSV file here, or click to browse</p>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] cursor-pointer">
                  <FileText className="w-4 h-4" /> Select CSV File
                </label>
              </div>
            </div>

            {preview && csvData.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#111111]">Step 4: Preview &amp; Submit ({csvData.length} students ranked)</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={downloadPDF} className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200"><Download className="w-3 h-3" /> PDF</button>
                    <button onClick={downloadExcel} className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"><Download className="w-3 h-3" /> Excel</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Rank</th>
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Learner</th> {/* Issue 26 */}
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Marks</th>
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Out Of</th>
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">%</th>
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">{currentGradeLabel}</th>
                        <th className="text-left text-xs font-medium text-[#666666] uppercase py-2 px-3">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            {row.position === 1 && <span className="text-yellow-500 font-bold">🥇 1st</span>}
                            {row.position === 2 && <span className="text-gray-400 font-bold">🥈 2nd</span>}
                            {row.position === 3 && <span className="text-orange-400 font-bold">🥉 3rd</span>}
                            {(row.position || 0) > 3 && <span className="text-gray-500">#{row.position}</span>}
                          </td>
                          <td className="py-2 px-3 font-medium">{row.name}</td>
                          <td className="py-2 px-3">{row.marks}</td>
                          <td className="py-2 px-3">{row.out_of}</td>
                          <td className="py-2 px-3 font-semibold">{row.percentage}%</td>
                          <td className="py-2 px-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColor(getMainGrade(row))}`}>{getMainGrade(row)}</span></td>
                          <td className="py-2 px-3">{getMainPoints(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {/* Mean Display */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-xl mr-auto">
                    <span className="text-sm text-blue-700">
                      <strong>Class Mean: {calculateClassMean(csvData)}%</strong>
                    </span>
                    <span className="text-xs text-blue-500">({csvData.length} learners)</span>
                  </div>
                  <button onClick={() => handleSubmit(csvData, true)} disabled={uploading} className="bg-gray-100 text-gray-700 border border-gray-300 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save as Draft'}
                  </button>
                  <button onClick={() => handleSubmit(csvData, false)} disabled={uploading} className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : 'Submit Results'}
                  </button>
                  <button onClick={() => { setCsvData([]); setPreview(false); }} className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
