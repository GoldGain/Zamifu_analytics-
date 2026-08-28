import { useEffect, useState } from 'react';
import { ArchiveRestore, Loader2, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseUntyped } from '@/lib/supabase/client';
import { deleteScopedUser } from '@/lib/supabase/accountActions';
import { useAuth } from '@/contexts/AuthContext';

type ArchivedLearner = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  parent_name: string | null;
  class_id: string | null;
  classes?: { name?: string | null } | null;
};

export default function RecycleBin() {
  const { user } = useAuth();
  const [learners, setLearners] = useState<ArchivedLearner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadArchived = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data, error } = await supabaseUntyped
      .from('students')
      .select('id, first_name, last_name, admission_number, parent_name, class_id, classes(name)')
      .eq('school_id', user.schoolId)
      .eq('is_active', false)
      .order('updated_at', { ascending: false });
    if (error) toast.error(`Could not load Recycle Bin: ${error.message}`);
    setLearners((data || []) as ArchivedLearner[]);
    setLoading(false);
  };

  useEffect(() => { loadArchived(); }, [user?.schoolId]);

  const restoreLearner = async (learner: ArchivedLearner) => {
    if (!user?.schoolId) return;
    setBusyId(learner.id);
    const { error } = await supabaseUntyped
      .from('students')
      .update({ is_active: true })
      .eq('id', learner.id)
      .eq('school_id', user.schoolId);
    if (error) toast.error(`Could not restore learner: ${error.message}`);
    else { toast.success('Learner restored successfully.'); await loadArchived(); }
    setBusyId(null);
  };

  const permanentlyDeleteLearner = async (learner: ArchivedLearner) => {
    if (!user?.schoolId) return;
    if (!window.confirm(`Permanently delete ${learner.first_name} ${learner.last_name}? This cannot be undone.`)) return;
    setBusyId(learner.id);
    try {
      await deleteScopedUser({ record_id: learner.id, target_type: 'student', school_id: user.schoolId });
      toast.success('Learner permanently deleted.');
      await loadArchived();
    } catch (error: any) { toast.error(`Could not permanently delete learner: ${error.message}`); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recycle Bin</h1>
        <p className="text-sm text-gray-500">Restore archived learners or permanently delete them.</p>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {loading ? <div className="p-10 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-600" /></div> : learners.length === 0 ? <div className="p-10 text-center text-sm text-gray-500"><Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />Recycle Bin is empty.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b bg-gray-50"><th className="px-5 py-3 text-xs uppercase text-gray-500">Learner</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Admission No.</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Class</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Parent</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Actions</th></tr></thead><tbody>{learners.map((learner) => <tr key={learner.id} className="border-b"><td className="px-5 py-3 text-sm font-medium">{learner.first_name} {learner.last_name}</td><td className="px-5 py-3 text-sm">{learner.admission_number || '-'}</td><td className="px-5 py-3 text-sm">{learner.classes?.name || '-'}</td><td className="px-5 py-3 text-sm">{learner.parent_name || '-'}</td><td className="px-5 py-3"><div className="flex gap-2"><button type="button" disabled={busyId === learner.id} onClick={() => restoreLearner(learner)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold disabled:opacity-50"><ArchiveRestore className="w-3.5 h-3.5" /> Restore</button><button type="button" disabled={busyId === learner.id} onClick={() => permanentlyDeleteLearner(learner)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</button></div></td></tr>)}</tbody></table></div>
        )}
      </div>
    </div>
  );
}
