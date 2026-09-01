import assert from 'node:assert/strict';
import { buildPerformanceTrend } from '../src/lib/reportCardPdf.ts';

const trend = buildPerformanceTrend([
  { term_id: 'term-2', exam_id: 'exam-2', percentage: 80, terms: { name: 'Term 2', academic_year: 2026 }, school_exams: { name: 'Mid-Term' } },
  { term_id: 'term-1', exam_id: 'exam-1', marks: 60, out_of: 100, terms: { name: 'Term 1', academic_year: 2026 }, school_exams: { name: 'End-Term' } },
  { term_id: 'term-1', exam_id: 'exam-1', marks: 70, out_of: 100, terms: { name: 'Term 1', academic_year: 2026 }, school_exams: { name: 'End-Term' } },
  { term_id: 'term-2', exam_id: 'exam-2', percentage: 90, terms: { name: 'Term 2', academic_year: 2026 }, school_exams: { name: 'Mid-Term' } },
  { term_id: 'term-2', percentage: 75, terms: { name: 'Term 2', academic_year: 2026 } },
]);

assert.deepEqual(trend, [
  { term: 'End-Term · Term 1 2026', avg: 65 },
  { term: 'Mid-Term · Term 2 2026', avg: 85 },
  { term: 'Term 2 2026', avg: 75 },
]);
console.log('Report-card trend invariants passed.');
