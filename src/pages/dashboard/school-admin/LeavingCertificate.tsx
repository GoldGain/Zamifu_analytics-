import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CheckSquare, Download, FileText, Loader2, Printer, Save, Sparkles, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DigitalSignature from '@/components/DigitalSignature';
import { CONDUCT_CATEGORIES, renderLeavingCertificatePreview, conductText, downloadLeavingCertificate, formatCertificateDate, generateLeavingCertificateComments, isLeavingCertificateClass, leavingCertificateStandardLabel, LEAVING_CERTIFICATE_CBE_CURRICULUM, printLeavingCertificate, type ConductCategory } from '@/lib/leavingCertificate';
import type { LeavingCertificateResult } from '@/lib/leavingCertificate';
import '@/styles/leavingCertificate.css';

const today = () => new Date().toISOString().slice(0, 10);

type ClassRecord = { name?: string | null; level?: number | null; grade_level?: number | null; curriculum?: string | null };
type StudentRecord = { id: string; first_name?: string | null; middle_name?: string | null; last_name?: string | null; admission_number?: string | null; date_of_birth?: string | null; enrollment_date?: string | null; date_left?: string | null; club_memberships?: string | null; curriculum?: string | null; classes?: ClassRecord | ClassRecord[] | null };
type CertificateState = { learnerName: string; admissionNumber: string; dateOfBirth: string; dateEnrolled: string; dateLeft: string; schoolName: string; standard: string; standardLeft: string; standardCurriculum: string | null; dateOfIssue: string; headTeacherName: string; conductCategory: ConductCategory; conductElaboration: string; academicComment: string; conductComment: string; cocurricularComment: string; extraNotes: string; pupilSignatureUrl: string | null; pupilSignatureType: string | null; headTeacherSignatureUrl: string | null; headTeacherSignatureType: string | null; schoolStampUrl: string | null; schoolStampType: string | null };
type CertificatePreviewProps = { data: CertificateState; previewRef: RefObject<HTMLDivElement | null> | ((element: HTMLDivElement | null) => void); headTeacherName: string; pupilSignatureUrl: string | null; headTeacherSignatureUrl: string | null };
function CertificatePreview({ data, previewRef, headTeacherName, pupilSignatureUrl, headTeacherSignatureUrl }: CertificatePreviewProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (localRef.current) renderLeavingCertificatePreview(localRef.current);
  }, [data, headTeacherName, pupilSignatureUrl, headTeacherSignatureUrl]);
  return <div ref={(element) => {
    localRef.current = element;
    if (typeof previewRef === 'function') previewRef(element);
    else if (previewRef) previewRef.current = element;
  }} className="leaving-certificate-preview" aria-label="Kenya Primary School Leaving Certificate preview">
    <p className="cert-overflow" role="alert" hidden />
    <div className="cert-artwork" />
    <div className="cert-source" hidden aria-hidden="true">
    <div className="cert-value cert-name">{data.learnerName}</div>
    <div className="cert-value cert-admission">{data.admissionNumber}</div>
    <div className="cert-value cert-dob">{formatCertificateDate(data.dateOfBirth)}</div>
    <div className="cert-value cert-enrolled">{data.schoolName}</div>
    <div className="cert-value cert-school">{formatCertificateDate(data.dateEnrolled)}</div>
    <div className="cert-value cert-standard">{data.standard}</div>
    <div className="cert-value cert-left">{formatCertificateDate(data.dateLeft)}</div>
    <div className="cert-value cert-standard-left">{leavingCertificateStandardLabel(data.standardLeft, data.standardCurriculum)}</div>
    <div className="cert-value cert-academic">{data.academicComment}</div>
    <div className="cert-value cert-conduct">{data.conductComment}</div>
    <div className="cert-value cert-cocurricular">{data.cocurricularComment}</div>
    {pupilSignatureUrl && <img className="cert-signature cert-pupil-signature" src={pupilSignatureUrl} alt="Pupil signature" />}
    <div className="cert-value cert-head-name">{data.headTeacherName || headTeacherName || ''}</div>
    {headTeacherSignatureUrl && <img className="cert-signature cert-head-signature" src={headTeacherSignatureUrl} alt="Head teacher signature" />}
    <div className="cert-value cert-issue">{formatCertificateDate(data.dateOfIssue)}</div>
    </div>
  </div>;
}

