import assert from 'node:assert/strict';
import { hasUsableVisualSpec, renderExamVisualDataUrl } from '../src/lib/exam-visuals.js';
import type { GeneratedExamQuestion } from '../src/lib/exam-schema.js';

const question = (question_text: string, visual_spec: Record<string, unknown>): GeneratedExamQuestion => ({
  question_number: 1,
  question_type: 'multiple_choice',
  question_text,
  options: [],
  correct_answer: '',
  marking_scheme: '',
  marks: 1,
  difficulty: 'medium',
  strand: 'Measurements and Geometry',
  sub_strand: 'Geometry',
  topic: 'Shapes',
  image_url: null,
  visual_spec,
});

const svgOf = (candidate: GeneratedExamQuestion): string => {
  const url = renderExamVisualDataUrl(candidate);
  assert.ok(url?.startsWith('data:image/svg+xml;charset=utf-8,'), 'expected a deterministic SVG data URL');
  return decodeURIComponent(url!.split(',', 2)[1] || '');
};

const wrongSides = question(
  'In a right-angled triangle, the two shorter sides are 6 cm and 8 cm. Find the hypotenuse.',
  { asset_type: 'shape', title: 'Right-angled triangle', labels: ['base', 'height'], values: [3, 4] },
);
assert.equal(hasUsableVisualSpec(wrongSides), false, 'mismatched structured side values must be rejected');
assert.equal(renderExamVisualDataUrl(wrongSides), null, 'mismatched side values must not receive a generic triangle');

const isosceles = question(
  'An isosceles triangle has three sides of length 5 cm. Study the triangle.',
  { asset_type: 'shape', title: 'Isosceles triangle', labels: ['5 cm', '5 cm', '5 cm'], values: [5, 5, 5] },
);
assert.equal(hasUsableVisualSpec(isosceles), false, 'an isosceles triangle without a stated right angle is not a right triangle');
assert.equal(renderExamVisualDataUrl(isosceles), null);

const sector = question(
  'A sector has radius 7 cm and central angle 90°. Find its area.',
  { asset_type: 'shape', title: 'Circle sector', labels: ['radius', 'central angle'], values: [7, 90], curated_key: 'circle_parts' },
);
assert.equal(hasUsableVisualSpec(sector), false, 'sector/central-angle requests are unsupported');
assert.equal(renderExamVisualDataUrl(sector), null, 'unsupported sector requests must not use circle-parts artwork');

const coordinate = question(
  'Plot the points A(2, 3), B(4, 3) and C(4, 6) on a coordinate plane.',
  { asset_type: 'shape', title: 'Coordinate plane', labels: ['A(2, 3)', 'B(4, 3)', 'C(4, 6)'], values: [2, 3, 4, 6], curated_key: 'coordinate_plane' },
);
assert.equal(hasUsableVisualSpec(coordinate), false, 'fixed coordinate artwork must not claim arbitrary coordinates');
assert.equal(renderExamVisualDataUrl(coordinate), null);

const explicitTriangle = question(
  'In a right-angled triangle, the two shorter sides are 6 cm and 8 cm. Find the hypotenuse.',
  { asset_type: 'shape', title: 'Right-angled triangle', labels: ['AB = 6 cm', 'BC = 8 cm', 'right angle at B'], values: [6, 8] },
);
assert.equal(hasUsableVisualSpec(explicitTriangle), true, 'explicit right-triangle givens should pass');
const triangleSvg = svgOf(explicitTriangle);
assert.ok(triangleSvg.includes('AB = 6 cm'), 'triangle SVG must preserve the first given side');
assert.ok(triangleSvg.includes('BC = 8 cm'), 'triangle SVG must preserve the second given side');
assert.ok(triangleSvg.includes('90° at B'), 'triangle SVG must preserve the requested right-angle vertex');
assert.ok(!triangleSvg.includes('3-4-5'), 'triangle SVG must not use the generic 3-4-5 fallback');
assert.ok(triangleSvg.includes('hypotenuse = ?'), 'a derived hypotenuse must remain unanswered in the visual');
assert.ok(!triangleSvg.includes('hypotenuse = 10'), 'the renderer must not leak the derived hypotenuse answer');

const explicitCircle = question(
  'A circle has radius 7 cm. Using π = 22/7, calculate its area.',
  { asset_type: 'shape', title: 'Circle with radius', labels: ['radius'], values: [7] },
);
assert.equal(hasUsableVisualSpec(explicitCircle), true, 'explicit circle radius should pass');
const circleSvg = svgOf(explicitCircle);
assert.ok(circleSvg.includes('radius = 7 cm'), 'circle SVG must preserve the explicit radius');
assert.ok(!circleSvg.includes('chord'), 'radius-only circle SVG must not imply a chord');
assert.ok(!circleSvg.includes('tangent'), 'radius-only circle SVG must not imply a tangent');

const qualitativeCircle = question(
  'Study the parts of a circle and identify the radius and diameter.',
  { asset_type: 'shape', title: 'Parts of a circle', labels: ['radius', 'diameter'] },
);
assert.equal(hasUsableVisualSpec(qualitativeCircle), true, 'qualitative supported circle parts should pass');
const qualitativeCircleSvg = svgOf(qualitativeCircle);
assert.ok(qualitativeCircleSvg.includes('radius'), 'qualitative circle should show the requested radius');
assert.ok(qualitativeCircleSvg.includes('diameter'), 'qualitative circle should show the requested diameter');
assert.ok(!qualitativeCircleSvg.includes('chord'), 'qualitative circle must not invent an unrequested chord');
assert.ok(!qualitativeCircleSvg.includes('tangent'), 'qualitative circle must not invent an unrequested tangent');

console.log('exam-math-visuals regression passed (geometry mismatch rejection, non-right rejection, sector/coordinate rejection, explicit lengths/radius, vertex preservation, and safe qualitative circle parts)');
