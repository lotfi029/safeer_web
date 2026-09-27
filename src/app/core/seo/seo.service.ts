import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_ORIGIN } from '../config/site-origin';
import { Lang, LANGS } from '../i18n/lang';

export interface SeoData {
  /** Page title; the org name is appended unless `rawTitle` is set. */
  title: string;
  description?: string | null;
  /** Locale-agnostic path, e.g. `/news/some-slug` (`/` for home). */
  path: string;
  lang: Lang;
  image?: string | null;
  type?: 'website' | 'article';
  noindex?: boolean;
  rawTitle?: boolean;
  /** JSON-LD objects, rendered as `<script type="application/ld+json">`. */
  jsonLd?: Record<string, unknown>[];
}

const SITE_NAME: Record<Lang, string> = { ar: 'جمعية سفير الدعوية', en: 'Safeer Association' };
const JSON_LD_ID = 'app-jsonld';
const OG_KEYS = [
  'og:title',
  'og:description',
  'og:type',
  'og:url',
  'og:site_name',
  'og:locale',
  'og:image',
] as const;

/** Title, description, canonical, hreflang ar/en/x-default, OG/Twitter, robots and JSON-LD. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly origin = inject(SITE_ORIGIN);

  set(data: SeoData): void {
    const fullTitle = data.rawTitle ? data.title : `${data.title} | ${SITE_NAME[data.lang]}`;
    const canonical = this.url(data.lang, data.path);
    this.title.setTitle(fullTitle);
    this.tag('name', 'description', data.description ?? null);
    this.tag('name', 'robots', data.noindex ? 'noindex, nofollow' : 'index, follow');
    this.tag('property', 'og:title', fullTitle);
    this.tag('property', 'og:description', data.description ?? null);
    this.tag('property', 'og:type', data.type ?? 'website');
    this.tag('property', 'og:url', canonical);
    this.tag('property', 'og:site_name', SITE_NAME[data.lang]);
    this.tag('property', 'og:locale', data.lang === 'ar' ? 'ar_SA' : 'en_US');
    this.tag('property', 'og:image', data.image ? this.absolute(data.image) : null);
    this.tag('name', 'twitter:card', data.image ? 'summary_large_image' : 'summary');

    this.link('canonical', canonical);
    for (const lang of LANGS) {
      this.link('alternate', this.url(lang, data.path), lang);
    }
    this.link('alternate', this.url('ar', data.path), 'x-default');
    this.setJsonLd(data.jsonLd ?? []);
  }

  /**
   * Private areas (admin, portal) are never indexed. W19: also drops everything a public page set
   * before a client-side navigation here (description, canonical, hreflang, OG/Twitter, JSON-LD),
   * so none of it describes the wrong page.
   */
  noindex(title: string, lang: Lang): void {
    this.title.setTitle(`${title} | ${SITE_NAME[lang]}`);
    this.tag('name', 'robots', 'noindex, nofollow');
    for (const key of ['description', 'twitter:card']) {
      this.tag('name', key, null);
    }
    for (const key of OG_KEYS) {
      this.tag('property', key, null);
    }
    this.document.head
      .querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]')
      .forEach((el) => el.remove());
    this.setJsonLd([]);
  }

  url(lang: Lang, path: string): string {
    const clean = path === '/' || path === '' ? '' : path.startsWith('/') ? path : `/${path}`;
    return `${this.origin}/${lang}${clean}`;
  }

  private absolute(pathOrUrl: string): string {
    return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${this.origin}${pathOrUrl}`;
  }

  private tag(attr: 'name' | 'property', key: string, content: string | null): void {
    const selector = `${attr}="${key}"`;
    if (content) {
      this.meta.updateTag({ [attr]: key, content }, selector);
    } else {
      this.meta.removeTag(selector);
    }
  }

  private link(rel: 'canonical' | 'alternate', href: string, hreflang?: string): void {
    const head = this.document.head;
    const selector = hreflang
      ? `link[rel="${rel}"][hreflang="${hreflang}"]`
      : `link[rel="${rel}"]:not([hreflang])`;
    let el = head.querySelector<HTMLLinkElement>(selector);
    if (!el) {
      el = this.document.createElement('link');
      el.setAttribute('rel', rel);
      if (hreflang) {
        el.setAttribute('hreflang', hreflang);
      }
      head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  private setJsonLd(items: Record<string, unknown>[]): void {
    const head = this.document.head;
    head.querySelector(`#${JSON_LD_ID}`)?.remove();
    if (!items.length) {
      return;
    }
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // `<` is escaped so API content can never close the script element.
    script.textContent = JSON.stringify(items.length === 1 ? items[0] : items).replace(
      /</g,
      '\\u003c',
    );
    head.appendChild(script);
  }
}
