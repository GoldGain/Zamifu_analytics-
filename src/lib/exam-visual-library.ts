/**
 * Curated printable black-and-white diagram library for the exam generator.
 * Drawn locally as SVG so no paper depends on an external image service, and
 * stored on a question only as a key so a saved paper is always re-renderable.
 * These are teaching schematics, not survey-accurate maps or scale drawings.
 */
import type { GeneratedExamQuestion } from './exam-schema.js';
import { isSocialStudiesSubject, normalizeKey } from './exam-construction.js';

export interface CuratedVisual {
  key: string;
  title: string;
  assetType: 'diagram' | 'map' | 'graph' | 'shape' | 'number_line';
  keywords: string[];
  svg: string;
}
function label(x: number, y: number, text: string, anchor = 'start'): string {
  return `<text x="${x}" y="${y}" font-size="13" fill="#111111" stroke="none" text-anchor="${anchor}" font-family="Helvetica, Arial, sans-serif">${text}</text>`;
}
function frame(title: string, body: string, height = 320): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 ${height}" width="520" height="${height}" role="img">`,
    `<rect x="0" y="0" width="520" height="${height}" fill="#ffffff" />`,
    '<g fill="none" stroke="#111111" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">', body, '</g>',
    `<text x="12" y="${height - 10}" font-size="13" fill="#111111" font-family="Helvetica, Arial, sans-serif">${title}</text>`,
    '</svg>',
  ].join('');
}
const measuringCylinder = frame('Measuring cylinder', [
  '<rect x="150" y="60" width="90" height="200" rx="6" />',
  '<path d="M240 120 h30 M240 150 h22 M240 180 h30 M240 210 h22 M240 240 h30" />',
  '<path d="M150 200 h90 v54 a6 6 0 0 1 -6 6 h-78 a6 6 0 0 1 -6 -6 z" fill="#dddddd" />',
  '<path d="M120 260 h120" />',
  label(250, 124, '100 cm\u00b3'), label(250, 154, '80'), label(250, 184, '60'),
  label(250, 214, '40'), label(250, 244, '20'), label(150, 44, 'Graduated scale'),
].join(''));
const bunsenBurner = frame('Bunsen burner, tripod and beaker', [
  '<rect x="196" y="250" width="120" height="14" rx="4" />', '<path d="M236 250 v-40 h40 v40" />',
  '<path d="M246 210 l10 -40 l10 40 z" />', '<path d="M256 170 c-10 -14 10 -22 0 -36 c-10 -14 10 -20 0 -32" />',
  '<path d="M150 150 h220" />', '<rect x="220" y="130" width="80" height="20" rx="3" />',
  label(60, 214, 'Gas inlet'), label(112, 276, 'Bench mat'), label(150, 118, 'Tripod stand'), label(316, 154, 'Beaker'),
].join(''));
const electricCircuit = frame('Simple electric circuit', [
  '<rect x="90" y="90" width="340" height="150" rx="4" />', '<rect x="60" y="150" width="30" height="30" />',
  '<path d="M66 150 v-14 M72 150 v-18 M78 150 v-14 M84 150 v-18" />', '<circle cx="260" cy="90" r="18" />',
  label(20, 196, 'Battery (2 cells)'), label(236, 60, 'Ammeter (A)'),
  '<rect x="230" y="176" width="60" height="28" rx="4" />', label(200, 282, 'Switch'),
].join(''));
const rightTriangle = frame('Right-angled triangle', [
  '<polygon points="120,240 400,240 120,90" />', '<rect x="120" y="222" width="18" height="18" />',
  label(255, 268, 'base, b'), label(96, 170, 'height, h'), label(275, 150, 'hypotenuse, c'),
  label(140, 120, 'A'), label(112, 262, 'B'), label(412, 262, 'C'), label(140, 206, '90\u00b0'),
].join(''));
const circleParts = frame('Parts of a circle', [
  '<circle cx="250" cy="160" r="100" />', '<circle cx="250" cy="160" r="4" fill="#111111" stroke="none" />',
  '<line x1="250" y1="160" x2="336" y2="88" />', '<line x1="150" y1="160" x2="350" y2="160" />',
  '<line x1="190" y1="262" x2="330" y2="70" />',
  label(258, 156, 'O'), label(300, 120, 'radius r'), label(228, 152, 'diameter'),
  label(336, 66, 'chord'), label(196, 240, 'tangent'),
].join(''));
const coordinatePlane = frame('Coordinate plane', [
  '<line x1="70" y1="250" x2="460" y2="250" />', '<line x1="250" y1="40" x2="250" y2="288" />',
  '<polygon points="320,190 400,150 380,230" />',
  '<circle cx="320" cy="190" r="4" fill="#111111" stroke="none" />',
  '<circle cx="400" cy="150" r="4" fill="#111111" stroke="none" />',
  '<circle cx="380" cy="230" r="4" fill="#111111" stroke="none" />',
  label(430, 272, 'x'), label(262, 52, 'y'), label(232, 268, 'O'),
  label(310, 184, 'A (2, 3)'), label(406, 144, 'B'), label(388, 252, 'C'),
].join(''));
const numberLine = frame('Number line', '<line x1="50" y1="160" x2="470" y2="160" />' +
  Array.from({ length: 11 }, (_v, index) => {
    const x = 60 + index * 40;
    return `<line x1="${x}" y1="150" x2="${x}" y2="170" />` + label(x, 192, String(index - 2), 'middle');
  }).join(''), 230);
