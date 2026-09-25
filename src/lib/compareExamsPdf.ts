import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateCompetencyGrade, getSchoolLevelBand } from '@/lib/grading';
import { drawReportFooter, type SchoolInfo } from '@/lib/reportCardPdf';
import { configurePdfFontSize, pdfFontSize, type PdfFontSize } from '@/lib/pdfFontSize';

export type ComparisonRow = {
  student_id: string;
  name: string;
  stream: string;
  subject: string;
  a: number | null;
  b: number | null;
  diff: number | null;
};

export type ComparisonLearner = {
  student_id: string;
  name: string;
  stream: string;
  total: number;
  outOf: number;
  average: number;
  grade: string;
  totalPoints: number;
  subjects: Record<string, number>;
};

export type ComparisonSide = {
  label: string;
  termLabel: string;
  examLabel: string;
  learners: ComparisonLearner[];
  subjects: string[];
};

export type ComparisonData = {
  classLabel: string;
  termLabel: string;
  sideA: ComparisonSide;
  sideB: ComparisonSide;
  rows: ComparisonRow[];
  streamLabels: string[];
  gradeLabels: string[];
  band: ReturnType<typeof getSchoolLevelBand>;
};

function numericPercentage(row: any): number {
  const value = row.percentage ?? (Number(row.out_of) > 0 ? Number(row.marks || 0) / Number(row.out_of) * 100 : 0);
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function displayName(row: any): string {
  return `${row.students?.first_name || ''} ${row.students?.last_name || ''}`.trim() || 'Unknown learner';
}

function streamName(row: any): string {
  const c = row.classes || {};
  return String(c.stream_name || c.stream || c.name || '—').trim() || '—';
}

function makeSide(rows: any[], label: string, termLabel: string, examLabel: string, band: any): ComparisonSide {
  const byStudent = new Map<string, any>();
  const subjects = new Set<string>();
  rows.forEach((row) => {
    if (!row.student_id) return;
    const subject = String(row.subjects?.name || 'Learning Area');
    subjects.add(subject);
    const learner = byStudent.get(row.student_id) || {
      student_id: row.student_id,
      name: displayName(row),
      stream: streamName(row),
      subjects: {},
      outOf: 0,
    };
    const pct = numericPercentage(row);
    learner.subjects[subject] = pct;
    learner.outOf += 100;
    byStudent.set(row.student_id, learner);
  });
  const learners = Array.from(byStudent.values()).map((learner) => {
    const values = Object.values(learner.subjects) as number[];
    const total = values.reduce((sum, value) => sum + value, 0);
    const average = values.length ? total / values.length : 0;
    const gradeResult = calculateCompetencyGrade(average, band);
    const totalPoints = values.reduce((sum, value) => sum + (calculateCompetencyGrade(value, band).points || 0), 0);
    return { ...learner, total, average, grade: band === 'primary' ? gradeResult.grade : gradeResult.subLevel, totalPoints };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { label, termLabel, examLabel, learners, subjects: Array.from(subjects).sort() };
}

export function buildComparisonData(args: {
  classLabel: string;
  termALabel: string;
  termBLabel: string;
  examALabel: string;
  examBLabel: string;
  rowsA: any[];
  rowsB: any[];
  classObj?: any;
}): ComparisonData {
  const band = getSchoolLevelBand(args.classObj);
  const sideA = makeSide(args.rowsA, 'EXAM 1', args.termALabel, args.examALabel, band);
  const sideB = makeSide(args.rowsB, 'EXAM 2', args.termBLabel, args.examBLabel, band);
  const subjectNames = Array.from(new Set([...sideA.subjects, ...sideB.subjects])).sort();
  const learners = new Map<string, ComparisonRow>();
  [...args.rowsA.map((row) => ({ row, side: 'a' as const })), ...args.rowsB.map((row) => ({ row, side: 'b' as const }))].forEach(({ row, side }) => {
    const key = `${row.student_id}:${row.subject_id}`;
    const current = learners.get(key) || { student_id: row.student_id, name: displayName(row), stream: streamName(row), subject: String(row.subjects?.name || 'Learning Area'), a: null, b: null, diff: null };
    current[side] = numericPercentage(row);
    current.diff = current.a != null && current.b != null ? current.b - current.a : null;
    learners.set(key, current);
  });
  const gradeLabels = band === 'primary' ? ['EE', 'ME', 'AE', 'BE'] : ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];
  return {
    classLabel: args.classLabel,
    termLabel: args.termALabel === args.termBLabel ? args.termALabel : `${args.termALabel} vs ${args.termBLabel}`,
    sideA: { ...sideA, subjects: subjectNames },
    sideB: { ...sideB, subjects: subjectNames },
    rows: Array.from(learners.values()).sort((a, b) => a.name.localeCompare(b.name) || a.subject.localeCompare(b.subject)),
    streamLabels: Array.from(new Set([...sideA.learners, ...sideB.learners].map((learner) => learner.stream))).sort(),
    gradeLabels,
    band,
  };
}

function mean(values: number[]): number | null { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function signed(value: number | null, digits = 1): string { return value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`; }
function changeColor(value: number | null): [number, number, number] { return value == null || value === 0 ? [100, 100, 100] : value > 0 ? [22, 128, 65] : [190, 45, 45]; }
function addSectionTitle(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(pdfFontSize(doc, 12));
  doc.text(title, 105, 11, { align: 'center' });
  if (subtitle) { doc.setFont('helvetica', 'normal'); doc.setFontSize(pdfFontSize(doc, 7)); doc.text(subtitle, 105, 17, { align: 'center' }); }
  doc.setTextColor(0, 0, 0);
}
function nextPage(doc: jsPDF, title: string, subtitle: string) { doc.addPage('a4', 'portrait'); addSectionTitle(doc, title, subtitle); }
function addTable(doc: jsPDF, head: string[], body: any[][], startY = 28, fontSize: PdfFontSize = 14, colorizeChange = false) {
  if (!body.length) return;
  autoTable(doc, {
    startY, head: [head], body, margin: { left: 10, right: 10 }, styles: { fontSize: pdfFontSize(doc, 7), cellPadding: 1.8, overflow: 'linebreak', halign: 'center' },
    headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: pdfFontSize(doc, 7), fontStyle: 'bold' }, alternateRowStyles: { fillColor: [245, 247, 255] },
    didParseCell: (data: any) => {
      if (colorizeChange && data.section === 'body' && data.column.index === head.length - 1) {
        const raw = String(data.cell.raw || ''); data.cell.styles.textColor = raw.startsWith('+') ? [22, 128, 65] : raw.startsWith('-') || raw.startsWith('−') ? [190, 45, 45] : [100, 100, 100]; data.cell.styles.fontStyle = 'bold';
      }
    },
  });
}

export async function generateComparisonPdf(data: ComparisonData, schoolInfo: SchoolInfo, fontSize: PdfFontSize = 14) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); configurePdfFontSize(doc, fontSize);
  const subtitle = `${schoolInfo.name || 'School'} — ${data.classLabel} — ${data.termLabel} — ${data.sideA.examLabel} vs ${data.sideB.examLabel}`;
  addSectionTitle(doc, 'COMPARE EXAMS — SECTION 1: EXAM SUMMARY', subtitle);
  const metric = (side: ComparisonSide) => {
    const totals = side.learners.map((learner) => learner.total); const avgs = side.learners.map((learner) => learner.average);
    return { learners: side.learners.length, mean: mean(totals), grade: mean(avgs), high: totals.length ? Math.max(...totals) : null, low: totals.length ? Math.min(...totals) : null };
  };
  const ma = metric(data.sideA), mb = metric(data.sideB);
  addTable(doc, ['Metric', data.sideA.examLabel, data.sideB.examLabel, 'Change'], [
    ['Total Learners', ma.learners, mb.learners, signed(mb.learners - ma.learners, 0)], ['Class Mean Marks', ma.mean?.toFixed(1) || '—', mb.mean?.toFixed(1) || '—', signed((mb.mean ?? 0) - (ma.mean ?? 0))],
    ['Class Mean Grade', ma.grade == null ? '—' : String(calculateCompetencyGrade(ma.grade, data.band).subLevel), mb.grade == null ? '—' : String(calculateCompetencyGrade(mb.grade, data.band).subLevel), '—'],
    ['Highest Mark', ma.high ?? '—', mb.high ?? '—', signed((mb.high ?? 0) - (ma.high ?? 0), 0)], ['Lowest Mark', ma.low ?? '—', mb.low ?? '—', signed((mb.low ?? 0) - (ma.low ?? 0), 0)],
  ], 32, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 2: PERFORMANCE DISTRIBUTION', subtitle);
  const distribution = data.gradeLabels.map((label) => {
    const count = (side: ComparisonSide) => side.learners.filter((learner) => learner.grade === label).length;
    const a = count(data.sideA), b = count(data.sideB); return [label, `${a} (${ma.learners ? (a / ma.learners * 100).toFixed(1) : '0.0'}%)`, `${b} (${mb.learners ? (b / mb.learners * 100).toFixed(1) : '0.0'}%)`, signed(b - a, 0)];
  }); addTable(doc, ['Grade', data.sideA.examLabel, data.sideB.examLabel, 'Change'], distribution, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 3: TOP 10 LEARNERS', subtitle);
  const top = Array.from({ length: Math.max(10, data.sideA.learners.length, data.sideB.learners.length) }, (_, i) => { const a = data.sideA.learners[i], b = data.sideB.learners[i]; return [String(i + 1), a?.name || '—', a?.stream || '—', a?.total.toFixed(0) || '—', a?.grade || '—', a?.totalPoints ?? '—', b?.name || '—', b?.stream || '—', b?.total.toFixed(0) || '—', b?.grade || '—', b?.totalPoints ?? '—']; }).slice(0, 10); addTable(doc, ['POS', `${data.sideA.examLabel} Learner`, 'Stream', 'Total Marks', 'Mean Grade', 'Total Points', `${data.sideB.examLabel} Learner`, 'Stream', 'Total Marks', 'Mean Grade', 'Total Points'], top, 28, fontSize);

  nextPage(doc, 'COMPARE EXAMS — SECTION 4: SUBJECT PERFORMANCE', subtitle);
  const subjectRows = data.sideA.subjects.map((subject) => { const av = data.sideA.learners.map((l) => l.subjects[subject]).filter((v) => v != null); const bv = data.sideB.learners.map((l) => l.subjects[subject]).filter((v) => v != null); const a = mean(av), b = mean(bv); const ag = a == null ? '—' : calculateCompetencyGrade(a, data.band).subLevel; const bg = b == null ? '—' : calculateCompetencyGrade(b, data.band).subLevel; return [subject, a == null ? '—' : `${a.toFixed(1)} (${ag})`, b == null ? '—' : `${b.toFixed(1)} (${bg})`, signed(a != null && b != null ? b - a : null)]; }); addTable(doc, ['Learning Area', data.sideA.examLabel + ' Mean (Grade)', data.sideB.examLabel + ' Mean (Grade)', 'Change'], subjectRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 5: SUBJECT GRADES', subtitle);
  const subjectGradeRows: any[][] = []; data.sideA.subjects.forEach((subject) => data.gradeLabels.forEach((grade) => { const a = data.sideA.learners.filter((l) => l.subjects[subject] != null && (calculateCompetencyGrade(l.subjects[subject], data.band).subLevel === grade || calculateCompetencyGrade(l.subjects[subject], data.band).grade === grade)).length; const b = data.sideB.learners.filter((l) => l.subjects[subject] != null && (calculateCompetencyGrade(l.subjects[subject], data.band).subLevel === grade || calculateCompetencyGrade(l.subjects[subject], data.band).grade === grade)).length; subjectGradeRows.push([subject, grade, a, b, signed(b - a, 0)]); })); addTable(doc, ['Learning Area', 'Grade', data.sideA.examLabel + ' Count', data.sideB.examLabel + ' Count', 'Change'], subjectGradeRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 6: LEARNER DEVIATION', subtitle);
  const learnerRows = Array.from(new Set([...data.sideA.learners, ...data.sideB.learners].map((l) => l.student_id))).map((id) => { const a = data.sideA.learners.find((l) => l.student_id === id), b = data.sideB.learners.find((l) => l.student_id === id); const diff = a && b ? b.total - a.total : null; return [a?.name || b?.name || '—', a?.stream || b?.stream || '—', a?.total.toFixed(0) || '—', b?.total.toFixed(0) || '—', signed(diff, 0)]; }); addTable(doc, ['Learner', 'Stream', data.sideA.examLabel + ' Total', data.sideB.examLabel + ' Total', 'Deviation'], learnerRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 7: STREAM PERFORMANCE', subtitle);
  const streams = data.streamLabels.map((stream) => { const a = mean(data.sideA.learners.filter((l) => l.stream === stream).map((l) => l.total)); const b = mean(data.sideB.learners.filter((l) => l.stream === stream).map((l) => l.total)); return [stream, a == null ? '—' : a.toFixed(1), b == null ? '—' : b.toFixed(1), signed(a != null && b != null ? b - a : null)]; }); addTable(doc, ['Stream', data.sideA.examLabel + ' Mean', data.sideB.examLabel + ' Mean', 'Change'], streams, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 8: TOTAL MEAN MARKS', subtitle);
  const meanA = mean(data.sideA.learners.map((l) => l.total)), meanB = mean(data.sideB.learners.map((l) => l.total)); const diff = meanA != null && meanB != null ? meanB - meanA : null; const pct = meanA ? (diff! / meanA) * 100 : null;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(pdfFontSize(doc, 14)); doc.text(`${data.sideA.examLabel} Total Mean Marks: ${meanA?.toFixed(1) || '—'}`, 20, 45); doc.text(`${data.sideB.examLabel} Total Mean Marks: ${meanB?.toFixed(1) || '—'}`, 20, 60); doc.setTextColor(...changeColor(diff)); doc.text(`Deviation: ${signed(diff)}`, 20, 75); doc.text(`Percent Change: ${signed(pct)}%`, 20, 90); doc.setTextColor(0, 0, 0);

  nextPage(doc, 'COMPARE EXAMS — SECTION 9: TOP 10 LISTINGS', subtitle);
  addTable(doc, ['POS', data.sideA.examLabel, 'Stream', 'Total Marks', 'Mean Grade', 'Total Points'], data.sideA.learners.slice(0, 10).map((l, i) => [i + 1, l.name, l.stream, l.total.toFixed(0), l.grade, l.totalPoints]), 28, fontSize); addTable(doc, ['POS', data.sideB.examLabel, 'Stream', 'Total Marks', 'Mean Grade', 'Total Points'], data.sideB.learners.slice(0, 10).map((l, i) => [i + 1, l.name, l.stream, l.total.toFixed(0), l.grade, l.totalPoints]), 145, fontSize);

  nextPage(doc, 'COMPARE EXAMS — SECTION 10: SUBJECT GRADE MEANS', subtitle);
  const gradeMeanRows: any[][] = []; data.sideA.subjects.forEach((subject) => data.gradeLabels.forEach((grade) => { const values = (side: ComparisonSide) => side.learners.map((l) => ({ value: l.subjects[subject], grade: l.subjects[subject] == null ? null : calculateCompetencyGrade(l.subjects[subject], data.band) })).filter((x) => x.value != null && (x.grade?.subLevel === grade || x.grade?.grade === grade)).map((x) => x.value!); const a = mean(values(data.sideA)), b = mean(values(data.sideB)); gradeMeanRows.push([subject, grade, a == null ? '—' : a.toFixed(1), b == null ? '—' : b.toFixed(1), signed(a != null && b != null ? b - a : null)]); })); addTable(doc, ['Learning Area', 'Grade', data.sideA.examLabel + ' Mean Mark', data.sideB.examLabel + ' Mean Mark', 'Change'], gradeMeanRows, 28, fontSize, true);

  // Compare Exams is an analytical report: end after Section 10 and retain only the branding footer.
  drawReportFooter(doc);
  const safe = `${schoolInfo.name || 'school'}_${data.classLabel}_${data.sideA.examLabel}_vs_${data.sideB.examLabel}`.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 150);
  doc.save(`compare_exams_${safe}.pdf`);
}
