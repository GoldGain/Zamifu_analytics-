import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchTeacherAssignments,
  type TeacherAssignment,
} from '@/lib/teacher-restrictions';
import { BookOpen, Upload, AlertCircle, Loader2, GraduationCap } from 'lucide-react';

/**
 * Teacher Results Upload hub — shows ONLY learning areas assigned to this teacher.
 * Upload is only available for those assigned class + subject pairs.
 */
export default function AssignedSubjectsUpload() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { assignments: rows } = await fetchTeacherAssignments(user?.id);
      setAssignments(rows);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  // Group by class
  const byClass = assignments.reduce<Record<string, { className: string; items: TeacherAssignment[] }>>(
    (acc, a) => {
      const key = a.class_id || 'unknown';
      if (!acc[key]) {
        acc[key] = { className: a.class_name || 'Class', items: [] };
      }
      acc[key].items.push(a);
      return acc;
    },
    {}
  );

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
        <h1 className="text-2xl font-bold text-[#111111]">Results Upload — Assigned Learning Areas</h1>
        <p className="text-sm text-[#666666]">
          You can only upload marks for learning areas assigned to you by your school administrator.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium mb-1">Restricted access</p>
          <p>
            Unassigned learning areas are hidden. If something is missing, ask your school admin to assign it
            under Assign Teachers.
          </p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No assignments yet</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Your school admin has not assigned any class or learning area to you. You cannot upload marks until
            assignments are created.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byClass).map(([classId, group]) => (
            <div
              key={classId}
              className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-[#111111]">{group.className}</h2>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {group.items.length} learning area{group.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((item) => (
                  <Link
                    key={`${item.class_id}-${item.subject_id}`}
                    to={`/teacher/results/upload?classId=${encodeURIComponent(item.class_id)}&subjectId=${encodeURIComponent(item.subject_id)}`}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50 to-blue-50/40 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#111111] truncate">{item.subject_name || 'Learning Area'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.class_name}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
