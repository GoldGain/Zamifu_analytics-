import type { GeneratedExamQuestion } from './exam-schema.js';
import { curatedVisualDataUrl } from './exam-visual-library.js';
import {
  EAST_AFRICA_FEATURES,
  KENYA_FEATURES,
  NATURAL_EARTH_AFRICA_FEATURES,
  inferExamMapBase,
  type ExamMapBase,
  type ExamMapFeature,
} from './exam-map-data.js';

export interface ExamVisualSpec {
  asset_type?: string;
  title?: string;
  prompt?: string;
  caption?: string;
  labels?: string[];
  values?: number[];
  x_labels?: string[];
  legend?: string[];
  map_regions?: string[];
  base_map?: ExamMapBase;
  scale_text?: string;
  compass?: string;
  map_features?: string[];
  table_headers?: string[];
  table_rows?: Array<Array<string | number>>;
  rows?: Array<Array<string | number>>;
  data?: Array<Array<string | number>>;
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function wrapWords(text: unknown, maxChars: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > Math.max(8, maxChars) && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['—'];
}

function textLines(text: string, x: number, y: number, width: number): string {
  return wrapWords(text, Math.floor(width / 8)).slice(0, 4).map((entry, index) => `<text x="${x}" y="${y + index * 18}" class="body">${escapeXml(entry)}</text>`).join('');
}

function centeredTextLines(text: string, x: number, y: number, maxChars: number, className: string, lineHeight: number): string {
  return wrapWords(text, maxChars).slice(0, 2).map((entry, index) => `<text x="${x}" y="${y + index * lineHeight}" text-anchor="middle" class="${className}">${escapeXml(entry)}</text>`).join('');
}

function tableCellText(text: unknown, x: number, centerY: number, width: number, header = false): string {
  const lines = wrapWords(text, Math.floor(width / 7)).slice(0, 2);
  const lineHeight = 13;
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2 + 4;
  return lines.map((entry, index) => `<text x="${x}" y="${startY + index * lineHeight}" text-anchor="middle" class="${header ? 'table-header' : 'table-cell'}">${escapeXml(entry)}</text>`).join('');
}

function visualTitle(spec: ExamVisualSpec, question: GeneratedExamQuestion): string {
  return spec.title || spec.caption || `${question.question_type.replace(/_/g, ' ')} visual`;
}

function renderGraph(spec: ExamVisualSpec): string {
  const values = (spec.values || [2, 4, 3, 6]).slice(0, 8).map((value) => Math.max(0, Number(value) || 0));
  const labels = (spec.x_labels || spec.labels || values.map((_, index) => `P${index + 1}`)).slice(0, values.length);
  const max = Math.max(1, ...values);
  const bars = values.map((value, index) => {
    const height = Math.round((value / max) * 150);
    const x = 60 + index * 45;
    return `<rect x="${x}" y="${205 - height}" width="26" height="${height}" rx="3" fill="#b91c1c"/><text x="${x + 13}" y="${220}" text-anchor="middle" class="small">${escapeXml(labels[index])}</text><text x="${x + 13}" y="${195 - height}" text-anchor="middle" class="small">${value}</text>`;
  }).join('');
  return `<line x1="50" y1="205" x2="430" y2="205" class="axis"/><line x1="50" y1="45" x2="50" y2="205" class="axis"/>${bars}`;
}

function renderNumberLine(spec: ExamVisualSpec): string {
  const labels = (spec.labels || ['0', '1', '2', '3', '4', '5']).slice(0, 10);
  const step = 360 / Math.max(1, labels.length - 1);
  return `<line x1="60" y1="150" x2="420" y2="150" class="axis"/>${labels.map((label, index) => {
    const x = 60 + index * step;
    return `<line x1="${x}" y1="140" x2="${x}" y2="160" class="axis"/><text x="${x}" y="185" text-anchor="middle" class="body">${escapeXml(label)}</text>`;
  }).join('')}`;
}

function extractVolume(labels: string[], fallback: number, position: 'initial' | 'final'): number {
  const matches = labels.flatMap((label) => Array.from(label.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*(?:mL|cm³|cm3)\b/gi)).map((match) => Number(match[1]))).filter((value) => Number.isFinite(value));
  const value = position === 'final' ? matches[matches.length - 1] : matches[0];
  return Number.isFinite(value) ? value : fallback;
}

function renderMeasuringCylinderDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || []).map(String);
  const values = (spec.values || []).map((value) => `${value} mL`);
  const volumeSources = [...labels, ...values];
  const initial = extractVolume(volumeSources, 40, 'initial');
  const final = extractVolume(volumeSources, 65, 'final');
  const maxVolume = Math.max(80, Math.ceil(Math.max(initial, final) / 10) * 10);
  const drawCylinder = (x: number, volume: number, stone: boolean, label: string): string => {
    const baseY = 238;
    const topY = 66;
    const waterTop = baseY - Math.max(0, Math.min(maxVolume, volume)) / maxVolume * (baseY - topY);
    const ticks = Array.from({ length: maxVolume / 10 + 1 }, (_, index) => {
      const tickY = baseY - index * (baseY - topY) / (maxVolume / 10);
      return `<line x1="${x + 14}" y1="${tickY}" x2="${x + (index % 2 === 0 ? 30 : 24)}" y2="${tickY}" stroke="#1f2937" stroke-width="1"/><text x="${x + 5}" y="${tickY + 3}" text-anchor="end" class="small">${index * 10}</text>`;
    }).join('');
    const stoneShape = stone ? `<path d="M${x + 45} ${baseY - 18} q18 -22 36 0 q-3 17 -18 18 q-15 -1 -18 -18 Z" fill="#fef3c7" stroke="#92400e" stroke-width="2"/><text x="${x + 63}" y="${baseY - 27}" text-anchor="middle" class="small">stone</text>` : '';
    return `<path d="M${x + 14} ${topY} L${x + 14} ${baseY} Q${x + 63} ${baseY + 12} ${x + 112} ${baseY} L${x + 112} ${topY}" fill="#eff6ff" fill-opacity="0.42" stroke="#1d4ed8" stroke-width="3"/><path d="M${x + 15} ${waterTop} L${x + 111} ${waterTop} L${x + 111} ${baseY} Q${x + 63} ${baseY + 10} ${x + 15} ${baseY} Z" fill="#93c5fd" fill-opacity="0.72"/>${ticks}${stoneShape}<text x="${x + 63}" y="260" text-anchor="middle" class="body">${escapeXml(label)}</text><text x="${x + 63}" y="278" text-anchor="middle" class="body">${escapeXml(`${volume} mL`)}</text>`;
  };
  return `${drawCylinder(72, initial, false, 'Before')}${drawCylinder(296, final, true, 'After stone')}<text x="240" y="302" text-anchor="middle" class="small">Read the bottom of the meniscus at eye level.</text>`;
}

