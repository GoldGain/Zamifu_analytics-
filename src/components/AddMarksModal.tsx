import { useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { calculateCompetencyGrade, getSchoolLevelBand, is844Curriculum, calculate844Grade } from '@/lib/grading';
import { Loader2, X, Save } from 'lucide-react';
import { toast } from 'sonner';

export interface AddMarksTarget {
  schoolId: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  termId: string;
  examId?: string | null;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
}

interface AddMarksModalProps { target: AddMarksTarget; onClose: () => void; onSaved?: () => void; defaultOutOf?: number; }

export function AddMarksModal({ target, onClose, onSaved, defaultOutOf = 100 }: AddMarksModalProps) {
  const [marks, setMarks] = useState('');
  const [outOf, setOutOf] = useState(String(defaultOutOf));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!target.termId) { toast.error('Select a term before adding marks'); return; }
    const marksVal = parseFloat(marks);
    const outOfVal = parseFloat(outOf) || 100;
    if (isNaN(marksVal) || marksVal < 0 || marksVal > outOfVal) { toast.error(`Marks must be between 0 and ${outOfVal}`); return; }
    setSaving(true);
    try {
      const { data: classData } = await supabaseUntyped.from('classes').select('id, name, curriculum, grade_level, level').eq('id', target.classId).maybeSingle();
      const classObj: any = classData || { curriculum: 'CBE' };
      let teacherId = '';
      const { data: assignment } = await supabaseUntyped.from('teacher_subject_assignments').select('teacher_id').eq('class_id', target.classId).eq('subject_id', target.subjectId).eq('is_active', true).limit(1);
      if (assignment && assignment.length > 0) teacherId = assignment[0].teacher_id;
      if (!teacherId) {
        const fb = await supabaseUntyped.from('teacher_subject_assignments').select('teacher_id').eq('class_id', target.classId).eq('subject_id', target.subjectId).limit(1);
        if (fb.data && fb.data.length > 0) teacherId = fb.data[0].teacher_id;
      }
      if (!teacherId) { toast.error('No teacher is assigned to this learning area and class.'); setSaving(false); return; }
      const percentage = Math.round((marksVal / outOfVal) * 100);
      const band = getSchoolLevelBand(classObj);
      const isPrimary = band === 'primary';
      const cbe = calculateCompetencyGrade(percentage, band);
      const grade844 = is844Curriculum(classObj) ? calculate844Grade(percentage) : null;
      const record: any = {
        school_id: target.schoolId, student_id: target.studentId, class_id: target.classId, subject_id: target.subjectId,
        teacher_id: teacherId, term_id: target.termId, academic_year: new Date().getFullYear().toString(),
        curriculum: classObj?.curriculum || 'CBE', marks: marksVal, out_of: outOfVal, percentage, converted_marks: percentage,
        cbc_sublevel: isPrimary ? null : (cbe.subLevel || null), cbc_grade: cbe.grade, cbc_points: isPrimary ? null : cbe.points,
        cbc_descriptor: cbe.descriptor, grade_844: grade844 ? grade844.grade : cbe.grade, exam_id: target.examId || null,
        status: 'submitted' as const, submitted_at: new Date().toISOString(),
      };
      const conflictKey = target.examId ? 'student_id,subject_id,term_id,exam_id' : 'student_id,subject_id,term_id';
      const { error: upsertError } = await supabaseUntyped.from('results').upsert(record, { onConflict: conflictKey, ignoreDuplicates: false });
      if (upsertError) {
        const { error: insertError } = await supabaseUntyped.from('results').insert(record);
        if (insertError) throw new Error(insertError.message);
      }
      toast.success(`Marks saved for ${target.studentName}`);
      onSaved?.(); onClose();
    } catch (err: any) { toast.error(err.message || 'Failed to save marks'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#111111]">Add Marks</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-sm font-bold text-blue-900">{target.studentName}</p>
            {target.admissionNumber && <p className="text-xs text-blue-700 font-medium">{target.admissionNumber}</p>}
            <p className="text-xs text-blue-700 font-medium mt-1">{target.subjectName || 'Learning Area'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#666666] uppercase mb-1.5">Marks Obtained</label>
              <input type="number" step="0.1" value={marks} autoFocus onChange={(e) => setMarks(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#666666] uppercase mb-1.5">Out Of</label>
              <input type="number" step="0.1" value={outOf} onChange={(e) => setOutOf(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-[#666666] hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-bold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Marks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
