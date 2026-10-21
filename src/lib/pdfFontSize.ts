import type { jsPDF } from 'jspdf';

export const PDF_FONT_SIZE_OPTIONS = [10, 12, 14, 16] as const;
export type PdfFontSize = (typeof PDF_FONT_SIZE_OPTIONS)[number];

export const DEFAULT_PDF_FONT_SIZE: PdfFontSize = 14;

// Report-card layouts use compact base sizes; these explicit steps make the
// Small and Large choices perceptible in the generated print/PDF output.
const PDF_FONT_SCALE: Record<PdfFontSize, number> = {
  10: 0.72,
  12: 0.88,
  14: 1,
  16: 1.3,
};

const PDF_FONT_SCALE_KEY = '__zamifuPdfFontScale' as const;
type FontAwarePdfDocument = jsPDF & {
  [PDF_FONT_SCALE_KEY]?: number;
};

export function normalizePdfFontSize(value: number | undefined | null): PdfFontSize {
  if (value === 10 || value === 12 || value === 16) return value;
  return DEFAULT_PDF_FONT_SIZE;
}

/**
 * Stores the user's requested size on the document. Existing report layouts use
 * a range of carefully tuned font sizes, so the selected value is applied as a
 * proportional scale relative to the default 14pt option.
 */
export function configurePdfFontSize(
  doc: jsPDF,
  fontSize: number | undefined | null = DEFAULT_PDF_FONT_SIZE,
): PdfFontSize {
  const normalized = normalizePdfFontSize(fontSize);
  (doc as FontAwarePdfDocument)[PDF_FONT_SCALE_KEY] = PDF_FONT_SCALE[normalized];
  return normalized;
}

export function pdfFontSize(doc: jsPDF, baseSize: number): number {
  const scale = (doc as FontAwarePdfDocument)[PDF_FONT_SCALE_KEY] || 1;
  return Number((baseSize * scale).toFixed(2));
}