export default function LeavingCertificate() {
  const { user, schoolData } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [certificate, setCertificate] = useState<CertificateState | null>(null);
  const [results, setResults] = useState<LeavingCertificateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkCertificates, setBulkCertificates] = useState<Array<{ studentId: string; certificate: CertificateState }>>([]);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [bulkRows, setBulkRows] = useState<Record<string, CertificateState>>({});
  const [bulkTableLoading, setBulkTableLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [search, setSearch] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const bulkRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!user?.schoolId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabaseUntyped.from('students')
        .select('id, first_name, middle_name, last_name, admission_number, date_of_birth, enrollment_date, date_left, club_memberships, curriculum, class_id, classes!students_class_id_fkey(name, level, grade_level, curriculum)')
        .eq('school_id', user.schoolId)
        .or('is_active.eq.true,is_active.is.null')
        .order('last_name', { ascending: true }).limit(2000);
      if (error) toast.error(error.message);
      setStudents((data || []).filter((student: StudentRecord) => {
        const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;
        return isLeavingCertificateClass(cls, student.curriculum);
      }));
      setLoading(false);
    })();
  }, [user?.schoolId]);

  const selectedStudent = students.find((student) => student.id === selectedId);
  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return students;
    return students.filter((student) => `${student.first_name} ${student.middle_name || ''} ${student.last_name} ${student.admission_number}`.toLowerCase().includes(q));
  }, [students, search]);

  const buildCertificate = async (student: StudentRecord) => {
    const [{ data: saved }, { data: learnerResults }] = await Promise.all([
      supabaseUntyped.from('leaving_certificates').select('*').eq('student_id', student.id).eq('school_id', user?.schoolId).maybeSingle(),
      supabaseUntyped.from('results').select('marks, out_of, percentage, grade_844').eq('student_id', student.id).eq('school_id', user?.schoolId).order('created_at', { ascending: false }).limit(1000),
    ]);
    const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const standardCurriculum = cls?.curriculum ?? student.curriculum;
    const classLevel = Number(cls?.level ?? cls?.grade_level);
    const currentStandard = Number.isInteger(classLevel) && classLevel >= 1 && classLevel <= 12 ? classLevel : 8;
    const baseCertificate = {
      learnerName: `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`.replace(/\s+/g, ' ').trim(),
      admissionNumber: student.admission_number || '', dateOfBirth: student.date_of_birth || '', dateEnrolled: student.enrollment_date || '',
      dateLeft: saved?.date_left || student.date_left || today(), schoolName: schoolData?.name || '', standard: leavingCertificateStandardLabel(currentStandard, standardCurriculum) || String(currentStandard), standardLeft: String(saved?.standard_left ?? currentStandard), standardCurriculum,
      dateOfIssue: saved?.date_of_issue || today(), headTeacherName: saved?.head_teacher_name || schoolData?.principal_name || '', conductCategory: (saved?.conduct_category || 'Good') as ConductCategory, conductElaboration: saved?.conduct_elaboration || '',
      academicComment: saved?.academic_comment || '', cocurricularComment: saved?.cocurricular_comment || '', conductComment: saved?.conduct_comment || '', extraNotes: saved?.extra_notes || '',
      pupilSignatureUrl: saved?.pupil_signature_url || null, pupilSignatureType: saved?.pupil_signature_type || null, headTeacherSignatureUrl: saved?.head_teacher_signature_url || null, headTeacherSignatureType: saved?.head_teacher_signature_type || null, schoolStampUrl: saved?.school_stamp_url || null, schoolStampType: saved?.school_stamp_type || null,
    };
    const certificate = saved ? baseCertificate : { ...baseCertificate, ...generateLeavingCertificateComments(learnerResults || [], student.club_memberships, ''), conductComment: conductText(baseCertificate.conductCategory, baseCertificate.conductElaboration) };
    return { certificate, results: (learnerResults || []) as LeavingCertificateResult[] };
  };

  const loadCertificate = async (student: StudentRecord | undefined) => {
    if (!student) return;
    setSelectedId(student.id);
    const loaded = await buildCertificate(student);
    setResults(loaded.results);
    setCertificate(loaded.certificate);
  };

  const generateComments = (learnerResults = results, clubs = selectedStudent?.club_memberships, notes = certificate?.extraNotes || '') => {
    if (!certificate) return;
    setGenerating(true);
    const generated = generateLeavingCertificateComments(learnerResults, clubs, notes);
    setCertificate((current) => current ? ({ ...current, academicComment: generated.academic_comment, cocurricularComment: generated.cocurricular_comment, conductComment: conductText(current.conductCategory, current.conductElaboration) }) : current);
    setGenerating(false);
  };

  const update = (key: keyof CertificateState, value: string) => setCertificate((current) => current ? ({ ...current, [key]: value }) : current);

  const save = async () => {
    if (!certificate || !user?.schoolId || !selectedStudent) return;
    if (certificate.conductCategory === 'Needs improvement' && certificate.conductElaboration.length > 140) return toast.error('Conduct elaboration must be 140 characters or fewer.');
    const standardLeft = Number(certificate.standardLeft);
    if (!Number.isInteger(standardLeft) || standardLeft < 1 || standardLeft > 12) return toast.error('Standard left must be a whole number from 1 to 12.');
    setSaving(true);
    const payload = {
      school_id: user.schoolId, student_id: selectedStudent.id, date_left: certificate.dateLeft, standard_left: standardLeft, date_of_issue: certificate.dateOfIssue, head_teacher_name: certificate.headTeacherName || null,
      conduct_category: certificate.conductCategory, conduct_elaboration: certificate.conductElaboration || null, academic_comment: certificate.academicComment, cocurricular_comment: certificate.cocurricularComment,
      conduct_comment: certificate.conductComment || conductText(certificate.conductCategory, certificate.conductElaboration), extra_notes: certificate.extraNotes || null, pupil_signature_url: certificate.pupilSignatureUrl || null,
      pupil_signature_type: certificate.pupilSignatureType || null, head_teacher_signature_url: certificate.headTeacherSignatureUrl || null, head_teacher_signature_type: certificate.headTeacherSignatureType || null, school_stamp_url: certificate.schoolStampUrl || null, school_stamp_type: certificate.schoolStampType || null, updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseUntyped.from('leaving_certificates').upsert(payload, { onConflict: 'school_id,student_id' });
    if (error) toast.error(error.message); else { await supabaseUntyped.from('students').update({ date_left: certificate.dateLeft }).eq('id', selectedStudent.id).eq('school_id', user.schoolId); toast.success('Leaving certificate saved.'); }
    setSaving(false);
  };

  const saveSignature = async (kind: 'pupil' | 'head', url: string, type: 'drawn' | 'uploaded') => {
    const urlKey = kind === 'pupil' ? 'pupilSignatureUrl' : 'headTeacherSignatureUrl';
    const typeKey = kind === 'pupil' ? 'pupilSignatureType' : 'headTeacherSignatureType';
    setCertificate((current) => current ? ({ ...current, [urlKey]: url, [typeKey]: type }) : current);
  };

  const toggleBulkStudent = (studentId: string) => setSelectedBulkIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  const startManualCertificate = () => {
    setSelectedId('');
    setResults([]);
    setCertificate({ learnerName: '', admissionNumber: '', dateOfBirth: '', dateEnrolled: '', dateLeft: today(), schoolName: schoolData?.name || '', standard: 'Grade 8', standardLeft: '8', standardCurriculum: LEAVING_CERTIFICATE_CBE_CURRICULUM, dateOfIssue: today(), headTeacherName: schoolData?.principal_name || '', conductCategory: 'Good', conductElaboration: '', academicComment: '', conductComment: 'Good', cocurricularComment: '', extraNotes: '', pupilSignatureUrl: null, pupilSignatureType: null, headTeacherSignatureUrl: null, headTeacherSignatureType: null, schoolStampUrl: null, schoolStampType: null });
  };
  const loadBulkTable = async () => {
    const targets = filteredStudents;
    if (!targets.length) return toast.error('No learners to load.');
    setBulkTableLoading(true);
    const next: Record<string, CertificateState> = { ...bulkRows };
    for (const student of targets) {
      if (next[student.id]) continue;
      const loaded = await buildCertificate(student);
      next[student.id] = loaded.certificate;
    }
    setBulkRows(next);
    setBulkTableLoading(false);
    toast.success(`Loaded details for ${targets.length} learner${targets.length === 1 ? '' : 's'}. Fill any missing fields, then save.`);
  };

  const updateBulkRow = (studentId: string, key: keyof CertificateState, value: string) => {
    setBulkRows((current) => {
      const row = current[studentId];
      if (!row) return current;
      const next = { ...row, [key]: value };
      if (key === 'conductCategory') next.conductComment = conductText(value as ConductCategory, next.conductElaboration);
      if (key === 'conductElaboration') next.conductComment = conductText(next.conductCategory, value);
      return { ...current, [studentId]: next };
    });
  };

  const saveBulkRow = async (studentId: string, silent = false) => {
    const row = bulkRows[studentId];
    const student = students.find((item) => item.id === studentId);
    if (!row || !student || !user?.schoolId) return false;
    const standardLeft = Number(row.standardLeft);
    if (!Number.isInteger(standardLeft) || standardLeft < 1 || standardLeft > 12) {
      toast.error(`${row.learnerName || 'Learner'}: standard left must be 1 to 12.`);
      return false;
    }
    const payload = {
      school_id: user.schoolId, student_id: student.id, date_left: row.dateLeft, standard_left: standardLeft, date_of_issue: row.dateOfIssue, head_teacher_name: row.headTeacherName || null,
      conduct_category: row.conductCategory, conduct_elaboration: row.conductElaboration || null, academic_comment: row.academicComment, cocurricular_comment: row.cocurricularComment,
      conduct_comment: row.conductComment || conductText(row.conductCategory, row.conductElaboration), extra_notes: row.extraNotes || null, pupil_signature_url: row.pupilSignatureUrl || null,
      pupil_signature_type: row.pupilSignatureType || null, head_teacher_signature_url: row.headTeacherSignatureUrl || null, head_teacher_signature_type: row.headTeacherSignatureType || null, school_stamp_url: row.schoolStampUrl || null, school_stamp_type: row.schoolStampType || null, updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseUntyped.from('leaving_certificates').upsert(payload, { onConflict: 'school_id,student_id' });
    if (error) { toast.error(`${row.learnerName}: ${error.message}`); return false; }
    await supabaseUntyped.from('students').update({ date_of_birth: row.dateOfBirth || null, enrollment_date: row.dateEnrolled || null, date_left: row.dateLeft || null, admission_number: row.admissionNumber || null }).eq('id', student.id).eq('school_id', user.schoolId);
    if (!silent) toast.success(`Saved ${row.learnerName}.`);
    return true;
  };

  const saveAllBulk = async () => {
    const ids = filteredStudents.filter((student) => bulkRows[student.id]).map((student) => student.id);
    if (!ids.length) return toast.error('Load the bulk table first.');
    setBulkSaving(true);
    let ok = 0;
    for (const id of ids) { if (await saveBulkRow(id, true)) ok += 1; }
    setBulkSaving(false);
    toast.success(`Saved ${ok} of ${ids.length} learner certificate${ids.length === 1 ? '' : 's'}.`);
  };

  const generateBulk = async () => {
    if (!selectedBulkIds.length) return toast.error('Select at least one learner for bulk generation.');
    setBulkGenerating(true);
    const records: Array<{ studentId: string; certificate: CertificateState }> = [];
    for (const studentId of selectedBulkIds) {
      const student = students.find((item) => item.id === studentId);
      if (!student) continue;
      const edited = bulkRows[studentId];
      const loaded = edited ? { certificate: edited } : await buildCertificate(student);
      records.push({ studentId, certificate: loaded.certificate });
    }
    setBulkCertificates(records);
  };

  useEffect(() => {
    if (!bulkCertificates.length || !bulkGenerating) return;
    (async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      for (const item of bulkCertificates) {
        const element = bulkRefs.current[item.studentId];
        if (!element) continue;
        const learner = students.find((student) => student.id === item.studentId);
        const filename = `${(learner ? `${learner.first_name || ''}-${learner.last_name || ''}` : item.studentId).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-leaving-certificate.pdf`;
        await downloadLeavingCertificate(element, filename);
      }
      setBulkCertificates([]);
      setBulkGenerating(false);
      toast.success(`Generated ${bulkCertificates.length} leaving certificate${bulkCertificates.length === 1 ? '' : 's'}.`);
    })();
  }, [bulkCertificates, bulkGenerating, students]);

  return <div className="p-4 md:p-8 space-y-6">
    <div><div className="flex items-center gap-3"><FileText className="w-8 h-8 text-[#2563EB]" /><h1 className="text-2xl font-bold">Kenya Primary School Leaving Certificate</h1></div><p className="text-sm text-gray-500 mt-1">Prepare, review, sign and print the official one-page certificate. Official artwork, one A4 page, 20 mm margins. Long values wrap within their blanks; oversized text must be shortened before export.</p></div>
    <div className="grid xl:grid-cols-[360px_1fr] gap-6 items-start">
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <label className="block text-sm font-medium">Select learner</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or admission no." className="w-full border rounded-lg px-3 py-2 text-sm" />
        <select value={selectedId} onChange={(e) => loadCertificate(students.find((s) => s.id === e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={loading}><option value="">{loading ? 'Loading learners…' : 'Choose a leaving-certificate learner'}</option>{filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} — {student.admission_number}</option>)}</select>
        <button type="button" onClick={startManualCertificate} className="w-full rounded-lg border border-dashed border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Enter learner details manually</button>
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-blue-950"><UsersRound className="w-4 h-4" />Bulk certificates</h2><p className="text-[11px] text-blue-800 mt-0.5">Fill missing details in the table below, then select learners and download PDFs.</p></div><span className="text-xs font-semibold text-blue-700">{selectedBulkIds.length} selected</span></div>
          <button type="button" onClick={loadBulkTable} disabled={bulkTableLoading || !filteredStudents.length} className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">{bulkTableLoading ? 'Loading learner details…' : 'Open bulk details table'}</button>
          <div className="flex gap-2"><button type="button" onClick={() => setSelectedBulkIds(filteredStudents.map((student) => student.id))} className="text-[11px] rounded-md border border-blue-200 bg-white px-2 py-1 text-blue-700">Select visible</button><button type="button" onClick={() => setSelectedBulkIds([])} className="text-[11px] rounded-md border border-blue-200 bg-white px-2 py-1 text-blue-700">Clear</button></div>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-blue-100 bg-white divide-y divide-gray-100">{filteredStudents.length === 0 ? <p className="p-3 text-xs text-gray-500">No primary learners found.</p> : filteredStudents.map((student) => <label key={student.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"><input type="checkbox" checked={selectedBulkIds.includes(student.id)} onChange={() => toggleBulkStudent(student.id)} className="rounded border-gray-300 text-blue-600" /><span className="truncate">{student.first_name} {student.last_name}<span className="text-gray-400"> · {student.admission_number || 'No admission no.'}</span></span></label>)}</div>
          <button type="button" onClick={generateBulk} disabled={bulkGenerating || !selectedBulkIds.length} className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-700 py-2 text-xs font-semibold text-white disabled:opacity-50">{bulkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}{bulkGenerating ? 'Generating PDFs…' : `Generate ${selectedBulkIds.length || ''} bulk PDF${selectedBulkIds.length === 1 ? '' : 's'}`}</button>
        </div>
        {certificate && <>
          <div className="border-t pt-4 space-y-3"><h2 className="font-semibold">Certificate details</h2>
            <div className="grid sm:grid-cols-2 gap-3">{([['learnerName', 'Learner name'], ['admissionNumber', 'Admission number'], ['schoolName', 'School name'], ['standard', 'Current standard'], ['headTeacherName', 'Head teacher’s name']] as Array<[keyof CertificateState, string]>).map(([key, label]) => <label key={key} className="block text-xs font-medium text-gray-600">{label}<input value={String(certificate[key] || '')} onChange={(e) => update(key, e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>)}</div>
            <div className="grid sm:grid-cols-2 gap-3"><label className="block text-xs font-medium text-gray-600">Date of birth<input type="date" value={certificate.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-gray-600">Date enrolled<input type="date" value={certificate.dateEnrolled} onChange={(e) => update('dateEnrolled', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label></div>
            <label className="block text-xs font-medium text-gray-600">Date left<input type="date" value={certificate.dateLeft} onChange={(e) => update('dateLeft', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium text-gray-600">Standard left<select value={certificate.standardLeft} onChange={(e) => update('standardLeft', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{Array.from({ length: 12 }, (_, index) => index + 1).map((n) => <option key={n} value={n}>{leavingCertificateStandardLabel(n, certificate.standardCurriculum)}</option>)}</select></label>
            <label className="block text-xs font-medium text-gray-600">Date of issue<input type="date" value={certificate.dateOfIssue} onChange={(e) => update('dateOfIssue', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium text-gray-600">Conduct category<select value={certificate.conductCategory} onChange={(e) => { update('conductCategory', e.target.value); update('conductComment', conductText(e.target.value as ConductCategory, certificate.conductElaboration)); }} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{CONDUCT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
            {certificate.conductCategory === 'Needs improvement' && <label className="block text-xs font-medium text-gray-600">Conduct elaboration ({certificate.conductElaboration.length}/140)<textarea maxLength={140} value={certificate.conductElaboration} onChange={(e) => { update('conductElaboration', e.target.value); update('conductComment', conductText('Needs improvement', e.target.value)); }} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></label>}
            <label className="block text-xs font-medium text-gray-600">Extra notes (not printed)<textarea value={certificate.extraNotes} onChange={(e) => update('extraNotes', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></label>
          </div>
          <button onClick={() => generateComments()} disabled={generating} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white rounded-lg py-2.5 text-sm font-medium">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate Comments</button>
          <div className="space-y-3"><label className="block text-xs font-medium text-gray-600">Academic ability comment ({certificate.academicComment.length}/220)<textarea maxLength={220} value={certificate.academicComment} onChange={(e) => update('academicComment', e.target.value)} rows={4} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-gray-600">Conduct comment ({certificate.conductComment.length}/140)<textarea maxLength={140} value={certificate.conductComment} onChange={(e) => update('conductComment', e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-gray-600">Co-curricular comment ({certificate.cocurricularComment.length}/140)<textarea maxLength={140} value={certificate.cocurricularComment} onChange={(e) => update('cocurricularComment', e.target.value)} rows={3} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label></div>
          <DigitalSignature title="Pupil's signature" subtitle="Draw or upload the pupil's signature. It prints on the pupil signature line." existingSignatureUrl={certificate.pupilSignatureUrl} existingSignatureType={certificate.pupilSignatureType} onSave={(url, type) => saveSignature('pupil', url, type)} />
          <DigitalSignature title="Head teacher's signature" subtitle="Draw or upload the head teacher's signature. It prints on the signature line." existingSignatureUrl={certificate.headTeacherSignatureUrl} existingSignatureType={certificate.headTeacherSignatureType} onSave={(url, type) => saveSignature('head', url, type)} />
          <p className="text-xs text-gray-600 border border-dashed border-gray-300 rounded-lg px-3 py-2">The official school rubber stamp is left blank. Stamp the printed certificate by hand.</p>
          <div className="flex flex-wrap gap-2"><button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}</button><button onClick={() => previewRef.current && downloadLeavingCertificate(previewRef.current, `${certificate.learnerName}-leaving-certificate.pdf`)} className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm"><Download className="w-4 h-4" />Download PDF</button><button onClick={() => previewRef.current && printLeavingCertificate(previewRef.current)} className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm"><Printer className="w-4 h-4" />Print</button></div>
        </>}
      </section>
      <section className="bg-gray-100 rounded-xl p-4 overflow-auto"><div className="min-w-[816px] flex justify-center">{certificate ? <CertificatePreview data={certificate} previewRef={previewRef} headTeacherName={schoolData?.principal_name || ''} pupilSignatureUrl={certificate.pupilSignatureUrl} headTeacherSignatureUrl={certificate.headTeacherSignatureUrl} /> : <div className="w-full min-h-[420px] flex items-center justify-center text-sm text-gray-500">Select a learner to preview the official certificate.</div>}</div></section>
    </div>
    {Object.keys(bulkRows).length > 0 && <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Bulk learner details</h2>
          <p className="text-xs text-gray-500">Enter the same certificate fields as the single-learner form. Empty cells print blank. Save before generating PDFs.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={saveAllBulk} disabled={bulkSaving} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{bulkSaving ? 'Saving…' : 'Save all visible rows'}</button>
        </div>
      </div>
      <div className="overflow-auto max-h-[70vh] border rounded-lg">
        <table className="min-w-[2200px] w-full text-xs text-left">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {['Select','Learner name','Admission no.','Date of birth','Date enrolled','Date left','Standard left','Date of issue','Head teacher','Conduct','Academic comment','Conduct comment','Co-curricular','Save'].map((heading) => <th key={heading} className="px-2 py-2 font-semibold border-b whitespace-nowrap">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.filter((student) => bulkRows[student.id]).map((student) => {
              const row = bulkRows[student.id];
              const cell = (key: keyof CertificateState, type = 'text') => <input type={type} value={String(row[key] || '')} onChange={(e) => updateBulkRow(student.id, key, e.target.value)} className="w-full min-w-[8rem] border rounded px-1.5 py-1" />;
              return <tr key={student.id} className="border-b align-top hover:bg-blue-50/40">
                <td className="px-2 py-1"><input type="checkbox" checked={selectedBulkIds.includes(student.id)} onChange={() => toggleBulkStudent(student.id)} /></td>
                <td className="px-2 py-1">{cell('learnerName')}</td>
                <td className="px-2 py-1">{cell('admissionNumber')}</td>
                <td className="px-2 py-1">{cell('dateOfBirth', 'date')}</td>
                <td className="px-2 py-1">{cell('dateEnrolled', 'date')}</td>
                <td className="px-2 py-1">{cell('dateLeft', 'date')}</td>
                <td className="px-2 py-1"><select value={row.standardLeft} onChange={(e) => updateBulkRow(student.id, 'standardLeft', e.target.value)} className="w-full min-w-[7rem] border rounded px-1.5 py-1">{Array.from({ length: 12 }, (_, index) => index + 1).map((n) => <option key={n} value={n}>{leavingCertificateStandardLabel(n, row.standardCurriculum)}</option>)}</select></td>
                <td className="px-2 py-1">{cell('dateOfIssue', 'date')}</td>
                <td className="px-2 py-1">{cell('headTeacherName')}</td>
                <td className="px-2 py-1"><select value={row.conductCategory} onChange={(e) => updateBulkRow(student.id, 'conductCategory', e.target.value)} className="w-full min-w-[8rem] border rounded px-1.5 py-1">{CONDUCT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></td>
                <td className="px-2 py-1"><textarea maxLength={220} value={row.academicComment} onChange={(e) => updateBulkRow(student.id, 'academicComment', e.target.value)} rows={2} className="w-64 border rounded px-1.5 py-1" /></td>
                <td className="px-2 py-1"><textarea maxLength={140} value={row.conductComment} onChange={(e) => updateBulkRow(student.id, 'conductComment', e.target.value)} rows={2} className="w-56 border rounded px-1.5 py-1" /></td>
                <td className="px-2 py-1"><textarea maxLength={140} value={row.cocurricularComment} onChange={(e) => updateBulkRow(student.id, 'cocurricularComment', e.target.value)} rows={2} className="w-56 border rounded px-1.5 py-1" /></td>
                <td className="px-2 py-1"><button type="button" onClick={() => saveBulkRow(student.id)} className="rounded bg-green-600 px-2 py-1 text-white">Save</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>}
    {bulkCertificates.length > 0 && <div className="certificate-bulk-renderer" aria-hidden="true">{bulkCertificates.map((item) => <CertificatePreview key={item.studentId} data={item.certificate} previewRef={(element) => { bulkRefs.current[item.studentId] = element; }} headTeacherName={schoolData?.principal_name || ''} pupilSignatureUrl={item.certificate.pupilSignatureUrl} headTeacherSignatureUrl={item.certificate.headTeacherSignatureUrl} />)}</div>}
  </div>;
}
