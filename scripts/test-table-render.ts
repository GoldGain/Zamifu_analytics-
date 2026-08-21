import assert from 'node:assert/strict';
import { renderExamVisualDataUrl } from '../src/lib/exam-visuals.ts';
import type { GeneratedExamQuestion } from '../src/lib/exam-schema.ts';

const question: GeneratedExamQuestion = {
  question_type: 'case_study',
  question_text: 'The table below shows the daily changes in stock over five days.',
  correct_answer: 'See marking scheme.',
  marking_scheme: 'Award marks for correct calculations.',
  marks: 6,
  difficulty: 'medium',
  visual_spec: {
    title: 'Daily stock changes for a shopkeeper',
    labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    prompt: "A table with two rows. The first row is labelled 'Day' and contains Monday, Tuesday, Wednesday, Thursday, Friday. The second row is labelled 'Change in stock' and contains +12, -5, +8, -15, +6.",
    caption: 'Table 1: Daily stock change over five days',
    x_labels: ['Day', 'Change in stock'],
    asset_type: 'table',
  },
};

const dataUrl = renderExamVisualDataUrl(question);
assert.ok(dataUrl?.startsWith('data:image/svg+xml'), 'table renderer should return an SVG data URL');
const svg = decodeURIComponent(dataUrl!.split(',', 2)[1] || '');
for (const value of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', '+12', '-5', '+8', '-15', '+6']) {
  assert.ok(svg.includes(value), `table SVG should contain ${value}`);
}
assert.ok(!svg.includes('>—</text>'), 'table SVG should not replace the generated values with dash placeholders');
console.log('PASS: row-oriented table visuals preserve all labels and signed values.');
