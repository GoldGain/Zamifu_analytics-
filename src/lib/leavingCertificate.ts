import html2pdf from 'html2pdf.js';

export const CONDUCT_CATEGORIES = ['Excellent', 'Very good', 'Good', 'Satisfactory', 'Needs improvement'] as const;
export type ConductCategory = typeof CONDUCT_CATEGORIES[number];

export function truncateAtWord(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const clipped = value.slice(0, limit + 1).replace(/\s+\S*$/, '').trim();
  return clipped || value.slice(0, limit).trim();
}

function bounded(value: string, limit: number) { return truncateAtWord(value.replace(/\s+/g, ' ').trim(), limit); }

export interface LeavingCertificateResult {
  marks?: number | string | null;
  out_of?: number | string | null;
  percentage?: number | string | null;
}

export function generateLeavingCertificateComments(results: LeavingCertificateResult[], clubs: string | null | undefined, notes = '') {
  const percentages = (results || []).map((row) => {
    const outOf = Number(row.out_of || 100);
    return Number(row.percentage ?? (outOf ? (Number(row.marks || 0) / outOf) * 100 : 0));
  }).filter(Number.isFinite);
  const average = percentages.length ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0;
  const best = Math.max(0, ...percentages);
  const academicTemplates = average >= 75
    ? [
      'Demonstrates excellent academic ability across the learning areas, with confident understanding of the approved Standard course. Shows consistent effort, sound judgement and a commendable readiness to pursue further learning with purpose.',
      'Has displayed very strong academic ability and a commendable grasp of the approved Standard course. The pupil works consistently, responds positively to guidance and has built a firm foundation for continued educational progress.',
    ]
    : average >= 55
      ? [
        'Demonstrates sound academic ability across the learning areas and a satisfactory understanding of the approved Standard course. The pupil applies effort consistently, responds well to guidance and has made steady, commendable progress.',
        'Has shown good academic ability and a growing understanding of the approved Standard course. With continued effort, regular practice and purposeful guidance, the pupil is well placed to make further progress in learning.',
      ]
      : [
        'Demonstrates developing academic ability and a basic understanding of the approved Standard course. The pupil has shown willingness to learn and will benefit from continued practice, encouragement and close guidance in future studies.',
        'Has made worthwhile progress in the approved Standard course and shows developing academic ability. Continued effort, support and regular practice will help the pupil strengthen understanding and achieve further success.',
      ];
  const academic = bounded(academicTemplates[Math.round(best + average) % academicTemplates.length], 220);
  const activity = (clubs || '').trim();
  const cocurricular = activity
    ? bounded(`The pupil participated in ${activity} and contributed positively to the wider school community during their time at the school.`, 140)
    : 'The pupil participated in school activities and contributed positively to the wider school community during their time at the school.';
  const cleanNotes = notes.trim();
  return {
    academic_comment: academic,
    cocurricular_comment: bounded(cocurricular, 140),
    notes_hint: cleanNotes ? bounded(cleanNotes, 140) : '',
  };
}

export function conductText(category: ConductCategory, elaboration = '') {
  const extra = category === 'Needs improvement' && elaboration.trim() ? ` — ${bounded(elaboration, 140)}` : '';
  return bounded(`${category}${extra}`, 140);
}

export interface LeavingCertificateData {
  learnerName: string;
  admissionNumber: string;
  dateOfBirth?: string | null;
  dateEnrolled?: string | null;
  schoolName: string;
  schoolAddress?: string | null;
  standard: string;
  dateLeft: string;
  standardLeft: string;
  dateOfIssue: string;
  academicComment: string;
  conductComment: string;
  cocurricularComment: string;
  pupilSignatureUrl?: string | null;
  headTeacherName?: string | null;
  headTeacherSignatureUrl?: string | null;
}

export function formatCertificateDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

export async function downloadLeavingCertificate(element: HTMLElement, filename: string) {
  await html2pdf().set({
    margin: 0,
    filename,
    image: { type: 'png', quality: 1 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all'] },
  }).from(element).save();
}

export function printLeavingCertificate(element: HTMLElement) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!printWindow) return;
  printWindow.document.write(`<html><head><title>Kenya Primary School Leaving Certificate</title><style>@page{size:A4 portrait;margin:0}body{margin:0;background:white}*{box-sizing:border-box}</style></head><body>${element.outerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}