function normalizedWords(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function defaultMapRegions(base: ExamMapBase): string[] {
  if (base === 'kenya') return ['Kenya', 'Uganda', 'Tanzania', 'Ethiopia', 'Somalia'];
  if (base === 'africa') return ['Kenya', 'Nigeria', 'Egypt', 'South Africa', 'Madagascar'];
  return ['Kenya', 'Uganda', 'Tanzania', 'Ethiopia', 'Somalia', 'South Sudan'];
}

function mapScaleText(base: ExamMapBase): string {
  if (base === 'kenya') return '≈ 200 km';
  if (base === 'africa') return '≈ 1,000 km';
  return '≈ 500 km';
}

function mapFeaturesForBase(base: ExamMapBase): ExamMapFeature[] {
  if (base === 'kenya') return KENYA_FEATURES;
  if (base === 'africa') return NATURAL_EARTH_AFRICA_FEATURES;
  return EAST_AFRICA_FEATURES;
}

function normalizeMapSpec(spec: ExamVisualSpec, question?: GeneratedExamQuestion): ExamVisualSpec {
  const descriptor = [spec.base_map, spec.title, spec.prompt, spec.caption, ...(spec.map_regions || []), ...(spec.labels || [])].filter(Boolean).join(' ');
  const base = spec.base_map || inferExamMapBase(descriptor || question?.question_text || 'east Africa');
  const regions = (spec.map_regions || spec.labels || []).map(String).filter((value) => value.trim());
  const legend = (spec.legend || []).map(String).filter((value) => value.trim());
  return {
    ...spec,
    base_map: base,
    map_regions: regions,
    legend: legend.length >= 2 ? legend : [
      'Dark fill: named focus region',
      'Line: country boundary',
      'Arrow: north; bar: approximate distance',
    ],
    scale_text: String(spec.scale_text || '').trim() || mapScaleText(base),
    compass: String(spec.compass || '').trim() || 'North',
  };
}

function projectMapPoint(point: number[], bounds: { west: number; east: number; south: number; north: number; x: number; y: number; width: number; height: number }): [number, number] {
  const [longitude, latitude] = point;
  const x = bounds.x + ((longitude - bounds.west) / (bounds.east - bounds.west)) * bounds.width;
  const y = bounds.y + ((bounds.north - latitude) / (bounds.north - bounds.south)) * bounds.height;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function polygonPath(rings: number[][][], bounds: { west: number; east: number; south: number; north: number; x: number; y: number; width: number; height: number }): string {
  return rings.map((ring) => ring.map((point, index) => {
    const [x, y] = projectMapPoint(point, bounds);
    return `${index ? 'L' : 'M'}${x} ${y}`;
  }).join(' ') + ' Z').join(' ');
}

function featureCentroid(feature: ExamMapFeature): [number, number] {
  const points = feature.polygons.flatMap((polygon) => polygon[0] || []);
  if (!points.length) return [0, 0];
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
}

function matchesMapFeature(feature: ExamMapFeature, values: string[]): boolean {
  const aliases: Record<string, string[]> = {
    's sudan': ['south sudan'],
    'dem rep congo': ['democratic republic of the congo', 'dr congo', 'congo kinshasa'],
    'cote divoire': ['cote d ivoire', 'ivory coast'],
  };
  const name = normalizedWords(feature.name);
  const names = [name, ...(aliases[name] || [])].map(normalizedWords);
  return values.some((value) => {
    const query = normalizedWords(value);
    return query && names.some((candidate) => query === candidate || query.includes(candidate) || candidate.includes(query));
  });
}

function mapReferencePoint(value: string, bounds: { west: number; east: number; south: number; north: number; x: number; y: number; width: number; height: number }): [number, number] | null {
  const query = normalizedWords(value);
  if (query.includes('lake victoria')) return projectMapPoint([33.2, -1], bounds);
  if (query.includes('mount kenya')) return projectMapPoint([37.3, -0.15], bounds);
  if (query.includes('indian ocean')) return projectMapPoint([42.2, -2], bounds);
  if (query === 'equator' || query.includes('equator')) return projectMapPoint([bounds.west + (bounds.east - bounds.west) * 0.62, 0], bounds);
  if (query.includes('rift valley')) return projectMapPoint([36.1, -1], bounds);
  return null;
}

function renderMapReferenceOverlays(values: string[], bounds: { west: number; east: number; south: number; north: number; x: number; y: number; width: number; height: number }): string {
  return values.flatMap((value) => {
    const query = normalizedWords(value);
    const point = mapReferencePoint(value, bounds);
    if (query.includes('lake victoria') && point) {
      return `<ellipse cx="${point[0]}" cy="${point[1]}" rx="17" ry="9" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="1.5"/><text x="${point[0] + 20}" y="${point[1] + 3}" class="map-label">Lake Victoria</text>`;
    }
    if (query.includes('mount kenya') && point) {
      return `<path d="M${point[0] - 7} ${point[1] + 6} L${point[0]} ${point[1] - 8} L${point[0] + 7} ${point[1] + 6} Z" fill="#64748b" stroke="#111827" stroke-width="1"/><text x="${point[0] + 10}" y="${point[1] + 3}" class="map-label">Mount Kenya</text>`;
    }
    if (query.includes('rift valley')) {
      const start = projectMapPoint([36.7, 5], bounds);
      const end = projectMapPoint([35.1, -5], bounds);
      return `<path d="M${start[0]} ${start[1]} L${end[0]} ${end[1]}" fill="none" stroke="#b45309" stroke-width="1.5" stroke-dasharray="5 3"/><text x="${end[0] + 7}" y="${end[1] - 4}" class="map-label">Rift Valley</text>`;
    }
    if (query === 'equator' || query.includes('equator')) {
      const start = projectMapPoint([bounds.west, 0], bounds);
      const end = projectMapPoint([bounds.east, 0], bounds);
      return `<path d="M${start[0]} ${start[1]} L${end[0]} ${end[1]}" fill="none" stroke="#15803d" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${bounds.x + 6}" y="${start[1] - 4}" class="map-label">Equator</text>`;
    }
    if (query.includes('indian ocean') && point) return `<text x="${point[0] - 28}" y="${point[1]}" class="map-label">Indian Ocean</text>`;
    return '';
  }).join('');
}

function renderMap(spec: ExamVisualSpec): string {
  const normalized = normalizeMapSpec(spec);
  const base = normalized.base_map || 'east_africa';
  const features = mapFeaturesForBase(base);
  const requested = [...(normalized.map_regions || []), ...(normalized.map_features || []), ...(normalized.labels || [])];
  const bounds = base === 'kenya'
    ? { west: 33, east: 43.5, south: -5.5, north: 5.5, x: 34, y: 55, width: 304, height: 190 }
    : base === 'africa'
      ? { west: -20, east: 52, south: -36, north: 38, x: 34, y: 55, width: 304, height: 190 }
      : { west: 27, east: 53, south: -12, north: 16, x: 34, y: 55, width: 304, height: 190 };
  const paths = features.map((feature) => {
    const focus = matchesMapFeature(feature, requested);
    const fill = focus ? '#cbd5e1' : '#f8fafc';
    const stroke = focus ? '#1e3a8a' : '#64748b';
    return feature.polygons.map((polygon) => `<path d="${polygonPath(polygon, bounds)}" fill="${fill}" stroke="${stroke}" stroke-width="${focus ? 1.5 : 0.7}" fill-rule="evenodd"/>`).join('');
  }).join('');
  const labelTargets = (normalized.map_regions || defaultMapRegions(base)).slice(0, base === 'africa' ? 6 : 8);
  const labels = labelTargets.map((label, index) => {
    const feature = features.find((candidate) => matchesMapFeature(candidate, [label]));
    const referencePoint = feature ? null : mapReferencePoint(label, bounds);
    if (!feature && !referencePoint) return `<text x="348" y="${74 + index * 18}" class="small">${escapeXml(String.fromCharCode(65 + index))}: ${escapeXml(label)}</text>`;
    const [x, y] = feature ? projectMapPoint(featureCentroid(feature), bounds) : referencePoint!;
    return `<circle cx="${x}" cy="${y}" r="2.8" fill="#1e3a8a"/><text x="${Math.min(334, x + 5)}" y="${Math.max(66, Math.min(246, y + 3))}" class="map-label">${escapeXml(label)}</text>`;
  }).join('');
  const overlays = renderMapReferenceOverlays(requested, bounds);
  const legend = (normalized.legend || []).slice(0, 3).map((entry, index) => textLines(entry, 364, 80 + index * 28, 94)).join('');
  const baseLabel = base === 'kenya' ? 'Kenya context' : base === 'africa' ? 'Africa context' : 'East Africa context';
  return `<defs><clipPath id="map-clip"><rect x="26" y="47" width="322" height="215"/></clipPath></defs><rect x="26" y="47" width="322" height="215" fill="#ffffff" stroke="#111827" stroke-width="2"/><g aria-label="${escapeXml(baseLabel)}" clip-path="url(#map-clip)">${paths}${overlays}${labels}<path d="M40 72 H335 M40 230 H335" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="3 4"/></g><rect x="356" y="47" width="112" height="118" fill="#ffffff" stroke="#111827" stroke-width="1.5"/><text x="364" y="64" class="map-key-title">KEY</text>${legend}<path d="M333 79 L333 55 L326 66 L340 66 Z" fill="#111827"/><text x="333" y="49" text-anchor="middle" class="small">${escapeXml(normalized.compass || 'North')}</text><line x1="42" y1="278" x2="102" y2="278" stroke="#111827" stroke-width="3"/><line x1="42" y1="273" x2="42" y2="283" stroke="#111827" stroke-width="2"/><line x1="102" y1="273" x2="102" y2="283" stroke="#111827" stroke-width="2"/><text x="110" y="282" class="small">${escapeXml(normalized.scale_text || 'approximate distance')}</text><text x="360" y="184" class="small">${escapeXml(baseLabel)}</text><text x="360" y="202" class="small">Vector country</text><text x="360" y="218" class="small">boundaries</text>`;
}

function renderCircuitDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || []).map(String);
  const markersOnly = labels.length > 0 && labels.every((entry) => /^[A-Z]$/.test(entry.trim()));
  const label = (index: number, fallback: string): string => escapeXml(labels[index] || fallback);
  const markers = markersOnly
    ? `<text x="130" y="56" text-anchor="middle" class="body">${label(0, 'X')}</text><line x1="130" y1="60" x2="130" y2="72" stroke="#111827" stroke-width="2"/><text x="360" y="145" text-anchor="middle" class="body">${label(1, 'Y')}</text><line x1="360" y1="137" x2="360" y2="120" stroke="#111827" stroke-width="2"/>`
    : `<text x="130" y="145" text-anchor="middle" class="body">${label(0, 'Cells in series')}</text><text x="230" y="55" text-anchor="middle" class="body">${label(2, 'Switch')}</text><text x="360" y="140" text-anchor="middle" class="body">${label(1, 'Bulb')}</text><text x="225" y="250" text-anchor="middle" class="body">${label(3, 'Connecting wires')}</text>`;
  return `<g>
    <path d="M58 92 H108 M152 92 H205 M255 92 H332 M388 92 V222 H58 V92" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="108" y1="72" x2="108" y2="112" stroke="#1d4ed8" stroke-width="6"/><line x1="124" y1="80" x2="124" y2="104" stroke="#1d4ed8" stroke-width="4"/>
    <line x1="136" y1="72" x2="136" y2="112" stroke="#1d4ed8" stroke-width="6"/><line x1="152" y1="80" x2="152" y2="104" stroke="#1d4ed8" stroke-width="4"/>
    <text x="116" y="62" text-anchor="middle" class="small">+</text><text x="144" y="62" text-anchor="middle" class="small">−</text>
    <circle cx="360" cy="92" r="28" fill="#fef3c7" stroke="#b45309" stroke-width="4"/><path d="M344 76 L376 108 M376 76 L344 108" stroke="#b45309" stroke-width="3"/>
    <circle cx="205" cy="92" r="5" fill="#111827"/><circle cx="255" cy="92" r="5" fill="#111827"/><path d="M205 92 L244 68" fill="none" stroke="#b45309" stroke-width="4" stroke-linecap="round"/>
    ${markers}
    <text x="240" y="285" text-anchor="middle" class="small">Closed circuit with two cells, a switch and a bulb.</text>
  </g>`;
}

function renderSeparationStagesDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || []).map(String);
  const label = (index: number, fallback: string): string => escapeXml(labels[index] || fallback);
  return `<g>
    <text x="118" y="52" text-anchor="middle" class="body">Stage 1: Filtration</text>
    <path d="M83 78 H153 L132 112 V172 H104 V112 Z" fill="#eff6ff" stroke="#1d4ed8" stroke-width="3"/>
    <path d="M91 92 H145" stroke="#92400e" stroke-width="2"/><path d="M99 96 Q118 84 137 96" fill="none" stroke="#92400e" stroke-width="2"/>
    <path d="M104 145 H132 V172 H104 Z" fill="#bfdbfe" fill-opacity="0.8"/><path d="M104 172 L132 172 L142 202 H94 Z" fill="#dcfce7" fill-opacity="0.7" stroke="#15803d" stroke-width="2"/>
    <text x="118" y="218" text-anchor="middle" class="small">${label(1, 'Residue (insoluble solid)')}</text>
    <text x="118" y="235" text-anchor="middle" class="small">${label(2, 'Filtrate (clear solution)')}</text>
    <path d="M164 130 H190" stroke="#111827" stroke-width="2"/><path d="M184 122 L194 130 L184 138" fill="none" stroke="#111827" stroke-width="2"/>
    <text x="300" y="52" text-anchor="middle" class="body">Stage 2: Evaporation</text>
    <path d="M236 175 L364 175 L348 198 L252 198 Z" fill="#fef3c7" stroke="#b45309" stroke-width="3"/>
    <path d="M251 175 Q300 154 349 175" fill="#bfdbfe" fill-opacity="0.8" stroke="#1d4ed8" stroke-width="2"/>
    <line x1="262" y1="198" x2="250" y2="228" stroke="#111827" stroke-width="3"/><line x1="338" y1="198" x2="350" y2="228" stroke="#111827" stroke-width="3"/><line x1="250" y1="228" x2="350" y2="228" stroke="#111827" stroke-width="3"/>
    <path d="M282 228 Q300 207 318 228" fill="none" stroke="#dc2626" stroke-width="4"/><path d="M290 228 Q300 214 310 228" fill="none" stroke="#f59e0b" stroke-width="3"/>
    <text x="300" y="246" text-anchor="middle" class="small">${label(3, 'Evaporating dish on tripod stand')}</text>
    <text x="300" y="264" text-anchor="middle" class="small">${label(4, 'Bunsen burner flame')}</text>
    <text x="240" y="292" text-anchor="middle" class="small">${label(0, 'Stage 1: filter funnel and filter paper')} → heat the filtrate to recover the dissolved solid</text>
  </g>`;
}

function renderFoodChainDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || ['Grass', 'Grasshopper', 'Frog', 'Snake', 'Eagle']).map(String).slice(0, 6);
  const cellWidth = 68;
  const gap = 12;
  const startX = Math.max(12, (480 - (labels.length * cellWidth + (labels.length - 1) * gap)) / 2);
  const boxes = labels.map((entry, index) => {
    const x = startX + index * (cellWidth + gap);
    const y = index % 2 === 0 ? 112 : 184;
    const fill = index === 0 ? '#dcfce7' : index === labels.length - 1 ? '#fee2e2' : '#dbeafe';
    const box = `<rect x="${x}" y="${y}" width="${cellWidth}" height="38" rx="8" fill="${fill}" stroke="#1d4ed8" stroke-width="2"/>${centeredTextLines(entry, x + cellWidth / 2, y + 15, 10, 'small', 11)}`;
    const nextX = startX + (index + 1) * (cellWidth + gap);
    const nextY = (index + 1) % 2 === 0 ? 131 : 203;
    const arrow = index < labels.length - 1 ? `<line x1="${x + cellWidth}" y1="${y + 19}" x2="${nextX - 7}" y2="${nextY}" stroke="#475569" stroke-width="2"/><path d="M${nextX - 15} ${nextY - 5} L${nextX - 5} ${nextY} L${nextX - 15} ${nextY + 5}" fill="none" stroke="#475569" stroke-width="2"/>` : '';
    return box + arrow;
  }).join('');
  return `<g><text x="240" y="58" text-anchor="middle" class="body">Energy flow through the food chain</text>${boxes}<text x="240" y="278" text-anchor="middle" class="small">Arrows show the direction of energy transfer.</text></g>`;
}

function renderDistillationDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || []).map(String);
  const label = (index: number, fallback: string): string => escapeXml(labels[index] || fallback);
  return `<g>
    <line x1="72" y1="70" x2="72" y2="244" stroke="#111827" stroke-width="4"/><line x1="52" y1="244" x2="94" y2="244" stroke="#111827" stroke-width="4"/>
    <line x1="72" y1="105" x2="112" y2="105" stroke="#111827" stroke-width="3"/><line x1="96" y1="105" x2="96" y2="140" stroke="#111827" stroke-width="3"/>
    <path d="M96 150 Q120 130 144 150 L151 183 Q149 213 120 222 Q91 213 89 183 Z" fill="#dbeafe" fill-opacity="0.72" stroke="#1d4ed8" stroke-width="3"/>
    <rect x="112" y="92" width="16" height="52" fill="#eff6ff" stroke="#1d4ed8" stroke-width="3"/>
    <line x1="120" y1="54" x2="120" y2="117" stroke="#b45309" stroke-width="3"/><circle cx="120" cy="54" r="5" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>
    <path d="M151 166 H304 Q316 166 316 154 V142 Q316 130 304 130 H151" fill="#e0f2fe" fill-opacity="0.72" stroke="#0369a1" stroke-width="3"/>
    <line x1="163" y1="142" x2="304" y2="142" stroke="#0369a1" stroke-width="2"/><path d="M180 154 H274" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="7 5"/>
    <path d="M316 154 L344 154 L344 177" fill="none" stroke="#0369a1" stroke-width="3"/>
    <path d="M344 177 Q360 163 376 177 L382 205 Q380 224 360 230 Q340 224 338 205 Z" fill="#dcfce7" fill-opacity="0.76" stroke="#15803d" stroke-width="3"/>
    <path d="M101 226 H139 L132 242 H108 Z" fill="#fef3c7" stroke="#b45309" stroke-width="2"/><path d="M107 226 Q120 212 133 226" fill="none" stroke="#dc2626" stroke-width="3"/>
    <text x="120" y="252" text-anchor="middle" class="small">${label(1, 'Round-bottom flask')}</text>
    <text x="120" y="70" text-anchor="middle" class="small">${label(0, 'Thermometer')}</text>
    <text x="235" y="120" text-anchor="middle" class="small">${label(2, 'Condenser')}</text>
    <text x="360" y="252" text-anchor="middle" class="small">${label(3, 'Receiving flask')}</text>
    <text x="120" y="274" text-anchor="middle" class="small">Heat</text>
  </g>`;
}

function renderSeparatingFunnelDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || []).map(String);
  const label = (index: number, fallback: string): string => escapeXml(labels[index] || fallback);
  return `<g>
    <line x1="72" y1="55" x2="72" y2="246" stroke="#111827" stroke-width="4"/><line x1="50" y1="246" x2="94" y2="246" stroke="#111827" stroke-width="4"/>
    <line x1="72" y1="98" x2="206" y2="98" stroke="#111827" stroke-width="4"/><line x1="174" y1="98" x2="174" y2="122" stroke="#111827" stroke-width="3"/>
    <path d="M174 88 L286 88 L274 152 Q270 175 246 186 L246 210 L218 210 L218 186 Q190 175 186 152 Z" fill="#eff6ff" fill-opacity="0.65" stroke="#1d4ed8" stroke-width="3"/>
    <path d="M187 137 L274 137 L268 156 Q264 173 244 181 L220 181 Q198 173 193 156 Z" fill="#fef3c7" fill-opacity="0.9"/>
    <path d="M187 137 L274 137 L270 112 L190 112 Z" fill="#bfdbfe" fill-opacity="0.85"/>
    <line x1="218" y1="210" x2="246" y2="210" stroke="#111827" stroke-width="4"/><circle cx="232" cy="210" r="7" fill="#fef3c7" stroke="#b45309" stroke-width="3"/>
    <line x1="232" y1="217" x2="232" y2="228" stroke="#111827" stroke-width="3"/>
    <path d="M202 230 L262 230 L254 266 L210 266 Z" fill="#dcfce7" fill-opacity="0.7" stroke="#15803d" stroke-width="3"/>
    <text x="174" y="72" text-anchor="middle" class="small">${label(0, 'Layer A (lower)')}</text>
    <text x="304" y="118" text-anchor="middle" class="small">${label(1, 'Layer B (upper)')}</text>
    <text x="232" y="246" text-anchor="middle" class="small">${label(2, 'Stopcock')}</text>
    <text x="232" y="282" text-anchor="middle" class="small">${label(3, 'Conical flask')}</text>
  </g>`;
}

function renderConceptMapDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || ['Honesty', 'Kindness', 'Respect', 'Empathy']).map(String).slice(0, 4);
  const positions = [[240, 58], [78, 142], [402, 142], [240, 232]];
  const connectors = positions.map(([x, y]) => `<line x1="240" y1="154" x2="${x}" y2="${y}" stroke="#64748b" stroke-width="2"/>`).join('');
  const boxes = labels.map((entry, index) => {
    const [x, y] = positions[index] || positions[0];
    return `<rect x="${x - 55}" y="${y - 17}" width="110" height="34" rx="8" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2"/>${centeredTextLines(entry, x, y - 3, 15, 'small', 11)}`;
  }).join('');
  return `<g>${connectors}<circle cx="240" cy="154" r="54" fill="#dcfce7" stroke="#15803d" stroke-width="3"/>${centeredTextLines('Healthy Friendship', 240, 149, 15, 'body', 16)}${boxes}<text x="240" y="277" text-anchor="middle" class="small">Concept map; relationships are shown schematically.</text></g>`;
}

function renderGenericLabeledDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || []).map(String).filter(Boolean).slice(0, 4);
  const effectiveLabels = labels.length >= 2 ? labels : ['Part A', 'Part B'];
  const positions = [[72, 68], [408, 68], [72, 236], [408, 236]];
  const connectors = effectiveLabels.map((_, index) => {
    const [x, y] = positions[index];
    const endX = x < 240 ? 130 : 350;
    const endY = y < 150 ? 100 : 205;
    return `<line x1="${x}" y1="${y}" x2="${endX}" y2="${endY}" stroke="#64748b" stroke-width="2"/>`;
  }).join('');
  const boxes = effectiveLabels.map((entry, index) => {
    const [x, y] = positions[index];
    return `<rect x="${x - 58}" y="${y - 15}" width="116" height="30" rx="7" fill="#f8fafc" stroke="#475569" stroke-width="2"/>${centeredTextLines(entry, x, y - 2, 15, 'small', 11)}`;
  }).join('');
  return `<g>${connectors}<rect x="130" y="100" width="220" height="105" rx="12" fill="#f8fafc" stroke="#1d4ed8" stroke-width="3" stroke-dasharray="7 5"/><text x="240" y="145" text-anchor="middle" class="body">SCHEMATIC VISUAL</text><text x="240" y="165" text-anchor="middle" class="small">Use the labelled parts shown.</text>${boxes}<text x="240" y="252" text-anchor="middle" class="small">Not to scale; interpret only as directed by the question.</text></g>`;
}