const mapKenya = frame('Kenya (schematic)', [
  '<polygon points="180,50 260,40 330,70 370,130 400,210 380,270 300,290 220,275 160,230 140,160 150,90" />',
  '<path d="M200 120 c40 -10 70 20 60 60 c-10 40 -60 40 -80 10 c-16 -24 -8 -60 20 -70 z" />',
  '<line x1="240" y1="110" x2="300" y2="250" stroke-dasharray="6 4" />',
  label(414, 90, 'ETHIOPIA'), label(418, 180, 'SOMALIA'), label(292, 310, 'INDIAN OCEAN'),
  label(150, 130, 'UGANDA'), label(80, 250, 'TANZANIA'), label(210, 176, 'Lake Victoria'), label(352, 246, 'Rift Valley'),
].join(''));
const mapAfrica = frame('Africa (schematic)', [
  '<polygon points="180,40 320,40 380,90 400,180 340,260 280,300 240,270 200,200 160,150 140,80" />',
  '<polygon points="340,200 390,210 380,260 330,250" />', '<circle cx="200" cy="120" r="26" stroke-dasharray="4 4" />',
  label(150, 30, 'MEDITERRANEAN SEA'), label(292, 320, 'INDIAN OCEAN'), label(60, 120, 'ATLANTIC OCEAN'),
  label(192, 124, 'Equator'), label(288, 276, 'Madagascar'), label(120, 190, 'Gulf of Guinea'),
].join(''));
const mapWorld = frame('World (schematic)', [
  '<rect x="60" y="60" width="400" height="200" />',
  '<polygon points="90,100 180,90 210,130 170,160 120,150 90,130" />',
  '<polygon points="150,180 210,180 230,240 180,260 150,230" />',
  '<polygon points="240,80 340,70 380,110 360,160 300,150 250,120" />',
  '<polygon points="270,180 330,180 350,240 300,260 265,230" />',
  '<polygon points="400,190 440,190 445,225 405,230" />',
  '<line x1="60" y1="160" x2="460" y2="160" stroke-dasharray="6 4" />',
  label(240, 56, 'Equator'), label(96, 176, 'PACIFIC'), label(292, 288, 'INDIAN OCEAN'),
  label(410, 90, 'ASIA'), label(140, 140, 'NORTH AMERICA'), label(310, 200, 'AFRICA'),
].join(''));
const soilProfile = frame('Soil profile', [
  '<rect x="120" y="60" width="280" height="200" />', '<line x1="120" y1="110" x2="400" y2="110" />',
  '<line x1="120" y1="170" x2="400" y2="170" />', '<line x1="120" y1="220" x2="400" y2="220" />',
  Array.from({ length: 10 }, (_v, index) =>
    `<circle cx="${142 + index * 26}" cy="86" r="5" fill="#111111" stroke="none" />`).join(''),
  label(410, 90, 'A: top soil'), label(410, 145, 'B: sub-soil'),
  label(410, 200, 'C: weathered rock'), label(410, 250, 'D: parent rock'),
].join(''));

