export type SourceReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'disabled';

export interface CurriculumSourceRecord {
  id: string;
  source_name: string;
  source_url: string | null;
  license_status: 'official_public' | 'licensed' | 'school_owned' | 'permission_granted' | 'pending_review' | 'rejected';
  retrieval_status: SourceReviewStatus;
}

export interface RetrievedSourceDraft {
  title: string;
  contentType: string;
  summaryDraft: string;
  retrievedAt: string;
}

const DISALLOWED_HOSTS = new Set(['localhost', '0.0.0.0', '127.0.0.1', '::1']);
const PRIVATE_ADDRESS = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
const MAX_SOURCE_BYTES = 700_000;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string): string {
  return decodeEntities(value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 255) : 'Untitled curriculum source';
}

export function assertReviewableSource(source: CurriculumSourceRecord): URL {
  if (source.retrieval_status !== 'approved') {
    throw new Error('This source has not been approved for retrieval.');
  }
  if (!['official_public', 'licensed', 'school_owned', 'permission_granted'].includes(source.license_status)) {
    throw new Error('This source does not have an approved licensing or permission status.');
  }
  if (!source.source_url) throw new Error('The approved source does not have a URL.');

  let url: URL;
  try { url = new URL(source.source_url); } catch { throw new Error('The approved source URL is invalid.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP(S) curriculum sources may be reviewed.');
  if (DISALLOWED_HOSTS.has(url.hostname) || PRIVATE_ADDRESS.test(url.hostname)) {
    throw new Error('Private or local network addresses cannot be retrieved.');
  }
  if (url.username || url.password) throw new Error('Source URLs must not contain credentials.');
  return url;
}

/**
 * Retrieves a limited, review-only draft. It deliberately does not copy a full document,
 * download assets, train a model, or mark a knowledge chunk as approved.
 */
export async function retrieveReviewDraft(source: CurriculumSourceRecord): Promise<RetrievedSourceDraft> {
  let url = assertReviewableSource(source);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    let response: Response | null = null;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'ZamifuCurriculumReview/1.0 (+review-only)' },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw new Error('The source redirect did not include a destination.');
      const redirectedUrl = new URL(location, url);
      const candidate: CurriculumSourceRecord = { ...source, source_url: redirectedUrl.toString() };
      url = assertReviewableSource(candidate);
      if (redirects === 3) throw new Error('The source redirected too many times.');
    }
    if (!response || !response.ok) throw new Error(`Source retrieval failed with status ${response?.status || 'unknown'}.`);
    const contentType = response.headers.get('content-type')?.toLowerCase() || 'application/octet-stream';
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_SOURCE_BYTES) throw new Error('The source is too large for review-only retrieval.');
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error('Only HTML and plain-text pages are eligible for automatic draft retrieval. Upload a licensed document through the school workflow instead.');
    }

    const text = await response.text();
    if (text.length > MAX_SOURCE_BYTES) throw new Error('The retrieved source exceeds the review limit.');
    const readable = contentType.includes('text/html') ? stripHtml(text) : text.replace(/\s+/g, ' ').trim();
    if (!readable) throw new Error('The source did not contain usable text.');

    return {
      title: contentType.includes('text/html') ? extractTitle(text) : source.source_name,
      contentType,
      // A short draft is deliberately kept for human review; it is never automatically approved.
      summaryDraft: readable.slice(0, 3500),
      retrievedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
