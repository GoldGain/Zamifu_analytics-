import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { FileText, Download, Loader2, BookOpen, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Paper {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  created_at: string;
  classes?: { name: string } | null;
  subjects?: { name: string } | null;
  terms?: { name: string } | null;
}

export default function StudentPapers() {
  const { user } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: student } = await supabaseUntyped
          .from('students')
          .select('id, class_id, school_id')
          .eq('profile_id', user?.id)
          .maybeSingle();

        if (!student) {
          setPapers([]);
          setLoading(false);
          return;
        }

        setStudentClassId(student.class_id);

        // Prefer class-scoped papers; fall back to school papers if class filter yields none
        let query = supabaseUntyped
          .from('papers')
          .select('*, classes(name), subjects(name), terms(name)')
          .eq('school_id', student.school_id)
          .order('created_at', { ascending: false });

        if (student.class_id) {
          query = query.eq('class_id', student.class_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        let rows = data || [];
        if (rows.length === 0 && student.class_id) {
          const { data: schoolPapers } = await supabaseUntyped
            .from('papers')
            .select('*, classes(name), subjects(name), terms(name)')
            .eq('school_id', student.school_id)
            .order('created_at', { ascending: false });
          rows = schoolPapers || [];
        }

        setPapers(rows as Paper[]);
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load papers: ' + (err.message || 'Unknown error'));
        setPapers([]);
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const subjects = Array.from(
    new Set(papers.map((p) => p.subjects?.name).filter(Boolean) as string[])
  );

  const filtered = filterSubject
    ? papers.filter((p) => p.subjects?.name === filterSubject)
    : papers;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Papers</h1>
        <p className="text-sm text-[#666666]">
          Past papers and revision materials shared by your teachers
        </p>
      </div>

      {subjects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          <button
            onClick={() => setFilterSubject('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              !filterSubject ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setFilterSubject(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                filterSubject === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No papers yet</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {studentClassId
              ? 'Your teachers have not uploaded papers for your class yet. Check back later.'
              : 'No class is linked to your profile, so papers cannot be loaded.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((paper) => (
            <div
              key={paper.id}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[#111111] truncate">{paper.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[paper.subjects?.name, paper.classes?.name, paper.terms?.name]
                      .filter(Boolean)
                      .join(' · ') || 'General'}
                  </p>
                </div>
              </div>
              {paper.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{paper.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-xs text-gray-400">
                  {paper.created_at ? new Date(paper.created_at).toLocaleDateString() : ''}
                  {paper.file_type ? ` · ${paper.file_type.toUpperCase()}` : ''}
                </span>
                <a
                  href={paper.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
