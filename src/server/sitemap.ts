import type { Request, Response } from 'express';
import { TtlCache } from './ttl-cache';

export interface SitemapIndexData {
  pages: { slug: string; updatedAt?: string }[];
  posts: { slug: string; updatedAt?: string }[];
  categories: { slug: string }[];
}

/** Public app routes always listed (locale-agnostic). Page slugs map onto these (slug ≠ route). */
export const STATIC_ROUTES = [
  '/',
  '/about',
  '/board',
  '/work-areas',
  '/scholarships',
  '/news',
  '/testimonials',
  '/partners',
  '/documents',
  '/contact',
  '/apply',
];
const PAGE_SLUG_ROUTES: Record<string, string> = {
  home: '/',
  about: '/about',
  board: '/board',
  work: '/work-areas',
  scholarships: '/scholarships',
  news: '/news',
  testimonials: '/testimonials',
  partners: '/partners',
  documents: '/documents',
  contact: '/contact',
};

function xmlEscape(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

function urlEntry(origin: string, path: string, lastmod?: string): string {
  const loc = (lang: string) => xmlEscape(`${origin}/${lang}${path === '/' ? '' : path}`);
  const alternates = ['ar', 'en']
    .map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${loc(l)}"/>`)
    .concat(`<xhtml:link rel="alternate" hreflang="x-default" href="${loc('ar')}"/>`)
    .join('');
  const mod =
    lastmod && !Number.isNaN(Date.parse(lastmod))
      ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`
      : '';
  return ['ar', 'en'].map((l) => `<url><loc>${loc(l)}</loc>${mod}${alternates}</url>`).join('');
}

/** Builds sitemap.xml with ar/en alternates from `GET /sitemap-index` (B15). */
export function buildSitemap(origin: string, index: SitemapIndexData | null): string {
  const lastmods = new Map<string, string | undefined>();
  for (const page of index?.pages ?? []) {
    const route = PAGE_SLUG_ROUTES[page.slug];
    if (route) {
      lastmods.set(route, page.updatedAt);
    }
  }
  const entries = STATIC_ROUTES.map((route) => urlEntry(origin, route, lastmods.get(route)));
  for (const post of index?.posts ?? []) {
    if (/^[a-z0-9-]+$/i.test(post.slug)) {
      entries.push(urlEntry(origin, `/news/${post.slug}`, post.updatedAt));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join('')}</urlset>\n`;
}

export function buildRobots(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /ar/admin',
    'Disallow: /en/admin',
    'Disallow: /ar/portal',
    'Disallow: /en/portal',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapHandler(
  origin: string,
  fetchIndex: () => Promise<SitemapIndexData | null>,
  cache = new TtlCache<string>(10 * 60_000, 1),
) {
  return async (_req: Request, res: Response): Promise<void> => {
    let xml = cache.get('sitemap');
    if (!xml) {
      const index = await fetchIndex();
      xml = buildSitemap(origin, index);
      if (index) {
        cache.set('sitemap', xml); // cache only complete sitemaps (review F9: 10 min)
      }
    }
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.type('application/xml').send(xml);
  };
}

export function apiSitemapIndex(
  apiInternalUrl: string,
  timeoutMs = 5000,
): () => Promise<SitemapIndexData | null> {
  return async () => {
    try {
      const res = await fetch(`${apiInternalUrl}/api/v1/sitemap-index`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok ? ((await res.json()) as SitemapIndexData) : null;
    } catch {
      return null;
    }
  };
}
