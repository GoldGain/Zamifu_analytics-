import { useEffect, useState } from 'react';
import { Download, Pencil, Plus, RefreshCw, Save, Trash2, WalletCards, X } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Staff = { id: string; full_name: string; staff_number?: string | null; position: string; department?: string | null; basic_salary: number; is_active: boolean; version: number };
type Line = { id: string; staff_name: string; staff_number?: string | null; position: string; department?: string | null; basic_salary: number; earnings: unknown; deductions: unknown; gross_pay: number; total_deductions: number; net_pay: number; paid_amount?: number; arrears?: number; opening_arrears?: number; payment_status: string; payment_reference?: string | null; payment_date?: string | null };
type Run = { id: string; payroll_month: string; status: string; revision: number; school_name?: string; lines?: Line[] };
type SalaryComponent = { kind: 'allowance' | 'deduction'; name: string; amount: number; is_percentage: boolean; percentage_of?: string | null; is_statutory: boolean };
const emptyForm = { full_name: '', staff_number: '', position: 'Teacher', department: '', basic_salary: '', allowances: '', deductions: '' };
type FormState = typeof emptyForm;
const money = (n: number) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUTORY: { key: string; match: RegExp }[] = [
  { key: 'NSSF', match: /nssf/i },
  { key: 'SHIF', match: /shif|nhif/i },
  { key: 'Housing Levy', match: /housing|levy/i },
  { key: 'PAYE', match: /paye|income tax/i },
];
const asItems = (value: unknown): { name: string; amount: number }[] => {
  if (Array.isArray(value)) {
    return value.map((raw: any) => ({ name: String(raw?.name ?? 'Item'), amount: Number(raw?.calculated_amount ?? raw?.amount ?? 0) }));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([name, amount]) => ({ name, amount: Number(amount) || 0 }));
  }
  return [];
};

