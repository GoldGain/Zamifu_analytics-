import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Users, BookOpen } from 'lucide-react';

interface Learner {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  parent_name: string | null;
  parent_phone: string | null;
  class_id: string;
  classes: { name: string } | null;
}

interface ClassGroup {
  classId: string;
  className: string;
  learners: Learner[];
}

export default function TeacherLearners() {
  const { user } = useAuth();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLearners(); }, []);

  const fetchLearners = async () => {
    setLoading(true);
    try {
      // Get teacher record
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (!teacherData) {
        setLearners([]);
        setLoading(false);
        return;
      }

      // Get teacher's class and subject assignments
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('class_id, subject_id, classes(name), subjects(name)')
        .eq('teacher_id', teacherData.id);

      setTeacherAssignments(assignments || []);

      // Get unique class IDs assigned to this teacher
      const assignedClassIds = [...new Set((assignments || []).map((a: any) => a.class_id).filter(Boolean))];

      if (assignedClassIds.length === 0) {
        // If no assignments, fetch all learners in school as fallback
        const { data } = await supabaseUntyped
          .from('students')
          .select('*, classes(name)')
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('first_name');
        setLearners(data || []);
      } else {
        // Only fetch learners from assigned classes
        const { data } = await supabaseUntyped
          .from('students')
          .select('*, classes(name)')
          .in('class_id', assignedClassIds)
          .eq('is_active', true)
          .order('first_name');
        setLearners(data || []);
      }
    } catch (err) {
      console.error('Error fetching learners:', err);
      // Fallback: fetch all learners
      const { data } = await supabaseUntyped
        .from('students')
        .select('*, classes(name)')
        .eq('school_id', user?.schoolId)
        .eq('is_active', true)
        .order('first_name');
      setLearners(data || []);
    }
    setLoading(false);
  };

  const filtered = learners.filter(s =>
    s.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.last_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(search.toLowerCase())
  );

  // Group learners by class
  const groupedByClass: ClassGroup[] = Object.values(
    filtered.reduce((acc: Record<string, ClassGroup>, learner) => {
      const cid = learner.class_id || 'unassigned';
      if (!acc[cid]) {
        acc[cid] = {
          classId: cid,
          className: learner.classes?.name || 'Unassigned',
          learners: [],
        };
      }
      acc[cid].learners.push(learner);
      return acc;
    }, {})
  );

  // Sort by class name
  groupedByClass.sort((a, b) => a.className.localeCompare(b.className));

  // Get subjects per class for display
  const getSubjectsForClass = (classId: string) => {
    const subs = teacherAssignments
      .filter((a: any) => a.class_id === classId && a.subjects?.name)
      .map((a: any) => a.subjects.name);
    return [...new Set(subs)];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Learners</h1>
        <p className="text-sm text-[#666666]">{learners.length} active learners across {groupedByClass.length} classes</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search learners by name or admission number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]"
        />
      </div>

      {/* Class columns layout */}
      {loading ? (
        <div className="text-center py-8 text-sm text-[#666666]">Loading...</div>
      ) : groupedByClass.length === 0 ? (
        <div className="text-center py-8 text-sm text-[#666666] bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          No learners found
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByClass.map(group => {
            const subjects = getSubjectsForClass(group.classId);
            return (
              <div key={group.classId} className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
                {/* Class Header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[#111111]">{group.className}</h2>
                      <p className="text-xs text-[#666666]">{group.learners.length} learners</p>
                    </div>
                  </div>
                  {subjects.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap justify-end max-w-md">
                      <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {subjects.map((sub, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                          {sub}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Learner grid for this class */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.learners.map(learner => (
                    <div key={learner.id} className="bg-gray-50 rounded-xl p-4 hover:bg-blue-50 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                          {learner.first_name[0]}{learner.last_name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#111111] text-sm truncate">{learner.first_name} {learner.last_name}</p>
                          <p className="text-xs text-[#666666]">{learner.admission_number}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-[#666666]">
                        <p>Gender: <span className="font-medium capitalize">{learner.gender || '—'}</span></p>
                        {learner.parent_name && <p>Parent: <span className="font-medium">{learner.parent_name}</span></p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