function renderNurseryBedDiagram(spec: ExamVisualSpec) {
  const labels = (spec.labels || ['Shade', 'Seed drill', 'Nursery bed', 'Watering can']).map(String);
  const label = (index: number, fallback: string): string => escapeXml(labels[index] || fallback);
  const seedRows = [0, 1, 2].map((row) => {
    const y = 182 + row * 12;
    return `<line x1="125" y1="${y}" x2="315" y2="${y}" stroke="#6b7280" stroke-width="2"/>${[0, 1, 2, 3, 4, 5].map((seed) => `<circle cx="${140 + seed * 34}" cy="${y - 4}" r="2.5" fill="#111827"/>`).join('')}`;
  }).join('');
  return `<g>
    <path d="M82 83 Q220 34 358 83 L342 108 Q220 70 98 108 Z" fill="#d1d5db" stroke="#111827" stroke-width="3"/>
    <path d="M98 91 Q220 58 342 91 M105 101 Q220 74 335 101" fill="none" stroke="#4b5563" stroke-width="2"/>
    <line x1="108" y1="94" x2="108" y2="165" stroke="#111827" stroke-width="4"/><line x1="332" y1="94" x2="332" y2="165" stroke="#111827" stroke-width="4"/>
    <path d="M92 168 L348 168 L330 226 L110 226 Z" fill="#9ca3af" stroke="#111827" stroke-width="3"/>
    <path d="M110 226 L330 226 L314 242 L126 242 Z" fill="#6b7280" stroke="#111827" stroke-width="2"/>
    ${seedRows}
    <text x="222" y="56" text-anchor="middle" class="body">${label(0, 'Shade')}</text>
    <line x1="222" y1="61" x2="222" y2="78" stroke="#111827" stroke-width="1.5"/>
    <text x="220" y="263" text-anchor="middle" class="body">${label(2, 'Nursery bed')}</text>
    <line x1="220" y1="248" x2="220" y2="230" stroke="#111827" stroke-width="1.5"/>
    <path d="M42 214 L72 214 L80 229 L46 229 Z M72 217 Q92 215 99 228" fill="none" stroke="#111827" stroke-width="3"/>
    <line x1="54" y1="229" x2="45" y2="245" stroke="#111827" stroke-width="2"/><line x1="72" y1="229" x2="80" y2="245" stroke="#111827" stroke-width="2"/>
    <text x="66" y="278" text-anchor="middle" class="small">${label(1, 'Seed drill')}</text>
    <path d="M390 214 Q407 204 421 214 L421 238 L390 238 Z M421 220 Q440 217 443 228 Q440 238 421 233" fill="none" stroke="#111827" stroke-width="3"/>
    <line x1="396" y1="214" x2="404" y2="204" stroke="#111827" stroke-width="2"/>
    <text x="414" y="263" text-anchor="middle" class="small">${label(3, 'Watering can')}</text>
  </g>`;
}

function parseMarkdownTableRows(lines: string[]): string[][] {
  return lines.map((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  }).filter((cells) => cells.length >= 2 && !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
}

function parseMarkdownTableBlocks(source: string): string[][][] {
  const blocks: string[][][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length >= 2) {
      const rows = parseMarkdownTableRows(current);
      if (rows.length >= 2) blocks.push(rows);
    }
    current = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.trim().includes('|')) current.push(line.trim());
    else flush();
  }
  flush();
  return blocks;
}

function parseMarkdownTable(source: string): string[][] {
  return parseMarkdownTableBlocks(source).flat();
}

function renderTable(spec: ExamVisualSpec, question?: GeneratedExamQuestion): string {
  const sourceLabels = (spec.labels || []).map(String).filter(Boolean);
  const sourceRows = (spec.x_labels || []).map(String).filter(Boolean);
  const values = (spec.values || []).map((value) => String(value));
  const structuredHeaders = (spec.table_headers || spec.labels || []).map(String).filter(Boolean);
  const structuredRows = (spec.table_rows || spec.rows || spec.data || [])
    .filter((row): row is Array<string | number> => Array.isArray(row))
    .map((row) => row.map((value) => String(value ?? '').trim()));
  const parsedRows = sourceRows.map((row) => row.split(',').map((part) => part.trim()).filter(Boolean));
  const commaSeparated = parsedRows.some((parts) => parts.length > 1);
  const promptNumbers = String(spec.prompt || '').match(/[+-]?\s*\d+(?:\.\d+)?/g)?.map((value) => value.replace(/\s+/g, '')) || [];
  const markdownRows = parseMarkdownTable(`${question?.question_text || ''}\n${spec.prompt || ''}`);

  // Prefer the structured table contract, then complete Markdown tables from
  // the learner-facing stem. When both are present, append any additional
  // source table that is not a duplicate of the structured table. This keeps
  // multi-table case studies faithful without manufacturing missing values.
  const markdownTables = parseMarkdownTableBlocks(`${question?.question_text || ''}\n${spec.prompt || ''}`);
  const tableSets: Array<{ headers: string[]; rows: string[][] }> = [];
  if (structuredHeaders.length >= 2 && structuredRows.length > 0) {
    const headers = structuredHeaders.slice(0, 6);
    const rows = structuredRows.map((row) => [...row, ...Array(Math.max(0, headers.length - row.length)).fill('—')].slice(0, headers.length));
    tableSets.push({ headers, rows });
    for (const table of markdownTables) {
      const candidateHeaders = table[0].slice(0, 6);
      const candidateRows = table.slice(1).map((row) => [...row, ...Array(Math.max(0, candidateHeaders.length - row.length)).fill('—')].slice(0, candidateHeaders.length));
      const duplicate = candidateHeaders.join('|') === headers.join('|') && candidateRows.some((row) => rows.some((existing) => existing.join('|') === row.join('|')));
      if (!duplicate && candidateHeaders.length >= 2 && candidateRows.length > 0) tableSets.push({ headers: candidateHeaders, rows: candidateRows });
    }
  } else if (markdownTables.length > 0) {
    for (const table of markdownTables) {
      const columnCount = Math.min(6, Math.max(...table.map((row) => row.length)));
      const headers = table[0].slice(0, columnCount);
      while (headers.length < columnCount) headers.push(`Detail ${headers.length}`);
      const rows = table.slice(1).map((row) => [...row, ...Array(Math.max(0, columnCount - row.length)).fill('—')].slice(0, columnCount));
      tableSets.push({ headers, rows });
    }
  } else if (sourceLabels.length >= 2 && sourceRows.length >= 2 && (values.length >= sourceLabels.length || promptNumbers.length >= sourceLabels.length)) {
    const rowValues = (values.length >= sourceLabels.length ? values : promptNumbers).slice(0, sourceLabels.length);
    tableSets.push({ headers: [sourceRows[0] || 'Item', ...sourceLabels], rows: [[sourceRows[1] || 'Value', ...rowValues]] });
  } else {
    const fallbackHeaders = sourceLabels.length ? sourceLabels.slice(0, 6) : ['Item', 'Value'];
    const fallbackRows = sourceRows.length ? sourceRows.slice(0, 6) : ['Item 1', 'Item 2', 'Item 3', 'Item 4'];
    const inferredColumns = commaSeparated ? Math.max(fallbackHeaders.length, ...parsedRows.map((parts) => parts.length)) : Math.max(fallbackHeaders.length, values.length ? 2 : fallbackHeaders.length);
    const headers = [...fallbackHeaders];
    if (commaSeparated && headers.length === 3 && inferredColumns === 4) headers.splice(2, 0, 'Group');
    while (headers.length < inferredColumns) headers.push(`Detail ${headers.length}`);
    const rows = fallbackRows.map((row, rowIndex) => {
      const parts = parsedRows[rowIndex];
      if (commaSeparated && parts.length > 1) return [...parts, ...Array(Math.max(0, headers.length - parts.length)).fill('—')].slice(0, headers.length);
      return headers.map((_, columnIndex) => columnIndex === 0 ? row : values[rowIndex] ?? '—');
    });
    tableSets.push({ headers, rows });
  }

  const x = 28;
  let y = 58;
  const tableWidth = 424;
  const rowHeight = tableSets.length > 1 ? 20 : (tableSets[0]?.rows.length || 0) > 5 ? 26 : 30;
  return tableSets.map(({ headers, rows }, tableIndex) => {
    const columnWidth = tableWidth / headers.length;
    const header = headers.map((header, index) => {
      const cellX = x + index * columnWidth;
      return `<rect x="${cellX}" y="${y}" width="${columnWidth}" height="${rowHeight}" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1"/>${tableCellText(header, cellX + columnWidth / 2, y + rowHeight / 2, columnWidth - 8, true)}`;
    }).join('');
    const body = rows.map((row, rowIndex) => {
      const cellY = y + rowHeight * (rowIndex + 1);
      return row.map((value, columnIndex) => {
        const cellX = x + columnIndex * columnWidth;
        return `<rect x="${cellX}" y="${cellY}" width="${columnWidth}" height="${rowHeight}" fill="${rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'}" stroke="#9ca3af" stroke-width="1"/>${tableCellText(value, cellX + columnWidth / 2, cellY + rowHeight / 2, columnWidth - 8)}`;
      }).join('');
    }).join('');
    const markup = `${header}${body}`;
    y += (rows.length + 1) * rowHeight + (tableIndex < tableSets.length - 1 ? 12 : 0);
    return markup;
  }).join('');
}

