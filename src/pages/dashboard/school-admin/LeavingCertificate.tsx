import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Download, FileText, Loader2, Printer, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DigitalSignature from '@/components/DigitalSignature';
import { CONDUCT_CATEGORIES, conductText, downloadLeavingCertificate, formatCertificateDate, generateLeavingCertificateComments, printLeavingCertificate, type ConductCategory } from '@/lib/leavingCertificate';
import type { LeavingCertificateResult } from '@/lib/leavingCertificate';

const today = () => new Date().toISOString().slice(0, 10);

type ClassRecord = { name?: string | null; level?: number | null; grade_level?: number | null; curriculum?: string | null };
type StudentRecord = { id: string; first_name?: string | null; middle_name?: string | null; last_name?: string | null; admission_number?: string | null; date_of_birth?: string | null; enrollment_date?: string | null; date_left?: string | null; club_memberships?: string | null; curriculum?: string | null; classes?: ClassRecord | ClassRecord[] | null };
type CertificateState = { learnerName: string; admissionNumber: string; dateOfBirth: string; dateEnrolled: string; dateLeft: string; standard: string; standardLeft: string; dateOfIssue: string; conductCategory: ConductCategory; conductElaboration: string; academicComment: string; conductComment: string; cocurricularComment: string; extraNotes: string; pupilSignatureUrl: string | null; pupilSignatureType: string | null; headTeacherSignatureUrl: string | null; headTeacherSignatureType: string | null };
type CertificatePreviewProps = { data: CertificateState; previewRef: RefObject<HTMLDivElement | null>; schoolName: string; headTeacherName: string; pupilSignatureUrl: string | null; headTeacherSignatureUrl: string | null };

