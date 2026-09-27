import { useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatClassStream } from '@/lib/class-label';

interface PromoteStudentModalProps {
  student: any;
  classes: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function PromoteStudentModal({
  student,
  classes,
  onClose,
  onSuccess,
}: PromoteStudentModalProps) {
  const [promoting, setPromoting] = useState(false);
  const currentClass = classes.find((c) => c.id === student.class_id);

  // Default: suggest next class by level
  const suggestedNextClass = classes.find(
    (c) =>
      c.level === (currentClass?.level || 0) + 1 &&
      c.school_id === currentClass?.school_id
  );

  const [selectedClassId, setSelectedClassId] = useState<string>(suggestedNextClass?.id || '');

  const availableClasses = classes.filter(
    (c) => c.id !== student.class_id && c.school_id === currentClass?.school_id
  );

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const handlePromote = async () => {
    if (!selectedClassId) {
      toast.error('Please select a destination class');
      return;
    }

    setPromoting(true);
    try {
      // Update student's class, record previous class and promotion timestamp
      const { error: updateError } = await supabaseUntyped
        .from('students')
        .update({
          class_id: selectedClassId,
          previous_class_id: student.class_id,
          promoted_at: new Date().toISOString(),
        })
        .eq('id', student.id);

      if (updateError) {
        toast.error('Failed to promote student: ' + updateError.message);
        setPromoting(false);
        return;
      }

      // Record promotion in student_promotions table (if exists)
      try {
        await supabaseUntyped.from('student_promotions').insert({
          student_id: student.id,
          school_id: student.school_id,
          from_class_id: student.class_id,
          to_class_id: selectedClassId,
          promotion_date: new Date().toISOString(),
          academic_year: new Date().getFullYear().toString(),
        });
      } catch {
        // Table may not exist — not critical
      }

      toast.success(
        `${student.first_name} ${student.last_name} promoted to ${selectedClass ? formatClassStream(selectedClass) : 'new class'}`
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Error promoting student: ' + error.message);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-[#111111]">Promote Student</h2>
            <p className="text-sm text-[#666666] mt-1">
              Promote {student.first_name} {student.last_name} to a new class
            </p>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-[#666666] uppercase font-medium mb-1">Current Class</p>
              <p className="text-sm font-semibold text-[#111111]">
                {currentClass ? formatClassStream(currentClass) : 'Unknown'}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-[#666666] uppercase font-medium mb-1">New Class</p>
              <p className="text-sm font-semibold text-blue-600">
                {selectedClass ? formatClassStream(selectedClass) : 'Select below'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-[#333333] mb-1">
            Select Destination Class
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">-- Select Class --</option>
            {availableClasses
              .sort((a, b) => (a.level || 0) - (b.level || 0))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClassStream(c)}
                </option>
              ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePromote}
            disabled={promoting || !selectedClassId}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {promoting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Promoting...
              </>
            ) : (
              'Promote Student'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
