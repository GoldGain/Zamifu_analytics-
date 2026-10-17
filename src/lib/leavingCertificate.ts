import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { CERTIFICATE_FONT } from './certificateFont';
import { CERTIFICATE_PAGE, CERTIFICATE_CROP, CERTIFICATE_SCALE, CERTIFICATE_ORIGIN, CERTIFICATE_FIELDS, CERTIFICATE_IMAGES, certificateX, certificateY, layoutCertificate, installCertificateFont } from './leavingCertificateLayout';

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

export function readCertificateValues(element: HTMLElement) {
  return Object.fromEntries(CERTIFICATE_FIELDS.map(field => [field.key, element.querySelector(`.cert-${field.key}`)?.textContent || '']));
}
const escapeXml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));

export function renderLeavingCertificatePreview(element: HTMLElement) {
  if (!document.getElementById('certificate-typeface')) {
    const style = document.createElement('style'); style.id = 'certificate-typeface';
    style.textContent = `@font-face { font-family: CertificateSerif; src: url(data:font/ttf;base64,${CERTIFICATE_FONT}) format('truetype'); font-weight: 400; }`;
    document.head.append(style);
  }
  const layout = layoutCertificate(readCertificateValues(element));
  const host = element.querySelector('.cert-artwork');
  if (!host) return;
  const imageUrl = new URL('/certificates/kenya-primary-school-leaving-certificate-official.png', window.location.origin).href;
  const { width, height } = CERTIFICATE_PAGE;
  const crop = CERTIFICATE_CROP;
  const texts = layout.lines.map(line => `${line.extraRule ? `<line x1="${line.x}" y1="${line.y}" x2="${line.x + line.width}" y2="${line.y}" stroke="#555" stroke-width="1" stroke-dasharray="1 3"/>` : ''}<text x="${line.x + 3}" y="${line.y - 1.5}" font-size="${line.size}" font-family="CertificateSerif" fill="#111">${escapeXml(line.text)}</text>`).join('');
  const images = CERTIFICATE_IMAGES.map(box => {
    const img = element.querySelector(`.cert-${box.key}`) as HTMLImageElement | null;
    return img?.src ? `<image href="${escapeXml(img.src)}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet"/>` : '';
  }).join('');
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="A4 leaving certificate with 20 mm margins"><rect width="${width}" height="${height}" fill="white"/><svg x="${CERTIFICATE_ORIGIN.x}" y="${CERTIFICATE_ORIGIN.y}" width="${crop.width * CERTIFICATE_SCALE}" height="${crop.height * CERTIFICATE_SCALE}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}"><image href="${escapeXml(imageUrl)}" width="1275" height="1650"/>${texts}${images}</svg></svg>`;
  const warning = element.querySelector('.cert-overflow');
  if (warning) { warning.textContent = layout.errors.join(' '); (warning as HTMLElement).hidden = !layout.errors.length; }
  element.dataset.certificateValid = String(!layout.errors.length);
}

async function loadCertificateImage(url: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to load a certificate image. Please try again.'));
    image.src = url;
  });
  return image;
}

export async function createLeavingCertificatePdf(element: HTMLElement) {
  const layout = layoutCertificate(readCertificateValues(element));
  if (layout.errors.length) throw new Error(layout.errors.join('\n'));
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  const template = await loadCertificateImage('/certificates/kenya-primary-school-leaving-certificate-official.png');
  const crop = CERTIFICATE_CROP;
  const canvas = document.createElement('canvas');
  canvas.width = crop.width; canvas.height = crop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to prepare the certificate artwork.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.drawImage(template, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', CERTIFICATE_ORIGIN.x, CERTIFICATE_ORIGIN.y, crop.width * CERTIFICATE_SCALE, crop.height * CERTIFICATE_SCALE, undefined, 'FAST');
  installCertificateFont(pdf); pdf.setTextColor(17, 17, 17);
  for (const line of layout.lines) {
    if (line.extraRule) {
      pdf.setDrawColor(85); pdf.setLineWidth(0.4); pdf.setLineDashPattern([0.5, 1.5], 0);
      pdf.line(certificateX(line.x), certificateY(line.y), certificateX(line.x + line.width), certificateY(line.y));
      pdf.setLineDashPattern([], 0);
    }
    pdf.setFontSize(line.size * CERTIFICATE_SCALE);
    pdf.text(line.text, certificateX(line.x + 3), certificateY(line.y - 1.5), { baseline: 'alphabetic' });
  }
  for (const box of CERTIFICATE_IMAGES) {
    const source = element.querySelector(`.cert-${box.key}`) as HTMLImageElement | null;
    if (!source?.src) continue;
    const image = await loadCertificateImage(source.src);
    const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
    c.getContext('2d')!.drawImage(image, 0, 0);
    const ratio = Math.min(box.width / c.width, box.height / c.height);
    const w = c.width * ratio; const h = c.height * ratio;
    pdf.addImage(c.toDataURL('image/png'), 'PNG', certificateX(box.x + (box.width - w) / 2), certificateY(box.y + (box.height - h) / 2), w * CERTIFICATE_SCALE, h * CERTIFICATE_SCALE);
  }
  return pdf;
}

export async function downloadLeavingCertificate(element: HTMLElement, filename: string) {
  try { (await createLeavingCertificatePdf(element)).save(filename); }
  catch (error) { toast.error(error instanceof Error ? error.message : 'Certificate download failed.'); throw error; }
}

export async function printLeavingCertificate(element: HTMLElement) {
  // Print the SAME PDF as Download, not a separately scaled HTML window.
  const printWindow = window.open('', '_blank');
  if (!printWindow) { toast.error('Allow pop-ups to print the certificate.'); return; }
  try {
    printWindow.opener = null;
    printWindow.document.title = 'Preparing leaving certificate';
    const pdf = await createLeavingCertificatePdf(element);
    pdf.autoPrint();
    const url = URL.createObjectURL(pdf.output('blob'));
    printWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (error) {
    printWindow.close();
    toast.error(error instanceof Error ? error.message : 'Certificate printing failed.');
  }
}
