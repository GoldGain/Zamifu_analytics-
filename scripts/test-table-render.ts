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

const markdownTableQuestion: GeneratedExamQuestion = {
  ...question,
  question_text: `The table below shows books read in a week.\n\n| Day | Books Read |\n|-----|------------|\n| Mon | 4 |\n| Tue | 6 |\n| Wed | 5 |\n| Thu | 3 |\n| Fri | 7 |\n\nWhat is the total number of books read?`,
  visual_spec: {
    title: 'Books Read in a Week',
    labels: ['Day', 'Books Read'],
    prompt: 'The table shows books read by pupils from Monday to Friday.',
    caption: 'Books read by pupils in a week',
    x_labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    asset_type: 'table',
  },
};
const markdownSvg = decodeURIComponent(renderExamVisualDataUrl(markdownTableQuestion)!.split(',', 2)[1] || '');
for (const value of ['Mon', '4', 'Tue', '6', 'Wed', '5', 'Thu', '3', 'Fri', '7']) {
  assert.ok(markdownSvg.includes(`>${value}</text>`), `markdown table SVG should contain ${value}`);
}
assert.ok(!markdownSvg.includes('>—</text>'), 'markdown table SVG should not replace source values with dash placeholders');
console.log('PASS: markdown table visuals preserve source cell values.');
