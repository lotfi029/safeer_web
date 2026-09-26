import { inject } from '@angular/core';
import type { Page } from '../../core/api/models';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { SiteStore } from '../../core/site/site.store';

export interface PageSeoInput {
  page: Page | null | undefined;
  path: string;
  /** Used when the page has no title (e.g. the API page is missing). */
  fallbackTitle?: string;
  jsonLd?: Record<string, unknown>[];
  image?: string | null;
  noindex?: boolean;
}

/**
 * Returns a setter for CMS page SEO (title/description from `GET /pages/:slug` meta, falling back to
 * the site SEO description). Create it in a field initializer, call it from an `effect()` once the
 * resolved data input is available:
 *
 *   private readonly seo = pageSeo();
 *   constructor() { effect(() => this.seo({ page: this.data().data?.page, path: '/board' })); }
 */
export function pageSeo(): (input: PageSeoInput) => void {
  const seo = inject(SeoService);
  const locale = inject(LocaleService);
  const site = inject(SiteStore);
  return ({ page, path, fallbackTitle, jsonLd, image, noindex }) =>
    seo.set({
      title:
        page?.metaTitle || page?.title || fallbackTitle || site.site()?.settings?.orgName || '',
      description: page?.metaDescription || site.site()?.settings?.seoDescription || null,
      path,
      lang: locale.lang(),
      image: image ?? null,
      jsonLd,
      noindex,
    });
}
