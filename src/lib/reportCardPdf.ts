import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSchoolLevelBand, calculateCompetencyGrade, generateSubjectSpecificComment } from './grading';
import type { SchoolLevelBand, SubjectResult } from './grading';

// ── Shared PDF Helper Functions for Report Cards ─────────────────────────────

export interface SchoolInfo {
  name: string;
  motto?: string;
  logo_url?: string | null;
  principal_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  next_term_start_date?: string | null;
  school_closes_on?: string | null;
  school_opens_on?: string | null;
}

export interface SignatureInfo {
  principal_signature_url?: string | null;
  teacher_signature_url?: string | null;
}

export interface ReportCardLearnerIdentity {
  name: string;
  photoUrl?: string | null;
}

export interface StudentResult {
  subjects?: { name?: string } | null;
  marks?: number;
  out_of?: number;
  percentage?: number | null;
  [key: string]: any;
}

const REPORT_CONTENT_TOP = 18;
const REPORT_CONTENT_BOTTOM_MARGIN = 8;

/**
 * COMPACT (ONE-PAGE) MODE
 * Reduces fonts, paddings and vertical spacing so a full report card
 * (header + student info + 13-subject table + summary + trend + comment +
 * signatures) fits on a single A4 page.
 */
// Readable multi-section layout: allow safe pagination instead of squeezing text into overlapping rows.
export const COMPACT_MODE = true;
const ROW = COMPACT_MODE ? 3.2 : 5;   // vertical row step for student info (further reduced)
const HDR_H = COMPACT_MODE ? 26 : 28; // enough room for matching corner identity squares

export const REPORT_CARD_CORNER_SIZE = 22;
export const REPORT_CARD_CORNER_Y = 3;
export const REPORT_CARD_LOGO_X = 14;
export const REPORT_CARD_PHOTO_X = 174;

/**
 * Starts a clean continuation page when a report-card block cannot fit in the
 * remaining printable space. The returned Y coordinate is always safe to draw.
 */
export function ensureReportCardSpace(doc: jsPDF, y: number, requiredHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const safeY = pageHeight - REPORT_CONTENT_BOTTOM_MARGIN - requiredHeight;
  if (y + requiredHeight <= pageHeight - REPORT_CONTENT_BOTTOM_MARGIN) return y;
  // Report cards are intentionally one-page documents. In compact mode, keep
  // the drawing cursor on page one instead of silently creating a continuation
  // page; callers use the compact dimensions and content caps below to remain
  // readable within the safe area.
  if (COMPACT_MODE) return Math.max(REPORT_CONTENT_TOP, safeY);
  doc.addPage();
  return REPORT_CONTENT_TOP;
}

// Pathway Mapping based on Junior School Learning Areas
export const PATHWAY_MAPPING: Record<string, string> = {
  'Mathematics': 'STEM',
  'Integrated Science': 'STEM',
  'Pre-Technical Studies': 'STEM',
  'Agriculture and Nutrition': 'STEM',
  'Agriculture': 'STEM',
  'Science and Technology': 'STEM',
  'English': 'Social Sciences',
  'Kiswahili': 'Social Sciences',
  'Social Studies': 'Social Sciences',
  'Religious Education': 'Social Sciences',
  'CRE': 'Social Sciences',
  'IRE': 'Social Sciences',
  'HRE': 'Social Sciences',
  'Creative Arts and Sports': 'Arts & Sports',
  'Creative Arts': 'Arts & Sports',
  'Physical and Health Education': 'Arts & Sports',
  'Music': 'Arts & Sports',
  'Art and Craft': 'Arts & Sports',
};

export const SUBJECT_ORDER = [
  'English',
  'Kiswahili',
  'Mathematics',
  'Integrated Science',
  'Pre-Technical Studies',
  'Agriculture',
  'Social Studies',
  'CRE',
  'Creative Arts',
  'Science and Technology',
  'Physical and Health Education',
  'IRE',
  'HRE'
];

