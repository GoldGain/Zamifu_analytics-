import { useEffect, useState } from 'react';
import { AlertTriangle, ArchiveRestore, Loader2, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseUntyped } from '@/lib/supabase/client';
import { deleteScopedUser, retryLearnerAuthCleanup } from '@/lib/supabase/accountActions';
import { useAuth } from '@/contexts/AuthContext';
import { formatClassStream } from '@/lib/class-label';
import { fetchAllRows } from '@/lib/paginatedQuery';

type ArchivedLearner = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent2_phone: string | null;
  profile_id: string | null;
  class_id: string | null;
  classes?: { name?: string | null; stream?: string | null; stream_name?: string | null } | null;
};

type ImpactRow = { table: string; label: string; count: number };
type DeletionImpact = {
  records: ImpactRow[];
  guardianLinksToOtherLearners: number;
  feePaymentTotal: number;
  parentPaymentTotal: number;
  invoicePaidTotal: number;
  invoiceBalanceTotal: number;
  openLoans: number;
  unpaidLibraryFines: number;
  smsLogs: number;
  smsTransactions: number;
  hasLinkedLogin: boolean;
};

const DEPENDENT_TABLES: Array<{ table: string; label: string }> = [
  { table: 'results', label: 'Exam marks and results' },
  { table: 'marklist_data', label: 'Marklist entries' },
  { table: 'student_term_averages', label: 'Term averages and positions' },
  { table: 'attendance', label: 'Attendance records' },
  { table: 'cbc_competencies', label: 'CBC competency records' },
  { table: 'report_cards', label: 'Saved report cards' },
  { table: 'student_promotions', label: 'Promotion history' },
  { table: 'learner_optional_subjects', label: 'Optional-subject selections' },
  { table: 'homework_submissions', label: 'Homework submissions' },
  { table: 'conferences', label: 'Parent-teacher conferences' },
  { table: 'teacher_messages', label: 'Learner-related teacher messages' },
  { table: 'teacher_selected_learners', label: 'Teacher-selected learner lists' },
  { table: 'fee_invoices', label: 'Fee invoices' },
  { table: 'fee_payments', label: 'Fee-ledger transactions' },
  { table: 'parent_payments', label: 'Parent payment transactions' },
  { table: 'library_borrowings', label: 'Library borrowing records' },
  { table: 'parent_student_links', label: 'Guardian links to this learner' },
];

async function countRows(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await (supabaseUntyped as any)
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count || 0;
}

async function fetchLearnerRows<T>(table: string, columns: string, learnerId: string): Promise<T[]> {
  const rows = await fetchAllRows<T>((from, to) => (supabaseUntyped as any)
    .from(table)
    .select(columns)
    .eq('student_id', learnerId)
    .order('id', { ascending: true })
    .range(from, to));
  if (rows.length >= 100000) throw new Error(`The ${table} impact count exceeds the safe preview limit.`);
  return rows;
}

function phoneVariants(...values: Array<string | null | undefined>): string[] {
  const variants = new Set<string>();
  for (const value of values) {
    const phone = String(value || '').trim();
    if (!phone) continue;
    variants.add(phone);
    const digits = phone.replace(/\D/g, '');
    if (digits) variants.add(digits);
    if (digits.startsWith('0') && digits.length >= 9) variants.add(`+254${digits.slice(1)}`);
    if (digits.startsWith('254')) variants.add(`+${digits}`);
    if (digits.length === 9 && digits.startsWith('7')) variants.add(`+254${digits}`);
  }
  return [...variants];
}

async function countSms(table: 'sms_logs' | 'school_sms_transactions', schoolId: string, phones: string[]): Promise<number> {
  if (!phones.length) return 0;
  const { count, error } = await (supabaseUntyped as any)
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('recipient_phone', phones);
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count || 0;
}

const money = (amount: number) => new Intl.NumberFormat('en-KE', {
  style: 'currency', currency: 'KES', maximumFractionDigits: 0,
}).format(amount || 0);

