import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  questionTypeLabel,
  type ExamFormat,
  type ExamPaper,
  type GeneratedExamQuestion,
  type QuestionType,
} from './exam-schema';
import { renderExamVisualDataUrl } from './exam-visuals';
import { getKjseaPaperSpec } from './kjsea-paper-formats';
import {
  candidateCalculationInstruction,
  getQuestionAnswerSpacePlan,
  sanitizeCandidateInstruction,
} from './exam-answer-space';

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
  makeBalancedBlueprint,
  makeFormatBlueprint,
} from './exam-schema';
export type {
  Difficulty,
  ExamFormat,
  ExamGenerationRequest,
  ExamGenerationResponse,
  ExamPaper,
  GeneratedExamQuestion,
  PaperVariant,
  QuestionType,
} from './exam-schema';

export type ExamPdfMode = 'student' | 'marking_scheme' | 'answer_key' | 'combined';

type BrandedPaper = ExamPaper & { school_logo_url?: string | null };

function formatLabel(format: ExamFormat): string {
  if (format === 'standard30') return 'STANDARD CBE ASSESSMENT';
  if (format === 'kpsea') return 'KPSEA-STYLE SCHOOL PRACTICE PAPER';
  if (format === 'kjsea') return 'KJSEA-STYLE SCHOOL PRACTICE PAPER';
  if (format === 'cbe') return 'CBE SCHOOL-BASED ASSESSMENT';
  return 'CUSTOM SCHOOL ASSESSMENT';
}

function internalPaperCode(paper: BrandedPaper): string {
  const subjectCode = paper.subject.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'PAPER';
  return `ZAS-${paper.year}-${subjectCode}-${String(paper.version_number || 1).padStart(2, '0')}`;
}

function officialKjseaPaperCode(paper: BrandedPaper): string | null {
  if (paper.format !== 'kjsea') return null;
  const variant = paperVariant(paper);
  const spec = getKjseaPaperSpec(paper.subject, variant === 'paper1' || variant === 'paper2' ? variant : 'single');
  return spec?.code || null;
}

function gradeLabel(paper: BrandedPaper): string {
  const supplied = String(paper.grade_level || '').trim();
  return /^grade\s+/i.test(supplied) ? supplied : `Grade ${supplied || '—'}`;
}

function isKjseaSocialStudiesPaper(paper: BrandedPaper): boolean {
  return paper.format === 'kjsea' && /social\s+studies/i.test(paper.subject);
}

function paperVariant(paper: BrandedPaper): string {
  return paper.paper_variant || paper.blueprint?.paper_variant || 'single';
}

function isKjseaIntegratedSciencePaper1(paper: BrandedPaper): boolean {
  return paper.format === 'kjsea'
    && /integrated\s+science/i.test(paper.subject)
    && paperVariant(paper) === 'paper1';
}

function isKjseaIntegratedSciencePaper2(paper: BrandedPaper): boolean {
  return paper.format === 'kjsea'
    && /integrated\s+science/i.test(paper.subject)
    && paperVariant(paper) === 'paper2';
}

export type ExamPdfQuestionGroup = {
  type: QuestionType;
  questions: GeneratedExamQuestion[];
  marks: number;
  title?: string;
  sectionTag?: string;
};
type QuestionGroup = ExamPdfQuestionGroup;

