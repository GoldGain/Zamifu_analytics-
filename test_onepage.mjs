// Simulate the compact report card layout with jsPDF + autoTable and report page count.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const COMPACT = true;
const HDR_H = COMPACT ? 28 : 32;
const ROW = COMPACT ? 4.5 : 6;

// Subjects: 13 learning areas like Junior/Senior school
const subjects = [
  ['English', 78], ['Kiswahili', 82], ['Mathematics', 74], ['Integrated Science', 88],
  ['Pre-Technical Studies', 71], ['Agriculture', 85], ['Social Studies', 69],
  ['CRE', 91], ['Creative Arts', 76], ['Science and Technology', 73],
  ['Physical and Health Education', 84], ['Art and Craft', 80], ['Music', 77],
];

// Trend data
const trendData = [
  { term: 'Term 1 2025', avg: 65 }, { term: 'Term 2 2025', avg: 70 },
  { term: 'Term 3 2025', avg: 72 }, { term: 'Term 1 2026', avg: 78 },
];

function drawHeader(doc) {
  doc.setFillColor(245, 166, 35); doc.rect(0, 0, 210, HDR_H, 'F');
  doc.setTextColor(26, 35, 126); doc.setFontSize(COMPACT ? 14 : 16); doc.setFont('helvetica', 'bold');
  doc.text('St Marys Academy Model Primary & Junior School', 105, 10, { align: 'center' });
  doc.setFontSize(COMPACT ? 8 : 9); doc.setFont('helvetica', 'normal');
  doc.text('Nurturing minds for tomorrow', 105, 15.5, { align: 'center' });
  const lines = doc.splitTextToSize('123 Learning Street, Nairobi | +254 700 000 000 | info@stmarys.ac.ke', 140);
  doc.text(lines, 105, 21, { align: 'center' });
}

function drawInfo(doc, y) {
  const fs = COMPACT ? 8.5 : 9;
  doc.setTextColor(0, 0, 0); doc.setFontSize(fs); doc.setFont('helvetica', 'normal');
  doc.text('Learner: Jane Doe Muthoni Longname', 14, y);
  doc.text('Adm No: ZFU/2024/0042', 14, y + ROW);
  doc.text('Class: Grade 8 Silver', 14, y + ROW * 2);
  doc.text('Term: Term 2 2026 Academic Year 2026', 120, y);
  doc.text('Assessment: End of Term Examination', 120, y + ROW);
  doc.text('Position: 15th out of 34', 120, y + ROW * 2);
  doc.setDrawColor(106, 27, 154); doc.line(14, y + ROW * 2 + 3, 196, y + ROW * 2 + 3);
  return y + ROW * 2 + 5;
}

function drawTable(doc, y) {
  const body = subjects.map(([name, marks], i) => [i + 1, name, String(marks), '100', `${marks}% A`]);
  autoTable(doc, {
    startY: y,
    head: [['#', 'Learning Area', 'Marks', 'Out Of', 'Score & Grade', 'Points']],
    body,
    styles: { fontSize: COMPACT ? 7.5 : 8, cellPadding: COMPACT ? 1 : 1.5 },
    headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: COMPACT ? 7.5 : 8, cellPadding: 1 },
    alternateRowStyles: { fillColor: [232, 234, 246] }, margin: { left: 14, right: 14 },
  });
  return doc.lastAutoTable.finalY;
}

function drawSummary(doc, y) {
  const boxH = COMPACT ? 17 : 22;
  doc.setFillColor(0, 137, 123); doc.rect(14, y, 182, boxH, 'F');
  const fs = COMPACT ? 7.5 : 8;
  const gap = COMPACT ? 6.5 : 8;
  doc.setFontSize(fs); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('Learning Areas: 13', 20, y + gap);
  doc.text('Total Marks: 1028', 65, y + gap);
  doc.text('Average: 78.9%', 130, y + gap);
  doc.text('Position: 15th out of 34', 20, y + gap * 2);
  doc.text('Grade: E-E2', 65, y + gap * 2);
  doc.text('Total Points: 96', 130, y + gap * 2);
  return y + boxH + 4;
}

function drawDeviation(doc, y) {
  doc.setTextColor(76, 175, 80); doc.setFont('helvetica', 'bold'); doc.setFontSize(COMPACT ? 7 : 8);
  doc.text('\u25B2 +4.2% vs previous term (Prev: 74.7%)', 14, y);
  doc.setTextColor(0, 0, 0);
  return y + (COMPACT ? 7 : 8);
}

function drawTrend(doc, y) {
  const height = COMPACT ? 32 : 45;
  const padding = COMPACT ? 10 : 15;
  const x = 14, graphX = x + padding, graphY = y + padding;
  const graphW = 182 - padding * 2, graphH = height - padding * 2;
  doc.setFillColor(250, 250, 252); doc.rect(x, y, 182, height, 'F');
  doc.setDrawColor(200, 200, 210); doc.rect(x, y, 182, height, 'S');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 70);
  doc.text('PERFORMANCE TREND', x + 5, y + 7);
  const max = 100, min = 0;
  const stepX = graphW / (trendData.length - 1);
  const pts = trendData.map((d, i) => ({ x: graphX + stepX * i, y: graphY + graphH - ((d.avg - min) / (max - min)) * graphH, term: d.term }));
  doc.setDrawColor(106, 27, 154); doc.setLineWidth(1.5);
  for (let i = 0; i < pts.length - 1; i++) doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  pts.forEach((p) => { doc.setFillColor(106, 27, 154); doc.circle(p.x, p.y, 2.5, 'F'); });
  return y + height + 6;
}

