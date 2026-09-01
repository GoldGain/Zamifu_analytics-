import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { drawTrendGraph } from '../src/lib/reportCardPdf.ts';

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const endY = drawTrendGraph(
  doc,
  [
    { term: 'End-Term · Term 1 2026', avg: 65 },
    { term: 'Mid-Term · Term 2 2026', avg: 85 },
  ],
  14,
  260,
  182,
  34,
  'primary',
);

assert.equal(doc.getNumberOfPages(), 1, 'trend graph must remain on the report-card page');
assert.ok(endY <= doc.internal.pageSize.getHeight() - 8, 'trend graph must stay above the footer safe area');
console.log('Report-card one-page layout invariants passed.');
