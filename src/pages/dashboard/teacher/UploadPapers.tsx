import { useState, useEffect } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, FileText, Trash2, Download, Loader2, Plus, X, BookOpen, Calendar, Filter } from 'lucide-react';
import { toast } from 'sonner';

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

export default function UploadPapers() {
  const { user } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    class_id: '',
    subject_id: '',
    term_id: '',
    file: null as File | null,
  });

  useEffect(() => {
    fetchData();
  }, [user?.schoolId]);

  const fetchData = async () => {
    setLoading(true);
    const schoolId = user?.schoolId;
    
    const [{ data: p }, { data: c }, { data: s }, { data: t }] = await Promise.all([
      supabaseUntyped.from('papers').select('*, classes(name), subjects(name), terms(name)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('classes').select('*').eq('school_id', schoolId).eq('is_active', true),
      supabase.from('subjects').select('*').eq('school_id', schoolId),
      supabase.from('terms').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
    ]);
    
    setPapers(p || []);
    setClasses(c || []);
    setSubjects(s || []);
    setTerms(t || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file) {
      toast.error('Please select a file');
      return;
    }
    if (!formData.title || !formData.class_id || !formData.subject_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);
    try {
      // Upload file to Supabase Storage
      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `papers/${user?.schoolId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('school-files')
        .upload(filePath, formData.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('school-files')
        .getPublicUrl(filePath);

      // Save paper record
      const { error: dbError } = await supabaseUntyped.from('papers').insert({
        title: formData.title,
        description: formData.description,
        file_url: publicUrl,
        file_type: fileExt || 'unknown',
        class_id: formData.class_id,
        subject_id: formData.subject_id,
        term_id: formData.term_id || null,
        school_id: user?.schoolId,
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;

      toast.success('Paper uploaded successfully!');
      setShowAdd(false);
      setFormData({ title: '', description: '', class_id: '', subject_id: '', term_id: '', file: null });
      fetchData();
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  const handleDelete = async (paper: Paper) => {
    if (!confirm('Delete this paper?')) return;
    setDeletingId(paper.id);
    try {
      // Delete from storage
      const url = new URL(paper.file_url);
      const pathParts = url.pathname.split('/papers/');
      if (pathParts.length > 1) {
        await supabase.storage.from('school-files').remove([`papers/${pathParts[1]}`]);
      }
      
      // Delete from DB
      const { error } = await supabaseUntyped.from('papers').delete().eq('id', paper.id);
      if (error) throw error;
      
      toast.success('Paper deleted');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
    setDeletingId(null);
  };

  const filteredPapers = papers.filter(p => {
    const matchesClass = filterClass ? p.class_id === filterClass : true;
    const matchesSubject = filterSubject ? p.subject_id === filterSubject : true;
    return matchesClass && matchesSubject;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Upload Papers</h1>
          <p className="text-sm text-[#666666]">Upload exam papers, notes, and resources for learners</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]"
        >
          <Plus className="w-4 h-4" /> Upload Paper
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="text-lg font-semibold mb-4">New Paper Upload</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <input
              placeholder="Paper Title *"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[60px]"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={formData.class_id}
                onChange={e => setFormData({ ...formData, class_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                required
              >
                <option value="">Select Class *</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={formData.subject_id}
                onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
                required
              >
                <option value="">Select Subject *</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                value={formData.term_id}
                onChange={e => setFormData({ ...formData, term_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
              >
                <option value="">Select Term (optional)</option>
                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>)}
              </select>
            </div>
            <input
              type="file"
              onChange={e => setFormData({ ...formData, file: e.target.files?.[0] || null })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png"
              required
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading}
                className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Upload Paper'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="">All Classes</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
          className="px-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="">All Subjects</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Papers List */}
      {loading ? (
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
                <a
                  href={paper.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(paper)}
                  disabled={deletingId === paper.id}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                >
                  {deletingId === paper.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
