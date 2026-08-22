import type { GeneratedExamQuestion } from './exam-schema';

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

function renderMap(spec: ExamVisualSpec): string {
  const regions = (spec.map_regions || spec.labels || ['Region A', 'Region B', 'Region C']).slice(0, 6);
  const polygon = '<path d="M105 55 L235 42 L335 85 L390 160 L338 245 L230 268 L130 232 L75 150 Z" fill="#fee2e2" stroke="#991b1b" stroke-width="4"/>';
  const labels = regions.map((label, index) => {
    const positions = [[150, 110], [260, 90], [315, 155], [245, 190], [145, 190], [205, 135]];
    const [x, y] = positions[index] || [200, 150];
    return `<circle cx="${x}" cy="${y}" r="5" fill="#1d4ed8"/><text x="${x + 9}" y="${y + 4}" class="small">${escapeXml(label)}</text>`;
  }).join('');
  return `${polygon}${labels}<path d="M410 65 L410 35 L400 48 L420 48 Z" fill="#111827"/><text x="410" y="25" text-anchor="middle" class="small">N</text><line x1="70" y1="285" x2="150" y2="285" stroke="#111827" stroke-width="3"/><text x="160" y="289" class="small">schematic scale</text>`;
}

function renderCircuitDiagram(spec: ExamVisualSpec): string {
  const labels = (spec.labels || []).map(String);
  const label = (index: number, fallback: string): string => escapeXml(labels[index] || fallback);
  return `<g>
    <path d="M58 92 H108 M152 92 H205 M255 92 H332 M388 92 V222 H58 V92" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="108" y1="72" x2="108" y2="112" stroke="#1d4ed8" stroke-width="6"/><line x1="124" y1="80" x2="124" y2="104" stroke="#1d4ed8" stroke-width="4"/>
    <line x1="136" y1="72" x2="136" y2="112" stroke="#1d4ed8" stroke-width="6"/><line x1="152" y1="80" x2="152" y2="104" stroke="#1d4ed8" stroke-width="4"/>
    <text x="116" y="62" text-anchor="middle" class="small">+</text><text x="144" y="62" text-anchor="middle" class="small">−</text>
    <circle cx="360" cy="92" r="28" fill="#fef3c7" stroke="#b45309" stroke-width="4"/><path d="M344 76 L376 108 M376 76 L344 108" stroke="#b45309" stroke-width="3"/>
    <circle cx="205" cy="92" r="5" fill="#111827"/><circle cx="255" cy="92" r="5" fill="#111827"/><path d="M205 92 L244 68" fill="none" stroke="#b45309" stroke-width="4" stroke-linecap="round"/>
    <text x="130" y="145" text-anchor="middle" class="body">${label(0, 'Cells in series')}</text>
    <text x="230" y="55" text-anchor="middle" class="body">${label(2, 'Switch')}</text>
    <text x="360" y="140" text-anchor="middle" class="body">${label(1, 'Bulb')}</text>
    <text x="225" y="250" text-anchor="middle" class="body">${label(3, 'Connecting wires')}</text>
    <text x="240" y="285" text-anchor="middle" class="small">Closed circuit with two cells, a switch and a bulb.</text>
  </g>`;
}

function renderNurseryBedDiagram(spec: ExamVisualSpec): string {
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
  const spec = (question.visual_spec || {}) as ExamVisualSpec;
  const assetType = String(spec.asset_type || '').toLowerCase();
  if (!assetType && !question.image_url) return null;
  const title = visualTitle(spec, question);
  let body = '';
  if (assetType === 'map') body = renderMap(spec);
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
    } else {
      body = '<rect x="95" y="70" width="120" height="100" fill="#dbeafe" stroke="#1d4ed8" stroke-width="4"/><circle cx="300" cy="120" r="52" fill="#dcfce7" stroke="#15803d" stroke-width="4"/><path d="M90 245 L220 245 L155 185 Z" fill="#fef3c7" stroke="#b45309" stroke-width="4"/>';
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
  const caption = spec.caption || (assetType === 'map' ? 'Schematic map for interpretation; verify labels before approval.' : 'Teacher-approved visual');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><style>.title{font:700 18px Arial;fill:#111827}.body{font:14px Arial;fill:#1f2937}.small{font:12px Arial;fill:#374151}.table-header{font:700 11px Arial;fill:#1e3a8a}.table-cell{font:11px Arial;fill:#374151}.axis{stroke:#111827;stroke-width:2;fill:none}</style><rect width="480" height="320" rx="12" fill="#ffffff" stroke="#d1d5db" stroke-width="2"/>${centeredTextLines(title, 240, 22, 42, 'title', 18)}${body}<text x="240" y="310" text-anchor="middle" class="small">${escapeXml(caption)}</text></svg>`;
  return dataUrl(svg);
}

export function withRenderedExamVisual(question: GeneratedExamQuestion): GeneratedExamQuestion {
  if (question.image_url || !question.visual_spec) return question;
  const rendered = renderExamVisualDataUrl(question);
  return rendered ? { ...question, image_url: rendered } : question;
}
