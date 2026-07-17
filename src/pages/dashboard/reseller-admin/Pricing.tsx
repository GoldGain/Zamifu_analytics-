import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_FEE_PER_LEARNER, feeOrDefault, getResellerForUser, money } from '@/lib/reseller';

export default function ResellerPricing() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [defaultFee, setDefaultFee] = useState(DEFAULT_FEE_PER_LEARNER);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const reseller = await getResellerForUser(user.id);
    if (reseller) {
      setResellerId(reseller.id);
      setDefaultFee(feeOrDefault(reseller.default_fee_per_learner));
      const { data } = await supabase
        .from('schools')
        .select('id, name, code, fee_per_learner_per_term')
        .eq('reseller_id', reseller.id)
        .order('name');
      const list = data || [];
      setSchools(list);
      const map: Record<string, number> = {};
      list.forEach((s: any) => {
        map[s.id] = feeOrDefault(s.fee_per_learner_per_term);
      });
      setFees(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const saveDefault = async () => {
    if (!resellerId) return;
    setSavingDefault(true);
    try {
      const value = feeOrDefault(defaultFee);
      const { error } = await (supabase as any)
        .from('resellers')
        .update({ default_fee_per_learner: value })
        .eq('id', resellerId);
      if (error) throw error;
      toast.success('Default fee saved (used when creating new schools)');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save default');
    } finally {
      setSavingDefault(false);
    }
  };

  const saveSchool = async (schoolId: string) => {
    setSavingId(schoolId);
    try {
      const value = feeOrDefault(fees[schoolId]);
      const { error } = await (supabase as any)
        .from('schools')
        .update({ fee_per_learner_per_term: value })
        .eq('id', schoolId);
      if (error) throw error;
      toast.success('School fee updated');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update fee');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" /> Pricing
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Set amount to be paid per learner per term for each school. Editable anytime after create.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Default fee for new schools</h2>
        <p className="text-xs text-gray-500 mb-3">Applied as the starting value when you create a school</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">KES per learner / term</label>
            <input
              type="number"
              min={1}
              value={defaultFee}
              onChange={(e) => setDefaultFee(Number(e.target.value) || 0)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
            />
          </div>
          <button
            onClick={saveDefault}
            disabled={savingDefault}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {savingDefault ? 'Saving...' : 'Save default'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : schools.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No schools yet. Create a school first.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Fee per learner / term</th>
                <th className="px-4 py-3">Preview (100 learners)</th>
                <th className="px-4 py-3">Save</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => {
                const fee = feeOrDefault(fees[s.id]);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.code}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">KES</span>
                        <input
                          type="number"
                          min={1}
                          value={fees[s.id] ?? DEFAULT_FEE_PER_LEARNER}
                          onChange={(e) => setFees({ ...fees, [s.id]: Number(e.target.value) || 0 })}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 w-28"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{money(fee * 100)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => saveSchool(s.id)}
                        disabled={savingId === s.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> {savingId === s.id ? '...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
