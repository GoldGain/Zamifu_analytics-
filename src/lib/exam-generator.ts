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

function addPageHeader(doc: jsPDF, paper: BrandedPaper, continuation = false, subtitle?: string): number {
  doc.setFillColor(185, 28, 28);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((paper.school_name || 'ZAMIFU ANALYTICS').toUpperCase(), 105, 10, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(continuation ? `${paper.title.toUpperCase()} — CONTINUED` : paper.title.toUpperCase(), 105, 17, { align: 'center' });
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(8.5);
  doc.text(`Subject: ${paper.subject}    |    Grade: ${paper.grade_level}    |    Time: ${paper.duration_minutes} minutes    |    Total: ${paper.total_marks} marks`, 105, 31, { align: 'center' });
  if (subtitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text(subtitle.toUpperCase(), 105, 36, { align: 'center' });
    doc.setTextColor(31, 41, 55);
  }
  doc.setDrawColor(229, 231, 235);
  doc.line(14, subtitle ? 39 : 35, 196, subtitle ? 39 : 35);
  return subtitle ? 46 : 42;
}

function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 286, 196, 286);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text('Generated securely by Zamifu Analytics Assessment Studio', 14, 291);
    doc.text(`Page ${pageNumber} of ${pageCount}`, 196, 291, { align: 'right' });
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

function addCandidateFields(doc: jsPDF, y: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Candidate name: ____________________________________________', 14, y);
  doc.text('Admission no.: ____________________', 14, y + 7);
  doc.text('Stream: __________________________', 125, y + 7);
  doc.line(14, y + 11, 196, y + 11);
  return y + 18;
}

function ensureRoom(doc: jsPDF, paper: BrandedPaper, y: number, needed: number, subtitle?: string): number {
  if (y + needed <= 272) return y;
  doc.addPage();
  return addPageHeader(doc, paper, true, subtitle);
}

async function addQuestionVisual(doc: jsPDF, paper: BrandedPaper, question: GeneratedExamQuestion, y: number, subtitle?: string): Promise<number> {
  if (!question.image_url) return y;
  const visual = await rasterizeForPdf(question.image_url);
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
  let y = addPageHeader(doc, paper, false, 'STUDENT PAPER');
  y = addCandidateFields(doc, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INSTRUCTIONS', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const instructions = paper.instructions.length ? paper.instructions : ['Answer all questions.', 'Write your name and class clearly.', 'Read every question carefully before answering.'];
  instructions.forEach((instruction, index) => {
    const lines = doc.splitTextToSize(`${index + 1}. ${instruction}`, 178);
    y = ensureRoom(doc, paper, y, lines.length * 4.5 + 3, 'STUDENT PAPER');
    doc.text(lines, 16, y);
    y += lines.length * 4.5 + 1.5;
  });
  y += 3;
  const groupOrder = [...new Set(paper.questions.map((question) => question.question_type))];
  let sequence = 1;
  for (const type of groupOrder) {
    const questions = paper.questions.filter((question) => question.question_type === type);
    if (!questions.length) continue;
    y = ensureRoom(doc, paper, y, 18, 'STUDENT PAPER');
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14, y - 4, 182, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    doc.text(sectionTitles[type] || questionTypeLabel(type).toUpperCase(), 17, y + 1.5);
    doc.setTextColor(0, 0, 0);
    y += 9;
    for (const question of questions) {
      const stem = doc.splitTextToSize(`${sequence}. ${question.question_text}  [${question.marks} mark${question.marks === 1 ? '' : 's'}]`, 176);
      y = ensureRoom(doc, paper, y, stem.length * 4.6 + 10, 'STUDENT PAPER');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(stem, 14, y);
      doc.setFont('helvetica', 'normal');
      y += stem.length * 4.6 + 2;
      const options = normalizeOptions(question);
      if (options.length) {
        options.forEach((option, optionIndex) => {
          const lines = doc.splitTextToSize(`${String.fromCharCode(65 + optionIndex)}. ${option}`, 168);
          y = ensureRoom(doc, paper, y, lines.length * 4.2 + 2, 'STUDENT PAPER');
          doc.text(lines, 19, y);
          y += lines.length * 4.2 + 1;
        });
      }
      y = await addQuestionVisual(doc, paper, { ...question, question_number: sequence }, y, 'STUDENT PAPER');
      y += 4;
      sequence += 1;
    }
  }
}

async function renderMarkingScheme(doc: jsPDF, paper: BrandedPaper): Promise<void> {
  let y = addPageHeader(doc, paper, false, 'MARKING SCHEME');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('MARKING SCHEME', 105, y, { align: 'center' });
  y += 7;
  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['No.', 'Question type', 'Expected answer / marking guidance', 'Marks']],
    body: paper.questions.map((question, index) => [
      String(index + 1),
      questionTypeLabel(question.question_type),
      question.marking_scheme || question.correct_answer || 'Teacher to assess according to the stated learning outcome.',
      String(question.marks),
    ]),
    styles: { fontSize: 7.5, cellPadding: 2, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 30 }, 2: { cellWidth: 125 }, 3: { cellWidth: 15, halign: 'center' } },
  });
  const finalY = Number((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 20);
  const visualQuestions = paper.questions.filter((question) => question.image_url);
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
  const visualQuestions = paper.questions.filter((question) => question.image_url);
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
  addFooter(doc);
  const suffix = mode === 'combined' ? 'student_and_marking_scheme' : mode;
  const safeName = paper.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'cbc_exam';
  doc.save(`${safeName}_${suffix}.pdf`);
}
