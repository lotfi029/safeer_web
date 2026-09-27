import { htmlCacheHeaders } from './cache-headers';
import { buildCsp, cspHeaderName, injectNonce } from './security-headers';

/** A small stylesheet served inline instead of through its `<link>` (a render-blocking round trip). */
export interface InlineStylesheet {
  /** The exact `href` of the `<link rel="stylesheet">` in index.html. */
  href: string;
  css: string;
}

/**
 * Replaces `<link rel="stylesheet" href="{href}" …>` with the same CSS in a nonce'd `<style>`. Leaves
 * the HTML unchanged when the link isn't there.
 */
export function inlineStylesheet(html: string, sheet: InlineStylesheet, nonce: string): string {
  const start = html.indexOf(`<link rel="stylesheet" href="${sheet.href}"`);
  if (start < 0) return html;
  const end = html.indexOf('>', start);
  const css = sheet.css.split('</').join('<\\/');
  return `${html.slice(0, start)}<style nonce="${nonce}">${css}</style>${html.slice(end + 1)}`;
}

/** Drops comments and line breaks from a static stylesheet read at start-up. */
export function compactCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('');
}

/**
 * Post-processes a response from the Angular engine. For HTML (SSR output and the CSR shell served to
 * RenderMode.Client routes alike) it swaps the nonce placeholder, inlines `inline` (the @font-face
 * sheet, Phase 10), and adds CSP + cache headers.
 */
export async function finalizeAngularResponse(
  response: Response,
  /** Request path with its query string (`req.originalUrl`). */
  url: string,
  nonce: string,
  isProduction: boolean,
  inline: InlineStylesheet | null = null,
): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  let html = injectNonce(await response.text(), nonce);
  if (inline) html = inlineStylesheet(html, inline, nonce);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set(cspHeaderName(isProduction), buildCsp(nonce));
  for (const [name, value] of Object.entries(htmlCacheHeaders(url))) {
    headers.set(name, value);
  }
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
