import assert from 'node:assert/strict';
import { renderExamVisualDataUrl, hasUsableVisualSpec, isSupportedExamMapSpec, withRenderedExamVisual } from '../src/lib/exam-visuals.js';
import { curatedVisualDataUrl } from '../src/lib/exam-visual-library.js';
import { resolveQuestionVisualForPdf } from '../src/lib/exam-generator.js';
import { repairGeneratedExam } from '../src/lib/exam-repair.js';
import { validateGeneratedExam } from '../src/lib/exam-validation.js';
import type { ExamGenerationRequest, GeneratedExamQuestion } from '../src/lib/exam-schema.js';
import { inferExamMapBase } from '../src/lib/exam-map-data.js';

assert.equal(inferExamMapBase('Map of Africa showing Kenya and Nigeria'), 'africa');
assert.equal(inferExamMapBase('Kenya counties and physical features'), 'kenya');
assert.equal(inferExamMapBase('East Africa and the Great Lakes'), 'east_africa');

const baseQuestion = (patch: Partial<GeneratedExamQuestion> = {}): GeneratedExamQuestion => ({
  question_number: 1,
  question_type: 'short_answer',
  question_text: 'Study the map and name two countries shown.',
  options: [],
  correct_answer: 'Kenya and Uganda.',
  marking_scheme: 'Award one mark for each correct country.',
  marks: 1,
  difficulty: 'medium',
  strand: '',
  sub_strand: '',
  topic: '',
  image_url: null,
  visual_spec: null,
  ...patch,
});

const mapQuestion = baseQuestion({
  visual_spec: {
    asset_type: 'map',
    title: 'East Africa map',
    base_map: 'east_africa',
    map_regions: ['Kenya', 'Uganda', 'Tanzania'],
    legend: ['Dark fill: named focus region', 'Line: country boundary'],
    scale_text: '≈ 500 km',
    compass: 'North',
  },
});

const rendered = renderExamVisualDataUrl(mapQuestion);
assert.ok(rendered?.startsWith('data:image/svg+xml;charset=utf-8,'), 'map must render as an SVG data URL');
const svg = decodeURIComponent(rendered!.split(',', 2)[1]);
for (const required of ['East Africa map', 'KEY', 'Line:', 'boundary', '500 km', 'North']) {
  assert.ok(svg.includes(required), `rendered map is missing ${required}`);
}
assert.ok(!svg.toLowerCase().includes('schematic'), 'map SVG must not be described as schematic');
assert.ok(svg.includes('map-focus-hatch'), 'focus regions must remain distinguishable in grayscale print');
assert.ok(isSupportedExamMapSpec(mapQuestion), 'country-level vector map should be recognised as supported');
assert.ok(/indicative|≈|approx/i.test(mapQuestion.visual_spec?.scale_text || ''), 'map scale must be explicitly approximate or indicative');
let boundedMapLabels = 0;
for (const match of svg.matchAll(/<text(?=[^>]*class="map-label")(?=[^>]*x="([0-9.]+)")(?=[^>]*y="([0-9.]+)")[^>]*>/g)) {
  boundedMapLabels += 1;
  const x = Number(match[1]);
  const y = Number(match[2]);
  assert.ok(x >= 33 && x <= 339, `map label x=${x} must stay inside the map frame`);
  assert.ok(y >= 55 && y <= 245, `map label y=${y} must stay inside the map frame`);
}
assert.ok(boundedMapLabels >= 1, 'map regression must inspect at least one positioned map label');
assert.equal(curatedVisualDataUrl('map_kenya'), null, 'legacy schematic map keys must not emit invented geometry');
assert.equal(hasUsableVisualSpec({ ...mapQuestion, image_url: rendered }), true, 'complete map metadata must pass visual validation');
assert.equal(
  resolveQuestionVisualForPdf({ ...mapQuestion, image_url: 'data:image/svg+xml;charset=utf-8,stale-placeholder' }),
  rendered,
  'PDF export must regenerate a map from its structured spec instead of trusting a stale cached SVG',
);

const unsupportedCountyMap = baseQuestion({
  question_text: 'Study the Kenya county map below and identify Kisumu County.',
  visual_spec: {
    asset_type: 'map', title: 'Kenya county map', base_map: 'kenya',
    map_regions: ['Lake Victoria', 'Kisumu County'], legend: ['Hatched fill', 'Line: boundary'],
    scale_text: '≈ 200 km (indicative)', compass: 'North',
  },
});
assert.equal(isSupportedExamMapSpec(unsupportedCountyMap), false, 'country geometry must not be presented as county geometry');
assert.equal(hasUsableVisualSpec(unsupportedCountyMap), false, 'unsupported county map must be sent to core visual repair');
assert.equal(renderExamVisualDataUrl(unsupportedCountyMap), null, 'unsupported county map must not receive a guessed marker');

