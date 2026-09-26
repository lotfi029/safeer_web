import type { NextFunction, Request, Response } from 'express';
import { TtlCache } from './ttl-cache';

/**
 * Legacy WordPress URLs (the old site ran on a clinic template). Families that never belonged to
 * the association answer 410 Gone; everything else outside `/ar|/en` is looked up once in
 * `GET /api/v1/redirects/resolve` and cached (hits and misses) for 5 minutes (review F9).
 */
export const GONE_PATTERNS: readonly RegExp[] = [
  /^\/doctors?(\/|$|-)/i,
  /^\/doctor-category(\/|$)/i,
  /^\/appointments?(\/|$)/i,
  /^\/cart(\/|$)/i,
  /^\/checkout(\/|$)/i,
  /^\/category\/(neurology|cardiology|pathology|pediatric|laboratory)(\/|$)/i,
];

/** Paths never looked up: locale routes, API/files proxies, health, sitemap/robots, static files. */
const SKIP =
  /^\/(?:(?:ar|en)(?:\/|$)|api(?:\/|$)|files(?:\/|$)|healthz$|sitemap\.xml$|robots\.txt$)/;
const STATIC_FILE = /\.[a-z0-9]{2,5}$/i;

export function isGone(path: string): boolean {
  return GONE_PATTERNS.some((p) => p.test(path));
}

export function shouldLookup(path: string): boolean {
  return (
    path !== '/' &&
    !SKIP.test(path) &&
    !(STATIC_FILE.test(path) && !/\.(php|html?|aspx?)$/i.test(path))
  );
}

export interface ResolvedRedirect {
  toPath: string;
  statusCode: 301 | 302 | 307 | 308;
}

/** Only same-site paths are followed (never `//host` or absolute URLs: open redirect, C10). */
export function sanitizeRedirect(body: unknown): ResolvedRedirect | null {
  const b = body as { toPath?: unknown; statusCode?: unknown } | null;
  if (!b || typeof b.toPath !== 'string' || !/^\/(?!\/)/.test(b.toPath)) {
    return null;
  }
  const code = Number(b.statusCode);
  return {
    toPath: b.toPath,
    statusCode: code === 302 || code === 307 || code === 308 ? code : 301,
  };
}

export type Resolver = (path: string) => Promise<ResolvedRedirect | null | 'error'>;

export function apiRedirectResolver(apiInternalUrl: string, timeoutMs = 2000): Resolver {
  return async (path) => {
    try {
      const res = await fetch(
        `${apiInternalUrl}/api/v1/redirects/resolve?path=${encodeURIComponent(path)}`,
        {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { accept: 'application/json' },
        },
      );
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        return 'error';
      }
      return sanitizeRedirect(await res.json());
    } catch {
      return 'error';
    }
  };
}

export const GONE_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>410</title></head><body><main><h1>هذه الصفحة لم تعد متاحة</h1><p lang="en" dir="ltr">This page is gone.</p><p><a href="/ar">الرئيسية</a> · <a href="/en" lang="en">Home</a></p></main></body></html>`;

export function legacyRedirects(
  resolve: Resolver,
  cache = new TtlCache<ResolvedRedirect | null>(5 * 60_000),
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    const path = req.path;
    if (isGone(path)) {
      res.status(410).setHeader('Cache-Control', 'public, max-age=86400');
      res.type('html').send(GONE_HTML);
      return;
    }
    if (!shouldLookup(path)) {
      return next();
    }
    let hit = cache.get(path);
    if (hit === undefined) {
      const result = await resolve(path);
      if (result === 'error') {
        return next(); // API trouble: fall through to the 404, don't cache.
      }
      cache.set(path, result);
      hit = result;
    }
    if (hit) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.redirect(hit.statusCode, hit.toPath);
      return;
    }
    next();
  };
}
