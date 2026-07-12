import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Loader2, Pencil, Save, X, Eye, BookOpen, Filter, Send, Users, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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
  classes: { name: string } | null;
  terms: { name: string; academic_year: string } | null;
}

interface GroupedMarks {
  className: string;
  classId: string;
  subjects: {
    subjectName: string;
    subjectId: string;
    marks: MarkEntry[];
  }[];
}

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

  useEffect(() => {
    fetchMarks();
    fetchExams();
  }, [user?.id]);

  const fetchExams = async () => {
    try {
      const { data } = await supabaseUntyped
        .from('school_exams')
        .select('id, name, type')
        .eq('school_id', user?.schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setExams(data || []);
    } catch (err) {
      console.warn('Could not load exams', err);
    }
  };

  const fetchMarks = async () => {
    setLoading(true);
    try {
      // Get teacher record
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', user?.id)
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
          classes(name),
          terms(name, academic_year)
        `)
        .eq('teacher_id', teacherId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Ensure all marks have valid data - no blank spaces
      const loadedMarks = (marksData || []).map((m: MarkEntry) => ({
        ...m,
        marks: m.marks ?? 0,
        out_of: m.out_of ?? 0,
        percentage: m.percentage ?? 0,
        cbc_sublevel: m.cbc_sublevel || m.cbc_grade || '-',
        status: m.status || 'draft',
      }));
      
      setMarks(loadedMarks);
    } catch (err: any) {
      toast.error('Failed to load marks: ' + err.message);
    }
    setLoading(false);
  };

  const handleSaveEdit = async (markId: string) => {
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
        .eq('id', markId);

      if (error) throw error;
      toast.success('Marks updated successfully');
      setEditingMark(null);
      fetchMarks();
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    }
    setSaving(false);
  };

  const handleSubmitDraft = async (markId: string) => {
    try {
      const { error } = await supabaseUntyped
        .from('results')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', markId);

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
    if (draftMarks.length === 0) {
      toast.info('All marks are already submitted');
      return;
    }

    if (!confirm(`Submit all ${draftMarks.length} draft mark(s) for ${subjectMarks[0].subjects?.name || 'this subject'}?`)) {
      return;
    }

    setSubmittingAll(true);
    try {
      const { error } = await supabaseUntyped
        .from('results')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .in('id', draftMarks.map(m => m.id));

      if (error) throw error;
      toast.success(`Submitted ${draftMarks.length} mark(s) successfully`);
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
    return matchesSearch && matchesClass && matchesSubject && matchesStatus && matchesExam;
  });

  // Group marks by class and subject
  const groupedMarks: GroupedMarks[] = [];
  const classMap = new Map<string, { className: string; subjects: Map<string, { subjectName: string; marks: MarkEntry[] }> }>();
  
  filteredMarks.forEach(m => {
    const classId = m.class_id;
    const subjectId = m.subject_id;
    
    if (!classMap.has(classId)) {
      classMap.set(classId, {
        className: m.classes?.name || 'Unknown Class',
        subjects: new Map(),
      });
    }
    
    const classData = classMap.get(classId)!;
    if (!classData.subjects.has(subjectId)) {
      classData.subjects.set(subjectId, {
        subjectName: m.subjects?.name || 'Unknown Subject',
        marks: [],
      });
    }
    
    classData.subjects.get(subjectId)!.marks.push(m);
  });

  classMap.forEach((value, classId) => {
    const subjects: GroupedMarks['subjects'] = [];
    value.subjects.forEach((subVal, subId) => {
      subjects.push({ subjectName: subVal.subjectName, subjectId: subId, marks: subVal.marks });
    });
    groupedMarks.push({ className: value.className, classId, subjects });
  });

  // Get unique classes and subjects for filters
  const uniqueClasses = [...new Map(marks.map((m: MarkEntry) => [m.class_id, m.classes]).filter(Boolean)).values()];
  const uniqueSubjects = [...new Map(marks.map((m: MarkEntry) => [m.subject_id, m.subjects]).filter(Boolean)).values()];

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
            <option key={c.name} value={c.name === 'Unknown Class' ? '' : c.name}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="">All Subjects</option>
          {uniqueSubjects.map((s: any) => (
            <option key={s.name} value={s.name}>{s.name}</option>
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
                      const subjectDrafts = subject.marks.filter(m => m.status === 'draft');
                      const subjectSubmitted = subject.marks.filter(m => m.status === 'submitted');
                      
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
                              <span className="text-xs text-gray-400">({subject.marks.length} entries)</span>
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
                                  {subject.marks.map((m) => (
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
                                                onClick={() => handleSaveEdit(m.id)}
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
                                          ) : (
                                            <>
                                              {m.status === 'draft' && (
                                                <button
                                                  onClick={() => handleSubmitDraft(m.id)}
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
                                            </>
                                          )}
                                        </div>
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
    </div>
  );
}
