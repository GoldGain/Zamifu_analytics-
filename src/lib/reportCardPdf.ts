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
}

export interface SignatureInfo {
  principal_signature_url?: string | null;
  teacher_signature_url?: string | null;
}

export interface StudentResult {
  subjects?: { name?: string } | null;
  marks?: number;
  out_of?: number;
  percentage?: number | null;
  [key: string]: any;
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
) {
  if (!trendData || trendData.length < 2) return;

  const padding = 15;
  const graphX = x + padding;
  const graphY = y + padding;
  const graphW = width - padding * 2;
  const graphH = height - padding * 2;

  // Background
  doc.setFillColor(250, 250, 252);
  doc.rect(x, y, width, height, 'F');
  doc.setDrawColor(200, 200, 210);
  doc.rect(x, y, width, height, 'S');

  // Title
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 70);
  doc.text('PERFORMANCE TREND', x + 5, y + 7);

  const maxAvg = Math.max(...trendData.map(d => d.avg), 100);
  const minAvg = Math.min(...trendData.map(d => d.avg), 0);
  const range = maxAvg - minAvg || 100;

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const gridY = graphY + (graphH / 4) * i;
    doc.setDrawColor(230, 230, 235);
    doc.line(graphX, gridY, graphX + graphW, gridY);
  }

  const stepX = graphW / Math.max(trendData.length - 1, 1);

  const points = trendData.map((d, i) => ({
    x: graphX + stepX * i,
    y: graphY + graphH - ((d.avg - minAvg) / range) * graphH,
    avg: d.avg,
    term: d.term,
  }));

  // Draw connecting line
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.5);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }

  // Draw points
  points.forEach((p) => {
    doc.setFillColor(37, 99, 235);
    doc.circle(p.x, p.y, 2.5, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(p.x, p.y, 1.2, 'F');

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 110);
    const termLabel = p.term.length > 10 ? p.term.substring(0, 10) : p.term;
    doc.text(termLabel, p.x, graphY + graphH + 7, { align: 'center' });

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`${p.avg.toFixed(0)}%`, p.x, p.y - 5, { align: 'center' });
  });

  doc.setLineWidth(0.2);
  doc.setTextColor(0, 0, 0);
}

