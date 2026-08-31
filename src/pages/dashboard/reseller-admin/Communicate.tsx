import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { sendBulkSMS } from '@/lib/sms';

type Recipient = { id: string; school_id: string; name: string; role: 'School Admin' | 'Teacher' | 'DOS'; phone: string };

export default function ResellerCommunicate() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [roles, setRoles] = useState<string[]>(['School Admin']);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data: reseller } = await supabaseUntyped.from('resellers').select('id').eq('user_id', user.id).maybeSingle();
        if (!reseller) return;
        const { data: schoolRows, error: schoolError } = await supabaseUntyped.from('schools').select('id, name').or(`reseller_id.eq.${reseller.id},reseller_id.is.null`).order('name');
        if (schoolError) throw schoolError;
        const schoolRowsSafe = (schoolRows || []) as Array<{ id: string; name: string }>;
        setSchools(schoolRowsSafe);
        const ids = schoolRowsSafe.map((school) => school.id);
        if (!ids.length) return;
        const [{ data: admins, error: adminError }, { data: teachers, error: teacherError }, { data: dos, error: dosError }] = await Promise.all([
          supabaseUntyped.from('school_admins').select('id, school_id, first_name, last_name, phone').in('school_id', ids).eq('is_active', true),
          supabaseUntyped.from('teachers').select('id, school_id, first_name, last_name, phone').in('school_id', ids).eq('is_active', true),
          supabaseUntyped.from('profiles').select('id, school_id, first_name, last_name, phone').in('school_id', ids).eq('role', 'dean_of_studies').eq('is_active', true),
        ]);
        if (adminError || teacherError || dosError) throw adminError || teacherError || dosError;
        const toRecipient = (row: any, role: Recipient['role']): Recipient | null => row.phone ? ({ id: `${role}-${row.id}`, school_id: row.school_id, name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || role, role, phone: row.phone }) : null;
        setRecipients([
          ...(admins || []).map((row: any) => toRecipient(row, 'School Admin')).filter(Boolean),
          ...(teachers || []).map((row: any) => toRecipient(row, 'Teacher')).filter(Boolean),
          ...(dos || []).map((row: any) => toRecipient(row, 'DOS')).filter(Boolean),
        ] as Recipient[]);
      } catch (error: any) {
        toast.error(error.message || 'Unable to load school recipients.');
      } finally { setLoading(false); }
    })();
  }, [user]);

  const visibleRecipients = useMemo(() => recipients.filter((recipient) => (!schoolId || recipient.school_id === schoolId) && roles.includes(recipient.role)), [recipients, schoolId, roles]);
  const toggleRole = (role: string) => setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  const toggleRecipient = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const send = async () => {
    const chosen = visibleRecipients.filter((recipient) => selected.includes(recipient.id));
    if (!chosen.length) { toast.error('Select at least one recipient.'); return; }
    if (!message.trim()) { toast.error('Enter a message.'); return; }
    setSending(true);
    try {
      const grouped = chosen.reduce<Record<string, string[]>>((groups, recipient) => {
        (groups[recipient.school_id] ||= []).push(recipient.phone);
        return groups;
      }, {});
      const results = await Promise.all(Object.entries(grouped).map(([targetSchoolId, phones]) => sendBulkSMS(phones, message.trim(), undefined, targetSchoolId)));
      const successful = results.reduce((count, result) => count + (result.data?.filter((item: any) => item.success).length || (result.success ? 1 : 0)), 0);
      const failed = chosen.length - successful;
      if (successful) toast.success(`SMS sent to ${successful} recipient${successful === 1 ? '' : 's'}${failed ? `; ${failed} failed` : ''}.`);
      else toast.error('SMS delivery failed.');
    } finally { setSending(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><MessageSquare className="text-blue-600" /> Communicate with schools</h1><p className="mt-1 text-sm text-slate-500">Send SMS to selected school administrators, teachers, and DOS contacts.</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold text-slate-700">School<select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setSelected([]); }} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label><div><p className="text-sm font-semibold text-slate-700">Recipient roles</p><div className="mt-2 flex flex-wrap gap-2">{['School Admin', 'Teacher', 'DOS'].map((role) => <button type="button" key={role} onClick={() => toggleRole(role)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${roles.includes(role) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>{role}</button>)}</div></div></div>
      {loading ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Loading recipients…</div> : <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">{visibleRecipients.length ? visibleRecipients.map((recipient) => <label key={recipient.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"><input type="checkbox" checked={selected.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)} /><Users size={16} className="text-slate-400" /><span className="flex-1 text-sm text-slate-800">{recipient.name}<span className="ml-2 text-xs text-slate-500">{recipient.role} · {schools.find((school) => school.id === recipient.school_id)?.name || 'School'}</span></span><span className="text-xs text-slate-500">{recipient.phone}</span></label>) : <p className="p-5 text-sm text-slate-500">No contacts with phone numbers match the selected filters.</p>}</div>}
      <label className="block text-sm font-semibold text-slate-700">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={480} rows={5} placeholder="Type your message…" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
      <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{message.length}/480 characters · {selected.length} selected</span><button type="button" onClick={() => void send()} disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Send SMS</button></div>
    </section>
  </div>;
}