export const CURATED_VISUALS: CuratedVisual[] = [
  { key: 'measuring_cylinder', title: 'Measuring cylinder with readings', assetType: 'diagram', keywords: ['measuring cylinder', 'volume of water', 'meniscus', 'graduated cylinder', 'water level'], svg: measuringCylinder },
  { key: 'bunsen_burner', title: 'Bunsen burner, tripod and beaker', assetType: 'diagram', keywords: ['bunsen burner', 'tripod', 'beaker', 'heating', 'flame', 'gas'], svg: bunsenBurner },
  { key: 'electric_circuit', title: 'Electric circuit with ammeter', assetType: 'diagram', keywords: ['circuit', 'ammeter', 'voltmeter', 'battery', 'switch', 'current', 'bulb'], svg: electricCircuit },
  { key: 'right_triangle', title: 'Right-angled triangle', assetType: 'shape', keywords: ['triangle', 'hypotenuse', 'pythagoras', 'right angled', 'right angle'], svg: rightTriangle },
  { key: 'circle_parts', title: 'Parts of a circle', assetType: 'shape', keywords: ['circle', 'radius', 'diameter', 'circumference', 'chord', 'tangent', 'arc'], svg: circleParts },
  { key: 'coordinate_plane', title: 'Coordinate plane with a triangle', assetType: 'graph', keywords: ['coordinate', 'cartesian', 'plot', 'transformation', 'rotation', 'reflection'], svg: coordinatePlane },
  { key: 'number_line', title: 'Number line from -2 to 8', assetType: 'number_line', keywords: ['number line', 'integers', 'inequality', 'less than', 'greater than'], svg: numberLine },
  { key: 'map_kenya', title: 'Kenya (schematic)', assetType: 'map', keywords: ['kenya', 'counties', 'lake victoria', 'rift valley', 'physical features', 'tana'], svg: mapKenya },
  { key: 'map_africa', title: 'Africa (schematic)', assetType: 'map', keywords: ['africa', 'continent', 'equator', 'madagascar', 'regions', 'countries'], svg: mapAfrica },
  { key: 'map_world', title: 'World (schematic)', assetType: 'map', keywords: ['world', 'continents', 'oceans', 'latitude', 'longitude', 'globe'], svg: mapWorld },
  { key: 'soil_profile', title: 'Soil profile', assetType: 'diagram', keywords: ['soil profile', 'top soil', 'sub soil', 'parent rock', 'horizon', 'erosion'], svg: soilProfile },
];
const CURATED_BY_KEY = new Map(CURATED_VISUALS.map((visual) => [visual.key, visual]));
export function curatedVisual(key: string): CuratedVisual | null {
  return CURATED_BY_KEY.get(String(key || '').trim()) || null;
}
export function curatedVisualDataUrl(key: string): string | null {
  const visual = curatedVisual(key);
  if (!visual) return null;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(visual.svg);
}
const VISUAL_REFERENCE = /\b(?:diagram|figure|map|graph|chart|table|illustration|picture|image|photograph|flowchart|sketch|drawing|number line|shown below|study the)\b/i;
function questionHaystack(question: GeneratedExamQuestion): string {
  return [
    question.question_text || '', question.strand || '', question.sub_strand || '', question.topic || '',
    (question.sub_parts || []).map((part) => part.prompt || '').join(' '),
  ].join(' ');
}
export function pickCuratedVisualKey(question: GeneratedExamQuestion, subject = ''): string | null {
  const haystack = normalizeKey(questionHaystack(question));
  if (!haystack) return null;
  const social = isSocialStudiesSubject(subject);
  let best: { key: string; score: number } | null = null;
  for (const visual of CURATED_VISUALS) {
    if (social && visual.assetType !== 'map' && visual.assetType !== 'diagram') continue;
    let score = 0;
    for (const keyword of visual.keywords) {
      const needle = normalizeKey(keyword);
      if (needle && haystack.includes(needle)) score += needle.length >= 6 ? 2 : 1;
    }
    if (score && (!best || score > best.score)) best = { key: visual.key, score };
  }
  return best ? best.key : null;
}
function hasUsableSpec(question: GeneratedExamQuestion): boolean {
  const spec = question.visual_spec as Record<string, unknown> | null | undefined;
  if (!spec) return false;
  if (spec.curated_key) return true;
  const tableRows = spec.table_rows || spec.rows || spec.data;
  if (Array.isArray(tableRows) && tableRows.length) return true;
  if (Array.isArray(spec.map_regions) && spec.map_regions.length) return true;
  if (Array.isArray(spec.values) && spec.values.length) return true;
  if (Array.isArray(spec.labels) && spec.labels.length >= 2) return true;
  return false;
}
export function applyCuratedVisualFallback(question: GeneratedExamQuestion, subject = ''): GeneratedExamQuestion {
  const spec = question.visual_spec as Record<string, unknown> | null | undefined;
  if (spec?.curated_key) {
    const key = String(spec.curated_key);
    return { ...question, image_url: curatedVisualDataUrl(key) || null, visual_spec: { ...spec } };
  }
  if (hasUsableSpec(question) || question.image_url) return question;
  if (!VISUAL_REFERENCE.test(questionHaystack(question))) return question;
  const key = pickCuratedVisualKey(question, subject);
  if (!key) return question;
  const visual = curatedVisual(key);
  if (!visual) return question;
  return {
    ...question,
    image_url: curatedVisualDataUrl(key),
    visual_spec: { asset_type: visual.assetType, title: visual.title, curated_key: key },
  };
}
