export interface ClassLabelInput {
  name?: string | null;
  stream?: string | null;
  stream_name?: string | null;
  level?: number | string | null;
  grade_level?: number | string | null;
}

/**
 * Return the canonical user-facing class label: the FULL class name, grade plus
 * stream, so two classes of the same grade are never indistinguishable.
 *
 * REQUIRED FORMAT (issues 3 / 4 / 5)
 * ----------------------------------
 *   Grade 9 + stream "A"      -> "Grade 9A"
 *   Grade 9 + stream "South"  -> "Grade 9 South"
 *   Grade 9 + stream ""       -> "Grade 9"     (school has no streams)
 *
 * A single-character stream is appended with NO separator ("Grade 9A"); a longer
 * stream is appended after a space ("Grade 9 South"). That is the exact shape the
 * issue examples ask for, which is why every page delegates to this helper
 * instead of concatenating the fields itself.
 *
 * `stream_name` is preferred for newer rows, with `stream` retained for older
 * deployments. The guards below handle shapes that already exist in the data:
 *
 *  1. A stream may repeat the grade number — `name="Grade 1"`, `stream="1A"`.
 *     Naive concatenation renders the misleading "Grade 11A"; the repeated grade
 *     prefix is dropped so the label reads "Grade 1A".
 *  2. A stream may equal the class name — `name="PP1"`, `stream="PP1"` — which
 *     would render "PP1 PP1". A stream already starting with the base name is
 *     never repeated.
 *
 * Only the DISPLAY label is derived here; no stored id or class name is modified,
 * and a class with no stream returns the plain name so single-stream schools
 * render exactly as before.
 */
export function formatClassStream(classData: ClassLabelInput | null | undefined): string {
  let base = String(classData?.name || '').trim();

  // Repair a grade name that lost its number in the data (name="Grade",
  // level=8) so the label is not the meaningless "Grade B".
  if (/^grade$/i.test(base)) {
    const level = Number(classData?.grade_level ?? classData?.level);
    if (Number.isFinite(level) && level >= 0) base = `Grade ${level}`;
  }
  if (!base) base = 'Unknown Class';

  const stream = String(classData?.stream_name || classData?.stream || '').trim();
  if (!stream) return base;

  // Guard 2 — never repeat a stream that already begins with the base name.
  if (stream.toLowerCase().startsWith(base.toLowerCase())) {
    return `${base}${stream.slice(base.length)}`.trim();
  }

  // A single-character stream is appended directly: "Grade 9A".
  if (/^[A-Za-z]$/.test(stream)) {
    return base.toLowerCase().endsWith(stream.toLowerCase()) ? base : `${base}${stream}`;
  }

  // Guard 1 — a stream carrying its own grade number ("1A" beside name="Grade 1")
  // keeps the number once instead of producing "Grade 11A".
  const baseGrade = (base.match(/(\d+)\s*$/) || [])[1];
  if (baseGrade) {
    const rest = stream.replace(new RegExp(`^${baseGrade}\\s*`, 'i'), '').trim();
    if (!rest) return base;
    return /^[A-Za-z]$/.test(rest) ? `${base}${rest}` : `${base} ${rest}`;
  }

  return `${base} ${stream}`;
}

/** Build a safe filename fragment while preserving the complete display label elsewhere. */
export function classLabelFilename(classData: ClassLabelInput | null | undefined): string {
  return formatClassStream(classData)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'class';
}


export interface ClassStreamImportRecord extends ClassLabelInput {
  id: string;
}

export interface ClassStreamImportResolution {
  classRow: ClassStreamImportRecord | null;
  error?: string;
}

/** Normalize CSV whitespace/case without collapsing meaningful punctuation or words. */
export function normalizeClassImportLabel(value: string | null | undefined): string {
  const normalized = String(value || '')
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
  // These are equivalent spellings of the single-letter labels produced by
  // formatClassStream: "Grade 5A", "Grade 5 A", and "Grade5A".
  const gradeStream = normalized.match(/^grade\s*(\d+)\s*[-–—]?\s*([a-z])$/i);
  return gradeStream ? `grade ${gradeStream[1]}${gradeStream[2]}` : normalized;
}

/** Build an ID-safe resolver for the school's existing classes/streams. */
export function buildClassStreamImportResolver(classRows: readonly ClassStreamImportRecord[]) {
  const exactLabels = new Map<string, Map<string, ClassStreamImportRecord>>();
  const aliases = new Map<string, Map<string, ClassStreamImportRecord>>();

  const add = (
    index: Map<string, Map<string, ClassStreamImportRecord>>,
    label: string | null | undefined,
    row: ClassStreamImportRecord,
  ) => {
    const key = normalizeClassImportLabel(label);
    if (!key) return;
    const matches = index.get(key) || new Map<string, ClassStreamImportRecord>();
    matches.set(row.id, row);
    index.set(key, matches);
  };

  for (const row of classRows) {
    const label = formatClassStream(row);
    const stream = String(row.stream_name || row.stream || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    add(exactLabels, label, row);
    add(aliases, label, row);
    add(aliases, row.name, row);
    if (stream) {
      add(aliases, `${row.name || ''} Stream ${stream}`, row);
      add(aliases, label.replace(/^grade\s+/i, ''), row);
    }
  }

  const asResult = (
    matches: Map<string, ClassStreamImportRecord> | undefined,
    inputLabel: string,
  ): ClassStreamImportResolution | null => {
    if (!matches?.size) return null;
    if (matches.size === 1) return { classRow: matches.values().next().value || null };
    return {
      classRow: null,
      error: `“${inputLabel}” matches more than one class/stream. Use the full stream label (for example, Grade 5A) or specify the class_name and stream columns separately.`,
    };
  };

  return (className: string, streamName?: string | null): ClassStreamImportResolution => {
    const nameKey = normalizeClassImportLabel(className);
    const streamValue = String(streamName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    const streamKey = normalizeClassImportLabel(streamValue);
    const inputLabel = streamValue ? `${className.trim()} / ${streamValue}` : className.trim();
    if (!nameKey) return { classRow: null, error: 'class_name is required.' };

    if (streamKey) {
      const pairMatches = new Map<string, ClassStreamImportRecord>();
      for (const row of classRows) {
        const rowStream = normalizeClassImportLabel(row.stream_name || row.stream);
        const rowName = normalizeClassImportLabel(row.name);
        const rowLabel = normalizeClassImportLabel(formatClassStream(row));
        const shortLabel = normalizeClassImportLabel(formatClassStream(row).replace(/^grade\s+/i, ''));
        if (rowStream === streamKey && [rowName, rowLabel, shortLabel].includes(nameKey)) {
          pairMatches.set(row.id, row);
        }
      }
      const pairResult = asResult(pairMatches, inputLabel);
      if (pairResult) return pairResult;
      return {
        classRow: null,
        error: `Class/stream “${inputLabel}” was not found in this school. Check the class and stream names, or refresh the school reference data.`,
      };
    }

    const key = normalizeClassImportLabel(className);
    const exactResult = asResult(exactLabels.get(key), inputLabel);
    if (exactResult) return exactResult;
    const aliasResult = asResult(aliases.get(key), inputLabel);
    if (aliasResult) return aliasResult;
    return {
      classRow: null,
      error: `Class/stream “${inputLabel}” was not found in this school. Use the full label shown in Classes (for example, Grade 5A), or refresh the school reference data.`,
    };
  };
}
