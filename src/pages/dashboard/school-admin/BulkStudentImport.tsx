import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';
import { deleteScopedUser, syncParentAccounts } from '@/lib/supabase/accountActions';

type ImportRow = Record<string, string>;
type ImportResult = { row: number; admission_number: string; assessment_number: string; name: string; email: string; password: string; status: 'created' | 'failed'; message?: string };

const ADMISSION_HEADER = 'admission_number';
const ASSESSMENT_HEADER = 'assessment_number';
const LEGACY_IDENTIFIER_HEADER = 'admission_no_assessment_no';

const TEMPLATE_HEADERS = [
  ADMISSION_HEADER, ASSESSMENT_HEADER, 'first_name', 'middle_name', 'last_name', 'class_name', 'student_email',
  'gender', 'date_of_birth', 'nationality', 'county', 'sub_county',
  'boarding_status', 'disability_status', 'curriculum', 'parent_name', 'parent_phone', 'parent_email',
];

function parseCsv(text: string): ImportRow[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) lines.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) lines.push(row); }
  if (lines.length < 2) return [];
  const headers = lines[0].map((h) => {
    const normalized = h.trim().toLowerCase().replace(/[\s/]+/g, '_');
    if (['admission_no', 'admission'].includes(normalized)) return ADMISSION_HEADER;
    if (['assessment_no', 'assessment'].includes(normalized)) return ASSESSMENT_HEADER;
    if (normalized === LEGACY_IDENTIFIER_HEADER) return LEGACY_IDENTIFIER_HEADER;
    return normalized;
  });
  return lines.slice(1).map((values) => headers.reduce<ImportRow>((obj, header, index) => {
    obj[header] = (values[index] || '').trim();
    return obj;
  }, {}));
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BulkStudentImport() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  useEffect(() => {
    if (!user?.schoolId) return;
    setLoading(true);
    supabaseUntyped.from('classes').select('id, name').eq('school_id', user.schoolId).eq('is_active', true).order('name')
      .then(({ data, error }) => {
        if (error) toast.error(`Could not load classes: ${error.message}`);
        setClasses(data || []);
      })
      .finally(() => setLoading(false));
  }, [user?.schoolId]);

  const classByName = useMemo(() => new Map(classes.map((c) => [c.name.trim().toLowerCase(), c])), [classes]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) { toast.error('The CSV has no learner rows. Download the template and try again.'); return; }
    setRows(parsed);
    setResults([]);
    setFileName(file.name);
    toast.success(`${parsed.length} learner rows loaded for review.`);
  };

  const validation = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((row, index) => {
        const legacy = row[LEGACY_IDENTIFIER_HEADER]?.trim();
        const admission = row[ADMISSION_HEADER]?.trim() || legacy?.split('/')[0]?.trim();
        const assessment = row[ASSESSMENT_HEADER]?.trim() || legacy?.split('/')[1]?.trim();
        const first = row.first_name?.trim();
      const last = row.last_name?.trim();
      const className = row.class_name?.trim().toLowerCase();
      const issues: string[] = [];
      if (!admission && !assessment) issues.push('missing admission_number or assessment_number');
      if (!first) issues.push('missing first_name');
      if (!last) issues.push('missing last_name');
      if (!className) issues.push('missing class_name');
      else if (!classByName.has(className)) issues.push('class not found');
      const key = (admission || assessment)?.toLowerCase() || `row-${index}`;
      if (seen.has(key)) issues.push('duplicate admission_number/assessment_number in CSV');
      seen.add(key);
      return { row, rowNumber: index + 2, issues };
    });
  }, [rows, classByName]);

  const invalidCount = validation.filter((item) => item.issues.length > 0).length;

  const importStudents = async () => {
    if (!user?.schoolId || !rows.length) return;
    if (invalidCount > 0) { toast.error('Fix the highlighted CSV rows before importing.'); return; }
    setImporting(true);
    setResults([]);
    try {
      const { data: existing } = await supabaseUntyped.from('students').select('admission_number, assessment_number, student_email').eq('school_id', user.schoolId);
      const existingAdmissions = new Set((existing || []).flatMap((s: any) => [s.admission_number, s.assessment_number]).filter(Boolean).map((value: any) => String(value).trim().toLowerCase()));
      const existingEmails = new Set((existing || []).map((s: any) => String(s.student_email || '').trim().toLowerCase()));
      const schoolPrefix = user.schoolId.split('-')[0] || 'student';
      const completed: ImportResult[] = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const legacy = row[LEGACY_IDENTIFIER_HEADER]?.trim();
        const admission = row[ADMISSION_HEADER]?.trim() || legacy?.split('/')[0]?.trim() || '';
        const assessment = row[ASSESSMENT_HEADER]?.trim() || legacy?.split('/')[1]?.trim() || '';
        const loginIdentifier = admission || assessment;
        const admissionKey = (admission || assessment).toLowerCase();
        const classRow = classByName.get(row.class_name.trim().toLowerCase());
        const fallbackEmail = `${loginIdentifier.toLowerCase().replace(/[^a-z0-9]+/g, '')}.${schoolPrefix}@student.edu`;
        const email = (row.student_email?.trim().toLowerCase() || fallbackEmail);
        const curriculum = row.curriculum?.trim() || 'CBE';
        const genderValue = row.gender?.trim().toLowerCase();
        const gender = ['male', 'female', 'other'].includes(genderValue || '') ? genderValue : null;
        const password = `${loginIdentifier}@2025`;
        const name = `${row.first_name} ${row.middle_name ? `${row.middle_name} ` : ''}${row.last_name}`.trim();
        try {
          if (existingAdmissions.has(admissionKey) || (assessment && existingAdmissions.has(assessment.toLowerCase()))) throw new Error('admission or assessment number already exists in this school');
          if (existingEmails.has(email)) throw new Error('student email already exists in this school');
          if (!classRow) throw new Error('class not found');

          const authData = await createScopedUser({
            email,
            password,
            first_name: row.first_name,
            last_name: row.last_name,
            role: 'student',
            school_id: user.schoolId,
            admission_number: admission || assessment,
            class_id: classRow.id,
            metadata: { admission_number: admission || null, assessment_number: assessment || null, class_id: classRow.id },
          });
          const { data: studentData, error } = await supabaseUntyped.from('students').insert({
            profile_id: authData.user.id,
            school_id: user.schoolId,
            admission_number: admission || assessment,
            assessment_number: assessment || null,
            first_name: row.first_name,
            middle_name: row.middle_name || null,
            last_name: row.last_name,
            class_id: classRow.id,
            student_email: email,
            gender,
            date_of_birth: row.date_of_birth || null,
            nationality: row.nationality || 'Kenyan',
            curriculum,
            county: row.county || null,
            sub_county: row.sub_county || null,
            boarding_status: row.boarding_status || 'day',
            disability_status: row.disability_status || null,
            parent_name: row.parent_name || null,
            parent_phone: row.parent_phone || null,
            parent_email: row.parent_email || null,
            parent_id: null,
            is_active: true,
            enrollment_date: new Date().toISOString().split('T')[0],
          }).select('id').single();
          if (error) throw new Error(error.message);
          if (!studentData?.id) throw new Error('Learner record was created without an identifier.');
          try {
            await syncParentAccounts({
              student_id: studentData.id,
              primary: {
                name: row.parent_name,
                phone: row.parent_phone,
                email: row.parent_email,
              },
            });
          } catch (parentError: any) {
            await deleteScopedUser({ record_id: studentData.id, target_type: 'student', school_id: user.schoolId });
            throw new Error(`Parent account could not be linked: ${parentError.message}`);
          }
          existingAdmissions.add(admissionKey);
          if (assessment) existingAdmissions.add(assessment.toLowerCase());
          existingEmails.add(email);
          completed.push({ row: index + 2, admission_number: admission, assessment_number: assessment, name, email, password, status: 'created' });
        } catch (error: any) {
          completed.push({ row: index + 2, admission_number: admission, assessment_number: assessment, name, email, password: '', status: 'failed', message: error?.message || 'Import failed' });
        }
        setResults([...completed]);
      }
      const createdCount = completed.filter((item) => item.status === 'created').length;
      toast.success(`${createdCount} of ${rows.length} learner accounts created.`);
    } finally {
      setImporting(false);
    }
  };

  const downloadCredentials = () => {
    const created = results.filter((result) => result.status === 'created');
    downloadCsv('zamifu-student-login-credentials.csv', [
      [ADMISSION_HEADER, ASSESSMENT_HEADER, 'student_name', 'email', 'temporary_password'],
      ...created.map((result) => [result.admission_number, result.assessment_number, result.name, result.email, result.password]),
    ]);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2"><Users className="text-blue-600" /> Bulk Student Upload</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a CSV to create learner records and individual student login accounts in one controlled batch.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <h2 className="font-black text-gray-900 flex items-center gap-2"><FileSpreadsheet className="text-blue-600" size={18} /> Step 1: Prepare CSV</h2>
            <button type="button" onClick={() => downloadCsv('zamifu-student-import-template.csv', [TEMPLATE_HEADERS, ['ADM001', 'ASM001', 'John', '', 'Kamau', classes[0]?.name || 'Grade 1', '', 'Male', '', '', 'Kenyan', '', '', 'day', '', 'CBE', '', '', '', '']
])} className="text-sm font-bold text-blue-700 hover:underline flex items-center gap-1"><Download size={15} /> Download template</button>
          </div>
          <p className="text-xs text-gray-600">Required columns are <strong>admission_number or assessment_number, first_name, last_name, and class_name</strong>. Provide both identifiers whenever available; legacy merged headers remain supported.
 Email and curriculum are optional; blank curriculum values default to <strong>CBE</strong>, while blank email values receive a unique generated student email. The default temporary password is the admission number followed by <strong>@2025</strong>.</p>
          <label className="border-2 border-dashed border-blue-200 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 transition">
            <Upload className="text-blue-600 mb-2" />
            <span className="font-bold text-blue-800">Choose CSV file</span>
            <span className="text-xs text-gray-500 mt-1">{fileName || 'CSV only'}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
          {loading && <p className="text-sm text-gray-500">Loading school classes...</p>}
        </section>

        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-black text-blue-900">Account safety</h2>
          <p className="text-sm text-blue-800">Each learner is checked for duplicate admission or assessment numbers and emails before account creation. Existing learners are not overwritten.</p>
          <p className="text-sm text-blue-800">The batch uses the same authenticated admin provisioning function as single-learner registration, confirms accounts, and reports failed rows without stopping the remaining import.</p>
          <p className="text-xs text-blue-700">Share the downloaded credentials securely and require learners to change their password after first login.</p>
        </section>
      </div>

      {rows.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-black text-gray-900">Step 2: Review {rows.length} rows</h2><p className="text-xs text-gray-500">{invalidCount ? `${invalidCount} rows require correction.` : 'All required fields and class names are valid.'}</p></div>
            <button type="button" disabled={importing || invalidCount > 0} onClick={importStudents} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2">{importing ? <Loader2 className="animate-spin" size={16} /> : <Users size={16} />} {importing ? 'Creating accounts...' : 'Create learner accounts'}</button>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left border-b"><th className="p-2">Row</th><th className="p-2">Admission Number</th><th className="p-2">Assessment Number</th><th className="p-2">Name</th><th className="p-2">Class</th><th className="p-2">Validation</th></tr></thead><tbody>{validation.slice(0, 100).map((item) => <tr key={item.rowNumber} className="border-b last:border-0"><td className="p-2">{item.rowNumber}</td><td className="p-2 font-semibold">{item.row[ADMISSION_HEADER] || item.row[LEGACY_IDENTIFIER_HEADER]?.split('/')[0]?.trim() || '-'}</td><td className="p-2 font-semibold">{item.row[ASSESSMENT_HEADER] || item.row[LEGACY_IDENTIFIER_HEADER]?.split('/')[1]?.trim() || '-'}</td><td className="p-2">{[item.row.first_name, item.row.middle_name, item.row.last_name].filter(Boolean).join(' ')}</td><td className="p-2">{item.row.class_name}</td><td className={`p-2 ${item.issues.length ? 'text-red-600' : 'text-green-700'}`}>{item.issues.length ? item.issues.join(', ') : 'Ready'}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {results.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-black text-gray-900">Step 3: Import results</h2><p className="text-xs text-gray-500">Credentials are shown only for accounts created in this batch.</p></div><button type="button" onClick={downloadCredentials} className="text-sm font-bold text-blue-700 flex items-center gap-1"><Download size={15} /> Download credentials</button></div>
          <div className="space-y-2">{results.map((result) => <div key={`${result.row}-${result.admission_number}`} className={`rounded-lg p-3 text-sm ${result.status === 'created' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{result.status === 'created' ? <CheckCircle2 className="inline mr-2" size={16} /> : <AlertCircle className="inline mr-2" size={16} />}Row {result.row}: <strong>{result.name || result.admission_number}</strong> — {result.status === 'created' ? `${result.email} / ${result.password}` : result.message}</div>)}</div>
        </section>
      )}
    </div>
  );
}
