import { useEffect, useState } from 'react';
import { AlertTriangle, Search, ShieldCheck, UserRound, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, type ImpersonationTarget } from '@/contexts/AuthContext';

export default function MasterAdminImpersonation() {
  const { searchImpersonationTargets, startImpersonation } = useAuth();
  const [query, setQuery] = useState('');
  const [targets, setTargets] = useState<ImpersonationTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setTargets([]); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const result = await searchImpersonationTargets(value);
      if (result.error) toast.error(result.error);
      setTargets(result.targets);
      setLoading(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, searchImpersonationTargets]);

  const handleStart = async (target: ImpersonationTarget) => {
    const confirmed = window.confirm(`Open a 30-minute support session as ${target.name} (${target.role.replace(/_/g, ' ')})?\n\nThis action is audited and the target will receive an email notification.`);
    if (!confirmed) return;
    setStarting(target.id);
    const result = await startImpersonation(target.id);
    if (result.error) toast.error(result.error);
    else toast.success(`Support session opened for ${target.name}`);
    setStarting(null);
  };

  return <div className="space-y-6 max-w-5xl">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-amber-100 p-3 text-amber-700"><ShieldCheck className="h-6 w-6" /></div>
      <div><h1 className="text-2xl font-bold text-gray-900">Support Access</h1><p className="mt-1 text-sm text-gray-500">Temporarily view a school, reseller, teacher, parent, or learner account without changing its credentials.</p></div>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0" /><p>Every session is recorded, limited to 30 minutes, and automatically ends at timeout. Use this only for an authorized support investigation.</p></div>
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <label className="mb-2 block text-sm font-medium text-gray-700">Find an account</label>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, admission number, assessment number, or school" className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
    </div>
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin" />Searching secure directory...</div> : targets.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">{query.length < 2 ? 'Enter at least two characters to search.' : 'No active matching accounts found.'}</div> : <div className="divide-y divide-gray-100">{targets.map(target => <div key={target.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-full bg-blue-100 p-3 text-blue-700"><UserRound className="h-5 w-5" /></div><div><p className="font-semibold text-gray-900">{target.name}</p><p className="text-sm text-gray-500">{target.email || 'No email'} · {target.role.replace(/_/g, ' ')}</p><p className="text-xs text-gray-400">{target.school_name || 'Platform account'}{target.admission_number ? ` · Admission ${target.admission_number}` : ''}{target.assessment_number ? ` · Assessment ${target.assessment_number}` : ''}</p></div></div><button disabled={starting === target.id} onClick={() => void handleStart(target)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><LogIn className="h-4 w-4" />{starting === target.id ? 'Opening...' : 'View as user'}</button></div>)}</div>}
    </div>
  </div>;
}
