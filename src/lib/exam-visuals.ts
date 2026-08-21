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

function renderTable(spec: ExamVisualSpec): string {
  const sourceHeaders = (spec.labels || ['Item', 'Value']).map(String).slice(0, 4);
  const sourceRows = (spec.x_labels || ['Item 1', 'Item 2', 'Item 3', 'Item 4']).map(String).slice(0, 6);
  const values = spec.values || [];
  const parsedRows = sourceRows.map((row) => row.split(',').map((part) => part.trim()).filter(Boolean));
  const commaSeparated = parsedRows.some((parts) => parts.length > 1);
  const inferredColumns = commaSeparated ? Math.max(sourceHeaders.length, ...parsedRows.map((parts) => parts.length)) : Math.max(sourceHeaders.length, values.length ? 2 : sourceHeaders.length);
  const headers = [...sourceHeaders];
  if (commaSeparated && headers.length === 3 && inferredColumns === 4) headers.splice(2, 0, 'Group');
  while (headers.length < inferredColumns) headers.push(`Detail ${headers.length}`);
  const rows = sourceRows.map((row, rowIndex) => {
    const parts = parsedRows[rowIndex];
    if (commaSeparated && parts.length > 1) return [...parts, ...Array(Math.max(0, headers.length - parts.length)).fill('—')].slice(0, headers.length);
    return headers.map((_, columnIndex) => columnIndex === 0 ? row : values[rowIndex] ?? '—');
  });
  const x = 28;
  const y = 58;
  const tableWidth = 424;
  const rowHeight = rows.length > 5 ? 26 : 30;
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
  return `${header}${body}`;
}

export function renderExamVisualDataUrl(question: GeneratedExamQuestion): string | null {
  const spec = (question.visual_spec || {}) as ExamVisualSpec;
  const assetType = String(spec.asset_type || '').toLowerCase();
  if (!assetType && !question.image_url) return null;
  const title = visualTitle(spec, question);
  let body = '';
  if (assetType === 'map') body = renderMap(spec);
  else if (assetType === 'graph' || assetType === 'chart') body = renderGraph(spec);
  else if (assetType === 'table') body = renderTable(spec);
  else if (assetType === 'number_line') body = renderNumberLine(spec);
  else if (assetType === 'shape' || assetType === 'diagram') {
    body = '<rect x="95" y="70" width="120" height="100" fill="#dbeafe" stroke="#1d4ed8" stroke-width="4"/><circle cx="300" cy="120" r="52" fill="#dcfce7" stroke="#15803d" stroke-width="4"/><path d="M90 245 L220 245 L155 185 Z" fill="#fef3c7" stroke="#b45309" stroke-width="4"/>';
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
