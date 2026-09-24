import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Loader2, Pencil, Save, X, Eye, BookOpen, Filter, Send, Users, ChevronDown, ChevronUp, CheckCircle, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { AddMarksModal, type AddMarksTarget } from '@/components/AddMarksModal';
import { formatClassStream } from '@/lib/class-label';
import { calculateCompetencyGrade, getSchoolLevelBand } from '@/lib/grading';

interface MarkEntry {
  id: string;
  student_id: string;
  subject_id: string;
  class_id: string;
  term_id: string;
  exam_id: string | null;
  marks: number;
  out_of: number;
  percentage: number;
  cbc_sublevel: string | null;
  cbc_grade: string;
  cbc_points: number | null;
  status: 'draft' | 'submitted';
  submitted_at: string;
  students: { first_name: string; last_name: string; admission_number: string } | null;
  subjects: { name: string } | null;
  classes: { name: string; stream?: string | null; stream_name?: string | null } | null;
  terms: { name: string; academic_year: string } | null;
}

interface MissingStudent {
  student_id: string;
  name: string;
  admission_number: string;
}

interface GroupedMarks {
  className: string;
  classId: string;
  subjects: {
    subjectName: string;
    subjectId: string;
    marks: MarkEntry[];
    missing: MissingStudent[];
  }[];
}

const markScopeKey = (mark: Pick<MarkEntry, 'student_id' | 'class_id' | 'subject_id' | 'term_id' | 'exam_id'>): string =>
  [mark.student_id, mark.class_id, mark.subject_id, mark.term_id, mark.exam_id || '__no_exam__'].map(String).join('|');

/** Keep the newest row for one exact assessment scope so one entry is never
 * counted as both submitted and draft. Different exams and terms remain distinct. */
const canonicalizeMarks = (rows: MarkEntry[]): MarkEntry[] => {
  const unique = new Map<string, MarkEntry>();
  rows.forEach((row) => {
    const key = markScopeKey(row);
    if (!unique.has(key)) unique.set(key, row);
  });
  return [...unique.values()];
};

const compareAdmissionNumber = (a: { students?: { admission_number?: string | null } | null }, b: { students?: { admission_number?: string | null } | null }): number =>
  String(a.students?.admission_number || '').localeCompare(String(b.students?.admission_number || ''), undefined, { numeric: true, sensitivity: 'base' });

