/**
 * Zero-dependency mock of safeer_api for e2e and CI. Serves the shared fixtures in mocks/fixtures
 * (the same files the in-app mock interceptor uses, review F6) and a few test-only routes:
 *   ANY /api/v1/__echo   → echoes method, url, headers and cookies; sets a test cookie
 *   GET /__log           → recent requests (headers) seen by the mock, for SSR-path assertions
 *   DELETE /__log        → clears the log
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collapseBilingual, resolveLang } from '../../mocks/collapse.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '../../mocks/fixtures');
const port = Number(process.env.MOCK_API_PORT ?? 3100);
const log = [];

const fixture = (name) => JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf8'));

// 1×1 transparent PNG for /files/* requests.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function problem(res, status, code, title) {
  send(
    res,
    status,
    {
      type: `https://safeer-sa.org/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      code,
    },
    { 'Content-Type': 'application/problem+json' },
  );
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://mock');
  const lang = resolveLang(url.searchParams.get('lang'), req.headers['accept-language']);

  if (url.pathname === '/__log') {
    if (req.method === 'DELETE') log.length = 0;
    return send(res, 200, log);
  }

  log.push({
    method: req.method,
    path: url.pathname,
    search: url.search,
    headers: req.headers,
    at: Date.now(),
  });
  if (log.length > 200) log.shift();

  if (url.pathname === '/api/v1/health') return send(res, 200, { status: 'ok' });
  if (url.pathname === '/api/v1/__echo') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () =>
      send(
        res,
        200,
        {
          method: req.method,
          path: url.pathname,
          search: url.search,
          headers: req.headers,
          bodyBytes: Buffer.concat(chunks).length,
        },
        { 'Set-Cookie': 'sf_echo=1; Path=/; HttpOnly; SameSite=Strict' },
      ),
    );
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/site') {
    return send(res, 200, collapseBilingual(fixture('site'), lang));
  }
  if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
    return send(res, 200, PNG, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    });
  }
  return problem(res, 404, 'NOT_FOUND', 'Not found');
});

server.listen(port, '127.0.0.1', () => console.log(`mock API on http://127.0.0.1:${port}`));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => server.close(() => process.exit(0)));
