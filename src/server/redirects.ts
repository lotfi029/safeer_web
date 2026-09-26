import type { NextFunction, Request, Response } from 'express';

export type Lang = 'ar' | 'en';
export const LANGS: readonly Lang[] = ['ar', 'en'];
export const DEFAULT_LANG: Lang = 'ar';
export const LANG_COOKIE = 'lang';

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

export function preferredLang(cookieHeader: string | undefined): Lang {
  const value = readCookie(cookieHeader, LANG_COOKIE);
  return value === 'en' || value === 'ar' ? value : DEFAULT_LANG;
}

/** Paths that are never normalised or redirected here (proxied or served as files). */
const PASSTHROUGH = /^\/(api|files)(\/|$)/;

/**
 * Sessions plan R6:
 * - `/` → 302 to `/ar` (or `/en` from the `lang` cookie) with `Vary: Cookie` + `no-store`.
 * - trailing slash → 301 to the path without it (query string kept).
 * Unknown languages fall through to Angular, which answers 404.
 */
export function langRedirects() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    const [path, ...rest] = req.originalUrl.split('?');
    const query = rest.length ? `?${rest.join('?')}` : '';
    if (path === '/') {
      res.setHeader('Vary', 'Cookie');
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(302, `/${preferredLang(req.headers.cookie)}${query}`);
      return;
    }
    if (path.length > 1 && path.endsWith('/') && !PASSTHROUGH.test(path)) {
      const trimmed = path.replace(/\/+$/, '') || '/';
      // Guard against protocol-relative redirects (`//evil.example/`).
      const safe = trimmed.startsWith('//') ? `/${trimmed.replace(/^\/+/, '')}` : trimmed;
      res.redirect(301, `${safe}${query}`);
      return;
    }
    next();
  };
}
