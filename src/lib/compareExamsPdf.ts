import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateGradeForClass, curriculumScopeKey, getSchoolLevelBand, gradePointsForClass, gradePointsMaxForClass } from '@/lib/grading';
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
  aMarks: number | null;
  aOutOf: number | null;
  aPoints: number | null;
  aLevel: string | null;
  bMarks: number | null;
  bOutOf: number | null;
  bPoints: number | null;
  bLevel: string | null;
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
  rankingTotalMarks: number;
  rankingTotalPoints: number;
  rankingSubjects: string[];
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
  classData?: any;
};

function displayName(row: any): string {
  return `${row.students?.first_name || ''} ${row.students?.last_name || ''}`.trim() || 'Unknown learner';
}

function streamName(row: any): string {
  const c = row.classes || {};
  return String(c.stream_name || c.stream || c.name || '—').trim() || '—';
}

function gradeLabel(value: number, classData?: any): string {
  const grade = calculateGradeForClass(value, classData);
  return 'subLevel' in grade ? grade.subLevel : grade.grade;
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
      grade: gradeLabel(summary.avgPct, classObj),
      totalPoints: summary.totalPoints,
      rankingTotalMarks: summary.rankingTotalMarks ?? summary.totalMarks ?? summary.totalPct,
      rankingTotalPoints: summary.rankingTotalPoints ?? summary.totalPoints,
      rankingSubjects: summary.rankingSubjects || [],
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
  const rowClasses = [...args.rowsA, ...args.rowsB]
    .map((row) => row.classes)
    .filter(Boolean);
  const classScopes = new Set(rowClasses.map((classData) => curriculumScopeKey(classData)));
  if (args.classObj) classScopes.add(curriculumScopeKey(args.classObj));
  if (classScopes.size > 1) {
    throw new Error('Cannot compare mixed CBE and 8-4-4 curriculum results in one cohort. Select a single curriculum/form group.');
  }
  const classData = args.classObj || rowClasses[0];
  const band = getSchoolLevelBand(classData);
  const subjectNames = learningAreaNames([...args.rowsA, ...args.rowsB], args.learningAreas || []);
  const sideA = makeSide(args.rowsA, 'EXAM 1', args.termALabel, args.examALabel, classData, subjectNames);
  const sideB = makeSide(args.rowsB, 'EXAM 2', args.termBLabel, args.examBLabel, classData, subjectNames);
  const learners = new Map<string, ComparisonRow>();
  [...args.rowsA.map((row) => ({ row, side: 'a' as const })), ...args.rowsB.map((row) => ({ row, side: 'b' as const }))].forEach(({ row, side }) => {
    if (!row.student_id) return;
    const subject = normalizeLearningAreaName(row.subjects?.name || 'Learning Area');
    const key = `${row.student_id}:${subject}`;
    const current = learners.get(key) || { student_id: row.student_id, name: displayName(row), stream: streamName(row), subject, a: null, b: null, diff: null, aMarks: null, aOutOf: null, aPoints: null, aLevel: null, bMarks: null, bOutOf: null, bPoints: null, bLevel: null };
    const outOf = Number(row.out_of) > 0 ? Number(row.out_of) : 100;
    const percentage = resultPercentage(row);
    const marks = row.marks != null ? Number(row.marks) : percentage * outOf / 100;
    const prefix = side === 'a' ? 'a' : 'b';
    const previousMarks = current[`${prefix}Marks` as 'aMarks' | 'bMarks'];
    const previousOutOf = current[`${prefix}OutOf` as 'aOutOf' | 'bOutOf'];
    const combinedMarks = (previousMarks || 0) + marks;
    const combinedOutOf = (previousOutOf || 0) + outOf;
    const combinedPercentage = combinedOutOf > 0 ? combinedMarks / combinedOutOf * 100 : percentage;
    const combinedGrade = calculateGradeForClass(combinedPercentage, classData);
    const combinedLevel = 'subLevel' in combinedGrade ? combinedGrade.subLevel : combinedGrade.grade;
    const combinedPoints = gradePointsMaxForClass(classData) > 0 ? gradePointsForClass(combinedPercentage, classData) : null;
    if (side === 'a') {
      current.a = combinedPercentage; current.aMarks = combinedMarks; current.aOutOf = combinedOutOf; current.aPoints = combinedPoints; current.aLevel = combinedLevel;
    } else {
      current.b = combinedPercentage; current.bMarks = combinedMarks; current.bOutOf = combinedOutOf; current.bPoints = combinedPoints; current.bLevel = combinedLevel;
    }
    current.diff = current.a != null && current.b != null ? current.b - current.a : null;
    learners.set(key, current);
  });
  const is844 = curriculumScopeKey(classData) === '844';
  const gradeLabels = is844
    ? ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E']
    : band === 'primary'
      ? ['EE', 'ME', 'AE', 'BE']
      : ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];
  return {
    classLabel: args.classLabel,
    termLabel: args.termALabel === args.termBLabel ? args.termALabel : `${args.termALabel} vs ${args.termBLabel}`,
    sideA: { ...sideA, subjects: subjectNames },
    sideB: { ...sideB, subjects: subjectNames },
    rows: Array.from(learners.values()).sort((a, b) => a.name.localeCompare(b.name) || a.subject.localeCompare(b.subject)),
    streamLabels: Array.from(new Set([...sideA.learners, ...sideB.learners].map((learner) => learner.stream))).sort(),
    gradeLabels,
    band,
    classData,
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
    ['Class Mean Grade', ma.grade == null ? '—' : gradeLabel(ma.grade, data.classData), mb.grade == null ? '—' : gradeLabel(mb.grade, data.classData), '—'],
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
    const points = (learner?: ComparisonLearner) => data.band === 'primary' ? '—' : learner?.rankingTotalPoints ?? '—';
    return [String(i + 1), a?.name || '—', a?.stream || '—', a ? a.rankingTotalMarks.toFixed(0) : '—', a?.average.toFixed(1) || '—', a?.grade || '—', points(a), b?.name || '—', b?.stream || '—', b ? b.rankingTotalMarks.toFixed(0) : '—', b?.average.toFixed(1) || '—', b?.grade || '—', points(b)];
  }).slice(0, 10);
  addTable(doc, ['POS', `${data.sideA.examLabel} Learner`, 'Stream', 'Rank Marks', 'Mean %', 'Mean Grade', 'Rank Points', `${data.sideB.examLabel} Learner`, 'Stream', 'Rank Marks', 'Mean %', 'Mean Grade', 'Rank Points'], top, 28, fontSize);

  nextPage(doc, 'COMPARE EXAMS — SECTION 4: LEARNER SUBJECT MARKS, POINTS & LEVELS', subtitle);
  const formatExamMarks = (marks: number | null, outOf: number | null) => marks == null
    ? '—'
    : Number(outOf || 100) === 100 ? marks.toFixed(0) : `${marks.toFixed(0)}/${Number(outOf).toFixed(0)}`;
  const learnerSubjectRows = data.rows.map((row) => [
    row.name,
    row.stream,
    row.subject,
    formatExamMarks(row.aMarks, row.aOutOf), row.aPoints ?? '—', row.aLevel || '—',
    formatExamMarks(row.bMarks, row.bOutOf), row.bPoints ?? '—', row.bLevel || '—',
    signed(row.diff),
  ]);
  addTable(doc, ['Learner', 'Stream', 'Learning Area', `${data.sideA.examLabel} Marks`, 'Pts', 'Level', `${data.sideB.examLabel} Marks`, 'Pts', 'Level', 'Change %'], learnerSubjectRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 5: SUBJECT PERFORMANCE', subtitle);
  const subjectRows = data.sideA.subjects.map((subject) => {
    const av = data.sideA.learners.map((learner) => learner.subjects[subject]).filter((value) => value != null);
    const bv = data.sideB.learners.map((learner) => learner.subjects[subject]).filter((value) => value != null);
    const a = mean(av); const b = mean(bv);
    const metric = (value: number | null) => value == null
      ? '—'
      : `${value.toFixed(1)}% · ${gradePointsMaxForClass(data.classData) > 0 ? `${gradePointsForClass(value, data.classData)} pts` : '—'} · ${gradeLabel(value, data.classData)}`;
    return [subject, metric(a), metric(b), signed(a != null && b != null ? b - a : null)];
  });
  addTable(doc, ['Learning Area', data.sideA.examLabel + ' Mean · Points · Level', data.sideB.examLabel + ' Mean · Points · Level', 'Change'], subjectRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 6: SUBJECT GRADES', subtitle);
  const subjectGradeRows: any[][] = [];
  data.sideA.subjects.forEach((subject) => data.gradeLabels.forEach((grade) => {
    const countFor = (side: ComparisonSide) => side.learners.filter((learner) => learner.subjects[subject] != null && gradeLabel(learner.subjects[subject], data.classData) === grade).length;
    const a = countFor(data.sideA); const b = countFor(data.sideB);
    subjectGradeRows.push([subject, grade, a, b, signed(b - a, 0)]);
  }));
  addTable(doc, ['Learning Area', 'Grade', data.sideA.examLabel + ' Count', data.sideB.examLabel + ' Count', 'Change'], subjectGradeRows, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 7: LEARNER DEVIATION', subtitle);
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

  nextPage(doc, 'COMPARE EXAMS — SECTION 8: STREAM PERFORMANCE', subtitle);
  const streams = data.streamLabels.map((stream) => {
    const a = mean(data.sideA.learners.filter((learner) => learner.stream === stream).map((learner) => learner.total));
    const b = mean(data.sideB.learners.filter((learner) => learner.stream === stream).map((learner) => learner.total));
    const aGrade = a == null ? '—' : gradeLabel((a / data.sideA.outOf) * 100, data.classData);
    const bGrade = b == null ? '—' : gradeLabel((b / data.sideB.outOf) * 100, data.classData);
    return [stream, a == null ? '—' : a.toFixed(1), aGrade, b == null ? '—' : b.toFixed(1), bGrade, signed(a != null && b != null ? b - a : null)];
  });
  addTable(doc, ['Stream', data.sideA.examLabel + ' Mean', data.sideA.examLabel + ' Grade', data.sideB.examLabel + ' Mean', data.sideB.examLabel + ' Grade', 'Change'], streams, 28, fontSize, true);

  nextPage(doc, 'COMPARE EXAMS — SECTION 9: TOTAL MEAN MARKS', subtitle);
  const meanA = mean(data.sideA.learners.map((learner) => learner.total));
  const meanB = mean(data.sideB.learners.map((learner) => learner.total));
  const diff = meanA != null && meanB != null ? meanB - meanA : null;
  const pct = meanA ? (diff! / meanA) * 100 : null;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(pdfFontSize(doc, 14));
  doc.text(`${data.sideA.examLabel} Total Mean Marks: ${meanA?.toFixed(1) || '—'} / ${data.sideA.outOf}`, 20, 45);
  doc.text(`${data.sideB.examLabel} Total Mean Marks: ${meanB?.toFixed(1) || '—'} / ${data.sideB.outOf}`, 20, 60);
  doc.setTextColor(...changeColor(diff)); doc.text(`Deviation: ${signed(diff)}`, 20, 75); doc.text(`Percent Change: ${signed(pct)}%`, 20, 90); doc.setTextColor(0, 0, 0);

  nextPage(doc, 'COMPARE EXAMS — SECTION 10: TOP 10 LISTINGS', subtitle);
  const hasKnecSelection = data.sideA.learners.some((learner) => learner.rankingSubjects.length > 0)
    || data.sideB.learners.some((learner) => learner.rankingSubjects.length > 0);
  const rankedLearnerRows = (side: ComparisonSide) => side.learners.slice(0, 10).map((learner, i) => [
    i + 1,
    learner.name,
    learner.stream,
    learner.rankingTotalMarks.toFixed(0),
    learner.average.toFixed(1),
    learner.grade,
    learner.rankingTotalPoints,
    ...(hasKnecSelection ? [learner.rankingSubjects.join(', ') || '—'] : []),
  ]);
  const rankingHeaders = ['POS', 'Learner', 'Stream', 'Rank Marks', 'Mean %', 'Mean Grade', 'Rank Points', ...(hasKnecSelection ? ['KNEC 7 Subjects'] : [])];
  addTable(doc, rankingHeaders, rankedLearnerRows(data.sideA), 28, fontSize);
  addTable(doc, rankingHeaders, rankedLearnerRows(data.sideB), 145, fontSize);

  nextPage(doc, 'COMPARE EXAMS — SECTION 11: SUBJECT GRADE MEANS', subtitle);
  const gradeMeanRows: any[][] = [];
  data.sideA.subjects.forEach((subject) => data.gradeLabels.forEach((grade) => {
    const valuesFor = (side: ComparisonSide) => side.learners.map((learner) => learner.subjects[subject]).filter((value) => value != null && gradeLabel(value, data.classData) === grade);
    const a = mean(valuesFor(data.sideA)); const b = mean(valuesFor(data.sideB));
    gradeMeanRows.push([subject, grade, a == null ? '—' : a.toFixed(1), b == null ? '—' : b.toFixed(1), signed(a != null && b != null ? b - a : null)]);
  }));
  addTable(doc, ['Learning Area', 'Grade', data.sideA.examLabel + ' Mean Mark', data.sideB.examLabel + ' Mean Mark', 'Change'], gradeMeanRows, 28, fontSize, true);

  drawReportFooter(doc);
  const safe = `${schoolInfo.name || 'school'}_${data.classLabel}_${data.sideA.examLabel}_vs_${data.sideB.examLabel}`.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 150);
  doc.save(`compare_exams_${safe}.pdf`);
}
