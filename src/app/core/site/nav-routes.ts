import type { NavSlug } from '../api/models';

/**
 * API nav slugs → app paths (docs/api/CONTRACT-NOTES.md "Public endpoints": slug ≠ route).
 * Paths are locale-agnostic; prefix with `LocaleService.link()`.
 */
export const NAV_SLUG_PATHS: Readonly<Record<NavSlug, string>> = {
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

export function pathForNavSlug(slug: string): string | null {
  return (NAV_SLUG_PATHS as Record<string, string>)[slug] ?? null;
}

/**
 * Button URLs from the API are locale-agnostic paths after B9 (`/apply`). Seeds before B9 still hold
 * prototype hash routes (`#/work`); map those too. External http(s) URLs pass through; anything
 * else (javascript:, //host, …) is dropped (backend C10 validates too).
 */
export function appPathForApiUrl(
  url: string | null | undefined,
): { internal: string } | { external: string } | null {
  if (!url) {
    return null;
  }
  const value = url.trim();
  if (value.startsWith('#/')) {
    const slug = value.slice(2).split(/[?#]/)[0];
    const mapped = pathForNavSlug(slug === 'work' ? 'work' : slug) ?? `/${slug}`;
    return { internal: mapped };
  }
  if (/^\/(?!\/)/.test(value)) {
    return { internal: value };
  }
  if (/^https?:\/\//i.test(value)) {
    return { external: value };
  }
  return null;
}

/**
 * W5: short header-bar labels (the prototype's `NAV`). The API nav carries the full page titles
 * ("Scholarships for international students in Saudi universities"), which overflow the header;
 * the drawer keeps those. A slug missing here falls back to the API title.
 */
export const NAV_SHORT_LABELS: Readonly<Record<'ar' | 'en', Partial<Record<NavSlug, string>>>> = {
  ar: {
    home: 'الرئيسية',
    about: 'من نحن',
    work: 'مجالات عملنا',
    scholarships: 'منح الوافدين',
    news: 'الأخبار',
    partners: 'شركاؤنا',
    contact: 'تواصل معنا',
  },
  en: {
    home: 'Home',
    about: 'About',
    work: 'Our work',
    scholarships: 'Scholarships',
    news: 'News',
    partners: 'Partners',
    contact: 'Contact',
  },
};

export function navLabel(slug: string, lang: 'ar' | 'en', apiTitle: string): string {
  return (NAV_SHORT_LABELS[lang] as Record<string, string | undefined>)[slug] ?? apiTitle;
}
