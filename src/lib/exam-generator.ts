import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  allocateQuestionBlueprint,
  cleanText,
  questionTypeLabel,
  validateExamRequest,
  type Difficulty,
  type ExamFormat,
  type ExamGenerationRequest,
  type ExamGenerationResponse,
  type ExamPaper,
  type GeneratedExamQuestion,
  type QuestionType,
} from './exam-schema';
import { renderExamVisualDataUrl } from './exam-visuals';

const sectionTitles: Record<string, string> = {
  multiple_choice: 'SECTION A: MULTIPLE CHOICE QUESTIONS',
  multiple_response: 'SECTION B: MULTIPLE RESPONSE QUESTIONS',
  modified_true_false: 'SECTION C: MODIFIED TRUE / FALSE',
  completion: 'SECTION D: COMPLETION QUESTIONS',
  matching: 'SECTION E: MATCHING QUESTIONS',
  short_answer: 'SECTION F: SHORT ANSWER QUESTIONS',
  numeric_response: 'SECTION G: NUMERIC RESPONSE QUESTIONS',
  case_study: 'SECTION H: CASE STUDY QUESTIONS',
  essay: 'SECTION I: EXTENDED RESPONSE QUESTIONS',
};

export {
  CBC_QUESTION_TYPES,
  cleanText,
  makeExamTitle,
  questionTypeLabel,
  validateExamRequest,
  allocateQuestionBlueprint,
  makeFormatBlueprint,
} from './exam-schema';
export type {
  Difficulty,
  ExamFormat,
  ExamGenerationRequest,
  ExamGenerationResponse,
  ExamPaper,
  GeneratedExamQuestion,
  QuestionType,
} from './exam-schema';

export type ExamPdfMode = 'student' | 'marking_scheme' | 'answer_key' | 'combined';

type BrandedPaper = ExamPaper & { school_logo_url?: string | null };

function formatLabel(format: ExamFormat): string {
  if (format === 'kpsea') return 'KPSEA-STYLE SCHOOL PRACTICE PAPER';
  if (format === 'kjsea') return 'KJSEA-STYLE SCHOOL PRACTICE PAPER';
  if (format === 'cbe') return 'CBE SCHOOL-BASED ASSESSMENT';
  return 'CUSTOM SCHOOL ASSESSMENT';
}

function internalPaperCode(paper: BrandedPaper): string {
  const subjectCode = paper.subject.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'PAPER';
  return `ZAS-${paper.year}-${subjectCode}-${String(paper.version_number || 1).padStart(2, '0')}`;
}

function groupedQuestions(paper: BrandedPaper): Array<{ type: QuestionType; questions: GeneratedExamQuestion[]; marks: number }> {
  const order = [...new Set(paper.questions.map((question) => question.question_type))];
  return order.map((type) => {
    const questions = paper.questions.filter((question) => question.question_type === type);
    return { type, questions, marks: questions.reduce((sum, question) => sum + question.marks, 0) };
  });
}

function isFormalPracticeFormat(paper: BrandedPaper): boolean {
  return paper.format === 'kpsea' || paper.format === 'kjsea';
}

function isObjectiveKpseaPaper(paper: BrandedPaper): boolean {
  return paper.format === 'kpsea'
    && paper.questions.length > 0
    && paper.questions.every((question) => question.question_type === 'multiple_choice' && normalizeOptions(question).length >= 2);
}

function formatSpecificInstructions(paper: BrandedPaper): string[] {
  if (isObjectiveKpseaPaper(paper)) {
    return [
      'Answer all questions on the separate answer sheet provided.',
      'For each question, choose only one correct answer from A, B, C and D.',
      'Shade the circle that corresponds to your chosen answer clearly and completely.',
      'Do not write more than one answer for any question.',
    ];
  }
  if (paper.format === 'kjsea') {
    return [
      'Answer all questions in the spaces provided.',
      'Show all working for calculations and give clear labelled responses where required.',
      'Use the diagrams, tables, maps and other visual stimuli only as directed by each question.',
    ];
  }
  return [];
}