const EXPLICIT_VISUAL_REFERENCE = /\b(?:diagram|figure|map|graph|chart|table|illustration|picture|image|photograph|flowchart|number\s+line)\b|\b(?:shown\s+(?:below|above)|as\s+(?:shown|illustrated)|study\s+(?:it|the)|observe\s+(?:it|the)|refer\s+to|look\s+at|use\s+the)\b/i;

/**
 * Keep generated visuals only when the learner is explicitly asked to use one.
 * This prevents a provider from turning every ordinary question into a generic
 * three-shape placeholder while preserving real diagram/map/chart questions.
 */
export function hasCompleteTableVisual(question: GeneratedExamQuestion): boolean {
  const spec = (question.visual_spec || {}) as ExamVisualSpec;
  if (String(spec.asset_type || '').toLowerCase() !== 'table') return true;
  const headers = (spec.table_headers || spec.labels || []).map(String).filter((value) => value.trim());
  const structuredRows = (spec.table_rows || spec.rows || spec.data || [])
    .filter((row): row is Array<string | number> => Array.isArray(row))
    .map((row) => row.map((value) => String(value ?? '').trim()));
  if (headers.length >= 2 && structuredRows.length > 0 && structuredRows.every((row) => row.length >= headers.length && row.slice(0, headers.length).every((value) => value && value !== '—'))) return true;
  const markdownRows = parseMarkdownTable(`${question.question_text || ''}\n${spec.prompt || ''}`);
  if (markdownRows.length >= 2) return markdownRows.slice(1).every((row) => row.every((value) => value.trim() && value.trim() !== '—'));
  const values = (spec.values || []).map((value) => String(value).trim()).filter(Boolean);
  const promptNumbers = String(spec.prompt || '').match(/[+-]?\s*\d+(?:\.\d+)?/g)?.map((value) => value.replace(/\s+/g, '')) || [];
  return headers.length >= 2 && (values.length >= headers.length || promptNumbers.length >= headers.length);
}

export function hasUsableVisualSpec(question: GeneratedExamQuestion): boolean {
  const spec = (question.visual_spec || {}) as ExamVisualSpec;
  const assetType = String(spec.asset_type || '').toLowerCase();
  const labels = (spec.labels || []).map(String).filter((value) => value.trim());
  const mapRegions = (spec.map_regions || []).map(String).filter((value) => value.trim());
  const values = (spec.values || []).filter((value) => Number.isFinite(Number(value)));
  const xLabels = (spec.x_labels || []).map(String).filter((value) => value.trim());
  const flowLabels = labels.length;
  if (!assetType) return false;
  if (!String(spec.title || spec.caption || '').trim()) return false;
  if (assetType === 'table') return hasCompleteTableVisual(question);
  if (assetType === 'map') {
    const base = String(spec.base_map || '').toLowerCase();
    const legend = (spec.legend || []).map(String).filter((value) => value.trim());
    return (mapRegions.length >= 2 || labels.length >= 2)
      && ['kenya', 'east_africa', 'africa', 'world'].includes(base)
      && legend.length >= 2
      && Boolean(String(spec.scale_text || '').trim())
      && Boolean(String(spec.compass || '').trim());
  }
  if (assetType === 'graph' || assetType === 'chart') return values.length >= 2 && (xLabels.length >= values.length || labels.length >= values.length);
  if (assetType === 'flowchart') return flowLabels >= 2;
  if (assetType === 'number_line') return labels.length >= 2;
  if (assetType === 'diagram' || assetType === 'shape') return labels.length >= 2;
  if (assetType === 'illustration') return Boolean(String(spec.prompt || '').trim()) && labels.length >= 1;
  return false;
}