function CertificatePreview({ data, previewRef, schoolName, headTeacherName, pupilSignatureUrl, headTeacherSignatureUrl }: CertificatePreviewProps) {
  return <div ref={previewRef} className="leaving-certificate-preview" aria-label="Kenya Primary School Leaving Certificate preview">
    <img className="leaving-certificate-template" src="/certificates/kenya-primary-school-leaving-certificate-official.png" alt="Official Kenya Primary School Leaving Certificate template" />
    <div className="cert-value cert-name">{data.learnerName}</div>
    <div className="cert-value cert-admission">{data.admissionNumber}</div>
    <div className="cert-value cert-dob">{formatCertificateDate(data.dateOfBirth)}</div>
    <div className="cert-value cert-enrolled">{formatCertificateDate(data.dateEnrolled)}</div>
    <div className="cert-value cert-school">{schoolName}</div>
    <div className="cert-value cert-standard">{data.standard}</div>
    <div className="cert-value cert-left">{formatCertificateDate(data.dateLeft)}</div>
    <div className="cert-value cert-standard-left">{data.standardLeft}</div>
    <div className="cert-value cert-academic">{data.academicComment}</div>
    <div className="cert-value cert-conduct">{data.conductComment}</div>
    <div className="cert-value cert-cocurricular">{data.cocurricularComment}</div>
    {pupilSignatureUrl && <img className="cert-signature cert-pupil-signature" src={pupilSignatureUrl} alt="Pupil signature" />}
    <div className="cert-value cert-head-name">{headTeacherName || ''}</div>
    {headTeacherSignatureUrl && <img className="cert-signature cert-head-signature" src={headTeacherSignatureUrl} alt="Head teacher signature" />}
    <div className="cert-value cert-issue">{formatCertificateDate(data.dateOfIssue)}</div>
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
  const [search, setSearch] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

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
        const level = Number(cls?.level ?? cls?.grade_level);
        return level >= 1 && level <= 8 && String(cls?.curriculum || student.curriculum || '').toLowerCase() !== 'cbe';
      }));
      setLoading(false);
    })();
  }, [user?.schoolId]);

  const selectedStudent = students.find((student) => student.id === selectedId);
  const schoolCurriculum = String(schoolData?.curriculum || '').toLowerCase();
  const is844 = Boolean(schoolData) && (schoolCurriculum.includes('8-4-4') || schoolCurriculum.includes('844'));
  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return students;
    return students.filter((student) => `${student.first_name} ${student.middle_name || ''} ${student.last_name} ${student.admission_number}`.toLowerCase().includes(q));
  }, [students, search]);

  const loadCertificate = async (student: StudentRecord | undefined) => {
    if (!student) return;
    setSelectedId(student.id);
    const [{ data: saved }, { data: learnerResults }] = await Promise.all([
      supabaseUntyped.from('leaving_certificates').select('*').eq('student_id', student.id).eq('school_id', user?.schoolId).maybeSingle(),
      supabaseUntyped.from('results').select('marks, out_of, percentage, grade_844').eq('student_id', student.id).eq('school_id', user?.schoolId).order('created_at', { ascending: false }).limit(1000),
    ]);
    setResults(learnerResults || []);
    const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const baseCertificate = {
      learnerName: `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`.replace(/\s+/g, ' ').trim(),
      admissionNumber: student.admission_number || '', dateOfBirth: student.date_of_birth || '', dateEnrolled: student.enrollment_date || '',
      dateLeft: saved?.date_left || student.date_left || today(), standard: String(cls?.level ?? cls?.grade_level ?? 1), standardLeft: String(saved?.standard_left ?? cls?.level ?? cls?.grade_level ?? 1),
      dateOfIssue: saved?.date_of_issue || today(), conductCategory: (saved?.conduct_category || 'Good') as ConductCategory, conductElaboration: saved?.conduct_elaboration || '',
      academicComment: saved?.academic_comment || '', cocurricularComment: saved?.cocurricular_comment || '', conductComment: saved?.conduct_comment || '', extraNotes: saved?.extra_notes || '',
      pupilSignatureUrl: saved?.pupil_signature_url || null, pupilSignatureType: saved?.pupil_signature_type || null, headTeacherSignatureUrl: saved?.head_teacher_signature_url || null, headTeacherSignatureType: saved?.head_teacher_signature_type || null,
    };
    if (saved) setCertificate(baseCertificate);
    else setCertificate({ ...baseCertificate, ...generateLeavingCertificateComments(learnerResults || [], student.club_memberships, ''), conductComment: conductText(baseCertificate.conductCategory, baseCertificate.conductElaboration) });
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
    setSaving(true);
    const payload = {
      school_id: user.schoolId, student_id: selectedStudent.id, date_left: certificate.dateLeft, standard_left: Number(certificate.standardLeft), date_of_issue: certificate.dateOfIssue,
      conduct_category: certificate.conductCategory, conduct_elaboration: certificate.conductElaboration || null, academic_comment: certificate.academicComment, cocurricular_comment: certificate.cocurricularComment,
      conduct_comment: conductText(certificate.conductCategory, certificate.conductElaboration), extra_notes: certificate.extraNotes || null, pupil_signature_url: certificate.pupilSignatureUrl || null,
      pupil_signature_type: certificate.pupilSignatureType || null, head_teacher_signature_url: certificate.headTeacherSignatureUrl || null, head_teacher_signature_type: certificate.headTeacherSignatureType || null, updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseUntyped.from('leaving_certificates').upsert(payload, { onConflict: 'school_id,student_id' });
    if (error) toast.error(error.message); else { await supabaseUntyped.from('students').update({ date_left: certificate.dateLeft }).eq('id', selectedStudent.id).eq('school_id', user.schoolId); toast.success('Leaving certificate saved.'); }
    setSaving(false);
  };

  const saveSignature = async (kind: 'pupil' | 'head', url: string, type: 'drawn' | 'uploaded') => {
    setCertificate((current) => current ? ({ ...current, [kind === 'pupil' ? 'pupilSignatureUrl' : 'headTeacherSignatureUrl']: url, [kind === 'pupil' ? 'pupilSignatureType' : 'headTeacherSignatureType']: type }) : current);
  };

  if (!is844) return <div className="p-8"><div className="bg-amber-50 border border-amber-200 rounded-xl p-6"><h1 className="text-xl font-bold">Leaving Certificate unavailable</h1><p className="mt-2 text-sm text-amber-800">This feature is available only for schools using the 8-4-4 curriculum.</p></div></div>;

  return <div className="p-4 md:p-8 space-y-6">
    <div><div className="flex items-center gap-3"><FileText className="w-8 h-8 text-[#2563EB]" /><h1 className="text-2xl font-bold">Kenya Primary School Leaving Certificate</h1></div><p className="text-sm text-gray-500 mt-1">Prepare, review, sign and print the official one-page certificate.</p></div>
    <div className="grid xl:grid-cols-[360px_1fr] gap-6 items-start">
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <label className="block text-sm font-medium">Select learner</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or admission no." className="w-full border rounded-lg px-3 py-2 text-sm" />
        <select value={selectedId} onChange={(e) => loadCertificate(students.find((s) => s.id === e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={loading}><option value="">{loading ? 'Loading learners…' : 'Choose an 8-4-4 learner'}</option>{filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} — {student.admission_number}</option>)}</select>
        {certificate && <>
          <div className="border-t pt-4 space-y-3"><h2 className="font-semibold">Certificate details</h2>
            {([['learnerName', 'Learner name'], ['admissionNumber', 'Admission number'], ['dateOfBirth', 'Date of birth'], ['dateEnrolled', 'Date enrolled'], ['standard', 'Current standard']] as Array<[keyof CertificateState, string]>).map(([key, label]) => <label key={key} className="block text-xs font-medium text-gray-600">{label}<input value={String(certificate[key] || '')} readOnly className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" /></label>)}
            <label className="block text-xs font-medium text-gray-600">Date left<input type="date" value={certificate.dateLeft} onChange={(e) => update('dateLeft', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium text-gray-600">Standard left<select value={certificate.standardLeft} onChange={(e) => update('standardLeft', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{[1,2,3,4,5,6,7,8].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="block text-xs font-medium text-gray-600">Date of issue<input type="date" value={certificate.dateOfIssue} onChange={(e) => update('dateOfIssue', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium text-gray-600">Conduct category<select value={certificate.conductCategory} onChange={(e) => { update('conductCategory', e.target.value); update('conductComment', conductText(e.target.value as ConductCategory, certificate.conductElaboration)); }} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{CONDUCT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
            {certificate.conductCategory === 'Needs improvement' && <label className="block text-xs font-medium text-gray-600">Conduct elaboration ({certificate.conductElaboration.length}/140)<textarea maxLength={140} value={certificate.conductElaboration} onChange={(e) => { update('conductElaboration', e.target.value); update('conductComment', conductText('Needs improvement', e.target.value)); }} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></label>}
            <label className="block text-xs font-medium text-gray-600">Extra notes (not printed)<textarea value={certificate.extraNotes} onChange={(e) => update('extraNotes', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></label>
          </div>
          <button onClick={() => generateComments()} disabled={generating} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white rounded-lg py-2.5 text-sm font-medium">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate Comments</button>
          <div className="space-y-3"><label className="block text-xs font-medium text-gray-600">Academic ability comment ({certificate.academicComment.length}/220)<textarea maxLength={220} value={certificate.academicComment} onChange={(e) => update('academicComment', e.target.value)} rows={4} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-gray-600">Conduct comment ({certificate.conductComment.length}/140)<textarea maxLength={140} value={certificate.conductComment} onChange={(e) => update('conductComment', e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-gray-600">Co-curricular comment ({certificate.cocurricularComment.length}/140)<textarea maxLength={140} value={certificate.cocurricularComment} onChange={(e) => update('cocurricularComment', e.target.value)} rows={3} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label></div>
          <DigitalSignature title="Pupil's signature" subtitle="Draw or upload the pupil's signature." existingSignatureUrl={certificate.pupilSignatureUrl} existingSignatureType={certificate.pupilSignatureType} onSave={(url, type) => saveSignature('pupil', url, type)} />
          <DigitalSignature title="Head teacher's signature" subtitle="Draw or upload the head teacher's signature." existingSignatureUrl={certificate.headTeacherSignatureUrl} existingSignatureType={certificate.headTeacherSignatureType} onSave={(url, type) => saveSignature('head', url, type)} />
          <div className="flex flex-wrap gap-2"><button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}</button><button onClick={() => previewRef.current && downloadLeavingCertificate(previewRef.current, `${certificate.learnerName}-leaving-certificate.pdf`)} className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm"><Download className="w-4 h-4" />Download PDF</button><button onClick={() => previewRef.current && printLeavingCertificate(previewRef.current)} className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm"><Printer className="w-4 h-4" />Print</button></div>
        </>}
      </section>
      <section className="bg-gray-100 rounded-xl p-4 overflow-auto"><div className="min-w-[760px] flex justify-center">{certificate ? <CertificatePreview data={certificate} previewRef={previewRef} schoolName={schoolData?.name || ''} headTeacherName={schoolData?.principal_name || ''} pupilSignatureUrl={certificate.pupilSignatureUrl} headTeacherSignatureUrl={certificate.headTeacherSignatureUrl} /> : <div className="w-full min-h-[420px] flex items-center justify-center text-sm text-gray-500">Select a learner to preview the official certificate.</div>}</div></section>
    </div>
  </div>;
}