const unsupportedTopoMap = baseQuestion({
  question_text: 'Study the topographic map with contour lines below.',
  visual_spec: {
    asset_type: 'map', title: 'Topographic map', base_map: 'kenya',
    map_regions: ['Kenya', 'Uganda'], legend: ['Hatched fill', 'Line: boundary'],
    scale_text: '≈ 200 km (indicative)', compass: 'North',
  },
});
assert.equal(renderExamVisualDataUrl(unsupportedTopoMap), null, 'topographic claims must not use country-only geometry');

const scienceDiagramCases: Array<{ name: string; question: GeneratedExamQuestion }> = [
  {
    name: 'atom',
    question: baseQuestion({
      question_text: 'Study the diagram below showing the structure of an atom of element Z.',
      visual_spec: { asset_type: 'diagram', title: 'Structure of an atom of element Z', labels: ['X = nucleus', 'Y = electron'], prompt: 'Show a nucleus and orbiting electrons.' },
    }),
  },
  {
    name: 'digestive system',
    question: baseQuestion({
      question_text: 'Study the diagram below showing a section of the human digestive system.',
      visual_spec: { asset_type: 'diagram', title: 'Human digestive system', labels: ['P = stomach', 'Q = small intestine'], prompt: 'Show labelled organs.' },
    }),
  },
  {
    name: 'flower',
    question: baseQuestion({
      question_text: 'Study the diagram below showing a longitudinal section of a flower.',
      visual_spec: { asset_type: 'diagram', title: 'Longitudinal section of a flower', labels: ['A = anther', 'B = stigma'], prompt: 'Show labelled reproductive parts.' },
    }),
  },
  {
    name: 'concave mirror',
    question: baseQuestion({
      question_text: 'Study the diagram below showing a concave mirror with an object beyond the centre of curvature.',
      visual_spec: { asset_type: 'diagram', title: 'Concave mirror ray diagram', labels: ['C = centre of curvature', 'F = principal focus', 'Object beyond C'], prompt: 'Show principal focus, centre, object and image.' },
    }),
  },
];
for (const { name, question } of scienceDiagramCases) {
  const image = renderExamVisualDataUrl(question);
  assert.ok(image?.startsWith('data:image/svg+xml;charset=utf-8,'), `${name} must render as deterministic SVG`);
  const diagramSvg = decodeURIComponent(image!.split(',', 2)[1]);
  assert.ok(!diagramSvg.includes('SCHEMATIC VISUAL'), `${name} must not use the generic placeholder`);
  if (name === 'atom') assert.ok(diagramSvg.includes('particle counts are not shown'), 'atom diagram must not imply a particular element or particle count');
  assert.equal(hasUsableVisualSpec(question), true, `${name} must pass visual validation when its renderer is supported`);
  const refreshed = withRenderedExamVisual({ ...question, image_url: 'data:image/svg+xml;charset=utf-8,stale-generic-placeholder' });
  assert.equal(refreshed.image_url, image, `${name} must replace a stale placeholder with the deterministic renderer output`);
  assert.equal(
    resolveQuestionVisualForPdf({ ...question, image_url: 'data:image/svg+xml;charset=utf-8,stale-generic-placeholder' }),
    image,
    `${name} PDF output must prefer the current deterministic renderer over a stale placeholder`,
  );
}

const unsupportedDiagram = baseQuestion({
  question_text: 'Study the diagram of a fictional apparatus below.',
  visual_spec: { asset_type: 'diagram', title: 'Uncatalogued apparatus', labels: ['P = inlet', 'Q = outlet'], prompt: 'Show an apparatus.' },
});
assert.equal(hasUsableVisualSpec(unsupportedDiagram), false, 'an unrecognized generic diagram must not pass visual validation');
assert.equal(renderExamVisualDataUrl(unsupportedDiagram), null, 'unsupported diagrams must not render a fake labeled-box image');
assert.equal(
  withRenderedExamVisual({ ...unsupportedDiagram, image_url: 'data:image/svg+xml;charset=utf-8,stale-generic-placeholder' }).image_url,
  null,
  'unsupported diagram normalization must clear stale generic imagery',
);
assert.equal(
  resolveQuestionVisualForPdf({ ...unsupportedDiagram, image_url: 'data:image/svg+xml;charset=utf-8,stale-generic-placeholder' }),
  null,
  'PDF export must not print a stale placeholder for an unsupported structured diagram',
);

