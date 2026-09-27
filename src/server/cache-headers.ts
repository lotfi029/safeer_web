/** Areas rendered client-side, never indexed and never cached (admin dashboard, student portal). */
const PRIVATE_AREA = /^\/(ar|en)\/(admin|portal)(\/|$)/;

export function isPrivateArea(path: string): boolean {
  return PRIVATE_AREA.test(path);
}

/**
 * Cache-Control for HTML (sessions plan R2): a per-request CSP nonce must never sit behind a shared
 * cache, so public SSR HTML is `no-cache` (browser revalidation only). Admin/portal are `no-store`,
 * and so is any `?preview=` URL (W18): an unpublished post must not stay in any cache.
 * `url` is the request path, optionally with its query string.
 */
export function htmlCacheHeaders(url: string): Record<string, string> {
  const { pathname, searchParams } = new URL(url, 'http://localhost');
  if (isPrivateArea(pathname)) {
    return { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  }
  if (searchParams.has('preview')) {
    return { 'Cache-Control': 'no-store' };
  }
  return { 'Cache-Control': 'no-cache' };
}

/** Angular emits content-hashed file names such as `main-ABCD1234.js` / `styles-ABCD1234.css`. */
const HASHED_ASSET = /-[A-Za-z0-9_-]{8}\.(js|mjs|css|woff2?|ttf|svg|png|jpe?g|webp|avif)$/;

export function staticCacheControl(filePath: string): string {
  return HASHED_ASSET.test(filePath)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600';
}
