/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type ActivityRow = { id: string; action: string; table_name: string | null; record_id: string | null; user_id: string | null; created_at: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null };

const formatAction = (action: string) => action.toLowerCase() === 'insert' ? 'Created' : action.toLowerCase() === 'update' ? 'Updated' : action.toLowerCase() === 'delete' ? 'Deleted' : action;
const labelTable = (value: string | null) => (value || 'portal').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ActivityHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data, error } = await supabase.from('audit_logs').select('id, action, table_name, record_id, user_id, created_at, old_values, new_values').eq('school_id', user.schoolId).order('created_at', { ascending: false }).limit(200);
    if (error) toast.error(error.message || 'Could not load activity history');
    setRows((data || []) as ActivityRow[]);
    setLoading(false);
  }, [user?.schoolId]);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Activity className="w-6 h-6 text-blue-600" /> Activity History</h1><p className="text-sm text-gray-500 mt-1">A chronological record of changes made in your school portal.</p></div><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button></div>
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">{loading ? <div className="p-10 text-center text-gray-500">Loading activity…</div> : rows.length === 0 ? <div className="p-10 text-center text-gray-500">No activity has been recorded for this school yet. New changes will appear here automatically.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr className="text-left text-gray-500"><th className="px-4 py-3">Time</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Area</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Details</th></tr></thead><tbody>{rows.map((row) => { const payload = row.new_values || row.old_values || {}; const keys = Object.keys(payload).filter((key) => !['id', 'school_id', 'updated_at', 'created_at'].includes(key)).slice(0, 3); return <tr key={row.id} className="border-b last:border-0 align-top"><td className="px-4 py-3 whitespace-nowrap text-gray-500">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td><td className="px-4 py-3 font-semibold text-gray-900">{formatAction(row.action)}</td><td className="px-4 py-3">{labelTable(row.table_name)}</td><td className="px-4 py-3 font-mono text-xs text-gray-500">{row.record_id ? row.record_id.slice(0, 8) : '—'}</td><td className="px-4 py-3 text-xs text-gray-600">{keys.length ? keys.map((key) => <div key={key}><span className="font-medium">{key.replaceAll('_', ' ')}:</span> {String(payload[key] ?? '—').slice(0, 80)}</div>) : 'Portal activity recorded'}</td></tr>; })}</tbody></table></div>}</div>
  </div>;
}