export function sortResultsBySubject(results: any[]) {
  return [...results].sort((a, b) => {
    const nameA = a.subjects?.name || '';
    const nameB = b.subjects?.name || '';
    const indexA = SUBJECT_ORDER.findIndex(s => nameA.toLowerCase().includes(s.toLowerCase()));
    const indexB = SUBJECT_ORDER.findIndex(s => nameB.toLowerCase().includes(s.toLowerCase()));
    if (indexA === -1 && indexB === -1) return nameA.localeCompare(nameB);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

export function getPercentage(result: any): number {
  if (result.percentage !== undefined && result.percentage !== null) return Number(result.percentage);
  const outOf = Number(result.out_of || 100);
  return outOf > 0 ? Math.round((Number(result.marks || 0) / outOf) * 100) : 0;
}

export function gradeFromPercentage(percentage: number, classData: any) {
  const band = getSchoolLevelBand(classData);
  const g = calculateCompetencyGrade(percentage, band);
  return { grade: g.subLevel, points: g.points || null, descriptor: g.descriptor };
}

export function overallGradeLabel(avgPct: number, classData?: any) {
  return gradeFromPercentage(avgPct, classData).grade;
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function formatPosition(position: number | null, totalStudents: number): string {
  if (!position) return 'N/A';
  return `${ordinal(position)} out of ${totalStudents || '—'}`;
}

// ── Legacy AI Comment Generator (kept for backward compatibility) ─────────────
const COMMENT_TEMPLATES = {
  top1: [
    "Exceptional performance! You ranked 1st out of {total} learners. Your mastery of {bestSubject} is remarkable, and your dedication sets a brilliant example. With your {grade} grade ({descriptor}), you demonstrate that excellence is a habit. Continue being the trailblazer you are!",
    "Magnificent work! Securing 1st position among {total} learners requires extraordinary commitment. Your {grade} grade in {bestSubject} reflects exceptional understanding. You are an inspiration to your peers — keep shining brilliantly!",
  ],
  top2: [
    "Outstanding achievement! You claimed 2nd place among {total} learners. Your proficiency in {bestSubject} is impressive, earning a {grade} grade ({descriptor}). A little more effort and the top spot is yours!",
    "Brilliant performance! 2nd position out of {total} learners showcases your determination. Your strength in {bestSubject} with a {grade} grade is praiseworthy. Keep pushing boundaries!",
  ],
  top3: [
    "Excellent effort! You earned 3rd place out of {total} learners. Your dedication to {bestSubject} has paid off with a {grade} grade ({descriptor}). Consistency will take you even higher!",
    "Wonderful work! Ranking 3rd among {total} learners demonstrates serious commitment. Your {grade} grade in {bestSubject} proves you have what it takes. Aim for the stars!",
  ],
  top5: [
    "Great work! You are among the top 5 performers in a class of {total}. Your {grade} grade in {bestSubject} shows tremendous potential. With continued focus, especially on {weakestSubject}, you will reach even greater heights!",
    "Commendable performance! Being in the top 5 out of {total} learners reflects your hard work. Your {grade} grade in {bestSubject} is excellent. Keep building on this strong foundation!",
  ],
  newStudent: [
    "Welcome! You have achieved a {grade} grade overall ({descriptor}). Your performance in {bestSubject} shows great promise. Focus on strengthening {weakestSubject} next term. We believe in your incredible potential!",
    "A warm welcome! Your {grade} grade ({descriptor}) indicates a solid start. You show particular aptitude in {bestSubject}. Devoting more time to {weakestSubject} will help you flourish. Exciting times ahead!",
  ],
  improved10: [
    "Remarkable improvement! You rose by {dev}% from last term — a phenomenal leap! Your relentless effort in {bestSubject} has truly paid off with a {grade} grade ({descriptor}). This momentum will carry you to extraordinary achievements!",
    "Phenomenal progress! A {dev}% increase from last term is truly inspiring. Your determination in {bestSubject} earned you a {grade} grade ({descriptor}). Maintain this incredible trajectory!",
  ],
  improved5: [
    "Excellent progress! You improved by {dev}% from last term. Your dedication to {bestSubject} is clearly evident in your {grade} grade ({descriptor}). To reach even greater heights, please give more attention to {weakestSubject}. Keep soaring!",
    "Fantastic improvement! Rising by {dev}% demonstrates real commitment. Your {grade} grade in {bestSubject} reflects your growing excellence. Continue nurturing your strengths while working on {weakestSubject}.",
  ],
  improved2: [
    "Good improvement! You rose by {dev}% from last term. Your {grade} grade shows positive growth. Continue building on your strength in {bestSubject} while dedicating time to {weakestSubject}. Steady progress leads to remarkable success!",
    "Nice upward trend! A {dev}% improvement shows you are on the right path. Your {grade} grade in {bestSubject} is encouraging. Keep refining your approach, especially for {weakestSubject}.",
  ],
  consistent: [
    "Consistent performance this term with a {grade} grade ({descriptor}). You demonstrate steady capability in {bestSubject}. Let's set ambitious goals to elevate {weakestSubject} next term. Your reliability is a valuable asset!",
    "Steady and reliable! Your {grade} grade ({descriptor}) shows consistency. Your strength in {bestSubject} is clear. Channeling more energy into {weakestSubject} will create a more balanced academic profile.",
  ],
  dropped5: [
    "Your performance dropped by {dev}% from last term. Do not be discouraged — every accomplished learner faces challenges. Focus more on {weakestSubject} and seek guidance from your teacher. We have full confidence you will bounce back stronger!",
    "A slight dip of {dev}% this term, but setbacks are setups for comebacks. Your previous success in {bestSubject} proves your capability. Let's create a recovery plan for {weakestSubject}. You've got this!",
  ],
  dropped10: [
    "Your performance dropped by {dev}% from last term, which requires attention. Please dedicate more quality time to {weakestSubject} and revisit your study strategies. Your teachers and parents are here to support your recovery. We believe in your resilience!",
    "A decline of {dev}% is concerning, but not insurmountable. Your past performance in {bestSubject} shows you have the ability. Let's identify obstacles together and create a targeted improvement plan for {weakestSubject}.",
  ],
  droppedSevere: [
    "Your performance dropped significantly by {dev}% from last term. Urgent intervention is needed, particularly in {weakestSubject}. Please schedule a meeting with your class teacher to develop a comprehensive improvement strategy. Your potential is untapped — we are here to help you recover!",
    "A substantial decline of {dev}% demands immediate action. Your capability in {bestSubject} proves you can excel. Let's work together intensively on {weakestSubject}. With focused effort and support, remarkable recovery is absolutely possible!",
  ],
};

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) / 2147483647;
}

export function generateUniqueAIComment(
  studentName: string,
  avgPct: number,
  deviation: number | null,
  bestSubject: string,
  weakestSubject: string,
  position: number | null,
  totalStudents: number,
  isNew: boolean,
  classData?: any,
  allSubjectResults?: SubjectResult[]
): string {
  // If we have full subject data, use the rich subject-specific generator
  if (allSubjectResults && allSubjectResults.length > 0) {
    return generateSubjectSpecificComment(
      studentName,
      allSubjectResults,
      avgPct,
      position,
      totalStudents,
      classData
    );
  }

  // Fallback to template-based generator
  const band = getSchoolLevelBand(classData);
  const grade = calculateCompetencyGrade(avgPct, band);
  const gradeLabel = grade.subLevel;
  const descriptor = grade.descriptor;

  const seed = `${studentName}-${avgPct.toFixed(1)}-${position}-${totalStudents}-${deviation || 0}`;
  const rand = seededRandom(seed);

  let templates: string[];

  if (position === 1 && totalStudents >= 3) {
    templates = COMMENT_TEMPLATES.top1;
  } else if (position === 2 && totalStudents >= 3) {
    templates = COMMENT_TEMPLATES.top2;
  } else if (position === 3 && totalStudents >= 3) {
    templates = COMMENT_TEMPLATES.top3;
  } else if (position && position <= 5 && totalStudents >= 5) {
    templates = COMMENT_TEMPLATES.top5;
  } else if (isNew || deviation === null) {
    templates = COMMENT_TEMPLATES.newStudent;
  } else if (deviation > 10) {
    templates = COMMENT_TEMPLATES.improved10;
  } else if (deviation > 5) {
    templates = COMMENT_TEMPLATES.improved5;
  } else if (deviation > 2) {
    templates = COMMENT_TEMPLATES.improved2;
  } else if (deviation >= -1) {
    templates = COMMENT_TEMPLATES.consistent;
  } else if (deviation >= -5) {
    templates = COMMENT_TEMPLATES.dropped5;
  } else if (deviation >= -10) {
    templates = COMMENT_TEMPLATES.dropped10;
  } else {
    templates = COMMENT_TEMPLATES.droppedSevere;
  }

  const template = templates[Math.floor(rand * templates.length)];

  return template
    .replace('{studentName}', studentName)
    .replace('{bestSubject}', bestSubject)
    .replace('{weakestSubject}', weakestSubject)
    .replace('{position}', String(position || 'N/A'))
    .replace('{total}', String(totalStudents))
    .replace('{dev}', deviation !== null ? Math.abs(deviation).toFixed(1) : '0')
    .replace('{grade}', gradeLabel)
    .replace('{descriptor}', descriptor)
    .replace('{avgPct}', avgPct.toFixed(1));
}

// ── Performance Trend Graph Drawing ──────────────────────────────────────────
export function drawTrendGraph(
  doc: jsPDF,
  trendData: { term: string; avg: number }[],
  x: number,
  y: number,
  width: number,
  height: number,
  band: SchoolLevelBand
): number {
  // REMOVED: Performance Trend Graph is no longer displayed on report cards
  // This function is kept for backward compatibility but returns immediately
  return y;
  
  // Original code below (disabled):
  // Performance trend graph has been removed to fit report cards on one page
  // The graph drawing code is intentionally removed for compact layout
}

// ── Add Logo to PDF ──────────────────────────────────────────────────────────
// Helper to compress and convert image to JPEG data URL
async function compressImage(src: string, maxWidth: number = 400, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Resource load timeout')), 12000);
    const img = new Image();
    // Setting crossOrigin on data URLs can make some mobile browsers reject an otherwise valid image.
    if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timeout);
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      if (!sourceWidth || !sourceHeight) {
        reject(new Error('Image has no readable dimensions'));
        return;
      }
      const scale = Math.min(1, maxWidth / sourceWidth);
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is unavailable'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Resource load failed'));
    };
    img.src = src;
  });
}

