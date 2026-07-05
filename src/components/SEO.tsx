/**
 * SEO.tsx
 * Reusable SEO component that injects meta tags, Open Graph tags,
 * Twitter Card tags, and JSON-LD structured data into the document head.
 *
 * Usage:
 *   <SEO
 *     title="Teacher Dashboard | Zamifu Analytics"
 *     description="Manage your classes, upload results, and track student performance."
 *     path="/teacher"
 *   />
 */

import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  structuredData?: object;
}

const SITE_NAME = 'Zamifu Analytics';
const BASE_URL = 'https://zamifu.company';
const DEFAULT_DESCRIPTION =
  "Zamifu Analytics is Kenya's leading intelligent school management platform. Manage learners, learning areas, assessments, fees, and report cards.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '',
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  structuredData,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Kenya's Intelligent School Management Platform`;
  const canonicalUrl = `${BASE_URL}${path}`;

  useEffect(() => {
    // ── Title ──────────────────────────────────────────────────────────────────
    document.title = fullTitle;

    // ── Helper: set or create a <meta> tag ────────────────────────────────────
    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        // Determine attribute type from selector
        if (selector.includes('property=')) {
          const propMatch = selector.match(/property="([^"]+)"/);
          el.setAttribute('property', propMatch ? propMatch[1] : '');
        } else if (selector.includes('name=')) {
          const nameMatch = selector.match(/name="([^"]+)"/);
          el.setAttribute('name', nameMatch ? nameMatch[1] : '');
        }
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // ── Standard meta ─────────────────────────────────────────────────────────
    setMeta('meta[name="description"]', description);
    setMeta('meta[name="robots"]', noindex ? 'noindex,nofollow' : 'index,follow');
    setMeta('meta[name="keywords"]', 'Zamifu, Zamifu Analytics, Zamifu Schools, Zamifu Results, school management system Kenya, intelligent school management, CBE Kenya, competency based education, student results portal, Kenya school portal, Zamifu School Management, 8-4-4 curriculum, school system Kenya');

    // ── Canonical ─────────────────────────────────────────────────────────────
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // ── Open Graph ────────────────────────────────────────────────────────────
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[property="og:type"]', type);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[property="og:site_name"]', SITE_NAME);
    setMeta('meta[property="og:locale"]', 'en_KE');

    // ── Twitter Card ──────────────────────────────────────────────────────────
    setMeta('meta[name="twitter:card"]', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', image);

    // ── JSON-LD Structured Data ───────────────────────────────────────────────
    const defaultSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: BASE_URL,
      description: DEFAULT_DESCRIPTION,
      applicationCategory: 'EducationApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'KES',
      },
      author: {
        '@type': 'Organization',
        name: 'Zamifu Analytics',
        url: BASE_URL,
      },
      keywords: 'Zamifu, Zamifu Analytics, school management Kenya, intelligent education, student results, report card, CBE, 8-4-4',
    };

    const schemaData = structuredData || defaultSchema;
    let ldScript = document.querySelector<HTMLScriptElement>('script[data-seo="zamifu-analytics"]');
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.setAttribute('type', 'application/ld+json');
      ldScript.setAttribute('data-seo', 'zamifu-analytics');
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(schemaData);

    // Cleanup: restore title on unmount
    return () => {
      // Keep the title as-is; the next page will set its own
    };
  }, [fullTitle, description, canonicalUrl, image, type, noindex, structuredData]);

  return null;
}
