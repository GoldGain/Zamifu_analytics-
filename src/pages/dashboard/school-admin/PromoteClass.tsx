import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowUpRight, Loader2, AlertTriangle, CheckCircle, Users, ChevronDown, Info, GraduationCap, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ClassOption {
  id: string;
  name: string;
  level: number | null;
  stream: string | null;
  studentCount: number;
  grade_level: number | null;
}

type PromotionMode = 'promote' | 'graduate' | null;

export default function PromoteClass() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [selectedFromClass, setSelectedFromClass] = useState('');
  const [selectedToClass, setSelectedToClass] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [promotionMode, setPromotionMode] = useState<PromotionMode>(null);

  useEffect(() => {
    fetchClasses();
  }, [user?.schoolId]);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const schoolId = user?.schoolId;
      
      const { data: classesData } = await supabaseUntyped
        .from('classes')
        .select('id, name, level, stream, grade_level')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('level');

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

  /** Grade 9 (junior exit) and Grade 12 / Form 4 (senior exit) must GRADUATE, not promote */
  const isGraduationClass = (cls: ClassOption | undefined): boolean => {
    if (!cls) return false;
    const name = (cls.name || '').toLowerCase();
    const grade = Number(cls.grade_level ?? cls.level);
    if (grade === 9 || grade === 12) return true;
    // Name patterns
    if (/grade\s*9\b|grade9|\bg9\b|class\s*9\b/.test(name)) return true;
    if (/grade\s*12\b|grade12|\bg12\b|class\s*12\b/.test(name)) return true;
    if (/form\s*4\b|form4|\bf4\b/.test(name)) return true;
    return false;
  };

  const graduationLabel = (cls: ClassOption | undefined): string => {
    if (!cls) return 'exit class';
    const name = (cls.name || '').toLowerCase();
    const grade = Number(cls.grade_level ?? cls.level);
    if (grade === 12 || /grade\s*12|form\s*4/.test(name)) return 'Grade 12 / Form 4';
    if (grade === 9 || /grade\s*9/.test(name)) return 'Grade 9';
    return cls.name;
  };

  const handlePromote = () => {
    if (!selectedFromClass) {
      toast.error('Please select a source class');
      return;
    }

    const fromClass = classes.find(c => c.id === selectedFromClass);

    // If Grade 9 or Grade 12 / Form 4, offer graduation
    if (isGraduationClass(fromClass)) {
      setPromotionMode('graduate');
      setShowConfirm(true);
      return;
    }

    // Normal promotion
    if (!selectedToClass) {
      toast.error('Please select a destination class');
      return;
    }
    if (selectedFromClass === selectedToClass) {
      toast.error('Source and destination must be different');
      return;
    }

    // Issue 9: Check if destination class has learners - prevent merge
    const toClassObj = classes.find(c => c.id === selectedToClass);
    if (toClassObj && toClassObj.studentCount > 0) {
      toast.error(`Cannot promote to ${toClassObj.name} — it already has ${toClassObj.studentCount} learner(s). Please select an empty class.`);
      return;
    }

    setPromotionMode('promote');
    setShowConfirm(true);
  };

  const confirmPromote = async () => {
    setPromoting(true);
    setShowConfirm(false);
    try {
      const fromClass = classes.find(c => c.id === selectedFromClass);

      if (promotionMode === 'graduate') {
        // Exit-class graduation (G9 / G12 / Form 4)
        const { error } = await supabaseUntyped
          .from('students')
          .update({ 
            is_active: false, 
            status: 'graduated',
            learner_status: 'graduated',
            graduation_date: new Date().toISOString(),
            graduation_year: new Date().getFullYear(),
          })
          .eq('class_id', selectedFromClass)
          .eq('school_id', user?.schoolId)
          .eq('is_active', true);

        if (error) throw error;
        toast.success(
          `Successfully graduated ${fromClass?.studentCount} learner(s) from ${fromClass?.name}! They are now marked as graduates.`
        );
      } else {
        // Normal promotion: move learners to destination class
        const toClassObj = classes.find(c => c.id === selectedToClass);
        
        // Issue 9: Double-check destination is still empty before promoting
        const { data: destStudents } = await supabaseUntyped
          .from('students')
          .select('id')
          .eq('class_id', selectedToClass)
          .eq('is_active', true);
        
        if (destStudents && destStudents.length > 0) {
          throw new Error(`Destination class ${toClassObj?.name} now has ${destStudents.length} learner(s). Cannot promote to a non-empty class.`);
        }
        
        const { error } = await supabaseUntyped
          .from('students')
          .update({ class_id: selectedToClass })
          .eq('class_id', selectedFromClass)
          .eq('school_id', user?.schoolId)
          .eq('is_active', true);

        if (error) throw error;
        toast.success(
          `Successfully promoted ${fromClass?.studentCount} learner(s) from ${fromClass?.name} to ${toClassObj?.name}!`
        );
      }

      setSelectedFromClass('');
      setSelectedToClass('');
      setPromotionMode(null);
      fetchClasses();
    } catch (err: any) {
      toast.error('Promotion failed: ' + err.message);
    }
    setPromoting(false);
  };

  const fromClass = classes.find(c => c.id === selectedFromClass);
  const toClass = classes.find(c => c.id === selectedToClass);
  const destinationHasLearners = toClass && toClass.studentCount > 0;
  const fromIsGraduation = isGraduationClass(fromClass);

  // Issue 9: Filter destination classes to only show empty classes
  const emptyDestinationClasses = classes.filter(c => c.id !== selectedFromClass && c.studentCount === 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Promote Whole Class</h1>
        <p className="text-sm text-[#666666]">Move all learners from one class to another, or graduate Grade 9 and Grade 12 / Form 4 learners</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-sm text-blue-900">
        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-bold mb-1">How it works:</p>
          <p>Select the source class. For Grade 9 and Grade 12 / Form 4, learners will be graduated. For other classes, select an empty destination class to promote all learners at once.</p>
          <p className="mt-1 text-blue-700">Promote from the highest class downwards. Grade 9 and Grade 12 / Form 4 learners will be marked as graduated.</p>
        </div>
      </div>

      {/* Issue 9: Show warning about merge restriction */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-sm text-red-900">
        <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
        <div>
          <p className="font-bold mb-1">Important:</p>
          <p>Promotion is only allowed to <strong>empty classes</strong>. You cannot merge learners into a class that already has students. Please ensure the destination class has no learners before promoting.</p>
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
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-2">From Class (Current)</label>
                <div className="relative">
                  <select
                    value={selectedFromClass}
                    onChange={e => {
                      setSelectedFromClass(e.target.value);
                      setSelectedToClass('');
                    }}
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
                {fromIsGraduation && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                    <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                    <span><strong>{graduationLabel(fromClass)} detected!</strong> These learners will graduate (not promote).</span>
                  </div>
                )}
              </div>

              {!fromIsGraduation && (
                <>
                  <div className="hidden md:flex items-center justify-center pt-6">
                    <ArrowUpRight className="w-8 h-8 text-gray-300" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-2">To Class (Empty Destination)</label>
                    <div className="relative">
                      <select
                        value={selectedToClass}
                        onChange={e => setSelectedToClass(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white appearance-none pr-10"
                        disabled={emptyDestinationClasses.length === 0}
                      >
                        <option value="">
                          {emptyDestinationClasses.length === 0 
                            ? 'No empty classes available' 
                            : 'Select empty destination class'}
                        </option>
                        {emptyDestinationClasses.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.stream ? `(${c.stream})` : ''} — {c.studentCount} learners
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    {emptyDestinationClasses.length === 0 && selectedFromClass && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>No empty classes available. Please create a new empty class first.</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {fromClass && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    {fromIsGraduation ? (
                      <>
                        <p className="font-bold">You are about to graduate ({graduationLabel(fromClass)}):</p>
                        <p><strong>{fromClass.studentCount}</strong> learner(s) from <strong>{fromClass.name}</strong></p>
                        <p className="mt-1 text-purple-700 font-medium">These learners will be marked as graduated and become inactive.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold">You are about to promote:</p>
                        <p><strong>{fromClass.studentCount}</strong> learner(s) from <strong>{fromClass.name}</strong> {toClass && `to <strong>${toClass.name}</strong>`}</p>
                        <p className="mt-1 text-green-700 font-medium">
                          Destination class will have exactly <strong>{fromClass.studentCount}</strong> learner(s) after promotion.
                        </p>
                      </>
                    )}
                    <p className="mt-1 text-amber-600">This action cannot be undone. Please confirm below.</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handlePromote}
              disabled={!selectedFromClass || (!fromIsGraduation && !selectedToClass) || promoting}
              className={`mt-6 w-full flex items-center justify-center gap-2 text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors ${
                fromIsGraduation 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-[#2563EB] hover:bg-[#1d4ed8]'
              }`}
            >
              {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : fromIsGraduation ? <GraduationCap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              {promoting ? 'Processing...' : fromIsGraduation ? `GRADUATE ${fromClass?.studentCount || ''} LEARNERS` : 'PROMOTE WHOLE CLASS'}
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-bold text-[#111111] mb-4">Class Overview</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Learners</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
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
                      <td className="px-4 py-3">
                        {c.studentCount === 0 ? (
                          <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded-full">Empty</span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">Has learners</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${fromIsGraduation ? 'bg-purple-100' : 'bg-amber-100'}`}>
                {fromIsGraduation ? <GraduationCap className="w-5 h-5 text-purple-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {fromIsGraduation ? 'Confirm Graduation (G9 / G12 / Form 4)' : 'Confirm Promotion'}
              </h2>
            </div>

            {fromIsGraduation ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  You are about to graduate <strong>{fromClass?.studentCount}</strong> learner(s) from <strong>{fromClass?.name}</strong>.
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  These learners will be marked as <strong>graduated</strong> (Grade 9 junior exit or Grade 12 / Form 4 senior exit) and will no longer appear in active class lists. View them under Graduated Students.
                </p>
                <p className="text-xs text-gray-400 mb-6">This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => { setShowConfirm(false); setPromotionMode(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Back</button>
                  <button onClick={confirmPromote} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
                    Graduate
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to promote <strong>{fromClass?.studentCount}</strong> learner(s) from <strong>{fromClass?.name}</strong> to <strong>{toClass?.name}</strong>?
                </p>
                <p className="text-sm text-green-700 mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <strong>Safe promotion:</strong> {toClass?.name} is empty. After promotion, it will have exactly {fromClass?.studentCount} learner(s).
                </p>
                <p className="text-xs text-gray-400 mb-6">This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={confirmPromote} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                    Yes, Promote All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