function groupedQuestions(paper: BrandedPaper): QuestionGroup[] {
  const ordered = [...paper.questions].sort((a, b) => (a.question_number || 0) - (b.question_number || 0));
  const blueprintSections = paper.format === 'kjsea' ? paper.blueprint?.sections : undefined;
  if (blueprintSections?.length) {
    const groups: QuestionGroup[] = [];
    let cursor = 0;
    for (const section of blueprintSections) {
      const questions = ordered.slice(cursor, cursor + section.count);
      cursor += section.count;
      if (!questions.length) continue;
      const title = section.title?.trim() || questionTypeLabel(section.question_type);
      const sectionTag = title.match(/^(Section\s+[A-Z]|Sehemu\s+[A-Z])\s*[:·]/i)?.[1]
        || title.match(/^(Question\s+\d+)/i)?.[1]
        || `Component ${groups.length + 1}`;
      groups.push({
        type: section.question_type,
        questions,
        marks: questions.reduce((sum, question) => sum + question.marks, 0),
        title,
        sectionTag,
      });
    }
    if (cursor < ordered.length) {
      const remaining = ordered.slice(cursor);
      groups.push({
        type: remaining[0].question_type,
        questions: remaining,
        marks: remaining.reduce((sum, question) => sum + question.marks, 0),
        title: 'Additional questions',
        sectionTag: `Component ${groups.length + 1}`,
      });
    }
    if (isKjseaSocialStudiesPaper(paper) || isKjseaIntegratedSciencePaper1(paper)) {
      const merged: QuestionGroup[] = [];
      for (const group of groups) {
        const previous = merged[merged.length - 1];
        if (previous && previous.sectionTag === group.sectionTag && /^Section\s+[A-Z]$/i.test(group.sectionTag || '')) {
          previous.questions.push(...group.questions);
          previous.marks += group.marks;
        } else {
          const isSectionB = /^Section\s+B$/i.test(group.sectionTag || '');
          merged.push({
            ...group,
            title: isSectionB ? 'Section B: Structured and essay questions' : group.title,
          });
        }
      }
      return merged;
    }
    return groups;
  }
  if (isKjseaIntegratedSciencePaper2(paper)) {
    return ordered.length ? [{ type: 'case_study', questions: ordered, marks: ordered.reduce((sum, question) => sum + question.marks, 0), title: 'Written practical skills', sectionTag: 'Component' }] : [];
  }
  const order = [...new Set(paper.questions.map((question) => question.question_type))];
  return order.map((type) => {
    const questions = paper.questions.filter((question) => question.question_type === type);
    return { type, questions, marks: questions.reduce((sum, question) => sum + question.marks, 0) };
  });
}

export function groupExamQuestionsForPdf(paper: ExamPaper): ExamPdfQuestionGroup[] {
  return groupedQuestions(paper);
}

function sectionDisplayName(paper: BrandedPaper, groupIndex: number, group: QuestionGroup): string {
  if (group.title) return group.title;
  if (isKjseaIntegratedSciencePaper2(paper)) return 'Written practical skills';
  if (isKjseaSocialStudiesPaper(paper) && groupIndex === 1) return 'Structured and essay questions';
  if (isKjseaIntegratedSciencePaper1(paper) && groupIndex === 1) return 'Structured and essay questions';
  return questionTypeLabel(group.type);
}

function isFormalPracticeFormat(paper: BrandedPaper): boolean {
  return paper.format === 'standard30' || paper.format === 'kpsea' || paper.format === 'kjsea';
}

function isObjectiveKpseaPaper(paper: BrandedPaper): boolean {
  return paper.format === 'kpsea'
    && paper.questions.length > 0
    && paper.questions.every((question) => question.question_type === 'multiple_choice' && normalizeOptions(question).length >= 2);
}

export function learnerQuestionText(question: GeneratedExamQuestion): string {
  let text = question.question_text || '';
  const assetType = String((question.visual_spec as { asset_type?: unknown } | null)?.asset_type || '').toLowerCase();
  if (assetType === 'table') {
    text = text.split(/\r?\n/).filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.includes('|') && trimmed.split('|').length >= 3);
    }).join('\n');
  }
  if (assetType === 'diagram' || assetType === 'shape') {
    text = text.replace(/\[\s*(?:diagram|figure|illustration|image|picture)[^\]]*\]/gi, '');
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
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
  const calculationInstruction = candidateCalculationInstruction(paper.subject, paper.questions);
  if (paper.format === 'kjsea') {
    return [
      'Answer all questions in the spaces provided.',
      calculationInstruction,
      'Use the diagrams, tables, maps and other visual stimuli only as directed by each question.',
    ];
  }
  if (paper.format === 'standard30') {
    return [
      'Answer all questions.',
      'Choose one correct answer for each multiple-choice question.',
      calculationInstruction,
    ];
  }
  return [calculationInstruction];
}