function drawAchievements(doc, y) {
  const rows = [
    ['English', 'Jane Doe Muthoni Longname', '92%', 'A'],
    ['Mathematics', 'Jane Doe Muthoni Longname', '88%', 'A'],
  ];
  const rowH = COMPACT ? 4.5 : 5;
  const boxHeight = 4 + rows.length * rowH;
  doc.setFillColor(255, 248, 225); doc.rect(14, y, 182, boxHeight, 'F');
  doc.setFontSize(COMPACT ? 6.5 : 7); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 166, 35);
  doc.text('ACHIEVEMENT:', 18, y + 3.5);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
  rows.forEach(([sub, name, pct, grade], bi) => {
    doc.text(`Best in ${sub}: ${name} (${pct}% \u2014 ${grade})`, 18, y + 8 + bi * rowH);
  });
  return y + boxHeight + (COMPACT ? 3 : 5);
}

function wrapText(doc, text, maxWidth) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(COMPACT ? 7 : 7.5);
  const words = text.split(/\s+/);
  const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (doc.getTextWidth(test) <= maxWidth || !cur) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawComment(doc, y) {
  const fontSize = COMPACT ? 7 : 7.5;
  const lineHeight = COMPACT ? fontSize * 0.55 + 0.6 : fontSize * 0.62 + 0.8;
  const pageH = doc.internal.pageSize.getHeight();
  const bottom = 16;
  const lines = wrapText(doc,
    "Consistent performance with an E-E2 grade (Exceeding Expectations). Your strength is English; channel more energy into Mathematics next term. Your reliability is a valuable asset!",
    165);
  let remaining = [...lines];
  let isCont = false;
  while (remaining.length > 0) {
    const minBlockH = COMPACT ? 26 : 35;
    if (y + minBlockH > pageH - bottom) { doc.addPage(); y = 18; isCont = true; }
    const avail = pageH - bottom - y;
    const maxLines = Math.max(3, Math.floor((avail - (COMPACT ? 12 : 15)) / lineHeight));
    const chunk = remaining.splice(0, maxLines);
    const boxHeight = Math.max(COMPACT ? 22 : 30, (COMPACT ? 11 : 14) + chunk.length * lineHeight + 6);
    doc.setDrawColor(100, 120, 180); doc.setLineWidth(0.5); doc.setFillColor(232, 234, 246);
    doc.rect(14, y, 182, boxHeight, 'FD');
    doc.setFontSize(COMPACT ? 7.5 : 8); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
    doc.text(isCont ? "Class Teacher's Comment (continued):" : "Class Teacher's Comment:", 18, y + (COMPACT ? 6 : 7));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(fontSize); doc.setTextColor(0, 0, 0);
    chunk.forEach((l, i) => doc.text(l, 18, y + (COMPACT ? 11 : 14) + i * lineHeight));
    y += boxHeight + (COMPACT ? 3 : 5);
  }
  return y;
}

// NOTE: real lib drawAchievements returns y + boxHeight + gap; keep.

function drawSignatures(doc, y) {
  const sigBlockH = COMPACT ? 24 : 34;
  const sigImgH = COMPACT ? 12 : 16;
  const sigImgY = COMPACT ? 2 : 3;
  const sigLabelY = COMPACT ? 16 : 22;
  if (y + sigBlockH > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); y = 18; }
  // no-signature fallback layout (same as compact path)
  doc.setDrawColor(150, 150, 155);
  doc.line(14, y + (COMPACT ? 9 : 12), 75, y + (COMPACT ? 9 : 12));
  doc.line(118, y + (COMPACT ? 9 : 12), 181, y + (COMPACT ? 9 : 12));
  doc.setFontSize(COMPACT ? 6 : 7); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 85);
  doc.text('Class Teacher Signature', 14, y + (COMPACT ? 15 : 18));
  doc.text('Principal Signature (Mrs. Principal)', 118, y + (COMPACT ? 15 : 18));
  doc.setFontSize(COMPACT ? 6 : 7);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, y + (COMPACT ? 21 : 27));
  doc.setDrawColor(180, 180, 185); doc.setLineDashPattern([2, 2], 0);
  doc.rect(118, y + sigImgY, 32, sigImgH + 2); doc.setLineDashPattern([], 0);
  doc.setFontSize(5.5); doc.setTextColor(150, 150, 155);
  doc.text('OFFICIAL STAMP', 134, y + sigImgY + sigImgH / 2, { align: 'center' });
  return y + sigBlockH;
}

const doc = new jsPDF('p', 'mm', 'a4');
drawHeader(doc);
let y = drawInfo(doc, 34); console.log('info end:', y);
y = drawTable(doc, 62) + 4; console.log('table end:', y);
y = drawSummary(doc, y) + 4; console.log('summary end:', y);
y = drawDeviation(doc, y) + 4; console.log('dev end:', y);
y = drawTrend(doc, y); console.log('trend end:', y);
y = drawAchievements(doc, y); console.log('ach end:', y);
y = drawComment(doc, y); console.log('comment end:', y);
drawSignatures(doc, y); console.log('sig end:', y);
console.log('page height:', doc.internal.pageSize.getHeight());

doc.setFontSize(8); doc.setTextColor(150, 150, 150);
doc.text('Zamifu Analytics School Management System | Support: tutorsultimate@gmail.com', 105, 285, { align: 'center' });

const pages = doc.getNumberOfPages();
console.log('PAGES:', pages);
if (pages > 1) {
  for (let i = 1; i <= pages; i++) console.log('Page', i, 'endY trace via internal API not available; saved PDF');
}
doc.save('/tmp/report_card_test.pdf');
console.log('saved /tmp/report_card_test.pdf');
