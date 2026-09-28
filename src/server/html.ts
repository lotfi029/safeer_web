import { htmlCacheHeaders, isPrivateArea } from './cache-headers';
import { buildCsp, cspHeaderName, injectNonce } from './security-headers';

/** A small stylesheet served inline instead of through its `<link>` (a render-blocking round trip). */
export interface InlineStylesheet {
  /** The exact `href` of the `<link rel="stylesheet">` in index.html. */
  href: string;
  css: string;
  /**
   * On public pages, only this part is inlined and the full sheet (`href`) loads after the first
   * paint (`deferStylesheet`). For the @font-face sheet: the body-text faces (`bodyFontFaces`).
   */
  firstPaintCss?: string;
}

/** A nonce'd script running `body` after the first frame (at once in a background tab, where frames don't run). */
function afterFirstPaint(body: string, nonce: string): string {
  return (
    `<script nonce="${nonce}">(()=>{let d=0;const go=()=>{if(d)return;d=1;${body}};` +
    `document.visibilityState==='hidden'?go():requestAnimationFrame(()=>setTimeout(go,0))})()</script>`
  );
}

/**
 * The regular (400) @font-face rules: body text in both scripts. Headings and other weights render
 * in the 400 face with synthetic bold until the full sheet arrives, then swap (`font-display: swap`).
 */
export function bodyFontFaces(css: string): string {
  return (css.match(/@font-face\s*\{[^}]*\}/g) ?? [])
    .filter((rule) => /font-weight:\s*400\b/.test(rule))
    .join('');
}

/**
 * Public pages: inlines `firstPaintCss` and loads the full sheet after the first paint, so the
 * other ~250 KB of font faces don't compete with the first paint for bandwidth (Phase 10,
 * Lighthouse). `<noscript>` keeps the full sheet for visitors without JavaScript.
 */
export function deferStylesheet(html: string, sheet: InlineStylesheet, nonce: string): string {
  if (sheet.firstPaintCss === undefined) return inlineStylesheet(html, sheet, nonce);
  const start = html.indexOf(`<link rel="stylesheet" href="${sheet.href}"`);
  if (start < 0) return html;
  const end = html.indexOf('>', start);
  const css = sheet.firstPaintCss.split('</').join('<\\/');
  const href = JSON.stringify(sheet.href);
  const load = afterFirstPaint(
    `const l=document.createElement('link');l.rel='stylesheet';l.href=${href};document.head.append(l)`,
    nonce,
  );
  return (
    `${html.slice(0, start)}<style nonce="${nonce}">${css}</style>` +
    `<noscript><link rel="stylesheet" href="${sheet.href}"></noscript>${load}${html.slice(end + 1)}`
  );
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

const MAIN_SCRIPT = /<script src="(main-[\w-]+\.js)" type="module"( nonce="[^"]*")?><\/script>/;

/**
 * Public SSR pages paint without JavaScript, so the app bundle shouldn't compete with the first paint
 * for bandwidth: on a slow connection the ~140 KB of JS used to be downloaded before the text could
 * show. The `<script type="module">` for `main-*.js` becomes a nonce'd loader that inserts it after
 * the first frame (at once in a background tab, where frames don't run). Clicks before hydration
 * are replayed (`withEventReplay`). `script-src 'self'` allows the inserted same-origin script.
 * Not used for the admin/portal CSR shells, which render nothing until the bundle runs.
 */
export function deferMainScript(html: string, nonce: string): string {
  const match = MAIN_SCRIPT.exec(html);
  if (!match) return html;
  const src = JSON.stringify(match[1]);
  const loader = afterFirstPaint(
    `const s=document.createElement('script');s.type='module';s.src=${src};document.body.append(s)`,
    nonce,
  );
  const deferred = html.slice(0, match.index) + loader + html.slice(match.index + match[0].length);
  // The route's lazy chunks, which Angular SSR preloads: the deferred bundle imports them itself.
  return deferred.replace(/<link rel="modulepreload" href="[^"]+\.js"[^>]*>/g, '');
}

/**
 * Post-processes a response from the Angular engine. For HTML (SSR output and the CSR shell served to
 * RenderMode.Client routes alike) it swaps the nonce placeholder, inlines `inline` (the @font-face
 * sheet, Phase 10: all of it on admin/portal, only `firstPaintCss` on public pages with the rest after
 * the first paint), defers the app bundle on public pages (`deferMainScript`), and adds CSP + cache
 * headers.
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
  const isPublic = !isPrivateArea(url.split('?')[0]);
  if (inline) {
    html = isPublic ? deferStylesheet(html, inline, nonce) : inlineStylesheet(html, inline, nonce);
  }
  if (isPublic) html = deferMainScript(html, nonce);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set(cspHeaderName(isProduction), buildCsp(nonce));
  for (const [name, value] of Object.entries(htmlCacheHeaders(url))) {
    headers.set(name, value);
  }
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
