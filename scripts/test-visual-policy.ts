import { filterUnnecessaryExamVisual, hasUsableVisualSpec, renderExamVisualDataUrl, shouldKeepExamVisual, type ExamVisualSpec } from '../src/lib/exam-visuals.ts';
import type { GeneratedExamQuestion } from '../src/lib/exam-schema.ts';

function question(questionText: string, visualSpec: ExamVisualSpec): GeneratedExamQuestion {
  return {
    question_type: 'short_answer',
    question_text: questionText,
    options: [],
    correct_answer: 'Teacher to assess.',
    marking_scheme: 'Award the stated marks.',
    marks: 2,
    difficulty: 'medium',
    strand: 'Test strand',
    sub_strand: 'Test sub-strand',
    topic: 'Test topic',
    learning_outcome: '',
    competency: '',
    cognitive_level: 'understand',
    image_url: null,
    source_website: null,
    visual_spec: visualSpec,
  };
}

const generic = question('Name three horticultural crops grown for their leaves in Kenya.', {
  asset_type: 'diagram',
});
if (shouldKeepExamVisual(generic)) throw new Error('Generic recall question was incorrectly kept as visual.');
if (filterUnnecessaryExamVisual(generic).visual_spec !== null) throw new Error('Generic visual spec was not suppressed.');

const explicitDiagram = question('Study the diagram below and identify the labelled parts.', {
  asset_type: 'diagram',
  title: 'A nursery bed',
  prompt: 'Study the diagram below showing the nursery bed.',
  labels: ['Shade cover', 'Seedlings', 'Soil'],
});
if (!shouldKeepExamVisual(explicitDiagram)) throw new Error('Explicit diagram question was suppressed.');
if (filterUnnecessaryExamVisual(explicitDiagram).visual_spec === null) throw new Error('Explicit diagram spec was removed.');
if (!hasUsableVisualSpec(explicitDiagram)) throw new Error('A labelled explicit diagram was incorrectly rejected.');
const renderedDiagram = renderExamVisualDataUrl(explicitDiagram);
const renderedSvg = renderedDiagram ? decodeURIComponent(renderedDiagram.split(',', 2)[1] || '') : '';
if (!renderedSvg.includes('Shade cover') || !renderedSvg.includes('Seedlings')) throw new Error('Rendered diagram omitted required labels.');

const weakDiagram = question('Study the diagram below and identify the labelled parts.', {
  asset_type: 'diagram',
  title: 'Unspecified apparatus',
  prompt: 'Study the diagram below.',
  labels: [],
});
if (hasUsableVisualSpec(weakDiagram)) throw new Error('A diagram without structured labels was incorrectly accepted.');

const explicitMap = question('Use the map below to identify the countries bordering Lake Victoria.', {
  asset_type: 'map',
  title: 'East Africa and Lake Victoria',
  base_map: 'east_africa',
  caption: 'Country boundaries and a labelled reference lake.',
  map_regions: ['Lake Victoria', 'Kenya', 'Uganda', 'Tanzania'],
  legend: ['Hatch: named focus country', 'Line: country boundary'],
  scale_text: '≈ 500 km (indicative)',
  compass: 'North',
});
if (!shouldKeepExamVisual(explicitMap)) throw new Error('Explicit map question was suppressed.');
if (!hasUsableVisualSpec(explicitMap)) throw new Error('A map with named regions was incorrectly rejected.');
const fakeCountyMap=question('Identify County A on the county map.',{...explicitMap.visual_spec!,title:'County map',map_regions:['County A','County B']});
if(hasUsableVisualSpec(fakeCountyMap)||renderExamVisualDataUrl(fakeCountyMap))throw new Error('Country geometry must never be used to invent county maps.');

console.log('Visual policy regression checks passed.');