// ── Add Logo to PDF ──────────────────────────────────────────────────────────
export async function addLogoToPDF(
  doc: jsPDF,
  logoUrl: string | null | undefined,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number
): Promise<boolean> {
  if (!logoUrl) return false;

  // Helper: render any image (including SVG/WebP) to PNG data URL via canvas
  const renderToCanvas = (src: string, timeoutMs = 8000): Promise<string> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image load timeout')), timeoutMs);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        clearTimeout(timer);
        const canvas = document.createElement('canvas');
        // Use 2× resolution for sharpness
        const scale = 2;
        canvas.width = (img.naturalWidth || maxWidth * 3.78) * scale;
        canvas.height = (img.naturalHeight || maxHeight * 3.78) * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (e) => { clearTimeout(timer); reject(e); };
      img.src = src;
    });

  try {
    let dataUrl: string;

    const getSafeUrl = (url: string) => {
      if (url.startsWith('data:')) return url;
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}t=${Date.now()}`;
    };

    if (logoUrl.startsWith('data:')) {
      dataUrl = await renderToCanvas(logoUrl);
    } else {
      // Strip existing query params for a clean fetch URL
      const fetchUrl = logoUrl.split('?')[0];
      let blob: Blob | null = null;

      // Attempt 1: fetch with explicit CORS headers and cache-control
      try {
        const resp = await fetch(getSafeUrl(fetchUrl), {
          mode: 'cors',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
        if (resp.ok) blob = await resp.blob();
      } catch { /* fall through to next attempt */ }

      // Attempt 2: fetch without custom headers (some CDNs reject extra headers)
      if (!blob) {
        try {
          const resp = await fetch(fetchUrl, { mode: 'cors' });
          if (resp.ok) blob = await resp.blob();
        } catch { /* fall through */ }
      }

      // Attempt 3: fetch without mode restriction (default browser behavior)
      if (!blob) {
        try {
          const resp = await fetch(fetchUrl);
          if (resp.ok) blob = await resp.blob();
        } catch { /* fall through */ }
      }

      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        try {
          dataUrl = await renderToCanvas(blobUrl);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        // Fallback: direct img src (works if CORS headers are set on bucket)
        console.warn('All fetch attempts failed for logo, trying direct img src:', logoUrl);
        try {
          dataUrl = await renderToCanvas(getSafeUrl(logoUrl));
        } catch {
          dataUrl = await renderToCanvas(logoUrl);
        }
      }
    }

    doc.addImage(dataUrl, 'PNG', x, y, maxWidth, maxHeight);
    return true;
  } catch (err) {
    console.error('Logo rendering failed:', err);
    return false;
  }
}

// ── Add Student Photo to PDF ─────────────────────────────────────────────────
export async function addStudentPhotoToPDF(
  doc: jsPDF,
  photoUrl: string | null | undefined,
  x: number,
  y: number,
  size: number
): Promise<boolean> {
  if (!photoUrl) return false;
  try {
    let dataUrl = photoUrl;
    if (!photoUrl.startsWith('data:')) {
      const fetchUrl = photoUrl.split('?')[0];
      let blob: Blob | null = null;

      // Attempt 1: fetch with CORS mode and cache-busting
      try {
        const resp = await fetch(`${fetchUrl}?t=${Date.now()}`, {
          mode: 'cors',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        });
        if (resp.ok) blob = await resp.blob();
      } catch { /* fall through */ }

      // Attempt 2: fetch without custom headers
      if (!blob) {
        try {
          const resp = await fetch(fetchUrl, { mode: 'cors' });
          if (resp.ok) blob = await resp.blob();
        } catch { /* fall through */ }
      }

      // Attempt 3: no-cors mode as last resort
      if (!blob) {
        try {
          const resp = await fetch(fetchUrl);
          if (resp.ok) blob = await resp.blob();
        } catch { /* fall through */ }
      }

      if (blob) {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob!);
        });
      } else {
        console.warn('Student photo fetch failed, skipping photo');
        return false;
      }
    }
    // Render to canvas for circular crop at high resolution
    const canvas = document.createElement('canvas');
    const px = Math.round(size * 3.78 * 2); // ~2x resolution for clarity
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    // Circular clip
    ctx.beginPath();
    ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0, px, px);
    const circularDataUrl = canvas.toDataURL('image/png');
    // Blue border circle
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.circle(x + size / 2, y + size / 2, size / 2, 'S');
    doc.addImage(circularDataUrl, 'PNG', x, y, size, size);
    return true;
  } catch {
    return false;
  }
}

// ── Add Signatures to PDF ────────────────────────────────────────────────────
export function addSignaturesToPDF(
  doc: jsPDF,
  signatures: SignatureInfo,
  y: number,
  schoolInfo?: SchoolInfo
) {
  const hasPrincipalSig = signatures.principal_signature_url && signatures.principal_signature_url.startsWith('data:');
  const hasTeacherSig = signatures.teacher_signature_url && signatures.teacher_signature_url.startsWith('data:');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 70);

  if (hasTeacherSig || hasPrincipalSig) {
    doc.text('DIGITAL SIGNATURES', 14, y);

    if (hasTeacherSig) {
      try {
        doc.addImage(signatures.teacher_signature_url!, 'PNG', 14, y + 3, 45, 16);
      } catch {
        doc.setDrawColor(150, 150, 155);
        doc.line(14, y + 16, 60, y + 16);
      }
    } else {
      doc.setDrawColor(150, 150, 155);
      doc.line(14, y + 16, 60, y + 16);
    }
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 110);
    doc.text('Class Teacher Signature', 14, y + 22);

    if (hasPrincipalSig) {
      try {
        doc.addImage(signatures.principal_signature_url!, 'PNG', 120, y + 3, 45, 16);
      } catch {
        doc.setDrawColor(150, 150, 155);
        doc.line(120, y + 16, 165, y + 16);
      }
    } else {
      doc.setDrawColor(150, 150, 155);
      doc.line(120, y + 16, 165, y + 16);
    }
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 110);
    doc.text(`Principal Signature${schoolInfo?.principal_name ? ` (${schoolInfo.principal_name})` : ''}`, 120, y + 22);
  } else {
    doc.setDrawColor(150, 150, 155);
    doc.line(14, y + 12, 75, y + 12);
    doc.line(120, y + 12, 181, y + 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 85);
    doc.text('Class Teacher Signature', 14, y + 18);
    doc.text(`Principal Signature${schoolInfo?.principal_name ? ` (${schoolInfo.principal_name})` : ''}`, 120, y + 18);
  }

  // Date
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 85);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, y + 27);

  // School stamp area
  doc.setDrawColor(180, 180, 185);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(120, y + 3, 35, 22);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(5.5);
  doc.setTextColor(150, 150, 155);
  doc.text('OFFICIAL STAMP', 137.5, y + 15, { align: 'center' });
}

// ── Draw Header with Logo ────────────────────────────────────────────────────
export async function drawReportHeader(
  doc: jsPDF,
  schoolInfo: SchoolInfo,
  subtitle: string = 'STUDENT REPORT CARD'
) {
  // Blue header background
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 32, 'F');

  // Try to add logo (left side, bigger)
  const logoAdded = schoolInfo.logo_url
    ? await addLogoToPDF(doc, schoolInfo.logo_url, 10, 3, 26, 26)
    : false;

  doc.setTextColor(255, 255, 255);
  // School name — always prominent, never fall back to generic 'School'
  const displayName = schoolInfo.name?.trim() || 'School';
  doc.setFontSize(logoAdded ? 14 : 16);
  doc.setFont('helvetica', 'bold');
  doc.text(displayName, logoAdded ? 40 : 105, logoAdded ? 11 : 11, { align: logoAdded ? 'left' : 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, logoAdded ? 40 : 105, logoAdded ? 20 : 20, { align: logoAdded ? 'left' : 'center' });

  if (schoolInfo.motto) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text(`"${schoolInfo.motto}"`, logoAdded ? 40 : 105, 27, { align: logoAdded ? 'left' : 'center' });
  }
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
  // Issue 10: Added assessmentName parameter to show on report card
  assessmentName?: string
) {
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Learner: ${studentName}`, 14, y);
  doc.text(`Adm No: ${admissionNo}`, 14, y + 6);
  doc.text(`Class: ${className}`, 14, y + 12);
  // Issue 10: Show assessment name if provided, otherwise show term name
  doc.text(`Term: ${termName} ${academicYear}`, 120, y);
  if (assessmentName) {
    doc.text(`Assessment: ${assessmentName}`, 120, y + 6);
    doc.text(`Position: ${position}`, 120, y + 12);
  } else {
    doc.text(`Position: ${position}`, 120, y + 6);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, y + 12);
  }

  doc.setDrawColor(37, 99, 235);
  doc.line(14, y + 17, 196, y + 17);
}