export default function ViewMarks() {
  const { user } = useAuth();
  const [marks, setMarks] = useState<MarkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'submitted'>('all');
  const [editingMark, setEditingMark] = useState<string | null>(null);
  const [editMarks, setEditMarks] = useState('');
  const [editOutOf, setEditOutOf] = useState('');
  const [saving, setSaving] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [filterExam, setFilterExam] = useState<string>('');
  const [exams, setExams] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [classRoster, setClassRoster] = useState<Record<string, any[]>>({});
  const [terms, setTerms] = useState<any[]>([]);
  const [filterTerm, setFilterTerm] = useState('');
  const [addingMarks, setAddingMarks] = useState<AddMarksTarget | null>(null);

  useEffect(() => {
    fetchMarks();
    fetchExams();
  }, [user?.id]);

  const fetchExams = async () => {
    try {
      const { data } = await supabaseUntyped
        .from('school_exams')
        .select('id, name, type, is_active')
        .eq('school_id', user?.schoolId)
        .order('created_at', { ascending: false });
      setExams(data || []);
    } catch (err) {
      console.warn('Could not load exams', err);
    }
    try {
      const { data: termsData } = await supabaseUntyped.from('terms').select('id, name, academic_year, is_current').eq('school_id', user?.schoolId).order('academic_year', { ascending: false });
      setTerms(termsData || []);
      const current = (termsData || []).find((t: any) => t.is_current);
      if (current) setFilterTerm(current.id);
      else if ((termsData || []).length > 0) setFilterTerm((termsData as any[])[0].id);
    } catch (err) {
      console.warn('Could not load terms', err);
    }
  };

  // Assessments that are NOT active are view-only: their historical marks stay
  // saved and visible but are locked from editing, submitting, or deleting.
  const inactiveExamIds = new Set((exams || []).filter((e: any) => !e.is_active).map((e: any) => e.id));
  const isMarkLocked = (m: MarkEntry) => !!m.exam_id && inactiveExamIds.has(m.exam_id);

  const fetchMarks = async () => {
    setLoading(true);
    if (!user?.id || !user?.schoolId) {
      setLoading(false);
      return;
    }
    try {
      // Get teacher record
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', user?.id)
        .eq('school_id', user?.schoolId)
        .single();

      const teacherId = teacherData?.id;
      if (!teacherId) {
        setLoading(false);
        return;
      }

      // Fetch marks with related data - include ALL fields to avoid blank spaces
      const { data: marksData, error } = await supabaseUntyped
        .from('results')
        .select(`
          *,
          students(first_name, last_name, admission_number),
          subjects(name),
          classes(name, stream, stream_name),
          terms(name, academic_year)
        `)
        .eq('teacher_id', teacherId)
        .eq('school_id', user?.schoolId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Ensure all marks have valid data - no blank spaces
      const loadedMarks = canonicalizeMarks((marksData || []) as MarkEntry[]).map((m: MarkEntry) => ({
        ...m,
        marks: m.marks ?? 0,
        out_of: m.out_of ?? 0,
        percentage: m.percentage ?? 0,
        cbc_sublevel: m.cbc_sublevel || m.cbc_grade || '-',
        status: m.status || 'draft',
      }));
      
      setMarks(loadedMarks);

      // Load the teacher's class/subject assignments so subjects with no marks
      // still render, and load the full class roster so unmarked learners show
      // a "Missing" status instead of being omitted entirely.
      const { data: assignmentsData } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('class_id, subject_id, subjects(name), classes(name, stream, stream_name)')
        .eq('teacher_id', teacherId)
        .eq('school_id', user?.schoolId)
        .eq('is_active', true);
      setTeacherAssignments(assignmentsData || []);

      const classIds = Array.from(new Set((assignmentsData || []).map((a: any) => a.class_id).filter(Boolean)));
      if (classIds.length > 0) {
        const { data: studentsData } = await supabaseUntyped
          .from('students')
          .select('id, class_id, first_name, last_name, admission_number')
          .in('class_id', classIds)
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('admission_number');
        const roster: Record<string, any[]> = {};
        (studentsData || []).forEach((stu: any) => {
          if (!roster[stu.class_id]) roster[stu.class_id] = [];
          roster[stu.class_id].push(stu);
        });
        setClassRoster(roster);
      }
    } catch (err: any) {
      toast.error('Failed to load marks: ' + err.message);
    }
    setLoading(false);
  };

  const handleSaveEdit = async (mark: MarkEntry) => {
    if (isMarkLocked(mark)) {
      toast.error('This assessment is inactive. Marks cannot be entered. Ask the admin to activate it.');
      return;
    }
    if (!editMarks || !editOutOf) {
      toast.error('Please enter marks and out of');
      return;
    }
    const marksVal = parseFloat(editMarks);
    const outOfVal = parseFloat(editOutOf);
    if (marksVal > outOfVal) {
      toast.error('Marks cannot exceed out of');
      return;
    }

    setSaving(true);
    try {
      const percentage = Math.round((marksVal / outOfVal) * 100);
      const { error } = await supabaseUntyped
        .from('results')
        .update({
          marks: marksVal,
          out_of: outOfVal,
          percentage: percentage,
          status: 'draft',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', mark.id)
        .eq('school_id', user.schoolId);

      if (error) throw error;
      toast.success('Marks updated successfully');
      setEditingMark(null);
      fetchMarks();
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    }
    setSaving(false);
  };

  const handleSubmitDraft = async (mark: MarkEntry) => {
    if (isMarkLocked(mark)) {
      toast.error('This assessment is inactive. Marks cannot be entered. Ask the admin to activate it.');
      return;
    }
    try {
      const { error } = await supabaseUntyped
        .from('results')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', mark.id)
        .eq('school_id', user?.schoolId);

      if (error) throw error;
      toast.success('Marks submitted successfully');
      fetchMarks();
    } catch (err: any) {
      toast.error('Failed to submit: ' + err.message);
    }
  };

  const handleSubmitWholeClass = async (subjectMarks: MarkEntry[]) => {
    if (!subjectMarks.length) return;
    
    const draftMarks = subjectMarks.filter(m => m.status === 'draft');
    const lockedMarks = draftMarks.filter(isMarkLocked);
    const editableMarks = draftMarks.filter(m => !isMarkLocked(m));
    if (lockedMarks.length > 0) {
      toast.error('Some marks belong to an inactive assessment and are locked from editing. Ask the admin to activate it to submit them.');
      if (editableMarks.length === 0) return;
    }
    if (editableMarks.length === 0) {
      toast.info('All marks are already submitted');
      return;
    }

    if (!confirm(`Submit all ${editableMarks.length} draft mark(s) for ${subjectMarks[0].subjects?.name || 'this subject'}?`)) {
      return;
    }

    setSubmittingAll(true);
    try {
      const { error } = await supabaseUntyped
        .from('results')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .in('id', editableMarks.map(m => m.id))
        .eq('school_id', user?.schoolId);

      if (error) throw error;
      toast.success(`Submitted ${editableMarks.length} mark(s) successfully`);
      fetchMarks();
    } catch (err: any) {
      toast.error('Failed to submit: ' + err.message);
    }
    setSubmittingAll(false);
  };

  const openEdit = (mark: MarkEntry) => {
    setEditingMark(mark.id);
    setEditMarks(String(mark.marks));
    setEditOutOf(String(mark.out_of));
  };

  const handleDeleteMark = async (mark: MarkEntry) => {
    if (isMarkLocked(mark)) {
      toast.error('This assessment is inactive and its marks are locked. Ask the admin to activate it to edit them.');
      return;
    }
    if (!confirm('Delete this mark? This cannot be undone.')) return;
    try {
      const { error } = await supabaseUntyped
        .from('results')
        .delete()
        .eq('id', mark.id)
        .eq('school_id', user?.schoolId);
      if (error) throw error;
      toast.success('Mark deleted');
      fetchMarks();
    } catch (err: any) { toast.error('Failed to delete mark: ' + err.message); }
  };

  const openAddMarks = (missing: MissingStudent, group: GroupedMarks, subject: GroupedMarks['subjects'][number]) => {
    if (!filterTerm) { toast.error('Select a term to add marks'); return; }
    setAddingMarks({
      schoolId: user?.schoolId || '',
      classId: group.classId,
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      termId: filterTerm,
      examId: filterExam || null,
      studentId: missing.student_id,
      studentName: missing.name,
      admissionNumber: missing.admission_number,
    });
  };

  // Filter marks
  const filteredMarks = marks.filter((m) => {
    const studentName = `${m.students?.first_name || ''} ${m.students?.last_name || ''}`.toLowerCase();
    const matchesSearch =
      studentName.includes(search.toLowerCase()) ||
      (m.students?.admission_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.subjects?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesClass = filterClass ? m.class_id === filterClass : true;
    const matchesSubject = filterSubject ? m.subject_id === filterSubject : true;
    const matchesStatus = filterStatus === 'all' ? true : m.status === filterStatus;
    const matchesExam = filterExam ? m.exam_id === filterExam : true;
    const matchesTerm = filterTerm ? m.term_id === filterTerm : true;
    return matchesSearch && matchesClass && matchesSubject && matchesStatus && matchesExam && matchesTerm;
  });

  // Scope missing-learner detection to the selected term and assessment.
  // Either draft or submitted counts as entered; status is intentionally not
  // part of this set.
  const marksForScope = marks.filter((m) =>
    (!filterTerm || m.term_id === filterTerm) &&
    (!filterExam || m.exam_id === filterExam),
  );

  // Group marks by class and subject
  const groupedMarks: GroupedMarks[] = [];
  const classMap = new Map<string, { className: string; subjects: Map<string, { subjectName: string; marks: MarkEntry[]; missing: MissingStudent[] }> }>();
  
  // Seed groups from the teacher's assignments so subjects with zero marks
  // still appear, then attach entered marks and compute missing learners.
  const seeds: Array<{ class_id: string; subject_id: string; className: string; subjectName: string }> =
    teacherAssignments.length > 0
      ? teacherAssignments.map((a: any) => ({
          class_id: a.class_id,
          subject_id: a.subject_id,
          className: formatClassStream(a.classes),
          subjectName: a.subjects?.name || 'Unknown Subject',
        }))
      : marks.map((m) => ({
          class_id: m.class_id,
          subject_id: m.subject_id,
          className: formatClassStream(m.classes),
          subjectName: m.subjects?.name || 'Unknown Subject',
        }));

  seeds.forEach((seed) => {
    if (!classMap.has(seed.class_id)) {
      classMap.set(seed.class_id, { className: seed.className, subjects: new Map() });
    }
    const classData = classMap.get(seed.class_id)!;
    if (!classData.subjects.has(seed.subject_id)) {
      classData.subjects.set(seed.subject_id, { subjectName: seed.subjectName, marks: [], missing: [] });
    }
  });

  filteredMarks.forEach((m) => {
    const classData = classMap.get(m.class_id);
    const subject = classData?.subjects.get(m.subject_id);
    if (subject) subject.marks.push(m);
  });

  classMap.forEach((classData, classId) => {
    const roster = classRoster[classId] || [];
    const enteredBySubject = new Map<string, Set<string>>();
    marksForScope.forEach((m) => {
      if (m.class_id !== classId || !m.student_id) return;
      if (!enteredBySubject.has(m.subject_id)) enteredBySubject.set(m.subject_id, new Set());
      enteredBySubject.get(m.subject_id)!.add(String(m.student_id));
    });

    classData.subjects.forEach((subject, subjectId) => {
      const entered = enteredBySubject.get(subjectId) || new Set<string>();
      subject.missing = roster
        .filter((stu) => !entered.has(String(stu.id)))
        .map((stu) => ({
          student_id: stu.id,
          name: `${stu.first_name || ''} ${stu.last_name || ''}`.trim() || 'Unknown',
          admission_number: stu.admission_number || '-',
        }));
    });

    const subjects: GroupedMarks['subjects'] = [];
    classData.subjects.forEach((subVal, subId) => {
      subjects.push({ subjectName: subVal.subjectName, subjectId: subId, marks: subVal.marks, missing: subVal.missing });
    });
    groupedMarks.push({ className: classData.className, classId, subjects });
  });

  // Get unique classes and subjects for filters
  const uniqueClasses = [...new Map([
    ...teacherAssignments.map((a: any) => [a.class_id, { id: a.class_id, name: formatClassStream(a.classes) }] as const),
    ...marks.map((m: MarkEntry) => [m.class_id, { id: m.class_id, name: formatClassStream(m.classes) }] as const),
  ]).values()];
  const uniqueSubjects = [...new Map([
    ...teacherAssignments.map((a: any) => [a.subject_id, { id: a.subject_id, name: a.subjects?.name || 'Unknown Subject' }] as const),
    ...marks.map((m: MarkEntry) => [m.subject_id, { id: m.subject_id, name: m.subjects?.name || 'Unknown Subject' }] as const),
  ]).values()];

  const gradeColor = (grade: string) => {
    if (!grade) return 'bg-gray-100 text-gray-600';
    if (grade.startsWith('EE')) return 'bg-green-100 text-green-700';
    if (grade.startsWith('ME')) return 'bg-blue-100 text-blue-700';
    if (grade.startsWith('AE')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Entered Marks</h1>
        <p className="text-sm text-[#666666]">View and manage marks grouped by class and subject</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-blue-600">{marks.length}</div>
          <div className="text-xs text-gray-500">Total Entries</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-green-600">{marks.filter(m => m.status === 'submitted').length}</div>
          <div className="text-xs text-gray-500">Submitted</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-orange-600">{marks.filter(m => m.status === 'draft').length}</div>
          <div className="text-xs text-gray-500">Drafts</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-2xl font-bold text-purple-600">{new Set(marks.map(m => m.class_id)).size}</div>
          <div className="text-xs text-gray-500">Classes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search learner or learning area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="">All Classes</option>
          {uniqueClasses.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="">All Subjects</option>
          {uniqueSubjects.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
        </select>
        {terms.length > 0 && (
          <select
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="">All Terms</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>
            ))}
          </select>
        )}
        {exams.length > 0 && (
          <select
            value={filterExam}
            onChange={(e) => setFilterExam(e.target.value)}
            className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="">All Assessments</option>
            {exams.map((ex: any) => (
              <option key={ex.id} value={ex.id}>{ex.name}{ex.type ? ` (${ex.type})` : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Grouped Marks */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
      ) : groupedMarks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <Eye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No marks found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedMarks.map((group) => {
            const isClassExpanded = expandedClass === group.classId;
            const totalMarks = group.subjects.reduce((sum, s) => sum + s.marks.length, 0);
            const submittedMarks = group.subjects.reduce((sum, s) => sum + s.marks.filter(m => m.status === 'submitted').length, 0);
            const draftMarks = totalMarks - submittedMarks;
            
            return (
              <div key={group.classId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Class Header */}
                <button
                  onClick={() => setExpandedClass(isClassExpanded ? null : group.classId)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{group.className}</h3>
                      <p className="text-xs text-gray-500">{group.subjects.length} subject(s) • {totalMarks} mark entries</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full">{submittedMarks} submitted</span>
                      {draftMarks > 0 && (
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-full">{draftMarks} draft</span>
                      )}
                    </div>
                    {isClassExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {/* Subject Groups */}
                {isClassExpanded && (
                  <div className="border-t border-gray-100">
                    {group.subjects.map((subject) => {
                      const isSubjectExpanded = expandedSubject === `${group.classId}-${subject.subjectId}`;
                      const sortedMarks = [...subject.marks].sort(compareAdmissionNumber);
                      const sortedMissing = [...subject.missing].sort((a, b) => String(a.admission_number).localeCompare(String(b.admission_number), undefined, { numeric: true, sensitivity: 'base' }));
                      const subjectDrafts = sortedMarks.filter(m => m.status === 'draft');
                      const subjectSubmitted = sortedMarks.filter(m => m.status === 'submitted');
                      const meanMarks = sortedMarks.length
                        ? sortedMarks.reduce((sum, mark) => sum + Number(mark.percentage ?? (mark.out_of ? (mark.marks / mark.out_of) * 100 : 0)), 0) / sortedMarks.length
                        : null;
                      const subjectBand = getSchoolLevelBand(sortedMarks[0]?.classes || undefined);
                      const meanGrade = meanMarks === null ? '-' : calculateCompetencyGrade(meanMarks, subjectBand).subLevel;
                      
                      return (
                        <div key={subject.subjectId} className="border-b border-gray-50 last:border-0">
                          {/* Subject Header */}
                          <button
                            onClick={() => setExpandedSubject(isSubjectExpanded ? null : `${group.classId}-${subject.subjectId}`)}
                            className="w-full flex items-center justify-between p-4 pl-16 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-blue-500" />
                              <span className="font-medium text-sm text-gray-900">{subject.subjectName}</span>
                              <span className="text-xs text-gray-400">({sortedMarks.length} entries)</span>
                              <span className="ml-2 text-xs font-semibold text-slate-600">Mean Marks: {meanMarks === null ? '-' : `${meanMarks.toFixed(1)} / 100`}</span>
                              <span className="text-xs font-semibold text-blue-700">Mean Grade: {meanGrade}</span>
                              {subject.missing.length > 0 && (
                                <span className="text-xs font-semibold text-red-500">· {subject.missing.length} missing</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {subjectDrafts.length > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSubmitWholeClass(subject.marks); }}
                                  disabled={submittingAll}
                                  className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                  <Send className="w-3 h-3" />
                                  Submit All
                                </button>
                              )}
                              {isSubjectExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                          </button>

                          {/* Marks Table */}
                          {isSubjectExpanded && (
                            <div className="px-4 pb-4 pl-16 overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead>
                                  <tr className="border-b bg-gray-50">
                                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Learner</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Admission #</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Marks</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">%</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedMarks.map((m) => (
                                    <tr key={m.id} className="border-b hover:bg-gray-50">
                                      <td className="px-3 py-2 font-medium">
                                        {m.students?.first_name || 'Unknown'} {m.students?.last_name || ''}
                                      </td>
                                      <td className="px-3 py-2 text-gray-500 text-xs">{m.students?.admission_number || '-'}</td>
                                      <td className="px-3 py-2">
                                        {editingMark === m.id ? (
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="number"
                                              value={editMarks}
                                              onChange={(e) => setEditMarks(e.target.value)}
                                              className="w-16 px-2 py-1 border rounded-lg text-sm"
                                              min={0}
                                            />
                                            <span className="text-gray-400">/</span>
                                            <input
                                              type="number"
                                              value={editOutOf}
                                              onChange={(e) => setEditOutOf(e.target.value)}
                                              className="w-16 px-2 py-1 border rounded-lg text-sm"
                                              min={1}
                                            />
                                          </div>
                                        ) : (
                                          <span className="font-medium">{m.marks ?? 0} / {m.out_of ?? 0}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 font-semibold">{m.percentage ?? 0}%</td>
                                      <td className="px-3 py-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeColor(m.cbc_sublevel || m.cbc_grade || '')}`}>
                                          {m.cbc_sublevel || m.cbc_grade || '-'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                          m.status === 'submitted'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-orange-100 text-orange-700'
                                        }`}>
                                          {m.status === 'submitted' ? 'Submitted' : 'Draft'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                          {editingMark === m.id ? (
                                            <>
                                              <button
                                                onClick={() => handleSaveEdit(m)}
                                                disabled={saving}
                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                                              >
                                                <Save className="w-3 h-3" /> Save
                                              </button>
                                              <button
                                                onClick={() => setEditingMark(null)}
                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100"
                                              >
                                                <X className="w-3 h-3" /> Cancel
                                              </button>
                                            </>
                                          ) : isMarkLocked(m) ? (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 bg-gray-100 text-gray-500 rounded-lg">View only</span>
                                          ) : (
                                            <>
                                              {m.status === 'draft' && (
                                                <button
                                                  onClick={() => handleSubmitDraft(m)}
                                                  className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                                >
                                                  Submit
                                                </button>
                                              )}
                                              <button
                                                onClick={() => openEdit(m)}
                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"
                                              >
                                                <Pencil className="w-3 h-3" /> Edit
                                              </button>
                                              <button
                                                onClick={() => handleDeleteMark(m)}
                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                              >
                                                <Trash2 className="w-3 h-3" /> Delete
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                  {sortedMissing.map((missing) => (
                                    <tr key={`missing-${missing.student_id}`} className="border-b bg-red-50/40">
                                      <td className="px-3 py-2 font-medium text-gray-700">{missing.name}</td>
                                      <td className="px-3 py-2 text-gray-500 text-xs">{missing.admission_number}</td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs font-semibold text-red-500">Not entered</span>
                                      </td>
                                      <td className="px-3 py-2">-</td>
                                      <td className="px-3 py-2">-</td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Missing</span>
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          onClick={() => openAddMarks(missing, group, subject)}
                                          className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                                        >
                                          <Plus className="w-3 h-3" /> Add Marks
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {addingMarks && (
        <AddMarksModal target={addingMarks} onClose={() => setAddingMarks(null)} onSaved={() => fetchMarks()} />
      )}
    </div>
  );
}
