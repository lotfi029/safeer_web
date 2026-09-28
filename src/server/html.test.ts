import { describe, expect, it } from 'vitest';
import {
  bodyFontFaces,
  compactCss,
  deferMainScript,
  deferStylesheet,
  finalizeAngularResponse,
  inlineStylesheet,
} from './html';

const page =
  '<html><body><app-root ngcspnonce="__CSP_NONCE__"></app-root><script nonce="__CSP_NONCE__"></script></body></html>';

describe('finalizeAngularResponse', () => {
  it('injects the nonce and sets CSP + cache headers on SSR HTML', async () => {
    const res = await finalizeAngularResponse(
      new Response(page, {
        status: 200,
        headers: { 'content-type': 'text/html;charset=UTF-8', 'content-length': '1' },
      }),
      '/ar',
      'NONCE1',
      true,
    );
    const body = await res.text();
    expect(body).not.toContain('__CSP_NONCE__');
    expect(body).toContain('nonce="NONCE1"');
    expect(res.headers.get('content-security-policy')).toContain("'nonce-NONCE1'");
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.has('content-length')).toBe(false);
  });

  it('applies to the CSR shell of admin/portal routes too (R1)', async () => {
    const res = await finalizeAngularResponse(
      new Response(page, { status: 200, headers: { 'content-type': 'text/html' } }),
      '/ar/admin',
      'NONCE2',
      true,
    );
    expect(await res.text()).toContain('nonce="NONCE2"');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('keeps the status code (404) and leaves non-HTML untouched', async () => {
    const notFound = await finalizeAngularResponse(
      new Response(page, { status: 404, headers: { 'content-type': 'text/html' } }),
      '/fr',
      'N',
      true,
    );
    expect(notFound.status).toBe(404);
    const json = new Response('{}', { headers: { 'content-type': 'application/json' } });
    expect(await finalizeAngularResponse(json, '/ar', 'N', true)).toBe(json);
  });

  it('uses report-only CSP in development', async () => {
    const res = await finalizeAngularResponse(
      new Response(page, { headers: { 'content-type': 'text/html' } }),
      '/ar',
      'N',
      false,
    );
    expect(res.headers.has('content-security-policy')).toBe(false);
    expect(res.headers.get('content-security-policy-report-only')).toContain("'nonce-N'");
  });
});

describe('inlineStylesheet (Phase 10: the @font-face sheet)', () => {
  const sheet = {
    href: '/fonts/fonts.css',
    css: compactCss('/* c */\n@font-face {\n  src: url($&);\n}\n'),
  };
  const html =
    '<head><link rel="stylesheet" href="/fonts/fonts.css" data-beasties-skip=""><title>x</title></head>';

  it('swaps the link for a nonce’d style, keeping `$` sequences literally', () => {
    expect(sheet.css).toBe('@font-face {src: url($&);}');
    expect(inlineStylesheet(html, sheet, 'N')).toBe(
      '<head><style nonce="N">@font-face {src: url($&);}</style><title>x</title></head>',
    );
  });

  it('leaves HTML without the link alone and cannot close the style element early', () => {
    expect(inlineStylesheet('<head></head>', sheet, 'N')).toBe('<head></head>');
    expect(inlineStylesheet(html, { ...sheet, css: 'a{}</style><script>' }, 'N')).toContain(
      String.raw`a{}<\/style><script></style>`,
    );
  });

  it('is applied by finalizeAngularResponse', async () => {
    const res = await finalizeAngularResponse(
      new Response(html, { headers: { 'content-type': 'text/html' } }),
      '/ar',
      'N',
      true,
      sheet,
    );
    expect(await res.text()).toContain('<style nonce="N">@font-face');
  });
});

describe('deferMainScript (public pages paint before the bundle loads)', () => {
  const page =
    '<head><link rel="modulepreload" href="chunk-A.js"></head><body><app-root></app-root>' +
    '<script src="main-ABC123.js" type="module" nonce="N"></script></body>';

  it('replaces the module script with a nonce’d loader and drops the route preloads', () => {
    const html = deferMainScript(page, 'N');
    expect(html).not.toContain('<script src="main-ABC123.js"');
    expect(html).not.toContain('modulepreload');
    expect(html).toContain('<script nonce="N">');
    expect(html).toContain('s.src="main-ABC123.js"');
    expect(html).toContain('requestAnimationFrame');
  });

  it('leaves HTML without a main script alone', () => {
    expect(deferMainScript('<body></body>', 'N')).toBe('<body></body>');
  });

  it('finalizeAngularResponse defers on public pages only', async () => {
    const render = (url: string) =>
      finalizeAngularResponse(
        new Response(page, { headers: { 'content-type': 'text/html' } }),
        url,
        'N',
        true,
      ).then((r) => r.text());
    expect(await render('/ar/news')).not.toContain('<script src="main-');
    expect(await render('/ar/admin/applications')).toContain('<script src="main-ABC123.js"');
    expect(await render('/en/portal?x=1')).toContain('<script src="main-ABC123.js"');
  });
});

describe('font faces on public pages (body faces first, the rest after the first paint)', () => {
  const css = compactCss(
    [400, 700]
      .map(
        (w) =>
          `@font-face {\n  font-family: 'X';\n  font-weight: ${w};\n  src: url('/fonts/x-${w}.woff2');\n}`,
      )
      .join('\n'),
  );
  const sheet = { href: '/fonts/fonts.css', css, firstPaintCss: bodyFontFaces(css) };
  const page =
    '<head><link rel="stylesheet" href="/fonts/fonts.css" data-beasties-skip=""></head><body>' +
    '<script src="main-A.js" type="module" nonce="N"></script></body>';

  it('keeps only the 400 rules for the first paint', () => {
    expect(sheet.firstPaintCss).toContain('x-400');
    expect(sheet.firstPaintCss).not.toContain('x-700');
  });

  it('inlines the body faces, loads the full sheet after the first paint, keeps a noscript fallback', () => {
    const html = deferStylesheet(page, sheet, 'N');
    expect(html).toContain('<style nonce="N">@font-face');
    expect(html).not.toMatch(/<style nonce="N">[^<]*x-700/);
    expect(html).toContain('<noscript><link rel="stylesheet" href="/fonts/fonts.css"></noscript>');
    expect(html).toContain('l.href="/fonts/fonts.css"');
    expect(html).not.toContain('data-beasties-skip');
  });

  it('admin/portal still get every face inline; public pages only the body faces', async () => {
    const render = (url: string) =>
      finalizeAngularResponse(
        new Response(page, { headers: { 'content-type': 'text/html' } }),
        url,
        'N',
        true,
        sheet,
      ).then((r) => r.text());
    expect(await render('/ar/admin')).toContain('x-700');
    const pub = await render('/ar');
    expect(pub).not.toMatch(/<style nonce="N">[^<]*x-700/);
    expect(pub).toContain('<noscript>');
  });
});