function addPageHeader(doc: jsPDF, paper: BrandedPaper, continuation = false, subtitle?: string): number {
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.6);
  doc.line(14, 35, 196, 35);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text((paper.school_name || 'SCHOOL ASSESSMENT').toUpperCase(), 14, 9);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('ZAMIFU ANALYTICS ASSESSMENT STUDIO', 196, 9, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(continuation ? `${paper.title.toUpperCase()} — CONTINUED` : paper.title.toUpperCase(), 105, 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`${formatLabel(paper.format)}  |  ${paper.subject.toUpperCase()}  |  GRADE ${paper.grade_level}  |  ${paper.term || 'SCHOOL TERM'} ${paper.year}`, 105, 25, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`Internal paper code: ${internalPaperCode(paper)}  |  Time: ${paper.duration_minutes} minutes  |  Total: ${paper.total_marks} marks`, 105, 31, { align: 'center' });
  if (subtitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(subtitle.toUpperCase(), 105, 42, { align: 'center' });
    doc.setDrawColor(107, 114, 128);
    doc.line(14, 45, 196, 45);
    return 52;
  }
  return 42;
}

function addFooter(doc: jsPDF, paper: BrandedPaper): void {
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, 286, 196, 286);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(75, 85, 99);
    doc.text(`${(paper.school_name || 'School assessment').slice(0, 42)}  |  ${internalPaperCode(paper)}  |  School-owned practice paper`, 14, 291);
    doc.text(`Page ${pageNumber} of ${pageCount}`, 196, 291, { align: 'right' });
    if (pageNumber < pageCount) doc.text('Turn over', 196, 296, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:image/')) return url;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function rasterizeForPdf(source: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' }> {
  const dataUrl = await fetchImageDataUrl(source);
  if (!dataUrl) throw new Error('A required visual could not be loaded for the PDF. Regenerate the paper or remove the broken visual.');
  if (/^data:image\/(png|jpeg|jpg|webp);/i.test(dataUrl)) {
    return { dataUrl, format: /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG' };
  }
  if (typeof document === 'undefined') throw new Error('Visual PDF rendering is available in the browser only.');
  const image = new Image();
  image.decoding = 'async';
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  const scale = Math.min(2, 1200 / Math.max(image.width, 1));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not prepare a visual for the PDF.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG' };
}

function normalizeOptions(question: GeneratedExamQuestion): string[] {
  return Array.isArray(question.options) ? question.options.filter(Boolean).slice(0, 8) : [];
}

function addCandidateTable(doc: jsPDF, y: number): number {
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    body: [
      ['Candidate name', '', 'Assessment number', ''],
      ['School name', '', 'School code', ''],
      ["Candidate's signature", '', 'Date', ''],
    ],
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [31, 41, 55], lineWidth: 0.25, minCellHeight: 8 },
    columnStyles: { 0: { cellWidth: 36, fontStyle: 'bold' }, 1: { cellWidth: 55 }, 2: { cellWidth: 36, fontStyle: 'bold' }, 3: { cellWidth: 55 } },
  });
  return Number((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 32) + 7;
}

