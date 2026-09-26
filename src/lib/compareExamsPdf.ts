import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateCompetencyGrade, getSchoolLevelBand } from '@/lib/grading';
import { normalizeLearningAreaName } from '@/lib/learningAreas';
import {
  buildAssessmentLearnerSummaries,
  learningAreaNames,
  requiredLearningAreaCount,
  resultPercentage,
  type AssessmentLearnerSummary,
} from '@/lib/assessmentAnalytics';
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
  outOf: number;
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

function displayName(row: any): string {
  return `${row.students?.first_name || ''} ${row.students?.last_name || ''}`.trim() || 'Unknown learner';
}

function streamName(row: any): string {
  const c = row.classes || {};
  return String(c.stream_name || c.stream || c.name || '—').trim() || '—';
}

function gradeLabel(value: number, band: ComparisonData['band']): string {
  const grade = calculateCompetencyGrade(value, band);
  return band === 'primary' ? grade.grade : grade.subLevel;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function signed(value: number | null, digits = 1): string {
  return value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function changeColor(value: number | null): [number, number, number] {
  return value == null || value === 0 ? [100, 100, 100] : value > 0 ? [22, 128, 65] : [190, 45, 45];
}

function addSectionTitle(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(pdfFontSize(doc, 12));
  doc.text(title, 105, 11, { align: 'center' });
  if (subtitle) { doc.setFont('helvetica', 'normal'); doc.setFontSize(pdfFontSize(doc, 7)); doc.text(subtitle, 105, 17, { align: 'center' }); }
  doc.setTextColor(0, 0, 0);
}

function nextPage(doc: jsPDF, title: string, subtitle: string) {
  doc.addPage('a4', 'portrait'); addSectionTitle(doc, title, subtitle);
}

function addTable(doc: jsPDF, head: string[], body: any[][], startY = 28, fontSize: PdfFontSize = 14, colorizeChange: boolean | number[] = false) {
  if (!body.length) return;
  autoTable(doc, {
    startY, head: [head], body, margin: { left: 8, right: 8 },
    styles: { fontSize: pdfFontSize(doc, 7), cellPadding: 1.5, overflow: 'linebreak', halign: 'center' },
    headStyles: { fillColor: [106, 27, 154], textColor: 255, fontSize: pdfFontSize(doc, 7), fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    didParseCell: (data: any) => {
      const colorColumns = Array.isArray(colorizeChange) ? colorizeChange : colorizeChange ? [head.length - 1] : [];
      if (colorColumns.includes(data.column.index) && data.section === 'body') {
        const raw = String(data.cell.raw || '');
        data.cell.styles.textColor = raw.startsWith('+') ? [22, 128, 65] : raw.startsWith('-') || raw.startsWith('−') ? [190, 45, 45] : [100, 100, 100];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
}

function makeSide(
  rows: any[],
  label: string,
  termLabel: string,
  examLabel: string,
  classObj: any,
  subjects: string[],
): ComparisonSide {
  const summaries = buildAssessmentLearnerSummaries(rows, classObj);
  const firstRowByStudent = new Map<string, any>();
  rows.forEach((row) => { if (row.student_id && !firstRowByStudent.has(row.student_id)) firstRowByStudent.set(row.student_id, row); });
  const requiredAreas = requiredLearningAreaCount(classObj, rows, subjects);
  const learners = summaries.map((summary: AssessmentLearnerSummary) => {
    const firstRow = firstRowByStudent.get(summary.studentId);
    return {
      student_id: summary.studentId,
      name: `${summary.student?.first_name || firstRow?.students?.first_name || ''} ${summary.student?.last_name || firstRow?.students?.last_name || ''}`.trim() || 'Unknown learner',
      stream: streamName(firstRow || { classes: {} }),
      total: summary.totalPct,
      outOf: requiredAreas * 100,
      average: summary.avgPct,
      grade: gradeLabel(summary.avgPct, getSchoolLevelBand(classObj)),
      totalPoints: summary.totalPoints,
      subjects: summary.subjects,
    };
  });
  return { label, termLabel, examLabel, learners, subjects, outOf: requiredAreas * 100 };
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
  learningAreas?: string[];
}): ComparisonData {
  const band = getSchoolLevelBand(args.classObj);
  const subjectNames = learningAreaNames([...args.rowsA, ...args.rowsB], args.learningAreas || []);
  const sideA = makeSide(args.rowsA, 'EXAM 1', args.termALabel, args.examALabel, args.classObj, subjectNames);
  const sideB = makeSide(args.rowsB, 'EXAM 2', args.termBLabel, args.examBLabel, args.classObj, subjectNames);
  const learners = new Map<string, ComparisonRow>();
  [...args.rowsA.map((row) => ({ row, side: 'a' as const })), ...args.rowsB.map((row) => ({ row, side: 'b' as const }))].forEach(({ row, side }) => {
    if (!row.student_id) return;
    const subject = normalizeLearningAreaName(row.subjects?.name || 'Learning Area');
    const key = `${row.student_id}:${subject}`;
    const current = learners.get(key) || { student_id: row.student_id, name: displayName(row), stream: streamName(row), subject, a: null, b: null, diff: null };
    current[side] = resultPercentage(row);
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

export async function generateComparisonPdf(data: ComparisonData, schoolInfo: SchoolInfo, fontSize: PdfFontSize = 14) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); configurePdfFontSize(doc, fontSize);
  const subtitle = `${schoolInfo.name || 'School'} — ${data.classLabel} — ${data.termLabel} — ${data.sideA.examLabel} vs ${data.sideB.examLabel}`;
  addSectionTitle(doc, 'COMPARE EXAMS — SECTION 1: EXAM SUMMARY', subtitle);
  const metric = (side: ComparisonSide) => {
    const totals = side.learners.map((learner) => learner.total);
    const avgs = side.learners.map((learner) => learner.average);
    return { learners: side.learners.length, mean: mean(totals), grade: mean(avgs), high: totals.length ? Math.max(...totals) : null, low: totals.length ? Math.min(...totals) : null };
  };
  const ma = metric(data.sideA); const mb = metric(data.sideB);
  addTable(doc, ['Metric', data.sideA.examLabel, data.sideB.examLabel, 'Change'], [
    ['Total Learners', ma.learners, mb.learners, signed(mb.learners - ma.learners, 0)],
    ['Class Mean Marks', ma.mean?.toFixed(1) || '—', mb.mean?.toFixed(1) || '—', signed((mb.mean ?? 0) - (ma.mean ?? 0))],
    ['Class Mean Grade', ma.grade == null ? '—' : gradeLabel(ma.grade, data.band), mb.grade == null ? '—' : gradeLabel(mb.grade, data.band), '—'],
    ['Highest Mark', ma.high ?? '—', mb.high ?? '—', signed((mb.high ?? 0) - (ma.high ?? 0), 0)],
    ['Lowest Mark', ma.low ?? '—', mb.low ?? '—', signed((mb.low ?? 0) - (ma.low ?? 0), 0)],
  ], 32, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 2: PERFORMANCE DISTRIBUTION', subtitle);
  const distribution = data.gradeLabels.map((label) => {
    const count = (side: ComparisonSide) => side.learners.filter((learner) => learner.grade === label).length;
    const a = count(data.sideA); const b = count(data.sideB);
    return [label, `${a} (${ma.learners ? (a / ma.learners * 100).toFixed(1) : '0.0'}%)`, `${b} (${mb.learners ? (b / mb.learners * 100).toFixed(1) : '0.0'}%)`, signed(b - a, 0)];
  });
  addTable(doc, ['Grade', data.sideA.examLabel, data.sideB.examLabel, 'Change'], distribution, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 3: TOP 10 LEARNERS', subtitle);
  const top = Array.from({ length: Math.max(10, data.sideA.learners.length, data.sideB.learners.length) }, (_, i) => {
    const a = data.sideA.learners[i]; const b = data.sideB.learners[i];
    return [String(i + 1), a?.name || '—', a?.stream || '—', a?.total.toFixed(0) || '—', a?.average.toFixed(1) || '—', a?.grade || '—', a?.totalPoints ?? '—', b?.name || '—', b?.stream || '—', b?.total.toFixed(0) || '—', b?.average.toFixed(1) || '—', b?.grade || '—', b?.totalPoints ?? '—'];
  }).slice(0, 10);
  addTable(doc, ['POS', `${data.sideA.examLabel} Learner`, 'Stream', 'Total Marks', 'Mean %', 'Mean Grade', 'Total Points', `${data.sideB.examLabel} Learner`, 'Stream', 'Total Marks', 'Mean %', 'Mean Grade', 'Total Points'], top, 28, fontSize);

  nextPage(doc, 'COMPARE EXAMS — SECTION 4: SUBJECT PERFORMANCE', subtitle);
  const subjectRows = data.sideA.subjects.map((subject) => {
    const av = data.sideA.learners.map((learner) => learner.subjects[subject]).filter((value) => value != null);
    const bv = data.sideB.learners.map((learner) => learner.subjects[subject]).filter((value) => value != null);
    const a = mean(av); const b = mean(bv);
    return [subject, a == null ? '—' : `${a.toFixed(1)} (${gradeLabel(a, data.band)})`, b == null ? '—' : `${b.toFixed(1)} (${gradeLabel(b, data.band)})`, signed(a != null && b != null ? b - a : null)];
  });
  addTable(doc, ['Learning Area', data.sideA.examLabel + ' Mean (Grade)', data.sideB.examLabel + ' Mean (Grade)', 'Change'], subjectRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 5: SUBJECT GRADES', subtitle);
  const subjectGradeRows: any[][] = [];
  data.sideA.subjects.forEach((subject) => data.gradeLabels.forEach((grade) => {
    const countFor = (side: ComparisonSide) => side.learners.filter((learner) => learner.subjects[subject] != null && gradeLabel(learner.subjects[subject], data.band) === grade).length;
    const a = countFor(data.sideA); const b = countFor(data.sideB);
    subjectGradeRows.push([subject, grade, a, b, signed(b - a, 0)]);
  }));
  addTable(doc, ['Learning Area', 'Grade', data.sideA.examLabel + ' Count', data.sideB.examLabel + ' Count', 'Change'], subjectGradeRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 6: LEARNER DEVIATION', subtitle);
  const learnerIds = Array.from(new Set([...data.sideA.learners, ...data.sideB.learners].map((learner) => learner.student_id)));
  const learnerRows = learnerIds.map((id) => {
    const a = data.sideA.learners.find((learner) => learner.student_id === id);
    const b = data.sideB.learners.find((learner) => learner.student_id === id);
    const diffMarks = a && b ? b.total - a.total : null;
    const diffPoints = a && b ? b.totalPoints - a.totalPoints : null;
    return [
      a?.name || b?.name || '—', a?.stream || b?.stream || '—',
      a?.total.toFixed(0) || '—', a?.totalPoints ?? '—', a?.grade || '—',
      b?.total.toFixed(0) || '—', b?.totalPoints ?? '—', b?.grade || '—',
      signed(diffMarks, 0), signed(diffPoints, 0),
    ];
  });
  addTable(doc, ['Learner', 'Stream', `${data.sideA.examLabel} Total`, `${data.sideA.examLabel} Points`, `${data.sideA.examLabel} Grade`, `${data.sideB.examLabel} Total`, `${data.sideB.examLabel} Points`, `${data.sideB.examLabel} Grade`, 'Dev (Marks)', 'Dev (Points)'], learnerRows, 28, fontSize, [8, 9]);

  nextPage(doc, 'COMPARE EXAMS — SECTION 7: STREAM PERFORMANCE', subtitle);
  const streams = data.streamLabels.map((stream) => {
    const a = mean(data.sideA.learners.filter((learner) => learner.stream === stream).map((learner) => learner.total));
    const b = mean(data.sideB.learners.filter((learner) => learner.stream === stream).map((learner) => learner.total));
    const aGrade = a == null ? '—' : gradeLabel((a / data.sideA.outOf) * 100, data.band);
    const bGrade = b == null ? '—' : gradeLabel((b / data.sideB.outOf) * 100, data.band);
    return [stream, a == null ? '—' : a.toFixed(1), aGrade, b == null ? '—' : b.toFixed(1), bGrade, signed(a != null && b != null ? b - a : null)];
  });
  addTable(doc, ['Stream', data.sideA.examLabel + ' Mean', data.sideA.examLabel + ' Grade', data.sideB.examLabel + ' Mean', data.sideB.examLabel + ' Grade', 'Change'], streams, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 8: TOTAL MEAN MARKS', subtitle);
  const meanA = mean(data.sideA.learners.map((learner) => learner.total));
  const meanB = mean(data.sideB.learners.map((learner) => learner.total));
  const diff = meanA != null && meanB != null ? meanB - meanA : null;
  const pct = meanA ? (diff! / meanA) * 100 : null;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(pdfFontSize(doc, 14));
  doc.text(`${data.sideA.examLabel} Total Mean Marks: ${meanA?.toFixed(1) || '—'} / ${data.sideA.outOf}`, 20, 45);
  doc.text(`${data.sideB.examLabel} Total Mean Marks: ${meanB?.toFixed(1) || '—'} / ${data.sideB.outOf}`, 20, 60);
  doc.setTextColor(...changeColor(diff)); doc.text(`Deviation: ${signed(diff)}`, 20, 75); doc.text(`Percent Change: ${signed(pct)}%`, 20, 90); doc.setTextColor(0, 0, 0);

  nextPage(doc, 'COMPARE EXAMS — SECTION 9: TOP 10 LISTINGS', subtitle);
  addTable(doc, ['POS', data.sideA.examLabel, 'Stream', 'Total Marks', 'Mean %', 'Mean Grade', 'Total Points'], data.sideA.learners.slice(0, 10).map((learner, i) => [i + 1, learner.name, learner.stream, learner.total.toFixed(0), learner.average.toFixed(1), learner.grade, learner.totalPoints]), 28, fontSize);
  addTable(doc, ['POS', data.sideB.examLabel, 'Stream', 'Total Marks', 'Mean %', 'Mean Grade', 'Total Points'], data.sideB.learners.slice(0, 10).map((learner, i) => [i + 1, learner.name, learner.stream, learner.total.toFixed(0), learner.average.toFixed(1), learner.grade, learner.totalPoints]), 145, fontSize);

  nextPage(doc, 'COMPARE EXAMS — SECTION 10: SUBJECT GRADE MEANS', subtitle);
  const gradeMeanRows: any[][] = [];
  data.sideA.subjects.forEach((subject) => data.gradeLabels.forEach((grade) => {
    const valuesFor = (side: ComparisonSide) => side.learners.map((learner) => learner.subjects[subject]).filter((value) => value != null && gradeLabel(value, data.band) === grade);
    const a = mean(valuesFor(data.sideA)); const b = mean(valuesFor(data.sideB));
    gradeMeanRows.push([subject, grade, a == null ? '—' : a.toFixed(1), b == null ? '—' : b.toFixed(1), signed(a != null && b != null ? b - a : null)]);
  }));
  addTable(doc, ['Learning Area', 'Grade', data.sideA.examLabel + ' Mean Mark', data.sideB.examLabel + ' Mean Mark', 'Change'], gradeMeanRows, 28, fontSize, true);

  drawReportFooter(doc);
  const safe = `${schoolInfo.name || 'school'}_${data.classLabel}_${data.sideA.examLabel}_vs_${data.sideB.examLabel}`.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 150);
  doc.save(`compare_exams_${safe}.pdf`);
}
