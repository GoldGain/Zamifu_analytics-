import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { BookOpen, Calendar, Send, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentHomework() {
  const { user } = useAuth();
  const [homework, setHomework] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitText, setSubmitText] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchHomework(); }, []);

  const fetchHomework = async () => {
    setLoading(true);
    const { data: student } = await supabaseUntyped
      .from('students')
      .select('id, class_id').or('is_active.eq.true,is_active.is.null')
      .eq('profile_id', user?.id)
      .single();

    if (!student?.class_id) { setLoading(false); return; }
    setStudentId(student.id);

    const { data: hw } = await supabaseUntyped
      .from('homework')
      .select('*, subjects(name), teachers(first_name, last_name)')
      .eq('class_id', student.class_id)
      .order('due_date');

    setHomework(hw || []);

    // Fetch existing submissions for this student
    if (hw && hw.length > 0) {
      const hwIds = hw.map((h: any) => h.id);
      const { data: subs } = await supabaseUntyped
        .from('homework_submissions')
        .select('*')
        .eq('student_id', student.id)
        .in('homework_id', hwIds);

      const subsMap: Record<string, any> = {};
      (subs || []).forEach((s: any) => { subsMap[s.homework_id] = s; });
      setSubmissions(subsMap);
    }
    setLoading(false);
  };

  const handleSubmit = async (homeworkId: string) => {
    if (!studentId) return;
    const text = submitText[homeworkId] || '';
    if (!text.trim()) {
      toast.error('Please write your submission before submitting');
      return;
    }
    setSubmitting(homeworkId);
    try {
      const existing = submissions[homeworkId];
      if (existing) {
        const { error } = await supabaseUntyped
          .from('homework_submissions')
          .update({ submission_text: text, submitted_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        toast.success('Submission updated!');
      } else {
        const { error } = await supabaseUntyped
          .from('homework_submissions')
          .insert({
            homework_id: homeworkId,
            student_id: studentId,
            submission_text: text,
            submitted_at: new Date().toISOString(),
            is_graded: false,
          });
        if (error) throw error;
        toast.success('Homework submitted successfully!');
      }
      await fetchHomework();
      setExpandedId(null);
    } catch (err: any) {
      toast.error('Failed to submit: ' + err.message);
    }
    setSubmitting(null);
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  const getStatus = (hwId: string) => {
    const sub = submissions[hwId];
    if (!sub) return 'pending';
    if (sub.is_graded) return 'graded';
    return 'submitted';
  };

  const statusBadge = (hwId: string) => {
    const status = getStatus(hwId);
    if (status === 'graded') return <span className="flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Graded</span>;
    if (status === 'submitted') return <span className="flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Submitted</span>;
    return <span className="flex items-center gap-1 text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full"><Clock className="w-3 h-3" /> Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Homework</h1>
        <p className="text-sm text-[#666666]">View, submit, and track assignments</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-[#666666]">Loading...</div>
      ) : homework.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#666666] bg-white rounded-2xl">No homework assigned yet</div>
      ) : (
        <div className="space-y-3">
          {homework.map(h => {
            const sub = submissions[h.id];
            const status = getStatus(h.id);
            const isExpanded = expandedId === h.id;

            return (
              <div key={h.id} className={`bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] ${isOverdue(h.due_date) && status === 'pending' ? 'border-l-4 border-red-400' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-[#111111]">{h.title}</h3>
                      {statusBadge(h.id)}
                    </div>
                    <p className="text-sm text-[#666666] mt-1">{h.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#666666]">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {h.due_date}</span>
                      <span>{h.subjects?.name}</span>
                      <span>By: {h.teachers?.first_name} {h.teachers?.last_name}</span>
                    </div>

                    {/* Graded feedback */}
                    {status === 'graded' && sub && (
                      <div className="mt-3 p-3 bg-green-50 rounded-xl text-sm">
                        <p className="font-medium text-green-800">Marks: {sub.marks_awarded ?? 'N/A'}</p>
                        {sub.teacher_feedback && <p className="text-green-700 mt-1">Feedback: {sub.teacher_feedback}</p>}
                      </div>
                    )}

                    {/* Submitted text preview */}
                    {status === 'submitted' && sub && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm text-blue-800">
                        <p className="font-medium">Your submission:</p>
                        <p className="mt-1 text-blue-700 line-clamp-2">{sub.submission_text}</p>
                      </div>
                    )}

                    {/* Submit / Edit form */}
                    {status !== 'graded' && (
                      <div className="mt-3">
                        {!isExpanded ? (
                          <button
                            onClick={() => {
                              setExpandedId(h.id);
                              if (sub) setSubmitText(prev => ({ ...prev, [h.id]: sub.submission_text || '' }));
                            }}
                            className="text-sm text-[#2563EB] font-medium hover:underline"
                          >
                            {status === 'submitted' ? 'Edit Submission' : 'Submit Homework'}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <textarea
                              placeholder="Write your answer here..."
                              value={submitText[h.id] || ''}
                              onChange={e => setSubmitText(prev => ({ ...prev, [h.id]: e.target.value }))}
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[100px]"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSubmit(h.id)}
                                disabled={submitting === h.id}
                                className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
                              >
                                {submitting === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {submitting === h.id ? 'Submitting...' : 'Submit'}
                              </button>
                              <button
                                onClick={() => setExpandedId(null)}
                                className="border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
