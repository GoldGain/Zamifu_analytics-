import { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_ANNUAL_FEE_PER_LEARNER,
  DEFAULT_FEE_PER_LEARNER,
  feeOrDefault,
  getResellerForUser,
  money,
} from '@/lib/reseller';

interface SchoolPricingRow {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  fee_per_learner_per_term: number | null;
  fee_per_learner_per_year: number | null;
}

interface SchoolAdminEmailRow {
  school_id: string | null;
  email: string | null;
}

export default function ResellerPricing() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<SchoolPricingRow[]>([]);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [annualFees, setAnnualFees] = useState<Record<string, number>>({});
  const [schoolAdminEmails, setSchoolAdminEmails] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [defaultFee, setDefaultFee] = useState(DEFAULT_FEE_PER_LEARNER);
  const [defaultAnnualFee, setDefaultAnnualFee] = useState(DEFAULT_ANNUAL_FEE_PER_LEARNER);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const reseller = await getResellerForUser(user.id);
    if (reseller) {
      setResellerId(reseller.id);
      setDefaultFee(feeOrDefault(reseller.default_fee_per_learner));
      setDefaultAnnualFee(feeOrDefault(reseller.default_fee_per_learner_per_year, DEFAULT_ANNUAL_FEE_PER_LEARNER));
      const { data } = await supabase
        .from('schools')
        .select('id, name, code, email, fee_per_learner_per_term, fee_per_learner_per_year')
        .or(`reseller_id.eq.${reseller.id},reseller_id.is.null`)
        .order('name');
      const list = (data || []) as SchoolPricingRow[];
      const schoolIds = list.map((school) => school.id);
      let adminRows: SchoolAdminEmailRow[] = [];
      if (schoolIds.length) {
        const { data: rows } = await supabaseUntyped
          .from('school_admins')
          .select('school_id, email')
          .in('school_id', schoolIds);
        adminRows = (rows || []) as SchoolAdminEmailRow[];
      }
      const emailsBySchool: Record<string, string[]> = {};
      adminRows.forEach((admin) => {
        if (!admin.school_id || !admin.email) return;
        emailsBySchool[admin.school_id] = [...(emailsBySchool[admin.school_id] || []), admin.email];
      });
      setSchools(list);
      setSchoolAdminEmails(emailsBySchool);
      const map: Record<string, number> = {};
      const annualMap: Record<string, number> = {};
      list.forEach((s) => {
        const termFee = feeOrDefault(s.fee_per_learner_per_term);
        map[s.id] = termFee;
        annualMap[s.id] = feeOrDefault(s.fee_per_learner_per_year, DEFAULT_ANNUAL_FEE_PER_LEARNER);
      });
      setFees(map);
      setAnnualFees(annualMap);
    }
    setLoading(false);
  }, [user]);

  const filteredSchools = schools.filter((school) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const searchable = [
      school.name,
      school.code,
      school.email,
      ...(schoolAdminEmails[school.id] || []),
    ].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(query);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const saveDefault = async () => {
    if (!resellerId) return;
    setSavingDefault(true);
    try {
      const value = feeOrDefault(defaultFee);
      const annualValue = feeOrDefault(defaultAnnualFee, DEFAULT_ANNUAL_FEE_PER_LEARNER);
      const { data, error } = await supabaseUntyped
        .from('resellers')
        .update({
          default_fee_per_learner: value,
          default_fee_per_learner_per_year: annualValue,
        })
        .eq('id', resellerId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No reseller pricing was updated. Refresh the page and try again.');
      toast.success('Default term and annual fees saved (used when creating new schools)');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save default');
    } finally {
      setSavingDefault(false);
    }
  };

  const saveSchool = async (schoolId: string) => {
    setSavingId(schoolId);
    try {
      const value = feeOrDefault(fees[schoolId]);
      const annualValue = feeOrDefault(annualFees[schoolId], DEFAULT_ANNUAL_FEE_PER_LEARNER);
      if (!resellerId) throw new Error('Reseller account not found');
      const { data, error } = await supabaseUntyped
        .from('schools')
        .update({
          fee_per_learner_per_term: value,
          fee_per_learner_per_year: annualValue,
        })
        .eq('id', schoolId)
        .or(`reseller_id.eq.${resellerId},reseller_id.is.null`)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No school was updated. Confirm this school is available to your reseller account, then refresh and try again.');
      toast.success('School fee updated');
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update fee');
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
            Set term and discounted annual amounts per learner for each school. Annual savings are calculated against three terms.
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
          <div>
            <label className="block text-sm text-gray-700 mb-1">KES per learner / year</label>
            <input
              type="number"
              min={1}
              value={defaultAnnualFee}
              onChange={(e) => setDefaultAnnualFee(Number(e.target.value) || 0)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
            />
            <p className="text-xs text-green-700 mt-1">
              Save KES {Math.max(0, defaultFee * 3 - defaultAnnualFee).toLocaleString()} vs 3 terms
            </p>
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full sm:max-w-md">
          <span className="mb-1 block text-sm font-medium text-gray-700">Find a school or school-admin email</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by school name, code, or email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {!loading && schools.length > 0 && <p className="text-xs text-gray-500">Edit the per-learner term or annual fee, then select Save on that school’s row.</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : schools.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No schools yet. Create a school first.</div>
        ) : filteredSchools.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No schools match “{search}”.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Fee / learner / term</th>
                <th className="px-4 py-3">Fee / learner / year</th>
                <th className="px-4 py-3">Annual saving vs 3 terms</th>
                <th className="px-4 py-3">Preview (100 learners)</th>
                <th className="px-4 py-3">Save</th>
              </tr>
            </thead>
            <tbody>
                {filteredSchools.map((s) => {
                const fee = feeOrDefault(fees[s.id]);
                const annualFee = feeOrDefault(annualFees[s.id], DEFAULT_ANNUAL_FEE_PER_LEARNER);
                const annualSavings = Math.max(0, fee * 3 - annualFee);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <div>{s.name}</div>
                      <div className="mt-0.5 text-xs font-normal text-gray-500">{s.email || 'No school contact email'}</div>
                      {(schoolAdminEmails[s.id] || []).map((email) => (
                        <div key={email} className="text-xs font-normal text-gray-500">Admin: {email}</div>
                      ))}
                    </td>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">KES</span>
                        <input
                          type="number"
                          min={1}
                          value={annualFees[s.id] ?? DEFAULT_ANNUAL_FEE_PER_LEARNER}
                          onChange={(e) => setAnnualFees({ ...annualFees, [s.id]: Number(e.target.value) || 0 })}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 w-28"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-green-700 font-medium">{money(annualSavings)}</td>
                    <td className="px-4 py-3 text-gray-600">{money(fee * 100)} / term<br />{money(annualFee * 100)} / year</td>
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