const pdf = (line: Line, run: Run, receipt = false) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const month = new Date(run.payroll_month).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  const earnings = asItems(line.earnings);
  const deductions = asItems(line.deductions);
  const buckets: Record<string, number> = { NSSF: 0, SHIF: 0, 'Housing Levy': 0, PAYE: 0, Other: 0 };
  deductions.forEach((d) => {
    const hit = STATUTORY.find((b) => b.match.test(d.name));
    buckets[hit ? hit.key : 'Other'] += d.amount;
  });
  const netPay = Number(line.net_pay);
  const paid = Number(line.paid_amount || 0);
  const owed = Number(line.arrears || 0);
  const broughtForward = Number(line.opening_arrears || 0);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text((run.school_name || 'SCHOOL').toUpperCase(), 105, 18, { align: 'center' });
  doc.setFontSize(11);
  doc.text(receipt ? 'PAYROLL PAYMENT RECEIPT' : 'EMPLOYEE PAYSLIP', 105, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Pay period: ${month}`, 105, 30, { align: 'center' });

  autoTable(doc, {
    startY: 36, theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [0, 61, 92], textColor: 255 },
    head: [['Employee details', '']],
    body: [
      ['Employee ID', line.staff_number || '—'],
      ['Name', line.staff_name],
      ['Department', line.department || '—'],
      ['Position', line.position],
    ],
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 135 } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4, theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [0, 61, 92], textColor: 255 },
    head: [['Earnings', 'Amount (KES)']],
    body: [
      ['Basic Salary', num(line.basic_salary)],
      ...earnings.map((e) => [e.name, num(e.amount)]),
      ['GROSS PAY', num(line.gross_pay)],
    ],
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: 'right' } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4, theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [0, 61, 92], textColor: 255 },
    head: [['Deductions', 'Amount (KES)']],
    body: [
      ...STATUTORY.map((b) => [b.key, num(buckets[b.key])]),
      ['Other', num(buckets.Other)],
      ['TOTAL DEDUCTIONS', num(line.total_deductions)],
    ],
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: 'right' } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4, theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [0, 61, 92], textColor: 255 },
    head: [['Summary', 'Amount (KES)']],
    body: [
      ['NET PAY', num(netPay)],
      ['Arrears brought forward', num(broughtForward)],
      ['Amount paid', line.payment_status === 'paid' ? num(paid) : '—'],
      ['BALANCE OWED', num(owed)],
      ['Total outstanding', num(owed + broughtForward)],
      ...(receipt ? [['Payment date', line.payment_date || '—'], ['Payment reference', line.payment_reference || '—']] : []),
    ],
    columnStyles: { 0: { cellWidth: 130, fontStyle: 'bold' }, 1: { cellWidth: 50, halign: 'right' } },
    didParseCell: (data: any) => {
      if (data.section === 'body' && (data.row.raw?.[0] === 'NET PAY' || data.row.raw?.[0] === 'BALANCE OWED')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [232, 244, 236];
      }
    },
  });

  doc.setFontSize(7.5); doc.setTextColor(110);
  doc.text(`Generated by Zamifu Analytics on ${new Date().toLocaleDateString('en-KE')}. Record-keeping document only.`, 105, 285, { align: 'center' });
  doc.save(`${receipt ? 'receipt' : 'payslip'}-${line.staff_name.replace(/[^a-z0-9]+/gi, '-')}-${run.payroll_month}.pdf`);
};

export default function Payroll() { const { user } = useAuth(); const [tab, setTab] = useState<'staff' | 'run' | 'records'>('staff'); const [staff, setStaff] = useState<Staff[]>([]); const [runs, setRuns] = useState<Run[]>([]); const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [editComponents, setEditComponents] = useState<SalaryComponent[]>([]);
  const [editTotals, setEditTotals] = useState({ allowances: 0, deductions: 0 });
  const load = async () => { if (!user?.schoolId) return; setLoading(true); const [{ data: s, error: se }, { data: r, error: re }] = await Promise.all([supabase.from('payroll_staff').select('id,full_name,staff_number,position,department,basic_salary,is_active,version').eq('school_id', user.schoolId).eq('is_active', true).order('full_name'), supabase.from('payroll_runs').select('id,payroll_month,status,revision,school_name').eq('school_id', user.schoolId).order('payroll_month', { ascending: false }).limit(24)]); if (se) toast.error(se.message); if (re) toast.error(re.message); setStaff((s || []) as Staff[]); setRuns((r || []) as Run[]); setLoading(false); };
  useEffect(() => { void load(); }, [user?.schoolId]);
  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setEditComponents([]);
    setEditTotals({ allowances: 0, deductions: 0 });
  };

  const startEdit = async (member: Staff) => {
    setEditing(member);
    setForm({
      full_name: member.full_name,
      staff_number: member.staff_number || '',
      position: member.position,
      department: member.department || '',
      basic_salary: String(member.basic_salary),
      allowances: '',
      deductions: '',
    });
    const { data, error } = await supabase.from('payroll_staff_components')
      .select('kind,name,amount,is_percentage,percentage_of,is_statutory')
      .eq('staff_id', member.id).eq('school_id', user?.schoolId || '');
    if (error) { toast.error(error.message); return; }
    const comps = (data || []) as SalaryComponent[];
    const total = (kind: SalaryComponent['kind']) => comps
      .filter((c) => c.kind === kind && !c.is_percentage)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const totals = { allowances: total('allowance'), deductions: total('deduction') };
    setEditComponents(comps);
    setEditTotals(totals);
    setForm((f) => ({ ...f, allowances: String(totals.allowances), deductions: String(totals.deductions) }));
  };

  // Re-sending the stored components keeps percentage/statutory detail intact
  // unless the admin actually changed the two amount fields.
  const componentsToSave = (): SalaryComponent[] => {
    const allow = Number(form.allowances || 0);
    const ded = Number(form.deductions || 0);
    if (editing && editComponents.length > 0 && allow === editTotals.allowances && ded === editTotals.deductions) {
      return editComponents;
    }
    const out: SalaryComponent[] = [];
    if (allow > 0) out.push({ kind: 'allowance', name: 'Allowances', amount: allow, is_percentage: false, percentage_of: null, is_statutory: false });
    if (ded > 0) out.push({ kind: 'deduction', name: 'Deductions', amount: ded, is_percentage: false, percentage_of: null, is_statutory: false });
    return out;
  };

  const saveStaff = async () => {
    if (saving) return;
    const name = form.full_name.trim();
    if (!name || !form.position.trim() || Number(form.basic_salary) <= 0) {
      toast.error('Name, position and a valid salary are required.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('payroll_save_staff', {
        p_staff_id: editing ? editing.id : null,
        p_expected_version: editing ? editing.version : null,
        p_staff: {
          full_name: name,
          staff_number: form.staff_number.trim() || null,
          position: form.position.trim(),
          department: form.department.trim() || null,
          basic_salary: Number(form.basic_salary),
          is_active: true,
        },
        p_components: componentsToSave(),
      } as never);
      if (error) { toast.error(error.message); return; }
      toast.success(editing ? 'Staff member updated' : 'Staff member saved');
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteStaff = async (member: Staff) => {
    const ok = window.confirm(
      `Remove ${member.full_name} from the payroll?\n\nIf this person already has payslips they are deactivated instead, so payroll history stays intact.`,
    );
    if (!ok) return;
    setBusyId(member.id);
    try {
      const { data, error } = await supabase.rpc('payroll_delete_staff', {
        p_staff_id: member.id,
        p_expected_version: member.version,
      } as never);
      if (error) { toast.error(error.message); return; }
      toast.success(data === 'deactivated'
        ? `${member.full_name} deactivated (payslip history kept)`
        : `${member.full_name} deleted`);
      if (editing?.id === member.id) resetForm();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const build = async () => { const { data, error } = await supabase.rpc('payroll_build_draft', { p_month: `${month}-01`, p_expected_revision: null }); if (error) toast.error(error.message); else { toast.success('Payroll draft generated'); await load(); setTab('records'); } return data as string; };
  const openRun = async (run: Run) => { const { data, error } = await supabase.from('payroll_lines').select('id,staff_name,staff_number,position,department,basic_salary,earnings,deductions,gross_pay,total_deductions,net_pay,paid_amount,arrears,opening_arrears,payment_status,payment_reference,payment_date').eq('run_id', run.id).order('staff_name'); if (error) toast.error(error.message); setRuns(current => current.map(x => x.id === run.id ? { ...x, lines: (data || []) as Line[] } : x)); };
  const markPaid = async (line: Line, run: Run) => {
    const reference = window.prompt('Bank reference or M-Pesa code (required except cash):', '');
    if (reference === null) return;
    const entered = window.prompt(
      `Amount actually paid. Net pay is KES ${num(line.net_pay)}. Leave blank for the full amount:`,
      num(line.net_pay),
    );
    if (entered === null) return;
    const amount = entered.trim() === '' ? Number(line.net_pay) : Number(entered.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0 || amount > Number(line.net_pay) + 0.005) {
      toast.error('Enter an amount between 0 and the net pay.');
      return;
    }
    const { error } = await supabase.rpc('payroll_mark_paid', {
      p_line_id: line.id,
      p_payment_date: new Date().toISOString().slice(0, 10),
      p_payment_method: 'mpesa',
      p_payment_reference: reference,
      p_amount_paid: amount,
    } as never);
    if (error) { toast.error(error.message); return; }
    const shortfall = Math.round((Number(line.net_pay) - amount) * 100) / 100;
    toast.success(shortfall > 0 ? `Payment recorded. Balance owed: KES ${num(shortfall)}` : 'Payment recorded in full');
    await openRun(run);
  };

  return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><WalletCards className="h-6 w-6 text-blue-600" /> Staff Payroll</h1><p className="mt-1 text-sm text-gray-500">Record-keeping only: generate payslips and record payments for school staff.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Refresh</button></div><div className="flex gap-2 border-b">{([['staff', 'Staff List'], ['run', 'Run Payroll'], ['records', 'Payslips & Receipts']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`border-b-2 px-4 py-2 text-sm font-semibold ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>{label}</button>)}</div>{tab === 'staff' && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3 rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? 'Edit staff member' : 'Add staff member'}</h2>
              {editing && (
                <button onClick={resetForm} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                  <X className="h-3 w-3" />Cancel
                </button>
              )}
            </div>
            {[['full_name','Name'],['staff_number','TSC / National ID'],['position','Role'],['department','Department'],['basic_salary','Basic salary'],['allowances','Allowances'],['deductions','Deductions']].map(([key, label]) => (
              <label key={key} className="block text-xs font-medium text-gray-600">{label}
                <input
                  type={key.includes('salary') || key === 'allowances' || key === 'deductions' ? 'number' : 'text'}
                  value={form[key as keyof FormState]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
            ))}
            <button
              onClick={() => void saveStaff()}
              disabled={saving}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus className="mr-1 inline h-4 w-4" />{saving ? 'Saving…' : editing ? 'Update staff' : 'Save staff'}
            </button>
            {editing && <p className="text-xs text-gray-500">Existing allowance and deduction detail is kept unless you change those two fields.</p>}
          </div>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Basic salary</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center">Loading…</td></tr>
                ) : staff.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">No staff members yet.</td></tr>
                ) : staff.map(member => (
                  <tr key={member.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{member.full_name}<div className="text-xs text-gray-500">{member.staff_number || '—'}</div></td>
                    <td className="px-4 py-3">{member.position}</td>
                    <td className="px-4 py-3">{member.department || '—'}</td>
                    <td className="px-4 py-3">{money(member.basic_salary)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => void startEdit(member)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50">
                          <Pencil className="h-3 w-3" />Edit
                        </button>
                        <button onClick={() => void deleteStaff(member)} disabled={busyId === member.id}
                          className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Trash2 className="h-3 w-3" />{busyId === member.id ? 'Removing…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'run' && <div className="max-w-xl rounded-xl border bg-white p-6"><h2 className="text-lg font-semibold">Generate monthly payroll</h2><p className="mt-1 text-sm text-gray-500">The server snapshots active staff, allowances, deductions, gross pay and net pay.</p><input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-5 rounded-lg border px-3 py-2" /><button onClick={() => void build()} className="mt-4 block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Save className="mr-1 inline h-4 w-4" />Generate Payslips</button></div>}{tab === 'records' && <div className="space-y-4">{runs.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-gray-500">No payroll runs yet.</div> : runs.map(run => <div key={run.id} className="overflow-hidden rounded-xl border bg-white"><div className="flex items-center justify-between bg-gray-50 px-4 py-3"><div><p className="font-semibold">{new Date(run.payroll_month).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</p><p className="text-xs text-gray-500 capitalize">{run.status}</p></div><button onClick={() => void openRun(run)} className="rounded-lg border px-3 py-1.5 text-xs">Load lines</button></div>{run.lines && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500"><th className="px-4 py-2">Staff</th><th className="px-4 py-2">Gross</th><th className="px-4 py-2">Net</th><th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Balance owed</th><th className="px-4 py-2">Actions</th></tr></thead><tbody>{run.lines.map(line => <tr key={line.id} className="border-b last:border-0"><td className="px-4 py-3">{line.staff_name}<div className="text-xs text-gray-500">{line.position}</div></td><td className="px-4 py-3">{money(line.gross_pay)}</td><td className="px-4 py-3 font-semibold">{money(line.net_pay)}</td><td className="px-4 py-3 capitalize">{line.payment_status}</td>
                          <td className="px-4 py-3">{Number(line.arrears || 0) > 0 ? money(Number(line.arrears)) : "—"}</td><td className="flex gap-2 px-4 py-3"><button onClick={() => pdf(line, run)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"><Download className="h-3 w-3" />Payslip</button>{line.payment_status === 'pending' ? <button onClick={() => void markPaid(line, run)} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Mark paid</button> : <button onClick={() => pdf(line, run, true)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"><Download className="h-3 w-3" />Receipt</button>}</td></tr>)}</tbody></table></div>}</div>)}</div>}</div>;
}
