import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Plus, Loader2, Calendar, ChevronDown, ChevronUp, CheckCircle, Clock, Star, Upload, FileText, Trash2, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';

// Issue 17: Upload Papers is now embedded under Homework as a tab

interface Paper {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  class_id: string;
  subject_id: string;
  term_id: string | null;
  created_at: string;
  classes: { name: string } | null;
  subjects: { name: string } | null;
  terms: { name: string } | null;
}

export default function TeacherHomework() {
  const { user } = useAuth();
  // Issue 17: Tab state
  const [activeTab, setActiveTab] = useState<'homework' | 'papers'>('homework');

  // Homework state
  const [homework, setHomework] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expandedHw, setExpandedHw] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
  // Issue 21: Extended grading data with CBE performance level
  const CBE_PERFORMANCE_LEVELS = [
    { value: '', label: 'Select Level' },
    { value: 'EE', label: 'EE - Exceeds Expectation' },
    { value: 'ME', label: 'ME - Meets Expectation' },
    { value: 'AE', label: 'AE - Approaches Expectation' },
    { value: 'BE', label: 'BE - Below Expectation' },
  ];
  const getAutoLevel = (marks: number, outOf: number): string => {
    if (!outOf) return '';
    const pct = (marks / outOf) * 100;
    if (pct >= 80) return 'EE';
    if (pct >= 60) return 'ME';
    if (pct >= 40) return 'AE';
    return 'BE';
  };
  const [gradingData, setGradingData] = useState<Record<string, { marks: string; feedback: string; performanceLevel: string }>>({});
  const [savingGrade, setSavingGrade] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '', description: '', class_id: '', subject_id: '', due_date: ''
  });

  // Papers state
  const [papers, setPapers] = useState<Paper[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [papersLoading, setPapersLoading] = useState(false);
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [paperFormData, setPaperFormData] = useState({
    title: '', description: '', class_id: '', subject_id: '', term_id: '', file: null as File | null,
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const schoolId = user?.schoolId ?? '';
    const [{ data: h }, { data: c }, { data: s }, { data: t }] = await Promise.all([
      supabaseUntyped.from('homework').select('*, classes(name), subjects(name)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('classes').select('*').eq('school_id', schoolId),
      supabase.from('subjects').select('*').eq('school_id', schoolId),
      supabase.from('terms').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
    ]);
    setHomework(h || []);
    setClasses(c || []);
    setSubjects(s || []);
    setTerms(t || []);
    setLoading(false);
  };

  const fetchPapers = async () => {
    setPapersLoading(true);
    const schoolId = user?.schoolId;
    const { data: p } = await supabaseUntyped.from('papers').select('*, classes(name), subjects(name), terms(name)').eq('school_id', schoolId).order('created_at', { ascending: false });
    setPapers(p || []);
    setPapersLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'papers' && papers.length === 0) {
      fetchPapers();
    }
  }, [activeTab]);

  const filteredPapers = papers.filter(p => {
    if (filterClass && p.class_id !== filterClass) return false;
    if (filterSubject && p.subject_id !== filterSubject) return false;
    return true;
  });

  const fetchSubmissions = async (homeworkId: string) => {
    const { data } = await supabaseUntyped
      .from('homework_submissions')
      .select('*, students(first_name, last_name, admission_number)')
      .eq('homework_id', homeworkId)
      .order('submitted_at', { ascending: false });
    setSubmissions(prev => ({ ...prev, [homeworkId]: data || [] }));
  };

  const handleToggleExpand = async (hwId: string) => {
    if (expandedHw === hwId) {
      setExpandedHw(null);
    } else {
      setExpandedHw(hwId);
      if (!submissions[hwId]) {
        await fetchSubmissions(hwId);
      }
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      const { error } = await supabaseUntyped.from('homework').insert([{
        title: formData.title,
        description: formData.description,
        class_id: formData.class_id,
        subject_id: formData.subject_id,
        due_date: formData.due_date,
        school_id: user?.schoolId ?? '',
        teacher_id: teacherData?.id ?? null,
      }]);

      if (error) throw error;
      toast.success('Homework assignment created!');
      setShowAdd(false);
      setFormData({ title: '', description: '', class_id: '', subject_id: '', due_date: '' });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create homework: ' + err.message);
    }
    setAdding(false);
  };

    const handleSaveGrade = async (submissionId: string, homeworkId: string) => {
    const grade = gradingData[submissionId];
    if (!grade?.marks && !grade?.performanceLevel) {
      toast.error('Please enter marks or select a performance level');
      return;
    }
    setSavingGrade(submissionId);
    try {
      const updateData: any = { teacher_feedback: grade.feedback || '', is_graded: true };
      if (grade.marks) updateData.marks_awarded = parseFloat(grade.marks);
      if (grade.performanceLevel) updateData.performance_level = grade.performanceLevel;
      const { error } = await supabaseUntyped.from('homework_submissions').update(updateData).eq('id', submissionId);
      if (error) throw error;
      toast.success('Grade saved!');
      await fetchSubmissions(homeworkId);
    } catch (err: any) {
      toast.error('Failed to save grade: ' + err.message);
    }
    setSavingGrade(null);
  };

  const handleUploadPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperFormData.file) { toast.error('Please select a file'); return; }
    if (!paperFormData.title || !paperFormData.class_id || !paperFormData.subject_id) { toast.error('Please fill in all required fields'); return; }
    setUploading(true);
    try {
      const fileExt = paperFormData.file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `papers/${user?.schoolId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('school-files').upload(filePath, paperFormData.file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('school-files').getPublicUrl(filePath);
      const { error: dbError } = await supabaseUntyped.from('papers').insert({
        title: paperFormData.title,
        description: paperFormData.description || null,
        file_url: publicUrl,
        file_type: fileExt || 'unknown',
        class_id: paperFormData.class_id,
        subject_id: paperFormData.subject_id,
        term_id: paperFormData.term_id || null,
        school_id: user?.schoolId,
      });
      if (dbError) throw dbError;
      toast.success('Paper uploaded successfully!');
      setShowAddPaper(false);
      setPaperFormData({ title: '', description: '', class_id: '', subject_id: '', term_id: '', file: null });
      fetchPapers();
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  const handleDeletePaper = async (paper: Paper) => {
    if (!confirm(`Delete "${paper.title}"?`)) return;
    setDeletingId(paper.id);
    try {
      const { error } = await supabaseUntyped.from('papers').delete().eq('id', paper.id);
      if (error) throw error;
      toast.success('Paper deleted');
      fetchPapers();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Homework &amp; Papers</h1>
          <p className="text-sm text-[#666666]">Manage assignments, grade submissions, and upload papers</p>
        </div>
        {activeTab === 'homework' ? (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]"
          >
            <Plus className="w-4 h-4" /> Add Homework
          </button>
        ) : (
          <button
            onClick={() => setShowAddPaper(!showAddPaper)}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]"
          >
            <Upload className="w-4 h-4" /> Upload Paper
          </button>
        )}
      </div>

      {/* Issue 17: Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('homework')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'homework' ? 'bg-white shadow-sm text-[#111111]' : 'text-gray-500 hover:text-[#111111]'}`}
        >
          <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Homework</span>
        </button>
        <button
          onClick={() => setActiveTab('papers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'papers' ? 'bg-white shadow-sm text-[#111111]' : 'text-gray-500 hover:text-[#111111]'}`}
        >
          <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Papers</span>
        </button>
      </div>

      {/* ── HOMEWORK TAB ── */}
      {activeTab === 'homework' && (
        <>
          {showAdd && (
            <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <h3 className="text-lg font-semibold mb-4">New Assignment</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <input
                  placeholder="Title *"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  required
                />
                <textarea
                  placeholder="Description / Instructions"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[80px]"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={formData.class_id}
                    onChange={e => setFormData({ ...formData, class_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select
                    value={formData.subject_id}
                    onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={adding} className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {adding ? 'Creating...' : 'Add Homework'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-sm text-[#666666]">Loading...</div>
          ) : homework.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#666666] bg-white rounded-2xl">No homework assignments yet</div>
          ) : (
            <div className="space-y-3">
              {homework.map((h: any) => (
                <div key={h.id} className="bg-white rounded-2xl shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)] overflow-hidden">
                  <div className="p-5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleToggleExpand(h.id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-[#111111]">{h.title}</h3>
                          {expandedHw === h.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                        <p className="text-sm text-[#666666] mt-1 line-clamp-1">{h.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-[#666666]">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {h.due_date}</span>
                          <span>{h.classes?.name}</span>
                          <span>{h.subjects?.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedHw === h.id && (
                    <div className="border-t border-gray-100 p-5">
                      <h4 className="text-sm font-semibold text-[#111111] mb-3">Submissions ({(submissions[h.id] || []).length})</h4>
                      {!submissions[h.id] ? (
                        <div className="text-center py-4 text-sm text-[#666666]">Loading submissions...</div>
                      ) : submissions[h.id].length === 0 ? (
                        <div className="text-center py-4 text-sm text-[#666666] bg-gray-50 rounded-xl">No submissions yet</div>
                      ) : (
                        <div className="space-y-4">
                          {submissions[h.id].map((sub: any) => (
                            <div key={sub.id} className="border border-gray-100 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-sm font-medium text-[#111111]">{sub.students?.first_name} {sub.students?.last_name}</p>
                                  <p className="text-xs text-[#666666]">{sub.students?.admission_number}</p>
                                </div>
                                {sub.is_graded ? (
                                  <span className="flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Graded: {sub.marks_awarded}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                    <Clock className="w-3 h-3" /> Submitted
                                  </span>
                                )}
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                <p className="text-sm text-[#333333] whitespace-pre-wrap">{sub.submission_text}</p>
                              </div>
                              {/* Issue 21: Show existing performance level */}
                              {sub.performance_level && (
                                <div className="mb-2">
                                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                                    sub.performance_level === 'EE' ? 'bg-purple-100 text-purple-700' :
                                    sub.performance_level === 'ME' ? 'bg-green-100 text-green-700' :
                                    sub.performance_level === 'AE' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {sub.performance_level}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="number"
                                  placeholder="Marks"
                                  value={gradingData[sub.id]?.marks ?? (sub.marks_awarded ?? '')}
                                  onChange={e => {
                                    const marks = e.target.value;
                                    const autoLevel = marks ? getAutoLevel(parseFloat(marks), h.total_marks || 100) : '';
                                    setGradingData(prev => ({ ...prev, [sub.id]: { marks, feedback: prev[sub.id]?.feedback ?? sub.teacher_feedback ?? '', performanceLevel: prev[sub.id]?.performanceLevel || autoLevel } }));
                                  }}
                                  className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                  min="0"
                                />
                                <select
                                  value={gradingData[sub.id]?.performanceLevel ?? (sub.performance_level ?? '')}
                                  onChange={e => setGradingData(prev => ({ ...prev, [sub.id]: { marks: prev[sub.id]?.marks ?? String(sub.marks_awarded ?? ''), feedback: prev[sub.id]?.feedback ?? sub.teacher_feedback ?? '', performanceLevel: e.target.value } }))}
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                                >
                                  {CBE_PERFORMANCE_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Feedback (optional)"
                                  value={gradingData[sub.id]?.feedback ?? (sub.teacher_feedback ?? '')}
                                  onChange={e => setGradingData(prev => ({ ...prev, [sub.id]: { marks: prev[sub.id]?.marks ?? String(sub.marks_awarded ?? ''), feedback: e.target.value, performanceLevel: prev[sub.id]?.performanceLevel ?? sub.performance_level ?? '' } }))}
                                  className="flex-1 min-w-[160px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                />
                                <button
                                  onClick={() => handleSaveGrade(sub.id, h.id)}
                                  disabled={savingGrade === sub.id}
                                  className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                >
                                  {savingGrade === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                                  {sub.is_graded ? 'Update' : 'Grade'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── PAPERS TAB (Issue 17) ── */}
      {activeTab === 'papers' && (
        <>
          {showAddPaper && (
            <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
              <h3 className="text-lg font-semibold mb-4">Upload New Paper</h3>
              <form onSubmit={handleUploadPaper} className="space-y-4">
                <input placeholder="Title *" value={paperFormData.title} onChange={e => setPaperFormData({ ...paperFormData, title: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />
                <textarea placeholder="Description (optional)" value={paperFormData.description} onChange={e => setPaperFormData({ ...paperFormData, description: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[60px]" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select value={paperFormData.class_id} onChange={e => setPaperFormData({ ...paperFormData, class_id: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white" required>
                    <option value="">Select Class *</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={paperFormData.subject_id} onChange={e => setPaperFormData({ ...paperFormData, subject_id: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white" required>
                    <option value="">Select Subject *</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={paperFormData.term_id} onChange={e => setPaperFormData({ ...paperFormData, term_id: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
                    <option value="">Select Term (optional)</option>
                    {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>)}
                  </select>
                </div>
                <input type="file" onChange={e => setPaperFormData({ ...paperFormData, file: e.target.files?.[0] || null })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png" required />
                <div className="flex gap-3">
                  <button type="submit" disabled={uploading} className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : 'Upload Paper'}
                  </button>
                  <button type="button" onClick={() => setShowAddPaper(false)} className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
              <option value="">All Classes</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
              <option value="">All Subjects</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {papersLoading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
          ) : filteredPapers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No papers uploaded yet</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredPapers.map((paper) => (
                <div key={paper.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{paper.title}</h3>
                      {paper.description && <p className="text-sm text-gray-500 line-clamp-1">{paper.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>{paper.classes?.name}</span>
                        <span>{paper.subjects?.name}</span>
                        {paper.terms?.name && <span>{paper.terms.name}</span>}
                        <span className="uppercase">{paper.file_type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={paper.file_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Download">
                      <Download className="w-4 h-4" />
                    </a>
                    <button onClick={() => handleDeletePaper(paper)} disabled={deletingId === paper.id} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50">
                      {deletingId === paper.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
