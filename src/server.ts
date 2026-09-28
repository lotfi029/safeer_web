import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import type { SsrRequestContext } from './app/core/http/ssr-context';
import { staticCacheControl } from './server/cache-headers';
import { loadDotEnv, parseEnv } from './server/env';
import {
  bodyFontFaces,
  compactCss,
  finalizeAngularResponse,
  type InlineStylesheet,
} from './server/html';
import { serverErrorHandler } from './server/error-page';
import { apiRedirectResolver, legacyRedirects } from './server/legacy';
import { apiProxy } from './server/proxy';
import { langRedirects } from './server/redirects';
import { createNonce, securityHeaders } from './server/security-headers';
import { apiSitemapIndex, buildRobots, sitemapHandler } from './server/sitemap';

/**
 * Serve when run directly, under PM2 (`pm_id`), or through `app.cjs` (`SAFEER_SSR_LISTEN`): the
 * CommonJS entry for runners that `require()` the start file, like Hostinger's LiteSpeed `lsnode.js`.
 */
const isEntryPoint =
  isMainModule(import.meta.url) ||
  Boolean(process.env['pm_id']) ||
  process.env['SAFEER_SSR_LISTEN'] === '1';

loadDotEnv();
// Strict validation only when this process actually serves traffic (not during `ng serve`/build).
const env = parseEnv(process.env, isEntryPoint);

const browserDistFolder = join(import.meta.dirname, '../browser');

/**
 * The @font-face sheet (W13) is ~10 KB of rules and no fonts: inlined into every HTML response instead
 * of costing a render-blocking request (Phase 10, Lighthouse). Public pages inline only the body-text
 * faces and load the rest after the first paint. Absent under `ng serve`.
 */
const fontFaces: InlineStylesheet | null = (() => {
  try {
    const css = compactCss(readFileSync(join(browserDistFolder, 'fonts/fonts.css'), 'utf8'));
    return { href: '/fonts/fonts.css', css, firstPaintCss: bodyFontFaces(css) };
  } catch {
    return null;
  }
})();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);

const angularApp = new AngularNodeAppEngine({
  allowedHosts: env.allowedHosts,
  // Behind the edge proxy these arrive on every request; Angular only uses host/proto for URLs.
  trustProxyHeaders:
    env.trustProxy > 0 ? ['x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host'] : false,
});

/** Liveness for PM2 / uptime checks. Deliberately outside `/api` (R7). */
app.get('/healthz', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok' });
});

app.use(securityHeaders(env.isProduction));
app.use(langRedirects());

/** SEO files built from the API (B15) and the public origin. */
app.get('/robots.txt', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('text/plain').send(buildRobots(env.publicSiteUrl));
});
app.get('/sitemap.xml', sitemapHandler(env.publicSiteUrl, apiSitemapIndex(env.apiInternalUrl)));

/** Legacy WordPress paths: 410 for the clinic-template families, else a cached API redirect lookup. */
app.use(legacyRedirects(apiRedirectResolver(env.apiInternalUrl)));

/** Same-origin API + file proxy. No body parser is mounted anywhere in this app. */
app.use(apiProxy(env.apiInternalUrl));

/**
 * gzip/brotli for what this server renders and serves itself (HTML, JS, CSS, fonts), mounted
 * after the proxy so API and file responses pass through untouched. The edge may compress again;
 * this keeps the origin fast when it doesn't. HTML carries no secrets an attacker could probe with
 * compression side channels (BREACH): the nonce changes on every response, and admin/portal HTML is
 * the CSR shell.
 */
app.use(compression());

/** Static files from /browser. HTML is never served statically: it needs a nonce. */
const serveStatic = express.static(browserDistFolder, {
  index: false,
  redirect: false,
  setHeaders: (res, filePath) => res.setHeader('Cache-Control', staticCacheControl(filePath)),
});
app.use((req, res, next) => (req.path.endsWith('.html') ? next() : serveStatic(req, res, next)));

/** Everything else is rendered by Angular (SSR, or the CSR shell for admin/portal). */
app.use((req, res, next) => {
  const nonce = createNonce();
  const context: SsrRequestContext = {
    clientIp: req.ip,
    acceptLanguage: req.get('accept-language'),
  };
  angularApp
    .handle(req, context)
    .then((response) =>
      response
        ? finalizeAngularResponse(
            response,
            req.originalUrl,
            nonce,
            env.isProduction,
            fontFaces,
          ).then((final) => writeResponseToNodeResponse(final, res))
        : next(),
    )
    .catch(next);
});

/** Anything that escaped Angular's handling: static 500 page (no scripts, CSP'd). */
app.use(serverErrorHandler(env.isProduction));

/** Start the server when run directly or under PM2; shut down gracefully on SIGTERM (R11). */
if (isEntryPoint) {
  const server: Server = app.listen(env.port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`safeer_web SSR listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, closing server`);
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 8_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

/** Request handler used by the Angular CLI (dev-server and build). */
export const reqHandler = createNodeRequestHandler(app);