export function shouldKeepExamVisual(question: GeneratedExamQuestion): boolean {
  if (!question.visual_spec) return false;
  const spec = question.visual_spec as ExamVisualSpec;
  const descriptor = [
    question.question_text,
    spec.title,
    spec.prompt,
    spec.caption,
    ...(spec.labels || []),
    ...(spec.map_regions || []),
  ].filter(Boolean).join(' ');
  return EXPLICIT_VISUAL_REFERENCE.test(descriptor);
}

export function filterUnnecessaryExamVisual(question: GeneratedExamQuestion): GeneratedExamQuestion {
  if (!question.visual_spec || shouldKeepExamVisual(question)) return question;
  return { ...question, image_url: null, visual_spec: null };
}

export function renderExamVisualDataUrl(question: GeneratedExamQuestion): string | null {
  const curatedKey = (question.visual_spec as Record<string, unknown> | null | undefined)?.curated_key;
  if (typeof curatedKey === 'string' && curatedKey && !curatedKey.startsWith('map_')) {
    const curated = curatedVisualDataUrl(curatedKey);
    if (curated) return curated;
  }
  const spec = (question.visual_spec || {}) as ExamVisualSpec;
  const assetType = String(spec.asset_type || '').toLowerCase();
  if (!assetType && !question.image_url) return null;
  const effectiveSpec = assetType === 'map' ? normalizeMapSpec(spec, question) : spec;
  const title = visualTitle(effectiveSpec, question);
  let body = '';
  if (assetType === 'map') body = renderMap(effectiveSpec);
  else if (assetType === 'graph' || assetType === 'chart') body = renderGraph(spec);
  else if (assetType === 'table') body = renderTable(spec, question);
  else if (assetType === 'number_line') body = renderNumberLine(spec);
  else if (assetType === 'shape' || assetType === 'diagram') {
    const descriptor = `${question.question_text} ${spec.title || ''} ${spec.prompt || ''} ${spec.caption || ''} ${(spec.labels || []).join(' ')}`.toLowerCase();
    if (assetType === 'diagram' && /measuring\s+cylinder|meniscus|initial\s+volume|final\s+volume|stone/.test(descriptor)) {
      body = renderMeasuringCylinderDiagram(spec);
    } else if (assetType === 'diagram' && /electric\s+circuit|circuit|cell(?:s)?\b|bulb|switch|connecting\s+wires|ammeter|voltage|potential\s+difference/.test(descriptor)) {
      body = renderCircuitDiagram(spec);
    } else if (assetType === 'diagram' && /nursery|horticulture|shade|seed drill|watering can/.test(descriptor)) {
      body = renderNurseryBedDiagram(spec);
    } else if (assetType === 'diagram' && /distillation|round-bottom|condenser|receiving flask|separation apparatus/.test(descriptor)) {
      body = renderDistillationDiagram(spec);
    } else if (assetType === 'diagram' && /separating funnel|stopcock|immiscible|two distinct layers/.test(descriptor)) {
      body = renderSeparatingFunnelDiagram(spec);
    } else if (assetType === 'diagram' && /filter funnel|filter paper|filtrate|residue|evaporating dish|tripod|bunsen|separation stages|sand.*salt/.test(descriptor)) {
      body = renderSeparationStagesDiagram(spec);
    } else if (assetType === 'diagram' && /food chain|grasshopper|flow of energy|producer|consumer|predator|prey/.test(descriptor)) {
      body = renderFoodChainDiagram(spec);
    } else if (assetType === 'diagram' && /healthy friendship|friendship|qualities|honesty|kindness|respect|empathy/.test(descriptor)) {
      body = renderConceptMapDiagram(spec);
    } else {
      body = renderGenericLabeledDiagram(spec);
    }
  } else if (assetType === 'flowchart') {
    const labels = (spec.labels || ['Start', 'Process', 'Decision', 'End']).slice(0, 4);
    const yPositions = [45, 105, 165, 225];
    body = labels.map((label, index) => {
      const y = yPositions[index];
      const fills = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3'];
      const strokes = ['#1d4ed8', '#15803d', '#b45309', '#be185d'];
      const box = `<rect x="145" y="${y}" width="190" height="42" rx="8" fill="${fills[index]}" stroke="${strokes[index]}" stroke-width="3"/>${textLines(label, 158, y + 18, 164)}`;
      const arrow = index < labels.length - 1
        ? `<path d="M240 ${y + 44} L240 ${yPositions[index + 1] - 10}" class="axis"/><path d="M230 ${yPositions[index + 1] - 20} L240 ${yPositions[index + 1] - 8} L250 ${yPositions[index + 1] - 20}" fill="none" class="axis"/>`
        : '';
      return box + arrow;
    }).join('');
  } else {
    body = textLines(spec.prompt || 'Teacher-approved educational visual', 55, 110, 340);
  }
  const caption = effectiveSpec.caption || (assetType === 'map' ? 'Use the key, scale and north arrow when interpreting this vector map.' : 'Teacher-approved visual');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><style>.title{font:700 18px Arial;fill:#111827}.body{font:14px Arial;fill:#1f2937}.small{font:12px Arial;fill:#374151}.map-label{font:10px Arial;fill:#111827}.map-key-title{font:700 11px Arial;fill:#111827}.table-header{font:700 11px Arial;fill:#1e3a8a}.table-cell{font:11px Arial;fill:#374151}.axis{stroke:#111827;stroke-width:2;fill:none}</style><rect width="480" height="320" rx="12" fill="#ffffff" stroke="#d1d5db" stroke-width="2"/>${centeredTextLines(title, 240, 22, 42, 'title', 18)}${body}<text x="240" y="310" text-anchor="middle" class="small">${escapeXml(caption)}</text></svg>`;
  return dataUrl(svg);
}

export function withRenderedExamVisual(question: GeneratedExamQuestion): GeneratedExamQuestion {
  if (!question.visual_spec) return question;
  const assetType = String((question.visual_spec as ExamVisualSpec).asset_type || '').toLowerCase();
  const visualSpec = (assetType === 'map' ? normalizeMapSpec(question.visual_spec as ExamVisualSpec, question) : question.visual_spec) as Record<string, unknown>;
  if (question.image_url && assetType !== 'map') return { ...question, visual_spec: visualSpec };
  const rendered = renderExamVisualDataUrl({ ...question, image_url: assetType === 'map' ? null : question.image_url, visual_spec: visualSpec });
  return rendered ? { ...question, image_url: rendered, visual_spec: visualSpec } : { ...question, visual_spec: visualSpec };
}
