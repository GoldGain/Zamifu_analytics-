import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const CONDUCT_CATEGORIES = ['Excellent', 'Very good', 'Good', 'Satisfactory', 'Needs improvement'] as const;
export type ConductCategory = typeof CONDUCT_CATEGORIES[number];

// These values mirror the curriculum codes and class-level presets in Classes.tsx.
// The traditional 8-4-4 option is represented by an empty curriculum string.
export const LEAVING_CERTIFICATE_CBE_CURRICULUM = 'CBE' as const;
export const LEAVING_CERTIFICATE_TRADITIONAL_CURRICULUM = '' as const;

export interface LeavingCertificateClassLike {
  name?: string | null;
  level?: number | null;
  grade_level?: number | null;
  curriculum?: string | null;
}

export function isLeavingCertificateClass(classRecord?: LeavingCertificateClassLike | null, learnerCurriculum?: string | null) {
  const curriculum = classRecord?.curriculum ?? learnerCurriculum;
  const level = Number(classRecord?.level ?? classRecord?.grade_level);
  if (!Number.isInteger(level)) return false;

  if (curriculum === LEAVING_CERTIFICATE_CBE_CURRICULUM) return level === 8 || level === 9;
  // Classes.tsx currently exposes Form 3/Form 4 for the traditional 8-4-4 option
  // (levels 11/12). Keep the filter open to any normalized 1..12 traditional
  // level so schools using another supported 8-4-4 class preset are not hidden.
  return curriculum === LEAVING_CERTIFICATE_TRADITIONAL_CURRICULUM && level >= 1 && level <= 12;
}

export function leavingCertificateStandardLabel(value: number | string | null | undefined, curriculum?: string | null) {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1 || level > 12) return '';
  if (curriculum === LEAVING_CERTIFICATE_TRADITIONAL_CURRICULUM && level === 11) return 'Form 3';
  if (curriculum === LEAVING_CERTIFICATE_TRADITIONAL_CURRICULUM && level === 12) return 'Form 4';
  return `Grade ${level}`;
}

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
  const academic = bounded(academicTemplates[Math.round(best + average) % academicTemplates.length], 175);
  const activity = (clubs || '').trim();
  const cocurricular = activity
    ? bounded(`The pupil participated in ${activity} and contributed positively to the wider school community during their time at the school.`, 140)
    : 'Participated in school activities and contributed positively.';
  const cleanNotes = notes.trim();
  return {
    academic_comment: academic,
    cocurricular_comment: bounded(cocurricular, 80),
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
  const width = 816;
  const height = 1056;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#fff',
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument) => {
      const clonedElement = clonedDocument.querySelector('.leaving-certificate-preview') as HTMLElement | null;
      if (!clonedElement) return;
      clonedElement.style.width = `${width}px`;
      clonedElement.style.height = `${height}px`;
      clonedElement.style.minWidth = `${width}px`;
      clonedElement.style.maxWidth = `${width}px`;
      clonedElement.style.transform = 'none';
      clonedElement.style.margin = '0';
      const template = clonedElement.querySelector('.leaving-certificate-template') as HTMLImageElement | null;
      if (template) {
        template.style.width = `${width}px`;
        template.style.height = `${height}px`;
      }
    },
  });
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  pdf.save(filename);
}

export function printLeavingCertificate(element: HTMLElement) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!printWindow) return;
  const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'))
    .map((node) => node.outerHTML).join('');
  printWindow.document.write(`<html><head><title>Kenya Primary School Leaving Certificate</title>${styles}<style>@page{size:letter portrait;margin:0}body{margin:0;background:white}*{box-sizing:border-box}</style></head><body>${element.outerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
}
