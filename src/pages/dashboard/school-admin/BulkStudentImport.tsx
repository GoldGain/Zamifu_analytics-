import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { createScopedUser } from '@/lib/supabase/createUser';
import { syncParentAccounts } from '@/lib/supabase/accountActions';
import { SENIOR_PATHWAYS, tracksForSeniorPathway } from '@/lib/seniorPathways';
import { buildClassStreamImportResolver, formatClassStream, type ClassStreamImportRecord } from '@/lib/class-label';

type ImportRow = Record<string, string>;
type ImportMode = 'add' | 'update';
type MatchBy = 'admission' | 'assessment' | 'both' | 'either';
type ResultStatus = 'created' | 'updated' | 'unchanged' | 'failed';
type ImportResult = {
  row: number;
  admission_number: string;
  assessment_number: string;
  name: string;
  email?: string;
  password?: string;
  status: ResultStatus;
  message?: string;
};

type ExistingStudent = {
  id: string;
  admission_number: string | null;
  assessment_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  class_id: string | null;
  stream_id: string | null;
  student_email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  county: string | null;
  sub_county: string | null;
  boarding_status: string | null;
  disability_status: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  curriculum: string | null;
  pathway: string | null;
  track: string | null;
};

type PreviewPlan = {
  row: ImportRow;
  rowNumber: number;
  admission: string;
  assessment: string;
  name: string;
  classRow?: ClassStreamImportRecord;
  target?: ExistingStudent;
  changes: Array<{ label: string; from: string; to: string }>;
  issues: string[];
  action: 'create' | 'update' | 'unchanged' | 'conflict' | 'skip';
};

const ADMISSION_HEADER = 'admission_number';
const ASSESSMENT_HEADER = 'assessment_number';
const LEGACY_IDENTIFIER_HEADER = 'admission_no_assessment_no';

const TEMPLATE_HEADERS = [
  ADMISSION_HEADER, ASSESSMENT_HEADER, 'first_name', 'middle_name', 'last_name', 'class_name', 'stream', 'student_email',
  'gender', 'date_of_birth', 'nationality', 'county', 'sub_county',
  'boarding_status', 'disability_status', 'curriculum', 'pathway', 'track', 'parent_name', 'parent_phone', 'parent_email',
];

const EDITABLE_FIELDS: Array<{ key: string; label: string }> = [
  { key: ADMISSION_HEADER, label: 'Admission No.' },
  { key: ASSESSMENT_HEADER, label: 'Assessment No.' },
  { key: 'first_name', label: 'First Name' },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'class_id', label: 'Class / Stream' },
  { key: 'student_email', label: 'Learner Email' },
  { key: 'gender', label: 'Gender' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'county', label: 'County' },
  { key: 'sub_county', label: 'Sub-County' },
  { key: 'boarding_status', label: 'Boarding Status' },
  { key: 'disability_status', label: 'Disability / Special Needs' },
  { key: 'curriculum', label: 'Curriculum' },
  { key: 'pathway', label: 'Pathway' },
  { key: 'track', label: 'Track' },
  { key: 'parent_name', label: 'Parent Name' },
  { key: 'parent_phone', label: 'Parent Phone' },
  { key: 'parent_email', label: 'Parent Email' },
];