export default function RecycleBin() {
  const { user } = useAuth();
  const [learners, setLearners] = useState<ArchivedLearner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletionCandidate, setDeletionCandidate] = useState<ArchivedLearner | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [authCleanupPending, setAuthCleanupPending] = useState(false);

  const loadArchived = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data, error } = await supabaseUntyped
      .from('students')
      .select('id, first_name, last_name, admission_number, parent_name, parent_phone, parent2_phone, profile_id, class_id, classes!students_class_id_fkey(name, stream, stream_name)')
      .eq('school_id', user.schoolId)
      .eq('is_active', false)
      .order('updated_at', { ascending: false });
    if (error) toast.error(`Could not load Recycle Bin: ${error.message}`);
    setLearners((data || []) as ArchivedLearner[]);
    setLoading(false);
  };

  useEffect(() => { void loadArchived(); }, [user?.schoolId]);

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

  const preparePermanentDeletion = async (learner: ArchivedLearner) => {
    if (!user?.schoolId) return;
    setDeletionCandidate(learner);
    setImpact(null);
    setImpactError(null);
    setAuthCleanupPending(false);
    setImpactLoading(true);
    setBusyId(learner.id);
    try {
      const phones = phoneVariants(learner.parent_phone, learner.parent2_phone);
      const [records, guardianLinksToOtherLearners, feePayments, parentPayments, invoices, loans, smsLogs, smsTransactions] = await Promise.all([
        Promise.all(DEPENDENT_TABLES.map(async ({ table, label }) => ({
          table,
          label,
          count: await countRows(table, table === 'parent_student_links' ? 'student_id' : 'student_id', learner.id),
        }))),
        learner.profile_id ? countRows('parent_student_links', 'parent_id', learner.profile_id) : Promise.resolve(0),
        fetchLearnerRows<{ amount: number | string }>('fee_payments', 'id, amount', learner.id),
        fetchLearnerRows<{ amount: number | string }>('parent_payments', 'id, amount', learner.id),
        fetchLearnerRows<{ amount_paid: number | string; balance: number | string | null }>('fee_invoices', 'id, amount_paid, balance', learner.id),
        fetchLearnerRows<{ returned_at: string | null; fine_amount: number | string | null; fine_paid: boolean }>('library_borrowings', 'id, returned_at, fine_amount, fine_paid', learner.id),
        countSms('sms_logs', user.schoolId, phones),
        countSms('school_sms_transactions', user.schoolId, phones),
      ]);
      setImpact({
        records,
        guardianLinksToOtherLearners,
        feePaymentTotal: feePayments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        parentPaymentTotal: parentPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        invoicePaidTotal: invoices.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0),
        invoiceBalanceTotal: invoices.reduce((sum, row) => sum + Number(row.balance || 0), 0),
        openLoans: loans.filter((row) => !row.returned_at).length,
        unpaidLibraryFines: loans.reduce((sum, row) => sum + (!row.fine_paid ? Number(row.fine_amount || 0) : 0), 0),
        smsLogs,
        smsTransactions,
        hasLinkedLogin: Boolean(learner.profile_id),
      });
    } catch (error: any) {
      setImpactError(error?.message || 'Impact counts could not be verified. Permanent deletion is disabled.');
    } finally {
      setBusyId(null);
      setImpactLoading(false);
    }
  };

  const cancelPermanentDeletion = () => {
    if (busyId) return;
    if (authCleanupPending) {
      toast.error('Auth cleanup is still pending. Retry the login-account deletion before closing this dialog.');
      return;
    }
    setDeletionCandidate(null);
    setImpact(null);
    setImpactError(null);
  };

  const permanentlyDeleteLearner = async () => {
    if (!user?.schoolId || !deletionCandidate || impactLoading) return;
    const learner = deletionCandidate;
    if (!authCleanupPending && (!impact || impactError)) return;
    setBusyId(learner.id);
    try {
      if (authCleanupPending && learner.profile_id) {
        await retryLearnerAuthCleanup({ target_user_id: learner.profile_id, school_id: user.schoolId });
      } else {
        await deleteScopedUser({
          record_id: learner.id,
          target_type: 'student',
          school_id: user.schoolId,
          permanent: true,
        });
      }
      toast.success('Learner permanently deleted.');
      setDeletionCandidate(null);
      setImpact(null);
      setAuthCleanupPending(false);
      await loadArchived();
    } catch (error: any) {
      if (error?.authCleanupPending) setAuthCleanupPending(true);
      toast.error(`Could not permanently delete learner: ${error.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const totalRecords = impact?.records.reduce((sum, row) => sum + row.count, 0) || 0;
  const hasReferences = Boolean(impact && (
    totalRecords > 0 || impact.guardianLinksToOtherLearners > 0 || impact.feePaymentTotal > 0
    || impact.parentPaymentTotal > 0 || impact.invoicePaidTotal > 0 || impact.invoiceBalanceTotal > 0
    || impact.openLoans > 0 || impact.unpaidLibraryFines > 0 || impact.smsLogs > 0 || impact.smsTransactions > 0
  ));
  const isCandidateBusy = Boolean(deletionCandidate && busyId === deletionCandidate.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recycle Bin</h1>
        <p className="text-sm text-gray-500">Restore archived learners, or review the affected records before permanent deletion.</p>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {loading ? <div className="p-10 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-600" /></div> : learners.length === 0 ? <div className="p-10 text-center text-sm text-gray-500"><Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />Recycle Bin is empty.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b bg-gray-50"><th className="px-5 py-3 text-xs uppercase text-gray-500">Learner</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Admission No.</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Class</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Parent</th><th className="px-5 py-3 text-xs uppercase text-gray-500">Actions</th></tr></thead><tbody>{learners.map((learner) => <tr key={learner.id} className="border-b"><td className="px-5 py-3 text-sm font-medium">{learner.first_name} {learner.last_name}</td><td className="px-5 py-3 text-sm">{learner.admission_number || '-'}</td><td className="px-5 py-3 text-sm">{formatClassStream(learner.classes)}</td><td className="px-5 py-3 text-sm">{learner.parent_name || '-'}</td><td className="px-5 py-3"><div className="flex gap-2"><button type="button" disabled={busyId === learner.id} onClick={() => void restoreLearner(learner)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold disabled:opacity-50"><ArchiveRestore className="w-3.5 h-3.5" /> Restore</button><button type="button" disabled={Boolean(busyId)} onClick={() => void preparePermanentDeletion(learner)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</button></div></td></tr>)}</tbody></table></div>
        )}
      </div>

      {deletionCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="permanent-delete-title">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <h2 id="permanent-delete-title" className="text-lg font-bold text-gray-900">Review permanent deletion</h2>
                <p className="mt-1 text-sm text-gray-600">{deletionCandidate.first_name} {deletionCandidate.last_name} · Admission {deletionCandidate.admission_number || '—'} · {formatClassStream(deletionCandidate.classes)}</p>
              </div>
              <button type="button" onClick={cancelPermanentDeletion} disabled={Boolean(busyId)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40" aria-label="Close deletion preview"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 p-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex gap-2 font-semibold"><AlertTriangle className="h-5 w-5 shrink-0" />{impact && !impactLoading && !impactError && !hasReferences ? 'No linked records found.' : 'This action cannot be undone.'}</div>
                <p className="mt-2">{impact && !impactLoading && !impactError && !hasReferences
                  ? 'This learner has no linked marks, fees, attendance, guardian links, library records or matching SMS history. Do you want to permanently delete the learner and linked login?'
                  : 'The learner record and its dependent database rows will be deleted first; the linked login account is removed last. If a database step fails, the transaction is rolled back and deletion is stopped.'}</p>
              </div>

              {authCleanupPending ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Learner data has been deleted, but the login account still needs cleanup.</strong> Retry the server-side Auth deletion below. The remaining account is verified to have no learner row.</div> : impactLoading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin" /> Counting affected records and totals…</div> : impactError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Cannot safely continue:</strong> {impactError} The deletion button remains disabled until every count can be verified.</div> : impact && (
                <>
                  <div>
                    <h3 className="mb-2 font-semibold text-gray-900">Database records affected</h3>
                    <div className="overflow-hidden rounded-xl border">
                      {impact.records.filter((row) => row.count > 0).map((row) => <div key={row.table} className="flex justify-between gap-4 border-b last:border-0 px-4 py-2.5 text-sm"><span className="text-gray-700">{row.label}</span><strong className="tabular-nums text-gray-900">{row.count.toLocaleString()}</strong></div>)}
                      {totalRecords === 0 && <div className="px-4 py-3 text-sm text-gray-500">No dependent learner records were found.</div>}
                      <div className="flex justify-between gap-4 bg-gray-50 px-4 py-2.5 text-sm font-semibold"><span>Total referenced rows</span><span className="tabular-nums">{totalRecords.toLocaleString()}</span></div>
                    </div>
                    {impact.guardianLinksToOtherLearners > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">This learner login is also a guardian for {impact.guardianLinksToOtherLearners} other learner link(s). Those links are associated with the login and may be removed when the account is deleted.</p>}
                    <p className="mt-2 text-xs text-gray-500">Linked authentication account: <strong>{impact.hasLinkedLogin ? 'yes' : 'no'}</strong></p>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold text-gray-900">Fees and transactions</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">Fee-ledger payments recorded</span><strong>{money(impact.feePaymentTotal)}</strong></div>
                      <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">Parent payment transactions recorded</span><strong>{money(impact.parentPaymentTotal)}</strong></div>
                      <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">Invoice paid total</span><strong>{money(impact.invoicePaidTotal)}</strong></div>
                      <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">Invoice balance remaining</span><strong>{money(impact.invoiceBalanceTotal)}</strong></div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">Library loans still open</span><strong>{impact.openLoans.toLocaleString()}</strong></div>
                    <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">Unpaid library fines</span><strong>{money(impact.unpaidLibraryFines)}</strong></div>
                    <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">SMS log rows matching guardian phone(s)</span><strong>{impact.smsLogs.toLocaleString()}</strong></div>
                    <div className="rounded-xl border p-3 text-sm"><span className="block text-xs text-gray-500">SMS transaction rows matching guardian phone(s)</span><strong>{impact.smsTransactions.toLocaleString()}</strong></div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 border-t bg-gray-50 p-4 sm:flex-row">
              <button type="button" onClick={cancelPermanentDeletion} disabled={Boolean(busyId)} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void permanentlyDeleteLearner()} disabled={(!authCleanupPending && (!impact || Boolean(impactError))) || impactLoading || isCandidateBusy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busyId === deletionCandidate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {authCleanupPending ? 'Retry login deletion' : 'Yes, delete permanently'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
