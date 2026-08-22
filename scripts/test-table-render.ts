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

const structuredTableQuestion: GeneratedExamQuestion = {
  ...question,
  question_text: 'Use the table below to answer the question. How many pupils read 3 books?',
  visual_spec: {
    title: 'Books read by pupils',
    prompt: 'Study the table.',
    caption: 'Number of books read by pupils',
    labels: ['Number of books', 'Number of pupils'],
    x_labels: ['1', '2', '3', '4'],
    table_headers: ['Number of books', 'Number of pupils'],
    table_rows: [['1', 4], ['2', 6], ['3', 5], ['4', 3]],
    asset_type: 'table',
  },
};
const structuredSvg = decodeURIComponent(renderExamVisualDataUrl(structuredTableQuestion)!.split(',', 2)[1] || '');
for (const value of ['1', '4', '2', '6', '3', '5', '4', '3']) {
  assert.ok(structuredSvg.includes(`>${value}</text>`), `structured table SVG should contain ${value}`);
}
assert.ok(!structuredSvg.includes('>—</text>'), 'structured table SVG should not replace complete rows with dash placeholders');
console.log('PASS: structured table visuals preserve all numeric rows.');

const multiTableQuestion: GeneratedExamQuestion = {
  ...question,
  question_text: `Study the tables below.\n\n| Symbol | Meaning |\n|--------|---------|\n| A | Wear safety goggles |\n| B | Flammable material |\n| C | Toxic substance |\n| D | Corrosive substance |\n\nThe results are shown below.\n\n| Temperature (°C) | Time (seconds) |\n|------------------|----------------|\n| 20 | 120 |\n| 40 | 60 |\n| 60 | 30 |\n| 80 | 15 |`,
  visual_spec: {
    title: 'Safety symbols and dissolving data',
    caption: 'Two complete data tables',
    table_headers: ['Symbol', 'Meaning'],
    table_rows: [['A', 'Wear safety goggles'], ['B', 'Flammable material'], ['C', 'Toxic substance'], ['D', 'Corrosive substance']],
    asset_type: 'table',
  },
};
const multiTableSvg = decodeURIComponent(renderExamVisualDataUrl(multiTableQuestion)!.split(',', 2)[1] || '');
for (const value of ['Temperature (°C)', 'Time (seconds)', '20', '120', '40', '60', '60', '30', '80', '15']) {
  assert.ok(multiTableSvg.includes(value), `multi-table SVG should contain ${value}`);
}
console.log('PASS: structured and Markdown tables compose without dropping source values.');

const measuringCylinderQuestion: GeneratedExamQuestion = {
  ...question,
  question_text: 'The diagrams below show the water level before and after the stone is placed in a measuring cylinder.',
  visual_spec: {
    title: 'Measuring Cylinder Diagrams',
    labels: ['Initial volume: 40 mL', 'Final volume: 65 mL'],
    caption: 'Read the bottom of the meniscus at eye level.',
    asset_type: 'diagram',
  },
};
const cylinderSvg = decodeURIComponent(renderExamVisualDataUrl(measuringCylinderQuestion)!.split(',', 2)[1] || '');
for (const value of ['40 mL', '65 mL', 'stone', 'Read the bottom of the meniscus']) {
  assert.ok(cylinderSvg.includes(value), `measuring-cylinder SVG should contain ${value}`);
}
assert.ok(!cylinderSvg.includes('M90 245'), 'measuring-cylinder SVG should not use the generic shape placeholder');
console.log('PASS: measuring-cylinder visuals preserve volume readings, graduations, and the stone.');
