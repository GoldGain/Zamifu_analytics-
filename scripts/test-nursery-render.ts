import { renderExamVisualDataUrl, type GeneratedExamQuestion } from '../src/lib/exam-visuals.ts';

const question = {
  question_type: 'case_study',
  question_text: 'The diagram below shows a structure commonly used in horticultural production.',
  correct_answer: '',
  marking_scheme: '',
  marks: 6,
  difficulty: 'medium',
  visual_spec: {
    asset_type: 'diagram',
    title: 'Raised nursery bed with shade',
    labels: ['Shade', 'Seed drill', 'Nursery bed', 'Watering can'],
    caption: 'A raised nursery bed with a shade made of grass and sticks',
  },
} as GeneratedExamQuestion;

const output = renderExamVisualDataUrl(question);
if (!output || !output.startsWith('data:image/svg+xml')) throw new Error('Nursery diagram was not rendered as an SVG data URL.');
const decoded = decodeURIComponent(output.split(',')[1] || '');
for (const label of ['Shade', 'Seed drill', 'Nursery bed', 'Watering can']) {
  if (!decoded.includes(label)) throw new Error(`Missing nursery diagram label: ${label}`);
}
if (!decoded.includes('M82 83 Q220 34 358 83')) throw new Error('The nursery-bed structure path was not rendered.');
console.log('Nursery renderer regression passed.');