const socialMapRequest: ExamGenerationRequest = {
  title: 'Social Studies map minimum test', gradeLevel: 'Grade 9', subject: 'Social Studies',
  strands: [], subStrands: [], topics: [], curriculumScope: [], questionTypes: ['case_study'],
  totalMarks: 1, durationMinutes: 90, difficulty: 'medium', includeImages: true,
  includeMarkingScheme: true, format: 'kjsea', term: 'Term 1', blueprint: undefined,
};
const oneMapValidation = validateGeneratedExam(socialMapRequest, [{ ...mapQuestion, image_url: rendered }]);
assert.equal(
  oneMapValidation.issues.some((issue) => issue.code === 'SOCIAL_STUDIES_MAP_REQUIREMENT'),
  false,
  'one complete vector map satisfies the Social Studies minimum; do not require three maps or fixed Q21–Q23 placement',
);
const noMapValidation = validateGeneratedExam(socialMapRequest, [baseQuestion()]);
assert.equal(
  noMapValidation.issues.some((issue) => issue.code === 'SOCIAL_STUDIES_MAP_REQUIREMENT'),
  false,
  'a Social Studies paper without a selected map/topography scope does not require an unrequested map',
);

const request: ExamGenerationRequest = {
  title: 'Visual repair test', gradeLevel: 'Grade 9', subject: 'Social Studies',
  strands: [], subStrands: [], topics: [], curriculumScope: [], questionTypes: ['short_answer'],
  totalMarks: 1, durationMinutes: 30, difficulty: 'medium', includeImages: true,
  includeMarkingScheme: true, format: 'custom', term: 'Term 1', blueprint: undefined,
};

const noImageRequest = { ...request, includeImages: false };
const danglingReference = baseQuestion({ question_text: 'Study the diagram below and name the labelled part.' });
const danglingValidation = validateGeneratedExam(noImageRequest, [danglingReference]);
assert.ok(
  danglingValidation.issues.some((issue) => issue.code === 'VISUAL_REFERENCE_MISSING'),
  'an explicit diagram reference without a visual specification must fail validation',
);
let danglingVisualRetries = 0;
const replacedDanglingReference = await repairGeneratedExam(noImageRequest, [danglingReference], {
  rewriteVisual: async () => { danglingVisualRetries += 1; return null; },
  rewriteQuestion: async () => baseQuestion({
    question_text: 'Name one function of the nucleus.',
    correct_answer: 'It controls the activities of the cell.',
    marking_scheme: 'Award one mark for controlling cell activities.',
  }),
});
assert.equal(danglingVisualRetries, 2, 'a missing reference must use the bounded visual retry flow');
assert.equal(replacedDanglingReference.questions.length, 1, 'a broken visual reference should survive only as a non-visual replacement');
assert.equal(replacedDanglingReference.questions[0].visual_spec, null, 'replacement question must not rely on a missing visual');

const unusable = baseQuestion({
  visual_spec: { asset_type: 'map', title: 'Broken map', map_regions: ['Kenya'] },
});
const dropped = await repairGeneratedExam(request, [unusable], {
  rewriteVisual: async () => null,
  rewriteQuestion: async () => null,
});
assert.equal(dropped.questions.length, 0, 'an unrecoverable required visual must drop its question');
assert.ok(dropped.actions.some((action) => action.kind === 'question_dropped'), 'drop must be recorded as a question drop');
assert.equal(dropped.actions.some((action) => action.kind === 'visual_dropped'), false, 'failed visual must not be silently stripped from a kept question');

let visualAttempts = 0;
const retryStartedAt = Date.now();
const retriedVisual = await repairGeneratedExam(request, [unusable], {
  rewriteVisual: async ({ question }) => {
    visualAttempts += 1;
    if (visualAttempts === 1) return null;
    const repaired = { ...question, visual_spec: mapQuestion.visual_spec };
    return { ...repaired, image_url: renderExamVisualDataUrl(repaired) };
  },
  rewriteQuestion: async () => null,
});
assert.equal(visualAttempts, 2, 'a failed visual attempt must be retried');
assert.ok(Date.now() - retryStartedAt >= 450, 'visual retry must use a backoff delay');
assert.equal(retriedVisual.questions.length, 1, 'a valid second visual attempt must keep the question');

const replacement = await repairGeneratedExam(request, [unusable], {
  rewriteVisual: async () => null,
  rewriteQuestion: async () => baseQuestion({
    question_text: 'Name one neighbouring country of Kenya.',
    correct_answer: 'Uganda.',
    marking_scheme: 'Award one mark for Uganda.',
  }),
});
assert.equal(replacement.questions.length, 1, 'a successful non-visual replacement must survive');
assert.equal(replacement.questions[0].visual_spec, null, 'replacement must not require a visual');
assert.ok(replacement.actions.some((action) => action.kind === 'question_rewritten'), 'replacement must be recorded');

console.log('visual-integrity regression passed (vector map + Science diagram templates + unsupported-placeholder rejection + one-map Social Studies minimum + backoff retry + failed-visual replacement/drop semantics)');
