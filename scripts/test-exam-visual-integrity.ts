import assert from 'node:assert/strict';
import { renderExamVisualDataUrl, hasUsableVisualSpec } from '../src/lib/exam-visuals.js';
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
assert.equal(hasUsableVisualSpec({ ...mapQuestion, image_url: rendered }), true, 'complete map metadata must pass visual validation');

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
  true,
  'a Social Studies paper without any map must still fail the minimum-map requirement',
);

const request: ExamGenerationRequest = {
  title: 'Visual repair test', gradeLevel: 'Grade 9', subject: 'Social Studies',
  strands: [], subStrands: [], topics: [], curriculumScope: [], questionTypes: ['short_answer'],
  totalMarks: 1, durationMinutes: 30, difficulty: 'medium', includeImages: true,
  includeMarkingScheme: true, format: 'custom', term: 'Term 1', blueprint: undefined,
};

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

console.log('visual-integrity regression passed (vector map + one-map Social Studies minimum + backoff retry + failed-visual replacement/drop semantics)');
