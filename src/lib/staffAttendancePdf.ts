import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateLabel, formatDistance, formatTimeInZone } from './staffAttendance';

export interface PdfAttendanceRow {
  date?: string;
  name: string;
  role: string;
  clockIn?: string | null;
  clockOut?: string | null;
  distance?: number | null;
  status?: string | null;
  method?: string | null;
  workingDays?: number;
  presentDays?: number;
  lateDays?: number;
  absentDays?: number;
  rate?: number;
}

export interface PdfSummary {
  totalStaff: number;
  present: number;
  late: number;
  absent: number;
  rate: number | null;
}

export interface StaffAttendancePdfOptions {
  schoolName: string;
  logoUrl?: string | null;
  address?: string | null;
  from: string;
  to: string;
  mode: 'daily' | 'summary' | 'individual';
  rows: PdfAttendanceRow[];
  summary: PdfSummary;
  timeZone: string;
  generatedBy?: string;
  individual?: { name: string; role: string; workingDays: number; presentDays: number; lateDays: number; absentDays: number; rate: number };
}

const NAVY: [number, number, number] = [17, 24, 39];
const BLUE: [number, number, number] = [37, 99, 235];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];
const EMERALD: [number, number, number] = [5, 150, 105];
const AMBER: [number, number, number] = [180, 83, 9];
const ROSE: [number, number, number] = [190, 18, 60];
const GRAY: [number, number, number] = [107, 114, 128];

async function loadLogo(url?: string | null): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read the school logo.'));
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    return { dataUrl, format: blob.type.includes('png') ? 'PNG' : 'JPEG' };
  } catch {
    return null;
  }
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

