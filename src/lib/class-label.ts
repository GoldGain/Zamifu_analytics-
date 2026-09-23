export interface ClassLabelInput {
  name?: string | null;
  stream?: string | null;
  stream_name?: string | null;
}

/**
 * Return the canonical user-facing class label without shortening the stream.
 * `stream_name` is preferred for newer rows, with `stream` retained for older
 * deployments. IDs and stored class names are never changed by this helper.
 */
export function formatClassStream(classData: ClassLabelInput | null | undefined): string {
  const name = String(classData?.name || '').trim() || 'Unknown Class';
  const stream = String(classData?.stream_name || classData?.stream || '').trim();
  return stream ? `${name} (${stream})` : name;
}

/** Build a safe filename fragment while preserving the complete display label elsewhere. */
export function classLabelFilename(classData: ClassLabelInput | null | undefined): string {
  return formatClassStream(classData)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'class';
}