function parseCsv(text: string): { rows: ImportRow[]; ignored: string[] } {
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
  if (lines.length < 2) return { rows: [], ignored: [] };
  const aliases: Record<string, string> = {
    admission: ADMISSION_HEADER, admission_no: ADMISSION_HEADER, adm_no: ADMISSION_HEADER, adm: ADMISSION_HEADER,
    assessment: ASSESSMENT_HEADER, assessment_no: ASSESSMENT_HEADER, asm_no: ASSESSMENT_HEADER, asm: ASSESSMENT_HEADER,
    class: 'class_name', grade: 'class_name', form: 'class_name', classname: 'class_name',
    stream: 'stream', stream_name: 'stream_name',
    phone: 'parent_phone', phone_number: 'parent_phone', parentphone: 'parent_phone', mobile: 'parent_phone',
    contact: 'parent_phone', contact_phone: 'parent_phone', guardian_phone: 'parent_phone', parent_mobile: 'parent_phone',
    parent: 'parent_name', parentname: 'parent_name', guardian: 'parent_name', guardian_name: 'parent_name',
    email: 'student_email', learner_email: 'student_email', studentemail: 'student_email',
    parentemail: 'parent_email', guardian_email: 'parent_email', parentemailaddress: 'parent_email',
    dob: 'date_of_birth', birth_date: 'date_of_birth', dateofbirth: 'date_of_birth',
    admissionnumber: ADMISSION_HEADER, assessmentnumber: ASSESSMENT_HEADER, admissionnumber_: ADMISSION_HEADER,
    firstname: 'first_name', middlename: 'middle_name', lastname: 'last_name', surname: 'last_name',
    gender_: 'gender', sex: 'gender', boarding: 'boarding_status', disability: 'disability_status',
    county_: 'county', subcounty: 'sub_county', sub_county_: 'sub_county', nationality_: 'nationality',
  };
  const knownHeaders = new Set<string>([ADMISSION_HEADER, ASSESSMENT_HEADER, LEGACY_IDENTIFIER_HEADER, 'stream_name', ...TEMPLATE_HEADERS]);
  const ignored: string[] = [];
  const headers = lines[0].map((h) => {
    const normalized = h.trim().toLowerCase().replace(/[\s/\-]+/g, '_').replace(/_+$/, '');
    const resolved = aliases[normalized] || normalized;
    if (resolved && !knownHeaders.has(resolved)) ignored.push(h.trim());
    return resolved;
  });
  const rows = lines.slice(1).map((values) => headers.reduce<ImportRow>((obj, header, index) => {
    obj[header] = (values[index] || '').trim();
    return obj;
  }, {}));
  return { rows, ignored: Array.from(new Set(ignored)) };
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

function normalized(value?: string | null): string { return String(value || '').trim().toLowerCase(); }

function identifiers(row: ImportRow): { admission: string; assessment: string } {
  const legacy = row[LEGACY_IDENTIFIER_HEADER]?.trim();
  return {
    admission: row[ADMISSION_HEADER]?.trim() || legacy?.split('/')[0]?.trim() || '',
    assessment: row[ASSESSMENT_HEADER]?.trim() || legacy?.split('/')[1]?.trim() || '',
  };
}

function displayValue(value?: string | null): string { return String(value ?? '').trim() || '—'; }

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export default function BulkStudentImport() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassStreamImportRecord[]>([]);
  const [existingStudents, setExistingStudents] = useState<ExistingStudent[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [mode, setMode] = useState<ImportMode>(() => (new URLSearchParams(window.location.search).get('mode') === 'update' ? 'update' : 'add'));
  const [matchBy, setMatchBy] = useState<MatchBy>('either');
  const [confirmingUpdates, setConfirmingUpdates] = useState(false);
  const runningRef = useRef(false);

  const loadReferenceData = useCallback(async () => {
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    try {
      const [{ data: classData, error: classError }, { data: learnerData, error: learnerError }] = await Promise.all([
        supabaseUntyped.from('classes').select('id, name, stream, stream_name, level, grade_level').eq('school_id', schoolId).eq('is_active', true).order('name'),
        supabaseUntyped
          .from('students')
          .select('id, admission_number, assessment_number, first_name, middle_name, last_name, class_id, stream_id, student_email, gender, date_of_birth, nationality, county, sub_county, boarding_status, disability_status, parent_name, parent_phone, parent_email, curriculum, pathway, track')
          .eq('school_id', schoolId)
          .order('first_name'),
      ]);
      if (classError) toast.error(`Could not load classes: ${classError.message}`);
      if (learnerError) toast.error(`Could not load existing learners: ${learnerError.message}`);
      setClasses(classData || []);
      setExistingStudents((learnerData || []) as ExistingStudent[]);
    } catch (error: unknown) {
      toast.error(`Could not load school reference data: ${errorMessage(error, 'Unknown error')}`);
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  const refreshReferenceData = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    await loadReferenceData();
  }, [user?.schoolId, loadReferenceData]);

  // The database request is awaited before this loader updates component state.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async data-load state updates happen after the Supabase response.
  useEffect(() => { void loadReferenceData(); }, [loadReferenceData]);

  const classResolver = useMemo(() => buildClassStreamImportResolver(classes), [classes]);
  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, formatClassStream(c)])), [classes]);
  const studentByAdmission = useMemo(() => new Map(existingStudents.filter((s) => s.admission_number).map((s) => [normalized(s.admission_number), s])), [existingStudents]);
  const studentByAssessment = useMemo(() => new Map(existingStudents.filter((s) => s.assessment_number).map((s) => [normalized(s.assessment_number), s])), [existingStudents]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    const { rows: parsed, ignored } = parseCsv(await file.text());
    if (!parsed.length) { toast.error('The CSV has no learner rows. Download the template and try again.'); return; }
    setRows(parsed);
    if (ignored.length) {
      toast.message(`These columns were not recognised and will be ignored: ${ignored.join(', ')}. Use the template headers so nothing is skipped.`);
    }
    setResults([]);
    setConfirmingUpdates(false);
    setFileName(file.name);
    toast.success(`${parsed.length} learner rows loaded for preview.`);
  };

  const preview = useMemo<PreviewPlan[]>(() => {
    const seen = new Set<string>();
    return rows.map((row, index) => {
      const rowNumber = index + 2;
      const { admission, assessment } = identifiers(row);
      const first = row.first_name?.trim() || '';
      const last = row.last_name?.trim() || '';
      const classInput = row.class_name?.trim() || '';
      const streamInput = row.stream_name?.trim() || row.stream?.trim() || '';
      const issues: string[] = [];
      const name = `${first} ${row.middle_name ? `${row.middle_name.trim()} ` : ''}${last}`.trim() || admission || assessment || `Row ${rowNumber}`;
      const keys = matchBy === 'admission' ? [admission] : matchBy === 'assessment' ? [assessment] : [admission, assessment];
      const classResolution = classInput ? classResolver(classInput, streamInput) : null;
      const classRow = classResolution?.classRow || undefined;

      if (mode === 'add') {
        const existingMatch = (assessment ? studentByAssessment.get(normalized(assessment)) : undefined)
          || (admission ? studentByAdmission.get(normalized(admission)) : undefined);
        if (existingMatch) {
          return { row, rowNumber, admission, assessment, name, classRow, changes: [], issues: [], action: 'skip' };
        }
        if (!admission && !assessment) issues.push('provide admission_number or assessment_number');
        if (!first) issues.push('missing first_name');
        if (!last) issues.push('missing last_name');
        if (!classInput) issues.push('missing class_name');
        else if (!classRow) issues.push(classResolution?.error || 'class/stream not found');
        const duplicateKey = `add:${normalized(admission)}:${normalized(assessment)}`;
        if (seen.has(duplicateKey)) issues.push('duplicate learner identifiers in CSV');
        seen.add(duplicateKey);
        return { row, rowNumber, admission, assessment, name, classRow, changes: [], issues, action: issues.length ? 'conflict' : 'create' };
      }

      if (streamInput && !classInput) issues.push('include class_name when supplying a separate stream value');
      else if (classInput && !classRow) issues.push(classResolution?.error || 'class/stream not found');
      if (matchBy === 'either' ? (!admission && !assessment) : keys.some((key) => !key)) issues.push(`missing ${matchBy === 'both' ? 'admission and assessment numbers' : matchBy === 'either' ? 'admission or assessment number' : `${matchBy} number`} for matching`);
      const admissionTarget = admission ? studentByAdmission.get(normalized(admission)) : undefined;
      const assessmentTarget = assessment ? studentByAssessment.get(normalized(assessment)) : undefined;
      const target = matchBy === 'admission'
        ? admissionTarget
        : matchBy === 'assessment'
          ? assessmentTarget
          : matchBy === 'either'
            ? (admissionTarget || assessmentTarget)
            : admissionTarget && assessmentTarget && admissionTarget.id === assessmentTarget.id ? admissionTarget : undefined;
      if (matchBy === 'both' && admissionTarget && assessmentTarget && admissionTarget.id !== assessmentTarget.id) issues.push('admission and assessment numbers match different learners');
      if (!target && !issues.length) issues.push('no existing learner matches the selected key');
      const matchKey = `update:${matchBy}:${keys.map(normalized).join(':')}`;
      if (seen.has(matchKey)) issues.push('duplicate update match key in CSV');
      seen.add(matchKey);

      const changes: PreviewPlan['changes'] = [];
      if (target) {
        if ((classInput || streamInput) && classRow) {
          const currentClassId = target.stream_id || target.class_id || '';
          if (normalized(currentClassId) !== normalized(classRow.id)) changes.push({
            label: 'Class / Stream',
            from: displayValue(classNameById.get(currentClassId)),
            to: formatClassStream(classRow),
          });
        }
        EDITABLE_FIELDS.forEach(({ key, label }) => {
          if (key === 'class_id') return;
          const next = row[key]?.trim() || '';
          if (!next) return; // Blank CSV cells preserve the attached record.
          const current = String(target[key as keyof ExistingStudent] ?? '');
          if (normalized(current) !== normalized(next)) changes.push({
            label,
            from: displayValue(current),
            to: displayValue(next),
          });
        });
        const nextAdmission = admission || target.admission_number || '';
        const nextAssessment = assessment || target.assessment_number || '';
        const admissionOwner = nextAdmission ? studentByAdmission.get(normalized(nextAdmission)) : undefined;
        const assessmentOwner = nextAssessment ? studentByAssessment.get(normalized(nextAssessment)) : undefined;
        if (admissionOwner && admissionOwner.id !== target.id) issues.push('new admission number belongs to another learner');
        if (assessmentOwner && assessmentOwner.id !== target.id) issues.push('new assessment number belongs to another learner');
      }
      return { row, rowNumber, admission, assessment, name, classRow, target, changes, issues, action: issues.length ? 'conflict' : changes.length ? 'update' : 'unchanged' };
    });
  }, [rows, mode, matchBy, classResolver, classNameById, studentByAdmission, studentByAssessment]);

  const blockingCount = preview.filter((item) => item.action === 'conflict').length;
  const pendingUpdates = preview.filter((item) => item.action === 'update');
  const readyAdds = preview.filter((item) => item.action === 'create');
  const skippedAdds = preview.filter((item) => item.action === 'skip');

  const findExistingLearner = useCallback(async (schoolId: string, admission: string, assessment: string) => {
    const filters: string[] = [];
    if (admission) filters.push(`admission_number.eq.${admission.replace(/[,"]/g, '')}`);
    if (assessment) filters.push(`assessment_number.eq.${assessment.replace(/[,"]/g, '')}`);
    if (!filters.length) return null;
    const { data } = await supabaseUntyped
      .from('students')
      .select('id, class_id, stream_id')
      .eq('school_id', schoolId)
      .or(filters.join(','))
      .limit(1)
      .maybeSingle();
    return (data || null) as { id: string; class_id: string | null; stream_id: string | null } | null;
  }, []);

  const createStudents = async () => {
    if (!user?.schoolId || (!readyAdds.length && !skippedAdds.length) || blockingCount) return;
    if (runningRef.current) return;
    runningRef.current = true;
    setImporting(true);
    setResults([]);
    const completed: ImportResult[] = skippedAdds.map((plan) => ({
      row: plan.rowNumber,
      admission_number: plan.admission,
      assessment_number: plan.assessment,
      name: plan.name,
      status: 'unchanged' as ResultStatus,
      message: 'Already exists in this school — skipped, nothing was changed.',
    }));
    setResults([...completed]);
    if (!readyAdds.length) {
      runningRef.current = false;
      setImporting(false);
      toast.success(`${completed.length} learner${completed.length === 1 ? '' : 's'} already exist — nothing new to create.`);
      return;
    }
    const schoolPrefix = user.schoolId.split('-')[0] || 'student';
    try {
      for (const plan of readyAdds) {
        const row = plan.row;
        const classRow = plan.classRow;
        if (!classRow) {
          completed.push({ row: plan.rowNumber, admission_number: plan.admission, assessment_number: plan.assessment, name: plan.name, status: 'failed', message: 'The class/stream could not be resolved. Refresh school reference data and preview again.' });
          setResults([...completed]);
          continue;
        }
        const existingNow = await findExistingLearner(user.schoolId, plan.admission, plan.assessment);
        if (existingNow?.id) {
          completed.push({ row: plan.rowNumber, admission_number: plan.admission, assessment_number: plan.assessment, name: plan.name, status: 'unchanged', message: 'Already exists in this school — skipped, nothing was changed.' });
          setResults([...completed]);
          continue;
        }
        const effectiveAdmission = plan.admission || plan.assessment || `PENDING-${Date.now().toString(36).toUpperCase()}`;
        const loginIdentifier = (plan.assessment || effectiveAdmission).toUpperCase();
        const email = (row.student_email?.trim().toLowerCase() || `${loginIdentifier.toLowerCase().replace(/[^a-z0-9]+/g, '')}.${schoolPrefix}@student.edu`);
        const genderValue = row.gender?.trim().toLowerCase();
        const gender = ['male', 'female', 'other'].includes(genderValue || '') ? genderValue : null;
        const studentPayload = {
          school_id: user.schoolId,
          admission_number: effectiveAdmission,
          assessment_number: plan.assessment || null,
          first_name: row.first_name,
          middle_name: row.middle_name || null,
          last_name: row.last_name,
          class_id: classRow?.id,
          student_email: email,
          gender,
          date_of_birth: row.date_of_birth || null,
          nationality: row.nationality || 'Kenyan',
          curriculum: row.curriculum || 'CBE',
          pathway: row.pathway || null,
          track: row.track || null,
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
        };
        try {
          const { data: existingProfile } = await supabaseUntyped
            .from('profiles')
            .select('id')
            .eq('school_id', user.schoolId)
            .eq('email', email)
            .limit(1)
            .maybeSingle();
          let profileId = (existingProfile?.id as string | undefined) || '';
          let adoptedAccount = false;
          if (profileId) {
            const { data: linkedStudent } = await supabaseUntyped
              .from('students')
              .select('id')
              .eq('profile_id', profileId)
              .limit(1)
              .maybeSingle();
            if (linkedStudent?.id) {
              completed.push({ row: plan.rowNumber, admission_number: effectiveAdmission, assessment_number: plan.assessment, name: plan.name, status: 'unchanged', message: 'Already exists in this school — skipped, nothing was changed.' });
              setResults([...completed]);
              continue;
            }
            adoptedAccount = true;
          } else {
            const authData = await createScopedUser({
              email,
              password: loginIdentifier,
              first_name: row.first_name,
              last_name: row.last_name,
              role: 'student',
              school_id: user.schoolId,
              admission_number: effectiveAdmission,
              assessment_number: plan.assessment || undefined,
              class_id: classRow?.id,
              metadata: { admission_number: effectiveAdmission, assessment_number: plan.assessment || null, class_id: classRow?.id },
            });
            profileId = authData.user.id;
          }
          const { data: studentData, error } = await supabaseUntyped
            .from('students')
            .insert({ ...studentPayload, profile_id: profileId })
            .select('id')
            .single();
          if (error || !studentData?.id) throw new Error(error?.message || 'Learner record was not created.');
          let parentNote = '';
          if (row.parent_name || row.parent_phone || row.parent_email) {
            try {
              await syncParentAccounts({ student_id: studentData.id, primary: { name: row.parent_name, phone: row.parent_phone, email: row.parent_email } });
            } catch (parentError: unknown) {
              parentNote = ` Parent account not linked yet: ${errorMessage(parentError, 'unknown error')}. The learner was created and kept.`;
            }
          }
          const adoptedNote = adoptedAccount ? 'Reused a login account that had no learner record. ' : '';
          const baseNote = plan.assessment ? '' : 'Created without assessment number; assign one later to enable Student Portal sign-in.';
          completed.push({ row: plan.rowNumber, admission_number: effectiveAdmission, assessment_number: plan.assessment, name: plan.name, email, password: plan.assessment ? loginIdentifier : '', status: 'created', message: `${adoptedNote}${baseNote}${parentNote}`.trim() || undefined });
        } catch (error: unknown) {
          const message = errorMessage(error, 'Import failed');
          const existing = /already|duplicate|captured/i.test(message)
            ? await findExistingLearner(user.schoolId, plan.admission, plan.assessment)
            : null;
          if (existing?.id) {
            completed.push({ row: plan.rowNumber, admission_number: effectiveAdmission, assessment_number: plan.assessment, name: plan.name, status: 'unchanged', message: 'Already exists in this school — skipped, nothing was changed.' });
          } else {
            completed.push({ row: plan.rowNumber, admission_number: effectiveAdmission, assessment_number: plan.assessment, name: plan.name, status: 'failed', message });
          }
        }
        setResults([...completed]);
      }
      const createdCount = completed.filter((item) => item.status === 'created').length;
      const skippedCount = completed.filter((item) => item.status === 'unchanged').length;
      const failedCount = completed.filter((item) => item.status === 'failed').length;
      toast.success(`${createdCount} learner${createdCount === 1 ? '' : 's'} created${skippedCount ? `, ${skippedCount} already existed and were skipped` : ''}${failedCount ? `, ${failedCount} failed` : ''}.`);
      await refreshReferenceData();
      if (createdCount > 0) { setRows([]); setFileName(''); }
    } finally { runningRef.current = false; setImporting(false); }
  };

  const applyUpdates = async () => {
    if (!user?.schoolId || !pendingUpdates.length || blockingCount) return;
    if (runningRef.current) return;
    runningRef.current = true;
    setConfirmingUpdates(false);
    setImporting(true);
    const completed: ImportResult[] = [];
    try {
      for (const plan of preview) {
        if (plan.action === 'unchanged') {
          completed.push({ row: plan.rowNumber, admission_number: plan.admission, assessment_number: plan.assessment, name: plan.name, status: 'unchanged', message: 'No supplied fields differ from the existing learner.' });
          continue;
        }
        if (plan.action !== 'update' || !plan.target) continue;
        const row = plan.row;
        const classWasProvided = Boolean(row.class_name?.trim() || row.stream?.trim() || row.stream_name?.trim());
        const classId = classWasProvided ? plan.classRow?.id : undefined;
        const payload: Record<string, unknown> = {};
        EDITABLE_FIELDS.forEach(({ key }) => {
          if (key === 'class_id') {
            if (classId) payload.class_id = classId;
            return;
          }
          const value = row[key]?.trim();
          if (value) payload[key] = value;
        });
        if (classId && plan.target.stream_id) payload.stream_id = classId;
        try {
          const { data: updatedStudent, error } = await supabaseUntyped.from('students').update(payload).eq('id', plan.target.id).eq('school_id', user.schoolId).select('id').maybeSingle();
          if (error) throw error;
          if (!updatedStudent) throw new Error('Learner update returned no row; this record may be outside your school or no longer available.');
          // Best-effort persistent audit trail; UI results remain the immediate change log if RLS blocks audit writes.
          await supabaseUntyped.from('audit_logs').insert({
            school_id: user.schoolId,
            user_id: user.id,
            action: 'bulk_learner_update',
            table_name: 'students',
            record_id: plan.target.id,
            old_values: Object.fromEntries(plan.changes.map((change) => [change.label, change.from])),
            new_values: Object.fromEntries(plan.changes.map((change) => [change.label, change.to])),
          });
          completed.push({ row: plan.rowNumber, admission_number: plan.admission || plan.target.admission_number || '', assessment_number: plan.assessment || plan.target.assessment_number || '', name: plan.name, status: 'updated', message: plan.changes.map((change) => `${change.label}: ${change.from} → ${change.to}`).join(' · ') });
        } catch (error: unknown) {
          completed.push({ row: plan.rowNumber, admission_number: plan.admission, assessment_number: plan.assessment, name: plan.name, status: 'failed', message: errorMessage(error, 'Update failed') });
        }
        setResults([...completed]);
      }
      const updatedCount = completed.filter((item) => item.status === 'updated').length;
      const failedItems = completed.filter((item) => item.status === 'failed');
      const unchangedCount = completed.filter((item) => item.status === 'unchanged').length;
      if (updatedCount) {
        toast.success(`${updatedCount} learner record${updatedCount === 1 ? '' : 's'} updated${failedItems.length ? `, ${failedItems.length} failed` : ''}${unchangedCount ? `, ${unchangedCount} unchanged` : ''}.`);
      } else if (failedItems.length) {
        toast.error(`No records were updated — ${failedItems.length} row${failedItems.length === 1 ? '' : 's'} failed. ${failedItems[0].message || ''}`.trim());
      } else {
        toast.message(`Nothing changed — ${unchangedCount} row${unchangedCount === 1 ? '' : 's'} matched but no supplied value differed from what is already saved.`);
      }
      await refreshReferenceData();
    } finally { runningRef.current = false; setImporting(false); }
  };

  const downloadCredentials = () => {
    const created = results.filter((result) => result.status === 'created');
    downloadCsv('zamifu-student-login-credentials.csv', [
      [ADMISSION_HEADER, ASSESSMENT_HEADER, 'student_name', 'email', 'temporary_password'],
      ...created.map((result) => [result.admission_number, result.assessment_number, result.name, result.email || '', result.password || '']),
    ]);
  };

  const downloadChangeLog = () => downloadCsv('zamifu-bulk-learner-change-log.csv', [
    ['row', 'learner', 'admission_number', 'assessment_number', 'outcome', 'details'],
    ...results.map((result) => [String(result.row), result.name, result.admission_number, result.assessment_number, result.status, result.message || '']),
  ]);

  const actionLabel = mode === 'add'
    ? (readyAdds.length ? `Create ${readyAdds.length} learner account${readyAdds.length === 1 ? '' : 's'}` : 'Show skipped learners')
    : `Review and update ${pendingUpdates.length} learner record${pendingUpdates.length === 1 ? '' : 's'}`;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2"><Users className="text-blue-600" /> Bulk Student Upload</h1>
        <p className="text-sm text-gray-500 mt-1">Create learners or safely correct existing learner data without deleting any attached records.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setMode('add'); setResults([]); }} className={`rounded-xl border px-4 py-2 text-sm font-bold ${mode === 'add' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>Create new learners</button>
          <button type="button" onClick={() => { setMode('update'); setResults([]); }} className={`rounded-xl border px-4 py-2 text-sm font-bold ${mode === 'update' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>Update learners from CSV</button>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-black text-gray-900">Import mode</h2>
            <p className="text-xs text-gray-500 mt-1">Update Existing changes only non-blank CSV fields after a review and final confirmation.</p>
          </div>
          <button type="button" onClick={() => void refreshReferenceData()} disabled={loading} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh learner reference data
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => { setMode('add'); setResults([]); }} className={`rounded-xl border p-4 text-left ${mode === 'add' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-200 hover:bg-gray-50'}`}>
            <span className="font-bold text-gray-900">Add New</span><span className="block mt-1 text-xs text-gray-600">Creates new learner profiles and optional Student Portal accounts.</span>
          </button>
          <button type="button" onClick={() => { setMode('update'); setResults([]); }} className={`rounded-xl border p-4 text-left ${mode === 'update' ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-300' : 'border-gray-200 hover:bg-gray-50'}`}>
            <span className="font-bold text-gray-900">Update Existing</span><span className="block mt-1 text-xs text-gray-600">Matches existing learners and updates supplied fields only. It never deletes learner data.</span>
          </button>
        </div>
        {mode === 'update' && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4"><p className="text-sm font-bold text-amber-900">Match existing learners by</p><div className="mt-2 flex flex-wrap gap-3">{([
          ['either', 'Either identifier (recommended)'], ['admission', 'Admission Number'], ['assessment', 'Assessment Number'], ['both', 'Both identifiers'],
        ] as Array<[MatchBy, string]>).map(([value, label]) => <label key={value} className="inline-flex items-center gap-2 text-sm text-amber-900"><input type="radio" checked={matchBy === value} onChange={() => setMatchBy(value)} /> {label}</label>)}</div></div>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between"><h2 className="font-black text-gray-900 flex items-center gap-2"><FileSpreadsheet className="text-blue-600" size={18} /> Step 1: Prepare CSV</h2><button type="button" onClick={() => downloadCsv('zamifu-student-import-template.csv', [TEMPLATE_HEADERS, ['ADM001', 'ASM001', 'John', '', 'Kamau', formatClassStream(classes[0]) || 'Grade 1', '', '', 'Male', '', 'Kenyan', '', '', 'day', '', 'CBE', '', '', 'Jane Kamau', '0712345678', 'parent@example.com']])} className="text-sm font-bold text-blue-700 hover:underline flex items-center gap-1"><Download size={15} /> Download template</button></div>
          <p className="text-xs text-gray-600">For new learners, provide first_name, last_name, class_name (use the full label shown under Classes, e.g. Grade 5A), and at least one identifier. Optionally use the separate stream column with the base class_name. Updates accept the same class/stream fields and change only reviewed non-blank values. Senior pathway options: {SENIOR_PATHWAYS.join(', ')}; track options: {SENIOR_PATHWAYS.flatMap((pathway) => tracksForSeniorPathway(pathway)).join(', ')}.</p>
          <label className="border-2 border-dashed border-blue-200 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 transition"><Upload className="text-blue-600 mb-2" /><span className="font-bold text-blue-800">Choose CSV file</span><span className="text-xs text-gray-500 mt-1">{fileName || 'CSV only'}</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} /></label>
          {loading && <p className="text-sm text-gray-500">Loading school reference data...</p>}
        </section>
        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3"><h2 className="font-black text-blue-900">Safe update rules</h2><p className="text-sm text-blue-800">The preview identifies every field change and key conflict before anything is saved.</p><p className="text-sm text-blue-800">Blank update cells preserve the existing field. Results, invoices, fees, attendance, and parent links remain attached because the learner record is updated in place.</p><p className="text-xs text-blue-700">A downloadable change log is created after the batch completes.</p></section>
      </div>

      {rows.length > 0 && <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-gray-900">Step 2: Preview {rows.length} rows</h2><p className="text-xs text-gray-500">{blockingCount ? `${blockingCount} row${blockingCount === 1 ? '' : 's'} must be corrected.` : mode === 'add' ? `${readyAdds.length} new learner${readyAdds.length === 1 ? '' : 's'} ready${skippedAdds.length ? `, ${skippedAdds.length} already exist and will be skipped` : ''}.` : `${pendingUpdates.length} update${pendingUpdates.length === 1 ? '' : 's'} ready; unchanged rows will be logged.`}</p></div><button type="button" disabled={importing || blockingCount > 0 || (mode === 'add' ? (!readyAdds.length && !skippedAdds.length) : !pendingUpdates.length)} onClick={() => mode === 'add' ? void createStudents() : setConfirmingUpdates(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2">{importing ? <Loader2 className="animate-spin" size={16} /> : <Users size={16} />}{importing ? 'Applying batch...' : actionLabel}</button></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left border-b"><th className="p-2">Row</th><th className="p-2">Learner</th><th className="p-2">Match / Identifiers</th><th className="p-2">Preview</th><th className="p-2">Status</th></tr></thead>
            <tbody>{preview.slice(0, 200).map((item) => <tr key={item.rowNumber} className="border-b last:border-0 align-top">
              <td className="p-2">{item.rowNumber}</td>
              <td className="p-2 font-semibold">{item.name}</td>
              <td className="p-2">{item.admission || '—'}<br />{item.assessment || '—'}</td>
              <td className="p-2 max-w-md">{item.changes.length ? <ul className="space-y-1">{item.changes.map((change) => <li key={change.label}><strong>{change.label}:</strong> {change.from} → {change.to}</li>)}</ul> : item.action === 'create' ? `New learner in ${item.classRow ? formatClassStream(item.classRow) : 'selected class/stream'}` : item.action === 'skip' ? 'Already in this school — nothing to create' : item.action === 'unchanged' ? 'No changes supplied' : 'Resolve the listed conflict'}</td>
              <td className={`p-2 font-semibold ${item.action === 'conflict' ? 'text-red-600' : item.action === 'update' ? 'text-amber-700' : item.action === 'create' ? 'text-green-700' : 'text-gray-500'}`}>{item.issues.length ? item.issues.join(', ') : item.action === 'update' ? 'Ready to update' : item.action === 'create' ? 'Ready to create' : item.action === 'skip' ? 'Already exists — will be skipped' : 'Unchanged'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}

      {results.length > 0 && <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4"><div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-black text-gray-900">Step 3: Change log</h2><p className="text-xs text-gray-500">Created passwords are shown only for accounts created in this batch.</p></div><div className="flex gap-3"><button type="button" onClick={downloadChangeLog} className="text-sm font-bold text-blue-700 flex items-center gap-1"><Download size={15} /> Download change log</button>{results.some((result) => result.status === 'created') && <button type="button" onClick={downloadCredentials} className="text-sm font-bold text-blue-700 flex items-center gap-1"><Download size={15} /> Download credentials</button>}</div></div><div className="space-y-2">{results.map((result) => <div key={`${result.row}-${result.status}`} className={`rounded-lg p-3 text-sm ${result.status === 'failed' ? 'bg-red-50 text-red-800' : result.status === 'updated' ? 'bg-amber-50 text-amber-900' : result.status === 'unchanged' ? 'bg-gray-50 text-gray-700' : 'bg-green-50 text-green-800'}`}>{result.status === 'failed' ? <AlertCircle className="inline mr-2" size={16} /> : <CheckCircle2 className="inline mr-2" size={16} />}Row {result.row}: <strong>{result.name || result.admission_number}</strong> — {result.status === 'created' && result.password ? `${result.email} / ${result.password}` : result.message || result.status}</div>)}</div></section>}

      {confirmingUpdates && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-black text-gray-900">Confirm {pendingUpdates.length} learner updates</h2><p className="mt-2 text-sm text-gray-600">This will update only the reviewed fields for matched learners. No learner, result, fee, attendance, or parent record will be deleted.</p><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setConfirmingUpdates(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void applyUpdates()} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700">Confirm and apply updates</button></div></div></div>}
    </div>
  );
}
