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
