import { renderExamVisualDataUrl } from '../src/lib/exam-visuals.ts';

const url = renderExamVisualDataUrl({
  question_type: 'multiple_choice',
  question_text: 'Inspect the schedule.',
  marks: 1,
  options: ['A', 'B'],
  visual_spec: {
    asset_type: 'table',
    title: 'Upendo Community Library Weekly Reading Club Schedule',
    labels: ['Day', 'Time', 'Activity'],
    x_labels: [
      'Monday, 9:00-10:00, Grade 6, Reading Club',
      'Tuesday, 10:00-11:00, Grade 7, Story Time',
      'Wednesday, 11:00-12:00, Grade 8, Book Talk',
    ],
    caption: 'Library schedule for learners',
  },
});

if (!url) throw new Error('Expected a rendered table visual data URL.');
const svg = decodeURIComponent(url.split(',')[1] || '');
for (const required of ['table-header', 'table-cell', 'Upendo Community Library Weekly', 'Reading Club', 'Story Time']) {
  if (!svg.includes(required)) throw new Error(`Missing expected rendered content: ${required}`);
}
const titleLines = svg.match(/class="title"/g) || [];
if (titleLines.length < 2) throw new Error('Expected the long table title to wrap across multiple SVG text nodes.');
if (!svg.includes('Club Schedule')) throw new Error('Wrapped title ending is missing.');
console.log(`table-render regression passed (${svg.length} SVG chars, ${titleLines.length} title lines)`);