export async function downloadStaffAttendancePdf(options: StaffAttendancePdfOptions): Promise<string> {
  const { schoolName, logoUrl, address, from, to, mode, rows, summary, timeZone, generatedBy, individual } = options;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const logo = await loadLogo(logoUrl);

  doc.setProperties({
    title: `Staff Attendance Report — ${schoolName}`,
    subject: `${formatDateLabel(from)} to ${formatDateLabel(to)}`,
    author: 'Zamifu Analytics',
    creator: 'Zamifu Analytics',
  });

  // ---- Header -------------------------------------------------------------
  let textX = margin;
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, margin, 11, 18, 18);
      textX = margin + 22;
    } catch {
      textX = margin;
    }
  }
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(schoolName.toUpperCase(), textX, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  if (address) doc.text(address, textX, 23.5);
  doc.text('Staff attendance is recorded with GPS geofence verification.', textX, address ? 27.5 : 23.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLUE);
  doc.text(mode === 'individual' ? 'INDIVIDUAL STAFF ATTENDANCE REPORT' : 'STAFF ATTENDANCE REPORT', margin, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  const periodLabel = from === to ? formatDateLabel(from) : `${formatDateLabel(from)} — ${formatDateLabel(to)}`;
  doc.text(`Period: ${periodLabel}`, margin, 46);
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB', { timeZone })}${generatedBy ? ` by ${generatedBy}` : ''}`, pageWidth - margin, 40, { align: 'right' });
  doc.text(`Timezone: ${timeZone}`, pageWidth - margin, 44, { align: 'right' });

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(margin, 50, pageWidth - margin, 50);

  // ---- Summary boxes ------------------------------------------------------
  const boxes: { label: string; value: string; color: [number, number, number] }[] = mode === 'individual' && individual
    ? [
        { label: 'Working days', value: String(individual.workingDays), color: BLUE },
        { label: 'Present', value: String(individual.presentDays), color: EMERALD },
        { label: 'Late', value: String(individual.lateDays), color: AMBER },
        { label: 'Absent', value: String(individual.absentDays), color: ROSE },
        { label: 'Attendance', value: `${individual.rate}%`, color: BLUE },
      ]
    : [
        { label: 'Total staff', value: String(summary.totalStaff), color: BLUE },
        { label: 'Present', value: String(summary.present), color: EMERALD },
        { label: 'Late', value: String(summary.late), color: AMBER },
        { label: 'Absent', value: String(summary.absent), color: ROSE },
        { label: 'Attendance', value: summary.rate === null ? '—' : `${summary.rate}%`, color: BLUE },
      ];

  let y = 56;
  if (mode === 'individual' && individual) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(individual.name, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(individual.role, margin, y + 5);
    y += 11;
  }

  const boxGap = 2;
  const boxWidth = (contentWidth - boxGap * 4) / 5;
  boxes.forEach((box, index) => {
    const x = margin + index * (boxWidth + boxGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, boxWidth, 16, 1.6, 1.6, 'FD');
    doc.setTextColor(...box.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(box.value, x + boxWidth / 2, y + 7.5, { align: 'center' });
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(box.label.toUpperCase(), x + boxWidth / 2, y + 12.5, { align: 'center' });
  });
  y += 22;

  // ---- Table --------------------------------------------------------------
  const body = rows.map((row, index) => {
    if (mode === 'summary') {
      return [
        String(index + 1),
        row.name,
        row.role,
        String(row.workingDays ?? 0),
        String(row.presentDays ?? 0),
        String(row.lateDays ?? 0),
        String(row.absentDays ?? 0),
        `${row.rate ?? 0}%`,
      ];
    }
    if (mode === 'individual') {
      return [
        formatDateLabel(row.date),
        row.clockIn ? formatTimeInZone(row.clockIn, timeZone) : '—',
        row.clockOut ? formatTimeInZone(row.clockOut, timeZone) : '—',
        row.distance === null || row.distance === undefined ? '—' : formatDistance(row.distance),
        row.status || '—',
        row.method || '—',
      ];
    }
    return [
      String(index + 1),
      row.name,
      row.role,
      row.clockIn ? formatTimeInZone(row.clockIn, timeZone) : '—',
      row.clockOut ? formatTimeInZone(row.clockOut, timeZone) : '—',
      row.distance === null || row.distance === undefined ? '—' : formatDistance(row.distance),
      row.status || '—',
      row.method || '—',
    ];
  });

  const head = mode === 'summary'
    ? [['#', 'Staff member', 'Role', 'Working days', 'Present', 'Late', 'Absent', 'Rate']]
    : mode === 'individual'
      ? [['Date', 'Clock in', 'Clock out', 'Distance', 'Status', 'Method']]
      : [['#', 'Staff member', 'Role', 'Clock in', 'Clock out', 'Distance', 'Status', 'Method']];

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 1.8, textColor: NAVY, lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, halign: 'left' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: mode === 'summary'
      ? {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 52 },
          2: { cellWidth: 32 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 19, halign: 'center' },
          5: { cellWidth: 17, halign: 'center' },
          6: { cellWidth: 19, halign: 'center' },
          7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        }
      : mode === 'individual'
        ? {
            0: { cellWidth: 38 },
            1: { cellWidth: 32 },
            2: { cellWidth: 32 },
            3: { cellWidth: 30 },
            4: { cellWidth: 28 },
            5: { cellWidth: 22 },
          }
        : {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 47 },
            2: { cellWidth: 27 },
            3: { cellWidth: 23 },
            4: { cellWidth: 23 },
            5: { cellWidth: 20 },
            6: { cellWidth: 18, fontStyle: 'bold' },
            7: { cellWidth: 16 },
          },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      const raw = String(data.cell.raw || '');
      if (raw === 'Present') {
        data.cell.styles.textColor = EMERALD;
        data.cell.styles.fontStyle = 'bold';
      } else if (raw === 'Late') {
        data.cell.styles.textColor = AMBER;
        data.cell.styles.fontStyle = 'bold';
      } else if (raw === 'Absent') {
        data.cell.styles.textColor = ROSE;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ---- Footer -------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 287, pageWidth - margin, 287);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('Generated by Zamifu Analytics · GPS-verified staff attendance', margin, 291);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, 291, { align: 'right' });
  }

  const nameSuffix = mode === 'individual' && individual ? `_${safeFileName(individual.name)}` : '';
  const fileName = `Staff_Attendance${nameSuffix}_${from}_${to}.pdf`;
  doc.save(fileName);
  return fileName;
}
