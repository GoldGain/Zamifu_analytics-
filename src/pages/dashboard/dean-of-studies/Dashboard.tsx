import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  GraduationCap, BarChart3, BookOpen, Users, CheckCircle, XCircle,
  Loader2, AlertCircle, Plus, ChevronDown, ChevronUp, Calendar, Trash2, Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { MarksProgress } from '@/components/MarksProgress';

interface ClassInfo {
  id: string;
  name: string;
  level: number;
  student_count?: number;
}

interface Term {
  id: string;
  name: string;
  academic_year: string;
  is_current: boolean;
}

interface Exam {
  id: string;
  name: string;
  type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  terms?: { name: string } | null;
}

const EXAM_TYPES = [
  'Opener', 'Mid Term', 'End Term', 'CAT', 'Mock', 'Pre-Mock',
  'Trial Exam', 'Holiday Assignment', 'Weekly Assessment', 'Revision Test', 'Custom',
];

const defaultExamForm = { name: '', type: 'Custom', term_id: '', start_date: '', end_date: '', weightage: '' };

export default function DeanOfStudiesDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  // Issue 12: Added class_lists and mark_lists tabs to DOS Dashboard
  const [activeTab, setActiveTab] = useState<'overview' | 'assessments' | 'class_lists' | 'mark_lists'>('overview');
  const [classListStudents, setClassListStudents] = useState<Record<string, any[]>>({});
  const [markListData, setMarkListData] = useState<any[]>([]);
  const [selectedMarkClass, setSelectedMarkClass] = useState('');
  const [loadingClassList, setLoadingClassList] = useState(false);
  const [loadingMarkList, setLoadingMarkList] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examForm, setExamForm] = useState(defaultExamForm);
  const [savingExam, setSavingExam] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.schoolId) {
      setSchoolId(user.schoolId);
      fetchData(user.schoolId);
    } else if (user?.id) {
      // DoS may not have schoolId in profile directly — look up via teachers table
      fetchDoSSchool();
    }
  }, [user]);

  const fetchDoSSchool = async () => {
    try {
      // Find the school where this teacher is dean_of_studies
      const { data: teacherData } = await (supabase as any)
        .from('teachers')
        .select('id, school_id')
        .eq('profile_id', user?.id)
        .maybeSingle();

      if (teacherData?.school_id) {
        // Double check if they are actually the DoS
        const { data: schoolData } = await (supabase as any)
          .from('schools')
          .select('dean_of_studies_id')
          .eq('id', teacherData.school_id)
          .maybeSingle();

        // Allow if they are the DoS OR if they have a teacher record for this school
        if (schoolData?.dean_of_studies_id === teacherData.id || teacherData.id) {
          setSchoolId(teacherData.school_id);
          fetchData(teacherData.school_id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchData = async (sid: string) => {
    setLoading(true);
    try {
      const [{ data: classesData }, { data: termsData }, { data: examsData }] = await Promise.all([
        (supabase as any)
          .from('classes')
          .select('id, name, level')
          .eq('school_id', sid)
          .eq('is_active', true)
          .order('level'),
        (supabase as any)
          .from('terms')
          .select('id, name, academic_year, is_current')
          .eq('school_id', sid)
          .order('academic_year', { ascending: false }),
        (supabase as any)
          .from('school_exams')
          .select('*, terms(name)')
          .eq('school_id', sid)
          .order('created_at', { ascending: false }),
      ]);

      // Enrich classes with student counts
      const enrichedClasses = await Promise.all(
        (classesData || []).map(async (cls: ClassInfo) => {
          const { count } = await (supabase as any)
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .eq('is_active', true);
          return { ...cls, student_count: count || 0 };
        })
      );

      setClasses(enrichedClasses);
      const allTerms = termsData || [];
      setTerms(allTerms);
      setExams(examsData || []);

      const current = allTerms.find((t: Term) => t.is_current);
      if (current) setSelectedTerm(current.id);
      else if (allTerms.length > 0) setSelectedTerm(allTerms[0].id);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openCreateExam = () => {
    setEditingExam(null);
    setExamForm(defaultExamForm);
    setShowExamModal(true);
  };

  const openEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setExamForm({
      name: exam.name,
      type: exam.type || 'Custom',
      term_id: '',
      start_date: exam.start_date || '',
      end_date: exam.end_date || '',
      weightage: '',
    });
    setShowExamModal(true);
  };

  const handleSaveExam = async () => {
    if (!examForm.name.trim()) {
      toast.error('Assessment name is required');
      return;
    }
    setSavingExam(true);
    try {
      const payload: any = {
        school_id: schoolId,
        name: examForm.name.trim(),
        type: examForm.type,
        term_id: examForm.term_id || null,
        start_date: examForm.start_date || null,
        end_date: examForm.end_date || null,
        weightage: examForm.weightage ? parseFloat(examForm.weightage) : null,
        is_active: true,
        created_by: user?.id,
      };

      if (editingExam) {
        const { data: updatedData, error } = await (supabase as any).from('school_exams').update(payload).eq('id', editingExam.id).select('*, terms(name)');
        if (error) throw error;
        if (updatedData && updatedData.length > 0) {
          setExams(prev => prev.map(e => e.id === editingExam.id ? updatedData[0] : e));
        }
        toast.success('Assessment updated');
      } else {
        const { data: newData, error } = await (supabase as any).from('school_exams').insert(payload).select('*, terms(name)');
        if (error) throw error;
        // Optimistic update — add to list immediately
        if (newData && newData.length > 0) {
          setExams(prev => [newData[0], ...prev]);
        }
        toast.success('Assessment created');
      }
      setShowExamModal(false);
      if (schoolId) fetchData(schoolId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save assessment');
    } finally {
      setSavingExam(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Delete this assessment?')) return;
    setDeletingExamId(id);
    try {
      const { error } = await (supabase as any).from('school_exams').delete().eq('id', id);
      if (error) throw error;
      toast.success('Assessment deleted');
      if (schoolId) fetchData(schoolId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeletingExamId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Not Assigned as Dean of Studies</h2>
        <p className="text-gray-500 max-w-sm">
          You have not been assigned as Dean of Studies yet. Please ask the School Admin to assign you via "Assign Roles".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dean of Studies Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {classes.length} classes · {classes.reduce((sum, c) => sum + (c.student_count || 0), 0)} learners
          </p>
        </div>
        <select
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.academic_year}){t.is_current ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <BookOpen className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
          <p className="text-xs text-gray-500">Total Classes</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {classes.reduce((sum, c) => sum + (c.student_count || 0), 0)}
          </p>
          <p className="text-xs text-gray-500">Total Learners</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <GraduationCap className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{exams.filter((e) => e.is_active).length}</p>
          <p className="text-xs text-gray-500">Active Assessments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'overview', label: 'Marks Progress', icon: <BarChart3 className="w-4 h-4" /> },
          { key: 'assessments', label: 'Assessments', icon: <BookOpen className="w-4 h-4" /> },
          // Issue 12: Added class lists and mark lists tabs
          { key: 'class_lists', label: 'Class Lists', icon: <Users className="w-4 h-4" /> },
          { key: 'mark_lists', label: 'Mark Lists', icon: <GraduationCap className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Marks Progress Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {!selectedTerm ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
              <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Select a term to view marks progress</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500">No classes found</p>
            </div>
          ) : (
            classes.map((cls) => (
              <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{cls.name}</p>
                      <p className="text-xs text-gray-500">{cls.student_count} learners</p>
                    </div>
                  </div>
                  {expandedClass === cls.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedClass === cls.id && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                    <MarksProgress
                      classId={cls.id}
                      className={cls.name}
                      termId={selectedTerm}
                      schoolId={schoolId}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Assessments Tab */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Assessments</h2>
            <button
              onClick={openCreateExam}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Assessment
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> You can create any assessment with any name — "CAT 1", "Form 4 Trial Exam", "Mock Exams", "Pre-Mock", etc.
            </p>
          </div>

          {exams.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No assessments yet. Create your first one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-3 ${
                    exam.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{exam.name}</h3>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{exam.type}</span>
                        {exam.is_active ? (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Active</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                        )}
                      </div>
                      {exam.start_date && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {exam.start_date}{exam.end_date ? ` – ${exam.end_date}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditExam(exam)}
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      disabled={deletingExamId === exam.id}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                    >
                      {deletingExamId === exam.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Exam Modal */}
      {showExamModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingExam ? 'Edit Assessment' : 'Create New Assessment'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={examForm.name}
                  onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                  placeholder="e.g. Form 4 National Trial Exam, CAT 1, Mock..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={examForm.type}
                  onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term (optional)</label>
                <select
                  value={examForm.term_id}
                  onChange={(e) => setExamForm({ ...examForm, term_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No specific term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={examForm.start_date}
                    onChange={(e) => setExamForm({ ...examForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={examForm.end_date}
                    onChange={(e) => setExamForm({ ...examForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowExamModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExam}
                disabled={savingExam}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingExam ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingExam ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue 12: Class Lists Tab */}
      {activeTab === 'class_lists' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Class Lists</strong> — View all learners in each class. Click a class to expand its student list.
          </div>
          {classes.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No classes found</p>
            </div>
          ) : (
            classes.map((cls) => (
              <ClassListExpander
                key={cls.id}
                cls={cls}
                schoolId={schoolId}
                isExpanded={expandedClass === `cl-${cls.id}`}
                onToggle={() => setExpandedClass(expandedClass === `cl-${cls.id}` ? null : `cl-${cls.id}`)}
              />
            ))
          )}
        </div>
      )}

      {/* Issue 12: Mark Lists Tab */}
      {activeTab === 'mark_lists' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Mark Lists</strong> — View all marks for a class and term.
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedMarkClass}
              onChange={e => setSelectedMarkClass(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select Class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select Term</option>
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>
              ))}
            </select>
          </div>
          {selectedMarkClass && selectedTerm && (
            <MarkListTable classId={selectedMarkClass} termId={selectedTerm} schoolId={schoolId} />
          )}
        </div>
      )}
    </div>
  );
}

// Issue 12: Class List Expander component
function ClassListExpander({ cls, schoolId, isExpanded, onToggle }: { cls: ClassInfo; schoolId: string | null; isExpanded: boolean; onToggle: () => void }) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadStudents = async () => {
    if (loaded || !schoolId) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('students')
        .select('id, first_name, last_name, admission_number, gender')
        .eq('class_id', cls.id)
        .eq('is_active', true)
        .order('first_name');
      setStudents(data || []);
      setLoaded(true);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleToggle = () => {
    if (!isExpanded) loadStudents();
    onToggle();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={handleToggle} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">{cls.name}</p>
            <p className="text-xs text-gray-500">{cls.student_count || 0} learners</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {isExpanded && (
        <div className="border-t border-gray-100 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Adm #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gender</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-gray-500">No learners in this class</td></tr>
                ) : (
                  students.map((s, i) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-600">{s.admission_number || '-'}</td>
                      <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.gender?.toLowerCase() === 'male' ? 'bg-blue-50 text-blue-600' : s.gender?.toLowerCase() === 'female' ? 'bg-pink-50 text-pink-600' : 'bg-gray-50 text-gray-600'}`}>
                          {s.gender || '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// Issue 12: Mark List Table component
function MarkListTable({ classId, termId, schoolId }: { classId: string; termId: string; schoolId: string | null }) {
  const [marks, setMarks] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarks();
  }, [classId, termId]);

  const loadMarks = async () => {
    if (!classId || !termId) return;
    setLoading(true);
    try {
      const [{ data: studentsData }, { data: resultsData }] = await Promise.all([
        (supabase as any).from('students').select('id, first_name, last_name, admission_number').eq('class_id', classId).eq('is_active', true).order('first_name'),
        (supabase as any).from('results').select('student_id, subject_id, marks, out_of, percentage, subjects(name)').eq('class_id', classId).eq('term_id', termId),
      ]);
      setStudents(studentsData || []);
      setMarks(resultsData || []);
      const uniqueSubjects: any[] = [];
      const seenIds = new Set();
      (resultsData || []).forEach((r: any) => {
        if (r.subject_id && !seenIds.has(r.subject_id)) {
          seenIds.add(r.subject_id);
          uniqueSubjects.push({ id: r.subject_id, name: r.subjects?.name || r.subject_id });
        }
      });
      setSubjects(uniqueSubjects);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  if (students.length === 0) return <div className="text-center py-10 text-gray-500">No learners found in this class</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-8 bg-gray-50">Name</th>
            {subjects.map(s => (
              <th key={s.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{s.name}</th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Avg %</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const studentMarks = marks.filter((m: any) => m.student_id === s.id);
            const avg = studentMarks.length > 0 ? Math.round(studentMarks.reduce((sum: number, m: any) => sum + (m.percentage ?? (m.out_of > 0 ? Math.round((m.marks / m.out_of) * 100) : 0)), 0) / studentMarks.length) : null;
            return (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 sticky left-0 bg-white">{i + 1}</td>
                <td className="px-4 py-3 font-medium sticky left-8 bg-white whitespace-nowrap">{s.first_name} {s.last_name}</td>
                {subjects.map(sub => {
                  const mark = studentMarks.find((m: any) => m.subject_id === sub.id);
                  const pct = mark ? (mark.percentage ?? (mark.out_of > 0 ? Math.round((mark.marks / mark.out_of) * 100) : 0)) : null;
                  return (
                    <td key={sub.id} className="px-4 py-3 text-center">
                      {pct !== null ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          pct >= 75 ? 'bg-green-100 text-green-700' :
                          pct >= 50 ? 'bg-blue-100 text-blue-700' :
                          pct >= 30 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>{pct}%</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  {avg !== null ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      avg >= 75 ? 'bg-green-100 text-green-700' :
                      avg >= 50 ? 'bg-blue-100 text-blue-700' :
                      avg >= 30 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{avg}%</span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