async function compressSquareImage(src: string, maxSize: number = 800, quality: number = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Photo load timeout')), 12000);
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timeout);
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      const side = Math.min(sourceWidth, sourceHeight);
      if (!side) {
        reject(new Error('Photo has no readable dimensions'));
        return;
      }
      const outputSize = Math.max(1, Math.min(maxSize, side));
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is unavailable'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);
      const sx = (sourceWidth - side) / 2;
      const sy = (sourceHeight - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSize, outputSize);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Photo resource failed to load'));
    };
    img.src = src;
  });
}

// Image cache to prevent redundant processing and bloat in bulk generation
const imageCache: Record<string, string> = {};

export async function addLogoToPDF(
  doc: jsPDF,
  logoUrl: string | null | undefined,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number
): Promise<boolean> {
  if (!logoUrl) return false;
  try {
    let dataUrl = imageCache[logoUrl];
    if (!dataUrl) {
      dataUrl = await compressImage(logoUrl, 300, 0.7);
      imageCache[logoUrl] = dataUrl;
    }
    doc.addImage(dataUrl, 'JPEG', x, y, maxWidth, maxHeight, undefined, 'FAST');
    return true;
  } catch (err) {
    console.error('Logo add error:', err);
    return false;
  }
}

// ── Corner identity fallbacks ──────────────────────────────────────────────────
export function drawLogoPlaceholder(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  size: number,
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(106, 27, 154);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, size, size, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(8, size * 0.34));
  doc.setTextColor(106, 27, 154);
  doc.text(label, x + size / 2, y + size / 2 + size * 0.12, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

export function drawStudentPhotoPlaceholder(
  doc: jsPDF,
  studentName: string,
  x: number,
  y: number,
  size: number
) {
  const initials = studentName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'ST';
  doc.setFillColor(232, 234, 246);
  doc.setDrawColor(106, 27, 154);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, size, size, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(9, size * 0.42));
  doc.setTextColor(106, 27, 154);
  doc.text(initials, x + size / 2, y + size / 2 + size * 0.14, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

export async function addStudentPhotoToPDF(
  doc: jsPDF,
  photoUrl: string | null | undefined,
  x: number,
  y: number,
  size: number
): Promise<boolean> {
  if (!photoUrl) return false;
  try {
    let dataUrl = imageCache[photoUrl];
    if (!dataUrl) {
      // Crop to a square before placing it, preserving the learner’s face and avoiding distortion.
      dataUrl = await compressSquareImage(photoUrl, 800, 0.92);
      imageCache[photoUrl] = dataUrl;
    }

    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1);
    doc.rect(x - 0.5, y - 0.5, size + 1, size + 1, 'D');
    doc.addImage(dataUrl, 'JPEG', x, y, size, size, undefined, 'FAST');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.rect(x - 0.6, y - 0.6, size + 1.2, size + 1.2, 'D');
    return true;
  } catch (err) {
    console.error('Photo add error:', err);
    return false;
  }
}

// ── Draw Report Header ───────────────────────────────────────────────────────
export async function drawReportHeader(
  doc: jsPDF,
  school: SchoolInfo,
  learner?: ReportCardLearnerIdentity,
) {
  doc.setFillColor(245, 166, 35);
  doc.rect(0, 0, 210, HDR_H, 'F');

  // Keep both identity images in matching 22mm squares at the same height.
  // The school logo is always on the left and the learner photo/initials on the right.
  const logoAdded = await addLogoToPDF(
    doc,
    school.logo_url || '/logo.png',
    REPORT_CARD_LOGO_X,
    REPORT_CARD_CORNER_Y,
    REPORT_CARD_CORNER_SIZE,
    REPORT_CARD_CORNER_SIZE,
  );
  if (!logoAdded) drawLogoPlaceholder(doc, 'ZA', REPORT_CARD_LOGO_X, REPORT_CARD_CORNER_Y, REPORT_CARD_CORNER_SIZE);
  const photoAdded = learner?.photoUrl
    ? await addStudentPhotoToPDF(doc, learner.photoUrl, REPORT_CARD_PHOTO_X, REPORT_CARD_CORNER_Y, REPORT_CARD_CORNER_SIZE)
    : false;
  if (!photoAdded && learner?.name) {
    drawStudentPhotoPlaceholder(doc, learner.name, REPORT_CARD_PHOTO_X, REPORT_CARD_CORNER_Y, REPORT_CARD_CORNER_SIZE);
  }

  // Center school identity between the two corner squares so long school contact
  // text cannot collide with either the logo or the learner image.
  const centerX = 105;
  doc.setTextColor(26, 35, 126);
  doc.setFontSize(COMPACT_MODE ? 13 : 16);
  doc.setFont('helvetica', 'bold');
  doc.text(school.name || 'School Name', centerX, 10, { align: 'center', maxWidth: 132 });
  doc.setFontSize(COMPACT_MODE ? 7.5 : 9);
  doc.setFont('helvetica', 'normal');
  doc.text(school.motto || '', centerX, 15.5, { align: 'center', maxWidth: 132 });
  const contactLine = `${school.address || ''} | ${school.phone || ''} | ${school.email || ''}`;
  const contactLines = doc.splitTextToSize(contactLine, 132);
  doc.text(contactLines, centerX, 21, { align: 'center' });
}

// ── Add Signatures to PDF ────────────────────────────────────────────────────
export async function addSignaturesToPDF(
  doc: jsPDF,
  signatures: SignatureInfo,
  y: number,
  schoolInfo?: SchoolInfo
) {
  // Compact mode shrinks the signature block so it fits on page 1
  const sigBlockH = COMPACT_MODE ? 14 : 34;
  const sigImgH = COMPACT_MODE ? 8 : 16;
  const sigImgY = COMPACT_MODE ? 0.5 : 3;
  const sigLabelY = COMPACT_MODE ? 9 : 22;
  const closingDate = schoolInfo?.school_closes_on ? new Date(`${schoolInfo.school_closes_on}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const openingDate = schoolInfo?.school_opens_on
    ? new Date(`${schoolInfo.school_opens_on}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : schoolInfo?.next_term_start_date
      ? new Date(`${schoolInfo.next_term_start_date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
  const calendarNoticeLines = [
    closingDate ? `School closes on: ${closingDate}` : '',
    openingDate ? `School opens on: ${openingDate}` : '',
  ].filter(Boolean);
  y = ensureReportCardSpace(doc, y, sigBlockH + (calendarNoticeLines.length > 0 ? (COMPACT_MODE ? 12 : 15) : 5));
  const hasPrincipalSig = signatures.principal_signature_url && signatures.principal_signature_url.startsWith('data:');
  const hasTeacherSig = signatures.teacher_signature_url && signatures.teacher_signature_url.startsWith('data:');
  doc.setFontSize(COMPACT_MODE ? 6 : 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 70);
  if (hasTeacherSig || hasPrincipalSig) {
    if (!COMPACT_MODE) doc.text('DIGITAL SIGNATURES', 14, y);
    if (hasTeacherSig) {
      try {
        let sigUrl = imageCache[signatures.teacher_signature_url!];
        if (!sigUrl) {
          sigUrl = await compressImage(signatures.teacher_signature_url!, 200, 0.6);
          imageCache[signatures.teacher_signature_url!] = sigUrl;
        }
        doc.addImage(sigUrl, 'JPEG', 14, y + sigImgY, 40, sigImgH, undefined, 'FAST');
      } catch {
        doc.setDrawColor(150, 150, 155);
        doc.line(14, y + sigLabelY - 2, 56, y + sigLabelY - 2);
      }
    } else {
      doc.setDrawColor(150, 150, 155);
      doc.line(14, y + sigLabelY - 2, 56, y + sigLabelY - 2);
    }
    doc.setFontSize(COMPACT_MODE ? 5.5 : 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 110);
    doc.text('Class Teacher Signature', 14, y + sigLabelY);
    if (hasPrincipalSig) {
      try {
        let sigUrl = imageCache[signatures.principal_signature_url!];
        if (!sigUrl) {
          sigUrl = await compressImage(signatures.principal_signature_url!, 200, 0.6);
          imageCache[signatures.principal_signature_url!] = sigUrl;
        }
        doc.addImage(sigUrl, 'JPEG', 118, y + sigImgY, 40, sigImgH, undefined, 'FAST');
      } catch {
        doc.setDrawColor(150, 150, 155);
        doc.line(118, y + sigLabelY - 2, 160, y + sigLabelY - 2);
      }
    } else {
      doc.setDrawColor(150, 150, 155);
      doc.line(118, y + sigLabelY - 2, 160, y + sigLabelY - 2);
    }
    doc.setFontSize(COMPACT_MODE ? 5.5 : 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 110);
    doc.text(`Principal Signature${schoolInfo?.principal_name ? ` (${schoolInfo.principal_name})` : ''}`, 118, y + sigLabelY);
  } else {
    doc.setDrawColor(150, 150, 155);
    doc.line(14, y + (COMPACT_MODE ? 9 : 12), 75, y + (COMPACT_MODE ? 9 : 12));
    doc.line(118, y + (COMPACT_MODE ? 9 : 12), 181, y + (COMPACT_MODE ? 9 : 12));
    doc.setFontSize(COMPACT_MODE ? 6 : 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 85);
    doc.text('Class Teacher Signature', 14, y + (COMPACT_MODE ? 15 : 18));
    doc.text(`Principal Signature${schoolInfo?.principal_name ? ` (${schoolInfo.principal_name})` : ''}`, 118, y + (COMPACT_MODE ? 15 : 18));
  }
  // Date
  doc.setFontSize(COMPACT_MODE ? 6 : 7);
  doc.setTextColor(80, 80, 85);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, y + (COMPACT_MODE ? 12 : 27));
  // School stamp area
  doc.setDrawColor(180, 180, 185);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(118, y + sigImgY, 32, sigImgH + 2);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(5.5);
  doc.setTextColor(150, 150, 155);
  doc.text('OFFICIAL STAMP', 134, y + sigImgY + sigImgH / 2, { align: 'center' });

  if (calendarNoticeLines.length > 0) {
    doc.setTextColor(0, 102, 102);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(COMPACT_MODE ? 7.2 : 8);
    doc.text(calendarNoticeLines, 14, y + sigBlockH + (COMPACT_MODE ? 4 : 5), { maxWidth: 180 });
    doc.setTextColor(0, 0, 0);
    return y + sigBlockH + (COMPACT_MODE ? 12 : 16);
  }

  return y + sigBlockH;
}

// ── Draw Footer ──────────────────────────────────────────────────────────────
export function drawReportFooter(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Zamifu Analytics School Management System | Support: tutorsultimate@gmail.com', 105, pageHeight - 6, { align: 'center' });
}

// ── Draw Student Info ────────────────────────────────────────────────────────
export function drawStudentInfo(
  doc: jsPDF,
  studentName: string,
  admissionNo: string,
  className: string,
  termName: string,
  academicYear: string,
  position: string,
  y: number = 38,
  assessmentName?: string
) {
  // Compact: two-column grid, denser rows so the info block uses <= 14mm
  const fs = COMPACT_MODE ? 8 : 9;
  doc.setTextColor(0, 0, 0); doc.setFontSize(fs); doc.setFont('helvetica', 'normal');
  doc.text(`Learner: ${studentName}`, 14, y);
  doc.text(`Adm No: ${admissionNo}`, 14, y + ROW);
  doc.text(`Class: ${className}`, 14, y + ROW * 2);
  doc.text(`Term: ${termName} ${academicYear}`, 120, y);
  if (assessmentName) {
    doc.text(`Assessment: ${assessmentName}`, 120, y + ROW);
    doc.text(`Position: ${position}`, 120, y + ROW * 2);
  } else {
    doc.text(`Position: ${position}`, 120, y + ROW);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, y + ROW * 2);
  }
  doc.setDrawColor(106, 27, 154); doc.line(14, y + ROW * 2 + 3, 196, y + ROW * 2 + 3);
}

// ── Draw Results Table ───────────────────────────────────────────────────────
export function drawResultsTable(
  doc: jsPDF,
  results: any[],
  classData: any,
  startY: number
): number {
  startY = ensureReportCardSpace(doc, startY, 24);
  const sorted = sortResultsBySubject(results);
  const isPrimary = getSchoolLevelBand(classData) === 'primary';
  const tableHead = isPrimary ? ['#', 'Learning Area', 'Marks', 'Out Of', 'Score & Grade'] : ['#', 'Learning Area', 'Marks', 'Out Of', 'Score & Grade', 'Points'];
  const tableBody = sorted.map((r, i) => {
    const pct = getPercentage(r);
    const grading = gradeFromPercentage(pct, classData);
    const subjectName = r.subjects?.name === 'Creative Arts' ? 'C-Arts' : (r.subjects?.name || 'N/A');
    const row: any[] = [i + 1, subjectName, String(r.marks || '0'), String(r.out_of || 100), `${pct}% ${grading.grade}`];
    if (!isPrimary) row.push(grading.points ?? '—');
    return row;
  });
  autoTable(doc, {
    startY,
    head: [tableHead],
    body: tableBody,
    pageBreak: COMPACT_MODE ? 'avoid' : 'auto',
    rowPageBreak: 'avoid',
    styles: { fontSize: COMPACT_MODE ? 6.8 : 8, cellPadding: COMPACT_MODE ? 0.6 : 1.5 },
    headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: COMPACT_MODE ? 7.2 : 8, cellPadding: 0.8 },
    alternateRowStyles: { fillColor: [232, 234, 246] }, margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY;
}

// ── Draw Pathway Performance ──────────────────────────────────────────────────
export function drawPathwayPerformance(
  doc: jsPDF,
  results: any[],
  startY: number
): number {
  const pathways = ['STEM', 'Arts & Sports', 'Social Sciences'];
  const pathwayData = pathways.map(pathway => {
    const relevantResults = results.filter(r => {
      const subjectName = r.subjects?.name || '';
      return PATHWAY_MAPPING[subjectName] === pathway;
    });
    const areasUsed = relevantResults.map(r => r.subjects?.name).join(', ');
    const score = relevantResults.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);
    const outOf = relevantResults.reduce((sum, r) => sum + (Number(r.out_of) || 100), 0);
    const percentage = outOf > 0 ? (score / outOf) * 100 : 0;
    return [pathway, areasUsed || 'None', `${score}/${outOf}`, `${percentage.toFixed(1)}%`];
  });
  doc.setFontSize(COMPACT_MODE ? 9 : 10); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
  doc.text('Pathway Performance Profile', 14, startY + (COMPACT_MODE ? 5 : 6));
  autoTable(doc, {
    startY: startY + (COMPACT_MODE ? 6 : 8), head: [['Pathway', 'Learning Areas Used', 'Score', 'Performance']], body: pathwayData,
    styles: { fontSize: COMPACT_MODE ? 7.5 : 8, cellPadding: COMPACT_MODE ? 1 : 2 }, headStyles: { fillColor: [106, 27, 154], textColor: 255 },
    alternateRowStyles: { fillColor: [255, 248, 225] }, margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY;
}

// ── Draw Summary Box ─────────────────────────────────────────────────────────
export function drawSummaryBox(
  doc: jsPDF,
  results: any[],
  avgPercentage: number,
  totalPoints: number | null,
  position: string,
  classData: any,
  startY: number
): number {
  const boxH = COMPACT_MODE ? 13 : 22;
  startY = ensureReportCardSpace(doc, startY, boxH + 2);
  const isPrimary = getSchoolLevelBand(classData) === 'primary';
  const totalMarks = results.reduce((s, r) => s + (Number(r.marks || 0)), 0);
  const overallGrading = gradeFromPercentage(avgPercentage, classData);
  doc.setFillColor(0, 137, 123); doc.rect(14, startY, 182, boxH, 'F');
  const fs = COMPACT_MODE ? 7.2 : 8;
  const gap = COMPACT_MODE ? 5.8 : 8;
  doc.setFontSize(fs); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(`Learning Areas: ${results.length}`, 20, startY + gap);
  doc.text(`Total Marks: ${totalMarks}`, 65, startY + gap);
  doc.text(`Average: ${avgPercentage.toFixed(1)}%`, 130, startY + gap);
  doc.text(`Position: ${position}`, 20, startY + gap * 2);
  doc.text(`Grade: ${overallGrading.grade}`, 65, startY + gap * 2);
  if (!isPrimary && totalPoints !== null) doc.text(`Total Points: ${totalPoints}`, 130, startY + gap * 2);
  // Leave a clear baseline gap so the deviation line cannot be painted into the summary border.
  return startY + boxH + (COMPACT_MODE ? 3 : 4);
}

// ── Draw Next Term Start Date ──────────────────────────────────────────────────
export function drawNextTermStartDate(
  doc: jsPDF,
  nextTermStartDate: string | null | undefined,
  startY: number
): number {
  if (!nextTermStartDate) return startY;
  
  startY = ensureReportCardSpace(doc, startY, COMPACT_MODE ? 8 : 10);
  const dateObj = new Date(nextTermStartDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  doc.setTextColor(0, 102, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(COMPACT_MODE ? 7.5 : 8);
  doc.text(`Next term begins on: ${formattedDate}`, 14, startY);
  doc.setTextColor(0, 0, 0);
  
  return startY + (COMPACT_MODE ? 7 : 8);
}

// ── Draw Deviation ───────────────────────────────────────────────────────────
export function drawDeviation(
  doc: jsPDF,
  deviation: number | null,
  previousAvg: number | null,
  previousPosition: number | null,
  startY: number
): number {
  startY = ensureReportCardSpace(doc, startY, COMPACT_MODE ? 10 : 12);
  if (deviation !== null && previousAvg !== null) {
    const arrow = deviation >= 0 ? '\u25B2' : '\u25BC';
    const sign = deviation >= 0 ? '+' : '';
    if (deviation >= 0) doc.setTextColor(76, 175, 80); else doc.setTextColor(244, 67, 54);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(COMPACT_MODE ? 7 : 8);
    doc.text(`${arrow} ${sign}${deviation.toFixed(1)}% vs previous (Prev: ${previousAvg?.toFixed(1)}% - Pos: ${previousPosition || 'N/A'})`, 14, startY);
    doc.setTextColor(0, 0, 0);
  } else if (previousAvg !== null) {
    doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal'); doc.setFontSize(COMPACT_MODE ? 7 : 8);
    doc.text(`Previous performance: ${previousAvg.toFixed(1)}% - Position: ${previousPosition || 'N/A'}`, 14, startY);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal'); doc.setFontSize(COMPACT_MODE ? 7 : 8);
    doc.text('First Term — No previous data for comparison', 14, startY);
    doc.setTextColor(0, 0, 0);
  }
  return startY + (COMPACT_MODE ? 7 : 8);
}

// ── Draw Achievements ────────────────────────────────────────────────────────
export function drawAchievements(
  doc: jsPDF,
  bestSubjects: any[],
  startY: number
): number {
  if (bestSubjects.length === 0) return startY;
  const visibleBestSubjects = COMPACT_MODE ? bestSubjects.slice(0, 3) : bestSubjects;
  const rowH = COMPACT_MODE ? 4.5 : 5;
  const boxHeight = 4 + visibleBestSubjects.length * rowH;
  startY = ensureReportCardSpace(doc, startY, boxHeight + (COMPACT_MODE ? 4 : 6));
  doc.setFillColor(255, 248, 225); doc.rect(14, startY, 182, boxHeight, 'F');
  doc.setFontSize(COMPACT_MODE ? 6.5 : 7); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 166, 35);
  doc.text('ACHIEVEMENT:', 18, startY + 3.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
  visibleBestSubjects.forEach((b, bi) => {
    const pts = b.points !== null ? ` (${b.points} pts)` : '';
    doc.text(`Best in ${b.subjectName}: ${b.studentName} (${b.percentage}% — ${b.gradeLabel}${pts})`, 18, startY + 8 + bi * rowH);
  });
  return startY + boxHeight + (COMPACT_MODE ? 1 : 5);
}

// ── Draw AI Comment ──────────────────────────────────────────────────────────

/**
 * Word-wrap text using measured widths, so wrapping is always correct
 * regardless of which font is active when splitting happens. The text font
 * is configured BEFORE measuring to guarantee accurate line widths.
 */
function wrapCommentText(doc: jsPDF, text: string): string[] {
  // Configure the exact font/size that the text will be drawn with.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(COMPACT_MODE ? 7 : 7.5);

  const pageWidth = doc.internal.pageSize.getWidth();
  const textX = 18;
  const rightMargin = 14;
  // Wrap width: leave a safety margin on both sides of the page.
  const maxWidth = Math.min(165, Math.max(60, pageWidth - textX - rightMargin));

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = doc.getTextWidth(testLine);
    if (width <= maxWidth || !currentLine) {
      // Allow a single very long word to occupy its own line even if it
      // exceeds maxWidth (better than losing characters).
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : ['No class teacher comment provided.'];
}

export function drawAIComment(
  doc: jsPDF,
  comment: string,
  startY: number
): number {
  const fontSize = COMPACT_MODE ? 7 : 7.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const commentLines = wrapCommentText(doc, (comment || 'No class teacher comment provided.').trim());
  const lineHeight = COMPACT_MODE ? fontSize * 0.55 + 0.6 : fontSize * 0.62 + 0.8;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (COMPACT_MODE) {
    const availableHeight = Math.max(18, pageHeight - REPORT_CONTENT_BOTTOM_MARGIN - startY);
    const headerHeight = 7;
    const maxLines = Math.max(2, Math.floor((availableHeight - headerHeight - 3) / lineHeight));
    const visibleLines = commentLines.slice(0, maxLines);
    if (commentLines.length > visibleLines.length && visibleLines.length > 0) {
      const last = visibleLines.length - 1;
      visibleLines[last] = visibleLines[last].replace(/[.,;:!?]?$/, '') + '…';
    }
    const boxHeight = Math.min(availableHeight, headerHeight + visibleLines.length * lineHeight + 3);
    const y = Math.max(REPORT_CONTENT_TOP, Math.min(startY, pageHeight - REPORT_CONTENT_BOTTOM_MARGIN - boxHeight));

    doc.setDrawColor(100, 120, 180);
    doc.setLineWidth(0.5);
    doc.setFillColor(232, 234, 246);
    doc.rect(14, y, 182, boxHeight, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 35, 126);
    doc.text("Class Teacher's Comment:", 18, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    visibleLines.forEach((line, index) => doc.text(line, 18, y + 7 + index * lineHeight));
    return y + boxHeight + 1;
  }

  let remainingLines = [...commentLines];
  let y = startY;
  let isContinuation = false;
  while (remainingLines.length > 0) {
    const minBlockH = 35;
    y = ensureReportCardSpace(doc, y, minBlockH);
    const availableHeight = pageHeight - REPORT_CONTENT_BOTTOM_MARGIN - y;
    const maxLines = Math.max(3, Math.floor((availableHeight - 15) / lineHeight));
    const chunk = remainingLines.splice(0, maxLines);
    const boxHeight = Math.max(30, 14 + chunk.length * lineHeight + 2);
    doc.setDrawColor(100, 120, 180);
    doc.setLineWidth(0.5);
    doc.setFillColor(232, 234, 246);
    doc.rect(14, y, 182, boxHeight, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 35, 126);
    doc.text(isContinuation ? "Class Teacher's Comment (continued):" : "Class Teacher's Comment:", 18, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    chunk.forEach((line, index) => doc.text(line, 18, y + 14 + index * lineHeight));
    y += boxHeight + 5;
    if (remainingLines.length > 0) {
      doc.addPage();
      y = REPORT_CONTENT_TOP;
      isContinuation = true;
    }
  }
  return y;
}