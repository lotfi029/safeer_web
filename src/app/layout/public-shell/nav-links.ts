import { computed, inject, Injectable } from '@angular/core';
import { LocaleService } from '../../core/i18n/locale.service';
import { navLabel, pathForNavSlug } from '../../core/site/nav-routes';
import { SiteStore } from '../../core/site/site.store';

export interface ShellNavLink {
  slug: string;
  /** The API page title (drawer). */
  label: string;
  /** W5: the short header-bar label, falling back to `label`. */
  shortLabel: string;
  link: string;
  /** `home` must match exactly, others by prefix. */
  exact: boolean;
}

/**
 * Header bar slugs (prototype `NAV`): the full 10-item API nav does not fit a header at 1100px, so
 * the bar shows these primary pages (still in API order, only if published); the drawer lists all.
 */
export const HEADER_SLUGS: ReadonlySet<string> = new Set([
  'home',
  'about',
  'work',
  'scholarships',
  'news',
  'partners',
  'contact',
]);

/** Header/drawer navigation built from `GET /site` → `nav` (API order, published pages only). */
@Injectable({ providedIn: 'root' })
export class ShellNav {
  private readonly site = inject(SiteStore);
  private readonly locale = inject(LocaleService);

  readonly links = computed<ShellNavLink[]>(() =>
    (this.site.site()?.nav ?? []).flatMap((item) => {
      const path = pathForNavSlug(item.slug);
      return path
        ? [
            {
              slug: item.slug,
              label: item.label,
              shortLabel: navLabel(item.slug, this.locale.lang(), item.label),
              link: this.locale.link(path),
              exact: path === '/',
            },
          ]
        : [];
    }),
  );

  readonly headerLinks = computed(() => this.links().filter((l) => HEADER_SLUGS.has(l.slug)));
}
