import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { promoteSchoolToNextTerm } from '@/lib/term-promotion';

interface PromoteToNextTermModalProps {
  schoolId: string;
  currentTerm: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PromoteToNextTermModal({
  schoolId,
  currentTerm,
  onClose,
  onSuccess,
}: PromoteToNextTermModalProps) {
  const [promoting, setPromoting] = useState(false);

  const getNextTerm = () => {
    if (!currentTerm) return { name: 'Term 1', year: new Date().getFullYear() };

    const termMap: Record<string, { name: string; nextYear: boolean }> = {
      'Term 1': { name: 'Term 2', nextYear: false },
      'Term 2': { name: 'Term 3', nextYear: false },
      'Term 3': { name: 'Term 1', nextYear: true },
    };

    const current = termMap[currentTerm.name] || { name: 'Term 1', nextYear: true };
    const nextYear = current.nextYear
      ? parseInt(currentTerm.academic_year || new Date().getFullYear().toString()) + 1
      : parseInt(currentTerm.academic_year || new Date().getFullYear().toString());

    return { name: current.name, year: nextYear };
  };

  const nextTerm = getNextTerm();

  const handlePromote = async () => {
    setPromoting(true);
    try {
      const promoted = await promoteSchoolToNextTerm(schoolId);
      toast.success(`Promoted to ${promoted.next_term_name} ${promoted.next_academic_year}. Students remain in their current classes.`);

      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Error promoting to next term: ' + error.message);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-[#111111]">Promote to Next Term</h2>
            <p className="text-sm text-[#666666] mt-1">
              This will update the current term for all students and classes.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg mb-6 space-y-2">
          <div>
            <p className="text-xs text-[#666666] uppercase font-medium">Current Term</p>
            <p className="text-sm font-medium text-[#111111]">
              {currentTerm?.name || 'Term 1'} {currentTerm?.academic_year || new Date().getFullYear()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#666666] uppercase font-medium">New Term</p>
            <p className="text-sm font-medium text-amber-600">
              {nextTerm.name} {nextTerm.year}
            </p>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg mb-6 text-sm text-blue-700">
          <p className="font-medium mb-1">What happens:</p>
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li>Current term is marked as inactive</li>
            <li>New term becomes the active term</li>
            <li>Students remain in their current classes</li>
          </ul>
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
            disabled={promoting}
            className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {promoting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Promoting...
              </>
            ) : (
              'Promote Term'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