export function getPrintedCandidateInstructions(paper: ExamPaper): string[] {
  const brandedPaper = paper as BrandedPaper;
  const baseInstructions = paper.instructions.length
    ? paper.instructions
    : ['Answer all questions.', 'Write your name and class clearly.', 'Read every question carefully before answering.'];
  return [
    ...formatSpecificInstructions(brandedPaper),
    ...baseInstructions.map((instruction) => sanitizeCandidateInstruction(instruction, paper.subject, paper.questions)).filter(Boolean),
  ]
    .filter((instruction, index, all) => all.indexOf(instruction) === index)
    .slice(0, 8);
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(continuation ? `${paper.title} — CONTINUED` : paper.title, 105, 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`${formatLabel(paper.format)}  |  ${paper.subject.toUpperCase()}  |  ${gradeLabel(paper).toUpperCase()}  |  ${paper.term || 'SCHOOL TERM'} ${paper.year}`, 105, 25, { align: 'center' });
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
  if (/^data:image\/(png|jpeg|jpg);/i.test(dataUrl)) {
    return { dataUrl, format: /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG' };
  }
  if (typeof document === 'undefined') throw new Error('Visual PDF rendering is available in the browser only.');
  const image = new Image();
  image.decoding = 'async';
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  // The generated diagrams and maps are SVG. Rasterize them to at least
  // 2400px wide (over 300 DPI across the printable A4 width) while keeping
  // larger source vectors at native resolution. Raster inputs are not
  // upscaled; WebP and SVG are converted to PNG by the canvas below.
  const isSvg = /^data:image\/svg\+xml(?:;|,)/i.test(dataUrl);
  const scale = isSvg ? Math.max(1, 2400 / Math.max(image.width, 1)) : 1;
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
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(14, 21, 196, 21);
  let y = addCandidateTable(doc, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(paper.title, 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.text(formatLabel(paper.format), 105, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${paper.subject.toUpperCase()}  |  ${gradeLabel(paper).toUpperCase()}  |  ${paper.term || 'SCHOOL TERM'} ${paper.year}`, 105, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7.5);
  const officialCode = officialKjseaPaperCode(paper);
  const codeLabel = officialCode
    ? `KJSEA code: ${officialCode}  |  School code: ${internalPaperCode(paper)}`
    : `Internal paper code: ${internalPaperCode(paper)}`;
  doc.text(`${codeLabel}  |  Time: ${paper.duration_minutes} minutes  |  Total: ${paper.total_marks} marks`, 105, y, { align: 'center' });
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
  const instructions = getPrintedCandidateInstructions(paper);
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
  const groups = groupExamQuestionsForPdf(paper);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [[paper.format === 'kjsea' ? 'Section / component' : 'Section', 'Paper section or component', 'Number of questions', 'Maximum score']],
    body: groups.map((group, index) => [
      group.sectionTag || `Section ${String.fromCharCode(65 + index)}`,
      sectionDisplayName(paper, index, group),
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

function addCalculationSpace(
  doc: jsPDF,
  paper: BrandedPaper,
  y: number,
  decision: ReturnType<typeof getQuestionAnswerSpacePlan>['question'],
  subtitle: string,
): number {
  if (!decision.requiresCalculationSpace) return y;
  const lineHeight = 5;
  y = ensureRoom(doc, paper, y, decision.lineCount * lineHeight + 10, subtitle);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(75, 85, 99);
  const graphical = decision.reason === 'graphical-task';
  doc.text(graphical ? 'GRAPHICAL RESPONSE SPACE' : 'CALCULATION STEPS', 19, y);
  y += 3;
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.25);
  if (graphical) {
    const height = Math.max(24, decision.lineCount * 5);
    doc.rect(19, y, 172, height);
    doc.setTextColor(0, 0, 0);
    return y + height + 3;
  }
  doc.setLineDashPattern([1, 1], 0);
  for (let index = 0; index < decision.lineCount; index += 1) {
    doc.line(19, y + index * lineHeight, 191, y + index * lineHeight);
  }
  doc.setLineDashPattern([], 0);
  doc.setTextColor(0, 0, 0);
  return y + decision.lineCount * lineHeight + 3;
}

function ensureRoom(doc: jsPDF, paper: BrandedPaper, y: number, needed: number, subtitle?: string): number {
  if (y + needed <= 272) return y;
  doc.addPage();
  const nextY = addPageHeader(doc, paper, true, subtitle);
  return nextY;
}

export function resolveQuestionVisualForPdf(question: GeneratedExamQuestion): string | null {
  if (question.visual_spec) {
    // The structured specification is canonical. Regenerate it with the
    // current renderer so saved papers cannot retain an older placeholder SVG.
    const refreshedVisual = renderExamVisualDataUrl({ ...question, image_url: null });
    if (refreshedVisual) return refreshedVisual;

    const assetType = String((question.visual_spec as { asset_type?: unknown }).asset_type || '').toLowerCase();
    if (['map', 'diagram', 'shape', 'table', 'graph', 'chart', 'number_line', 'flowchart'].includes(assetType)) {
      return null;
    }
  }
  return question.image_url || null;
}

async function addQuestionVisual(doc: jsPDF, paper: BrandedPaper, question: GeneratedExamQuestion, y: number, subtitle?: string): Promise<number> {
  const source = resolveQuestionVisualForPdf(question);
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

function addStructuredSubParts(
  doc: jsPDF,
  paper: BrandedPaper,
  question: GeneratedExamQuestion,
  y: number,
  textWidth: number,
  subtitle: string,
  spacePlan: ReturnType<typeof getQuestionAnswerSpacePlan>,
): number {
  if (!question.sub_parts?.length) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(paper.format === 'kjsea' ? 8.2 : 8.8);
  for (const [partIndex, part] of question.sub_parts.entries()) {
    const marks = ` [${part.marks} mark${part.marks === 1 ? '' : 's'}]`;
    const lines = doc.splitTextToSize(`${part.label} ${part.prompt}${paper.format === 'standard30' || paper.format === 'kjsea' ? marks : ''}`, textWidth);
    y = ensureRoom(doc, paper, y, lines.length * 4.2 + 4, subtitle);
    doc.text(lines, 19, y);
    y += lines.length * 4.2 + 2;
    const decision = spacePlan.subParts[partIndex];
    if (decision?.requiresCalculationSpace) y = addCalculationSpace(doc, paper, y, decision, subtitle);
  }
  return y;
}

function markingGuidance(question: GeneratedExamQuestion): string {
  if (!question.sub_parts?.length) return question.marking_scheme || question.correct_answer || 'Teacher to assess according to the stated learning outcome.';
  return question.sub_parts.map((part) => `${part.label} ${part.marking_scheme || part.correct_answer || 'Award for a correct response.'} [${part.marks} mark${part.marks === 1 ? '' : 's'}]`).join('\n');
}

async function renderStudentPaper(doc: jsPDF, paper: BrandedPaper): Promise<void> {
  addFormalCoverPage(doc, paper, 'STUDENT PAPER');
  doc.addPage();
  let y = addPageHeader(doc, paper, false, 'STUDENT PAPER');
  const formal = isFormalPracticeFormat(paper);
  const groups = groupExamQuestionsForPdf(paper);
  let sequence = 1;
  for (const [groupIndex, group] of groups.entries()) {
    y = ensureRoom(doc, paper, y, 18, 'STUDENT PAPER');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(formal ? 8.5 : 9);
    doc.setTextColor(formal ? 17 : 153, formal ? 24 : 27, formal ? 39 : 27);
    const sectionHeading = paper.format === 'kjsea'
      ? `${sectionDisplayName(paper, groupIndex, group).toUpperCase()} (${group.marks} MARK${group.marks === 1 ? '' : 'S'})`
      : `SECTION ${String.fromCharCode(65 + groupIndex)}: ${sectionDisplayName(paper, groupIndex, group).toUpperCase()} (${group.marks} MARK${group.marks === 1 ? '' : 'S'})`;
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
      const textWidth = 176;
      const spacePlan = getQuestionAnswerSpacePlan(paper.subject, question);
      const showMarks = !formal || paper.format === 'kjsea' || paper.format === 'standard30';
      const markText = ` [${question.marks} mark${question.marks === 1 ? '' : 's'}]`;
      const stem = doc.splitTextToSize(`${sequence}. ${learnerQuestionText(question)}${showMarks ? markText : ''}`, textWidth);
      y = ensureRoom(doc, paper, y, stem.length * 4.6 + 10, 'STUDENT PAPER');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(formal ? 8.5 : 9.5);
      doc.text(stem, 14, y);
      doc.setFont('helvetica', 'normal');
      y += stem.length * 4.6 + 2;
      y = addStructuredSubParts(doc, paper, question, y, textWidth, 'STUDENT PAPER', spacePlan);
      const options = normalizeOptions(question);
      if (options.length) {
        options.forEach((option, optionIndex) => {
          const lines = doc.splitTextToSize(`${String.fromCharCode(65 + optionIndex)}. ${option}`, 168);
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
      if (!question.sub_parts?.length) y = addCalculationSpace(doc, paper, y + 2, spacePlan.question, 'STUDENT PAPER');
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
  const groups = groupExamQuestionsForPdf(paper);
  const rows: string[][] = [];
  let sequence = 1;
  groups.forEach((group, groupIndex) => {
    group.questions.forEach((question) => {
      rows.push([
        group.title || group.sectionTag || `Section ${String.fromCharCode(65 + groupIndex)}`,
        String(sequence),
        questionTypeLabel(question.question_type),
        markingGuidance(question),
        String(question.marks),
      ]);
      sequence += 1;
    });
  });
  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Section / component', 'No.', 'Question type', 'Expected answer / marking guidance', 'Marks']],
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
