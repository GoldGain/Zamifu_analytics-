import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowUpRight, Loader2, AlertTriangle, CheckCircle, Users, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface ClassOption {
  id: string;
  name: string;
  level: number | null;
  stream: string | null;
  studentCount: number;
}

export default function PromoteClass() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [selectedFromClass, setSelectedFromClass] = useState('');
  const [selectedToClass, setSelectedToClass] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, [user?.schoolId]);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const schoolId = user?.schoolId;
      
      // Fetch classes with student counts
      const { data: classesData } = await supabaseUntyped
        .from('classes')
        .select('id, name, level, stream')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('level');

      // Get student counts
      const { data: studentsData } = await supabaseUntyped
        .from('students')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      const classesWithCounts = (classesData || []).map((cls: any) => ({
        ...cls,
        studentCount: (studentsData || []).filter((s: any) => s.class_id === cls.id).length,
      }));

      setClasses(classesWithCounts);
    } catch (err: any) {
      toast.error('Failed to load classes: ' + err.message);
    }
    setLoading(false);
  };

  const handlePromote = async () => {
    if (!selectedFromClass || !selectedToClass) {
      toast.error('Please select both source and destination classes');
      return;
    }
    if (selectedFromClass === selectedToClass) {
      toast.error('Source and destination must be different');
      return;
    }
    setShowConfirm(true);
  };

  const confirmPromote = async () => {
    setPromoting(true);
    setShowConfirm(false);
    try {
      const fromClass = classes.find(c => c.id === selectedFromClass);
      
      // Update all students from source class to destination class
      const { error } = await supabaseUntyped
        .from('students')
        .update({ class_id: selectedToClass })
        .eq('class_id', selectedFromClass)
        .eq('school_id', user?.schoolId)
        .eq('is_active', true);

      if (error) throw error;

      toast.success(`Successfully promoted all learners from ${fromClass?.name || 'source class'}!`);
      
      // Reset selection
      setSelectedFromClass('');
      setSelectedToClass('');
      fetchClasses();
    } catch (err: any) {
      toast.error('Promotion failed: ' + err.message);
    }
    setPromoting(false);
  };

  const fromClass = classes.find(c => c.id === selectedFromClass);
  const toClass = classes.find(c => c.id === selectedToClass);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Promote Whole Class</h1>
        <p className="text-sm text-[#666666]">Move all learners from one class to another in one action</p>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-sm text-blue-900">
        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-bold mb-1">How it works:</p>
          <p>Select the source class (where learners currently are) and the destination class (where you want to move them). All learners will be moved at once.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
      ) : classes.length < 2 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-gray-500">You need at least 2 classes to use promotion</p>
        </div>
      ) : (
        <>
          {/* Selection */}
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* From Class */}
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-2">From Class (Current)</label>
                <div className="relative">
                  <select
                    value={selectedFromClass}
                    onChange={e => setSelectedFromClass(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white appearance-none pr-10"
                  >
                    <option value="">Select source class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.stream ? `(${c.stream})` : ''} — {c.studentCount} learners
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center pt-6">
                <ArrowUpRight className="w-8 h-8 text-gray-300" />
              </div>

              {/* To Class */}
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-2">To Class (Destination)</label>
                <div className="relative">
                  <select
                    value={selectedToClass}
                    onChange={e => setSelectedToClass(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white appearance-none pr-10"
                  >
                    <option value="">Select destination class</option>
                    {classes
                      .filter(c => c.id !== selectedFromClass)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.stream ? `(${c.stream})` : ''} — {c.studentCount} learners
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Summary */}
            {fromClass && toClass && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-bold">You are about to promote:</p>
                    <p><strong>{fromClass.studentCount}</strong> learner(s) from <strong>{fromClass.name}</strong> to <strong>{toClass.name}</strong></p>
                    <p className="mt-1 text-amber-600">This action cannot be undone. Please confirm below.</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handlePromote}
              disabled={!selectedFromClass || !selectedToClass || promoting}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
            >
              {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              {promoting ? 'Promoting...' : 'PROMOTE WHOLE CLASS'}
            </button>
          </div>

          {/* Class Overview */}
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-bold text-[#111111] mb-4">Class Overview</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Learners</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name} {c.stream && `(${c.stream})`}</td>
                      <td className="px-4 py-3 text-gray-600">{c.level || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full">{c.studentCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Confirm Promotion</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to move <strong>{fromClass?.studentCount}</strong> learner(s) from <strong>{fromClass?.name}</strong> to <strong>{toClass?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmPromote}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
              >
                Yes, Promote All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
