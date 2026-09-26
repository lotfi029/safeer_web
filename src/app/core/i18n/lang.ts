import { CanMatchFn, Route, UrlSegment } from '@angular/router';

export type Lang = 'ar' | 'en';
export const LANGS: readonly Lang[] = ['ar', 'en'];
export const DEFAULT_LANG: Lang = 'ar';
export const LANG_COOKIE = 'lang';

export function isLang(value: unknown): value is Lang {
  return value === 'ar' || value === 'en';
}

export function dirFor(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** `/:lang` only matches `ar` and `en`; anything else falls through to the 404 route (R6). */
export const langCanMatch: CanMatchFn = (_route: Route, segments: UrlSegment[]) =>
  isLang(segments[0]?.path);