function addAnswerSheetSample(doc: jsPDF, y: number): number {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(107, 114, 128);
  doc.setLineWidth(0.35);
  doc.roundedRect(14, y, 182, 19, 1.2, 1.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('HOW TO USE THE ANSWER SHEET', 18, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('For each item, shade only one circle. Example of a selected answer:', 18, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.text('A  ○    B  ●    C  ○    D  ○', 133, y + 10);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.text('Use a dark pencil or pen and erase corrections completely.', 18, y + 15);
  return y + 25;
}

function addFormalCoverPage(doc: jsPDF, paper: BrandedPaper, subtitle: string): number {
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text((paper.school_name || 'SCHOOL ASSESSMENT').toUpperCase(), 105, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('ZAMIFU ANALYTICS ASSESSMENT STUDIO', 105, 17, { align: 'center' });
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(14, 21, 196, 21);
  let y = addCandidateTable(doc, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(paper.title.toUpperCase(), 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.text(formatLabel(paper.format), 105, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${paper.subject.toUpperCase()}  |  GRADE ${paper.grade_level}  |  ${paper.term || 'SCHOOL TERM'} ${paper.year}`, 105, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7.5);
  doc.text(`Internal paper code: ${internalPaperCode(paper)}  |  Time: ${paper.duration_minutes} minutes  |  Total: ${paper.total_marks} marks`, 105, y, { align: 'center' });
  y += 9;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y - 4, 182, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(subtitle.toUpperCase(), 105, y + 1.5, { align: 'center' });
  y += 12;
  doc.setFontSize(9);
  doc.text('INSTRUCTIONS TO CANDIDATES', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const baseInstructions = paper.instructions.length
    ? paper.instructions
    : ['Answer all questions.', 'Write your name and class clearly.', 'Read every question carefully before answering.'];
  const instructions = [...formatSpecificInstructions(paper), ...baseInstructions]
    .filter((instruction, index, all) => all.indexOf(instruction) === index)
    .slice(0, 8);
  instructions.forEach((instruction, index) => {
    const lines = doc.splitTextToSize(`${index + 1}. ${instruction}`, 178);
    doc.text(lines, 16, y);
    y += lines.length * 4.2 + 1.5;
  });
  y += 3;
  if (isObjectiveKpseaPaper(paper)) y = addAnswerSheetSample(doc, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PAPER STRUCTURE', 14, y);
  y += 3;
  const groups = groupedQuestions(paper);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [['Section', 'Question type', 'Number of questions', 'Maximum score']],
    body: groups.map((group, index) => [
      `Section ${String.fromCharCode(65 + index)}`,
      questionTypeLabel(group.type),
      String(group.questions.length),
      String(group.marks),
    ]),
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [107, 114, 128], lineWidth: 0.25, valign: 'middle' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 78 }, 2: { cellWidth: 38, halign: 'center' }, 3: { cellWidth: 36, halign: 'center' } },
  });
  y = Number((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 18) + 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('School-owned practice assessment. This document is not an official KNEC examination paper.', 105, Math.min(y, 270), { align: 'center' });
  return Math.min(y, 270);
}

function addAnswerLines(doc: jsPDF, paper: BrandedPaper, y: number, marks: number): number {
  if (paper.format !== 'kjsea') return y;
  const lineCount = Math.max(1, Math.min(6, Math.ceil(marks / 2)));
  y = ensureRoom(doc, paper, y, lineCount * 5 + 2, 'STUDENT PAPER');
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1], 0);
  for (let index = 0; index < lineCount; index += 1) {
    doc.line(14, y + index * 5, 105, y + index * 5);
  }
  doc.setLineDashPattern([], 0);
  return y + lineCount * 5 + 2;
}

function addWorkingSpaceColumn(doc: jsPDF, paper: BrandedPaper): void {
  if (!isFormalPracticeFormat(paper) || isObjectiveKpseaPaper(paper)) return;
  doc.setDrawColor(107, 114, 128);
  doc.setLineWidth(0.35);
  doc.line(112, 52, 112, 282);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text('WORKING SPACE', 154, 49, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function ensureRoom(doc: jsPDF, paper: BrandedPaper, y: number, needed: number, subtitle?: string): number {
  if (y + needed <= 272) return y;
  doc.addPage();
  const nextY = addPageHeader(doc, paper, true, subtitle);
  addWorkingSpaceColumn(doc, paper);
  return nextY;
}

async function addQuestionVisual(doc: jsPDF, paper: BrandedPaper, question: GeneratedExamQuestion, y: number, subtitle?: string): Promise<number> {
  const automaticVisual = question.visual_spec ? renderExamVisualDataUrl(question) : null;
  const source = automaticVisual || question.image_url;
  if (!source) return y;
  const visual = await rasterizeForPdf(source);
  y = ensureRoom(doc, paper, y, 68, subtitle);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Visual for question ${question.question_number || ''}`.trim(), 19, y);
  doc.addImage(visual.dataUrl, visual.format, 19, y + 3, 92, 58, undefined, 'FAST');
  y += 64;
  doc.setTextColor(31, 41, 55);
  return y;
}

async function renderStudentPaper(doc: jsPDF, paper: BrandedPaper): Promise<void> {
  addFormalCoverPage(doc, paper, 'STUDENT PAPER');
  doc.addPage();
  let y = addPageHeader(doc, paper, false, 'STUDENT PAPER');
  addWorkingSpaceColumn(doc, paper);
  const formal = isFormalPracticeFormat(paper);
  const groups = groupedQuestions(paper);
  let sequence = 1;
  for (const [groupIndex, group] of groups.entries()) {
    y = ensureRoom(doc, paper, y, 18, 'STUDENT PAPER');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(formal ? 8.5 : 9);
    doc.setTextColor(formal ? 17 : 153, formal ? 24 : 27, formal ? 39 : 27);
    const sectionHeading = `SECTION ${String.fromCharCode(65 + groupIndex)}: ${questionTypeLabel(group.type).toUpperCase()} (${group.marks} MARK${group.marks === 1 ? '' : 'S'})`;
    if (formal) {
      doc.text(sectionHeading, 14, y);
      doc.setDrawColor(107, 114, 128);
      doc.setLineWidth(0.3);
      doc.line(14, y + 2, 105, y + 2);
      y += 8;
    } else {
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(14, y - 4, 182, 8, 1.5, 1.5, 'F');
      doc.text(sectionTitles[group.type] || questionTypeLabel(group.type).toUpperCase(), 17, y + 1.5);
      y += 9;
    }
    doc.setTextColor(0, 0, 0);
    for (const question of group.questions) {
      const textWidth = formal ? 91 : 176;
      const stem = doc.splitTextToSize(`${sequence}. ${question.question_text}${formal ? '' : `  [${question.marks} mark${question.marks === 1 ? '' : 's'}]`}`, textWidth);
      y = ensureRoom(doc, paper, y, stem.length * 4.6 + 10, 'STUDENT PAPER');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(formal ? 8.5 : 9.5);
      doc.text(stem, 14, y);
      doc.setFont('helvetica', 'normal');
      y += stem.length * 4.6 + 2;
      const options = normalizeOptions(question);
      if (options.length) {
        options.forEach((option, optionIndex) => {
          const lines = doc.splitTextToSize(`${String.fromCharCode(65 + optionIndex)}. ${option}`, formal ? 86 : 168);
          y = ensureRoom(doc, paper, y, lines.length * 4.2 + 2, 'STUDENT PAPER');
          doc.text(lines, 19, y);
          y += lines.length * 4.2 + 1;
        });
        if (formal) {
          doc.setFontSize(8);
          if (isObjectiveKpseaPaper(paper)) {
            doc.text('Record one answer on the separate answer sheet.', 19, y + 1);
          } else {
            doc.text('Answer in the space provided.', 19, y + 1);
          }
          y += 5;
        }
      }
      y = await addQuestionVisual(doc, paper, { ...question, question_number: sequence }, y, 'STUDENT PAPER');
      if (!options.length) y = addAnswerLines(doc, paper, y + 2, question.marks);
      y += formal ? 6 : 4;
      sequence += 1;
    }
  }
}

async function renderMarkingScheme(doc: jsPDF, paper: BrandedPaper): Promise<void> {
  let y = addPageHeader(doc, paper, false, 'MARKING SCHEME — TEACHER COPY');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MARKING SCHEME AND SCORING GUIDANCE', 105, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Use this school-owned marking scheme with the matching student paper. Award only the marks shown.', 105, y, { align: 'center' });
  y += 6;
  const groups = groupedQuestions(paper);
  const rows: string[][] = [];
  let sequence = 1;
  groups.forEach((group, groupIndex) => {
    group.questions.forEach((question) => {
      rows.push([
        `Section ${String.fromCharCode(65 + groupIndex)}`,
        String(sequence),
        questionTypeLabel(question.question_type),
        question.marking_scheme || question.correct_answer || 'Teacher to assess according to the stated learning outcome.',
        String(question.marks),
      ]);
      sequence += 1;
    });
  });
  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Section', 'No.', 'Question type', 'Expected answer / marking guidance', 'Marks']],
    body: rows,
    styles: { fontSize: 7.2, cellPadding: 2, valign: 'top', overflow: 'linebreak', lineColor: [107, 114, 128], lineWidth: 0.25 },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 28 }, 3: { cellWidth: 116 }, 4: { cellWidth: 12, halign: 'center' } },
  });
  const finalY = Number((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 20);
  const visualQuestions = paper.questions.filter((question) => question.image_url || question.visual_spec);
  if (visualQuestions.length) {
    doc.addPage();
    y = addPageHeader(doc, paper, false, 'MARKING SCHEME — VISUAL REFERENCES');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('VISUAL REFERENCES USED IN THE PAPER', 14, y);
    y += 8;
    for (const [index, question] of visualQuestions.entries()) {
      y = ensureRoom(doc, paper, y, 70, 'MARKING SCHEME — VISUAL REFERENCES');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`Question ${paper.questions.indexOf(question) + 1}: ${question.question_text.slice(0, 90)}`, 14, y);
      y += 3;
      y = await addQuestionVisual(doc, paper, question, y, 'MARKING SCHEME — VISUAL REFERENCES');
      y += index === visualQuestions.length - 1 ? 0 : 5;
    }
  } else if (finalY > 260) {
    doc.addPage();
  }
}

async function renderAnswerKey(doc: jsPDF, paper: BrandedPaper): Promise<void> {
  let y = addPageHeader(doc, paper, false, 'ANSWER KEY');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('COMPACT ANSWER KEY', 105, y, { align: 'center' });
  y += 8;
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['No.', 'Answer', 'Marks', 'Cognitive level']],
    body: paper.questions.map((question, index) => [
      String(index + 1),
      question.correct_answer || question.marking_scheme || 'See marking scheme',
      String(question.marks),
      question.cognitive_level || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 128 }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 30 } },
  });
  const visualQuestions = paper.questions.filter((question) => question.image_url || question.visual_spec);
  if (visualQuestions.length) {
    doc.addPage();
    y = addPageHeader(doc, paper, false, 'ANSWER KEY — VISUAL REFERENCES');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('VISUAL REFERENCES', 14, y);
    y += 8;
    for (const question of visualQuestions) {
      y = ensureRoom(doc, paper, y, 70, 'ANSWER KEY — VISUAL REFERENCES');
      y = await addQuestionVisual(doc, paper, question, y, 'ANSWER KEY — VISUAL REFERENCES');
      y += 5;
    }
  }
}

export async function downloadExamPdf(paper: ExamPaper, modeOrInclude: ExamPdfMode | boolean = 'student'): Promise<void> {
  const mode: ExamPdfMode = typeof modeOrInclude === 'boolean' ? (modeOrInclude ? 'combined' : 'student') : modeOrInclude;
  const brandedPaper = paper as BrandedPaper;
  if (!paper.questions.length) throw new Error('There are no questions to export.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  if (mode === 'student' || mode === 'combined') await renderStudentPaper(doc, brandedPaper);
  if (mode === 'marking_scheme') await renderMarkingScheme(doc, brandedPaper);
  if (mode === 'answer_key') await renderAnswerKey(doc, brandedPaper);
  if (mode === 'combined') {
    doc.addPage();
    await renderMarkingScheme(doc, brandedPaper);
  }
  addFooter(doc, brandedPaper);
  const suffix = mode === 'combined' ? 'student_and_marking_scheme' : mode;
  const safeName = paper.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'cbc_exam';
  doc.save(`${safeName}_${suffix}.pdf`);
}
