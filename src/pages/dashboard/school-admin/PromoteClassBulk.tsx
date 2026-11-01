import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { toast } from 'sonner';

type ClassRow = { id: string; name: string; level: number | null; stream: string | null; grade_level: number | null };

export default function PromoteClassBulk() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ moved: number; from_class: string; to_class: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseUntyped.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabaseUntyped.from('profiles').select('school_id').eq('id', user.id).maybeSingle();
      if (!profile?.school_id) return;
      const { data, error } = await supabaseUntyped
        .from('classes')
        .select('id,name,level,stream,grade_level')
        .eq('school_id', profile.school_id)
        .order('level');
      if (error) { toast.error('Could not load classes: ' + error.message); return; }
      setClasses(data || []);
    })();
  }, []);

  const level = (c?: ClassRow) => Number(c?.level ?? c?.grade_level ?? 0);
  const from = classes.find((c) => c.id === fromClassId);
  const to = classes.find((c) => c.id === toClassId);
  const valid = Boolean(from && to && level(to) > level(from));

  const promote = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabaseUntyped.auth.getSession();
      const res = await fetch('/api/promote-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ fromClassId, toClassId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not promote that class.');
      setResult(json.result);
      setConfirming(false);
      toast.success(`${json.result.moved} learner(s) moved to ${json.result.to_class}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not promote that class.');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">School Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Promote a whole class</h1>
        <p className="mt-1 text-sm text-gray-600">
          Move every active learner in one class to the next class in a single action. Each learner keeps their history:
          the old class is stored as their previous class and the promotion date is recorded.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Current class</span>
            <select value={fromClassId} onChange={(e) => { setFromClassId(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select the class being promoted</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Move them to</span>
            <select value={toClassId} onChange={(e) => { setToClassId(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select the next class</option>
              {classes.filter((c) => !from || level(c) > level(from)).map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>
              ))}
            </select>
          </label>
        </div>

        {from && to && !valid && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            The target class must be a higher level than {from.name}.
          </p>
        )}

        <button onClick={() => setConfirming(true)} disabled={!valid || busy}
          className="mt-4 rounded-full bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Promote whole class
        </button>

        {result && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Done — {result.moved} learner(s) moved from {result.from_class} to {result.to_class}.
          </p>
        )}
      </div>

      {confirming && from && to && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">Promote {from.name} to {to.name}?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Every active learner in {from.name} will move to {to.name}. Their previous class and promotion date are
              recorded, and all results stay attached to the assessment they were entered for.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
                Cancel
              </button>
              <button onClick={promote} disabled={busy} className="flex-1 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? 'Promoting…' : 'Yes, promote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
