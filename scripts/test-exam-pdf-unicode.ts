import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { jsPDF } from 'jspdf';
import { registerUnicodeExamFonts } from '../src/lib/exam-pdf-fonts.js';

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input) => {
  const url = new URL(String(input));
  assert.equal(url.protocol, 'file:');
  return new Response(fs.readFileSync(fileURLToPath(url)));
}) as typeof fetch;
try {
  const doc = new jsPDF({ putOnlyUsedFonts: true, compress: true });
  await registerUnicodeExamFonts(doc);
  doc.text('Mathematics: π ≤ ≥ θ √ × ÷', 14, 24);
  doc.setFont('helvetica', 'bold');
  doc.text('Science: α β Δ Ω µ', 14, 34);
  doc.setFont('helvetica', 'normal');
  doc.text('French: école; German: Größe.', 14, 44);
  const text = execFileSync('pdftotext', ['-', '-'], { input: Buffer.from(doc.output('arraybuffer')), encoding: 'utf8' });
  for (const glyph of ['π', '≤', '≥', 'θ', '√', '×', '÷', 'α', 'β', 'Δ', 'Ω', 'µ', 'é', 'ö', 'ß']) assert.ok(text.includes(glyph), `PDF lost ${glyph}`);
  console.log('PASS: Unicode mathematics, science and language glyphs survive actual embedded PDF output.');
} finally {
  globalThis.fetch = originalFetch;
}
