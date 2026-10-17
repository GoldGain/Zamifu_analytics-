import { jsPDF } from 'jspdf';
import { CERTIFICATE_FONT } from './certificateFont';
export function installCertificateFont(pdf: jsPDF) {
  pdf.addFileToVFS('CertificateSerif.ttf', CERTIFICATE_FONT);
  pdf.addFont('CertificateSerif.ttf', 'CertificateSerif', 'normal');
  pdf.setFont('CertificateSerif', 'normal');
}

// Coordinates measured on the original 1275 × 1650 artwork. Crop only its
// outside whitespace; never stretch the artwork or independently scale axes.
export const CERTIFICATE_PAGE = { width: 595.2756, height: 841.8898, margin: 20 * 72 / 25.4 };
export const CERTIFICATE_CROP = { x: 110, y: 0, width: 955, height: 1460 };
export const CERTIFICATE_SCALE = Math.min(
  (CERTIFICATE_PAGE.width - 2 * CERTIFICATE_PAGE.margin) / CERTIFICATE_CROP.width,
  (CERTIFICATE_PAGE.height - 2 * CERTIFICATE_PAGE.margin) / CERTIFICATE_CROP.height,
);
export const CERTIFICATE_ORIGIN = {
  x: (CERTIFICATE_PAGE.width - CERTIFICATE_CROP.width * CERTIFICATE_SCALE) / 2,
  y: CERTIFICATE_PAGE.margin,
};
export const certificateX = (x: number) => CERTIFICATE_ORIGIN.x + (x - CERTIFICATE_CROP.x) * CERTIFICATE_SCALE;
export const certificateY = (y: number) => CERTIFICATE_ORIGIN.y + (y - CERTIFICATE_CROP.y) * CERTIFICATE_SCALE;
export type CertificateSlot = { x: number; y: number; width: number; extraRule?: boolean };
type Field = { key: string; label: string; slots: CertificateSlot[]; wrapSlots?: CertificateSlot[] };
const slot = (x: number, y: number, width: number, extraRule = false): CertificateSlot => ({ x, y, width, extraRule });
export const CERTIFICATE_FIELDS: Field[] = [
  { key: 'name', label: 'Learner name', slots: [slot(390, 471, 418)], wrapSlots: [slot(390, 443, 418, true), slot(390, 471, 418)] },
  { key: 'admission', label: 'Admission number', slots: [slot(940, 471, 106)] },
  { key: 'dob', label: 'Date of birth', slots: [slot(292, 533, 177)] },
  { key: 'enrolled', label: 'School name', slots: [slot(590, 533, 456)], wrapSlots: [slot(590, 505, 456, true), slot(590, 533, 456)] },
  { key: 'school', label: 'Enrollment date', slots: [slot(480, 595, 276)] },
  { key: 'standard', label: 'Current standard', slots: [slot(927, 595, 119)] },
  { key: 'left', label: 'Date left', slots: [slot(278, 656, 309)] },
  { key: 'standard-left', label: 'Standard completed', slots: [slot(510, 718, 319)] },
  { key: 'academic', label: 'Academic comment', slots: [slot(790, 778, 256), slot(125, 824, 921), slot(125, 870, 921)] },
  { key: 'conduct', label: 'Conduct comment', slots: [slot(329, 947, 717), slot(125, 993, 921)] },
  { key: 'cocurricular', label: 'Co-curricular comment', slots: [slot(710, 1039, 336), slot(125, 1085, 921)] },
  { key: 'head-name', label: 'Head teacher name', slots: [slot(852, 1131, 194), slot(580, 1178, 466)] },
  { key: 'issue', label: 'Date of issue', slots: [slot(284, 1294, 263)] },
];
export const CERTIFICATE_IMAGES = [
  { key: 'pupil-signature', x: 330, y: 1092, width: 240, height: 40 },
  { key: 'head-signature', x: 620, y: 1184, width: 400, height: 42 },
];
export type CertificateLine = CertificateSlot & { text: string; size: number; key: string };
export type CertificateLayout = { lines: CertificateLine[]; errors: string[] };
const metrics = new jsPDF({ unit: 'pt' });
installCertificateFont(metrics);
const clean = (s: string) => s.replace(/\s+/gu, ' ').trim();

// Consume the original string, not splitTextToSize output lengths (which can
// silently lose characters at word boundaries). Unbroken tokens also wrap.
function wrap(value: string, slots: CertificateSlot[], size: number) {
  metrics.setFontSize(size);
  let rest = value;
  const lines: Array<CertificateSlot & { text: string; size: number }> = [];
  for (const s of slots) {
    if (!rest) break;
    const chars = Array.from(rest);
    let lo = 0; let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (metrics.getTextWidth(chars.slice(0, mid).join('')) <= s.width - 6) lo = mid;
      else hi = mid - 1;
    }
    if (!lo) return { lines, rest };
    let take = lo;
    if (lo < chars.length && chars[lo] !== ' ') {
      const boundary = chars.slice(0, lo).lastIndexOf(' ');
      if (boundary > 0) take = boundary;
    }
    const text = chars.slice(0, take).join('').trimEnd();
    rest = chars.slice(take).join('').trimStart();
    lines.push({ ...s, text, size });
  }
  return { lines, rest };
}

export function layoutCertificate(values: Record<string, string>): CertificateLayout {
  const lines: CertificateLine[] = []; const errors: string[] = [];
  for (const field of CERTIFICATE_FIELDS) {
    const text = clean(values[field.key] || '');
    if (!text) continue;
    let fitted = false;
    // Prefer normal readable type. Long names get their own second ruled line
    // before reducing type; other fields never alter the surrounding layout.
    for (let size = 21; size >= 15; size -= 0.5) {
      const one = wrap(text, field.slots, size);
      const result = one.rest && field.wrapSlots ? wrap(text, field.wrapSlots, size) : one;
      if (!result.rest) {
        lines.push(...result.lines.map(line => ({ ...line, key: field.key })));
        fitted = true;
        break;
      }
    }
    if (!fitted) errors.push(`${field.label} is too long for the official certificate. Shorten this field; no text has been removed.`);
  }
  return { lines, errors };
}

export function measureCertificateLine(line: CertificateLine) {
  metrics.setFontSize(line.size);
  return metrics.getTextWidth(line.text);
}
