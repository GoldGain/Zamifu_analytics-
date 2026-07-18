import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { BookOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Subject {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
  level: string;
}

interface Assignment {
  id?: string;
  class_id: string;
  subject_id: string;
  lessons_per_week: number;
  is_priority: boolean;
  class_name?: string;
  subject_name?: string;
}

export default function TeacherMySubjects() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    try {
      // Get teacher's school
      const { data: profile } = await supabaseUntyped
        .from('profiles')
        .select('school_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.school_id) {
        toast.error('No school assigned to your account');
        setLoading(false);
        return;
      }

      // Resolve teachers.id then fetch assignments (assignments store teachers.id, not profile id)
      const { data: teacherRec } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', user?.id)
        .maybeSingle();

      let assignmentsData: any[] | null = null;
      if (teacherRec?.id) {
        const res = await supabaseUntyped
          .from('teacher_subject_assignments')
          .select(`
            *,
            classes(name),
            subjects(name)
          `)
          .eq('teacher_id', teacherRec.id);
        assignmentsData = res.data;
      }
      // Legacy fallback: some rows may have used profile_id
      if (!assignmentsData || assignmentsData.length === 0) {
        const res = await supabaseUntyped
          .from('teacher_subject_assignments')
          .select(`
            *,
            classes(name),
            subjects(name)
          `)
          .eq('teacher_id', user?.id);
        assignmentsData = res.data;
      }

      const enrichedAssignments = (assignmentsData || []).map((a: any) => ({
        ...a,
        class_name: a.classes?.name,
        subject_name: a.subjects?.name,
      }));

      setAssignments(enrichedAssignments);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subject assignments');
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Subject Assignments</h1>
        <p className="text-sm text-[#666666]">View the classes and subjects assigned to you by your school admin</p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">View-Only Mode</p>
          <p>Your subject assignments are managed by your school administrator. If you need changes, please contact your school admin.</p>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-bold text-[#111111] mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Your Assignments ({assignments.length})
        </h2>

        {assignments.length === 0 ? (
          <p className="text-[#666666] text-center py-8">No assignments yet. Your school admin will assign you to classes and subjects.</p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium text-[#111111]">{assignment.class_name} - {assignment.subject_name}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-[#666666]">
                    <span>{assignment.lessons_per_week} lessons/week</span>
                    {assignment.is_priority && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        Priority (Morning)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