// ── Draw Results Table ───────────────────────────────────────────────────────
export function drawResultsTable(
  doc: jsPDF,
  results: any[],
  classData: any,
  startY: number
): number {
  const isPrimary = getSchoolLevelBand(classData) === 'primary';

  const tableHead = isPrimary
    ? ['#', 'Learning Area', 'Marks', 'Out Of', '%', 'CBE Grade']
    : ['#', 'Learning Area', 'Marks', 'Out Of', '%', 'CBE Grade', 'Points'];

  const tableBody = results.map((r, i) => {
    const pct = getPercentage(r);
    const grading = gradeFromPercentage(pct, classData);
    const row: any[] = [
      i + 1,
      r.subjects?.name || 'N/A',
      String(r.marks || '0'),
      String(r.out_of || 100),
      `${pct}%`,
      grading.grade,
    ];
    if (!isPrimary) row.push(grading.points ?? '—');
    return row;
  });

  autoTable(doc, {
    startY,
    head: [tableHead],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    margin: { left: 14, right: 14 },
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
  const isPrimary = getSchoolLevelBand(classData) === 'primary';
  const totalMarks = results.reduce((s, r) => s + (Number(r.marks || 0)), 0);
  const overallGrading = gradeFromPercentage(avgPercentage, classData);

  doc.setFillColor(245, 247, 255);
  doc.rect(14, startY, 182, 22, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Learning Areas: ${results.length}`, 20, startY + 7);
  doc.text(`Total Marks: ${totalMarks}`, 65, startY + 7);
  doc.text(`Average: ${avgPercentage.toFixed(1)}%`, 130, startY + 7);
  doc.text(`Position: ${position}`, 20, startY + 15);
  doc.text(`Grade: ${overallGrading.grade}`, 65, startY + 15);
  if (!isPrimary && totalPoints !== null) {
    doc.text(`Total Points: ${totalPoints}`, 130, startY + 15);
  }

  return startY + 26;
}

// ── Draw Deviation ───────────────────────────────────────────────────────────
export function drawDeviation(
  doc: jsPDF,
  deviation: number | null,
  previousAvg: number | null,
  startY: number
): number {
  if (deviation !== null) {
    const arrow = deviation >= 0 ? '\u25B2' : '\u25BC';
    const sign = deviation >= 0 ? '+' : '';
    if (deviation >= 0) doc.setTextColor(22, 163, 74);
    else doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${arrow} ${sign}${deviation.toFixed(1)}% vs previous term (Prev: ${previousAvg?.toFixed(1)}%)`, 14, startY);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('First Term — No previous data for comparison', 14, startY);
    doc.setTextColor(0, 0, 0);
  }
  return startY + 8;
}

// ── Draw Achievements ────────────────────────────────────────────────────────
export function drawAchievements(
  doc: jsPDF,
  bestSubjects: any[],
  startY: number
): number {
  if (bestSubjects.length === 0) return startY;

  doc.setFillColor(254, 249, 195);
  doc.rect(14, startY, 182, 5 + bestSubjects.length * 5, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(202, 138, 4);
  doc.text('ACHIEVEMENT:', 18, startY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  bestSubjects.forEach((b, bi) => {
    const pts = b.points !== null ? ` (${b.points} pts)` : '';
    doc.setFontSize(7);
    doc.text(`Best in ${b.subjectName}: ${b.percentage}% — ${b.gradeLabel}${pts}`, 18, startY + 9 + bi * 5);
  });
  return startY + 5 + bestSubjects.length * 5 + 5;
}

// ── Draw AI Comment ──────────────────────────────────────────────────────────
export function drawAIComment(
  doc: jsPDF,
  comment: string,
  startY: number
): number {
  const commentLines = doc.splitTextToSize(comment, 168);
  const boxHeight = Math.max(20, commentLines.length * 4.5 + 10);

  doc.setFillColor(254, 252, 232);
  doc.rect(14, startY, 182, boxHeight, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("Class Teacher's Comment:", 18, startY + 6);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text(commentLines, 18, startY + 12);
  return startY + boxHeight + 4;
}
