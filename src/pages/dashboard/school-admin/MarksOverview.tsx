import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Loader2, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { MarksProgress } from '@/components/MarksProgress';

interface ClassInfo {
  id: string;
  name: string;
  level: number;
}

interface Term {
  id: string;
  name: string;
  academic_year: string;
  is_current: boolean;
}

export default function MarksOverview() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  useEffect(() => {
    if (user?.schoolId) fetchData();
  }, [user?.schoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: classesData }, { data: termsData }, { data: examsData }] = await Promise.all([
        (supabase as any)
          .from('classes')
          .select('id, name, level')
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('level'),
        (supabase as any)
          .from('terms')
          .select('id, name, academic_year, is_current')
          .eq('school_id', user?.schoolId)
          .order('academic_year', { ascending: false }),
        (supabase as any)
          .from('school_exams')
          .select('id, name, type')
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);

      setClasses(classesData || []);
      setExams(examsData || []);
      const allTerms = termsData || [];
      setTerms(allTerms);

      // Auto-select current term
      const current = allTerms.find((t: Term) => t.is_current);
      if (current) setSelectedTerm(current.id);
      else if (allTerms.length > 0) setSelectedTerm(allTerms[0].id);
    } catch (err) {
      console.error('MarksOverview error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marks Entry Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor marks entry progress across all classes</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Term</label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a term --</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academic_year}){t.is_current ? ' ✓ Current' : ''}
              </option>
            ))}
          </select>
        </div>
        {exams.length > 0 && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Assessment</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Assessments</option>
              {exams.map((ex: any) => (
                <option key={ex.id} value={ex.id}>{ex.name}{ex.type ? ` (${ex.type})` : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !selectedTerm ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Please select a term to view marks progress</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No classes found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-gray-900">{cls.name}</span>
                </div>
                {expandedClass === cls.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedClass === cls.id && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="pt-4">
                    <MarksProgress
                      classId={cls.id}
                      className={cls.name}
                      termId={selectedTerm}
                      schoolId={user?.schoolId || ''}
                      examId={selectedExam}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
