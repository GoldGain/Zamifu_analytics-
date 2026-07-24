import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CBC_QUESTION_TYPES,
  type ExamPaper,
  type GeneratedExamQuestion,
  type QuestionType,
} from './exam-schema';

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

function addPageHeader(doc: jsPDF, paper: ExamPaper, continuation = false): number {
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
  doc.setDrawColor(229, 231, 235);
  doc.line(14, 35, 196, 35);
  return 42;
}

function addFooter(doc: jsPDF, paper: ExamPaper): void {
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 286, 196, 286);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text('Generated securely by Zamifu Analytics Curriculum Navigator', 14, 291);
    doc.text(`Page ${pageNumber} of ${pageCount}`, 196, 291, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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

function normalizeOptions(question: GeneratedExamQuestion): string[] {
  return Array.isArray(question.options) ? question.options.filter(Boolean).slice(0, 8) : [];
}

export async function downloadExamPdf(paper: ExamPaper, includeMarkingScheme: boolean): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addPageHeader(doc, paper);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INSTRUCTIONS', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const instructions = paper.instructions.length
    ? paper.instructions
    : ['Answer all questions.', 'Write your name and class clearly.', 'Read every question carefully before answering.'];
  instructions.forEach((instruction, index) => {
    const lines = doc.splitTextToSize(`${index + 1}. ${instruction}`, 178);
    doc.text(lines, 16, y);
    y += lines.length * 4.5 + 1.5;
  });
  y += 3;

  const groupOrder = [...new Set(paper.questions.map((question) => question.question_type))];
  let sequence = 1;
  for (const type of groupOrder) {
    const questions = paper.questions.filter((question) => question.question_type === type);
    if (!questions.length) continue;
    if (y > 252) {
      doc.addPage();
      y = addPageHeader(doc, paper, true);
    }
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14, y - 4, 182, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    doc.text(sectionTitles[type] || questionTypeLabel(type).toUpperCase(), 17, y + 1.5);
    doc.setTextColor(0, 0, 0);
    y += 9;

    for (const question of questions) {
      if (y > 245) {
        doc.addPage();
        y = addPageHeader(doc, paper, true);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const stem = doc.splitTextToSize(`${sequence}. ${question.question_text}  [${question.marks} mark${question.marks === 1 ? '' : 's'}]`, 176);
      doc.text(stem, 14, y);
      doc.setFont('helvetica', 'normal');
      y += stem.length * 4.6 + 2;

      const options = normalizeOptions(question);
      if (options.length) {
        options.forEach((option, optionIndex) => {
          const label = String.fromCharCode(65 + optionIndex);
          const lines = doc.splitTextToSize(`${label}. ${option}`, 168);
          doc.text(lines, 19, y);
          y += lines.length * 4.2 + 1;
        });
      }

      if (question.image_url) {
        const image = await fetchImageDataUrl(question.image_url);
        if (image) {
          if (y > 215) {
            doc.addPage();
            y = addPageHeader(doc, paper, true);
          }
          try {
            (doc as any).addImage(image, 'JPEG', 19, y, 82, 54, undefined, 'FAST');
            y += 58;
          } catch {
            // Image data that jsPDF cannot decode is ignored without blocking the paper download.
          }
        }
      }
      y += 4;
      sequence += 1;
    }
  }

  if (includeMarkingScheme) {
    doc.addPage();
    y = addPageHeader(doc, paper);
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
  }

  addFooter(doc, paper);
  const safeName = paper.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'cbc_exam';
  doc.save(`${safeName}.pdf`);
}
