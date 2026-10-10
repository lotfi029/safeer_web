/**
 * Zero-dependency HTTP wrapper around the shared mock backend (mocks/backend.mjs), used by e2e and
 * CI. Test-only routes:
 *   ANY /api/v1/__echo   → echoes method, url, headers; sets a test cookie
 *   GET /__log           → recent requests seen by the mock (SSR-path assertions)
 *   DELETE /__log        → clears the log
 *   POST /__reset        → resets mock state (?reference=SA-… restores one seeded application)
 *   POST /__site         → merges a JSON body into the site settings (map specs); send nulls to restore
 *   POST /__auth-token   → {purpose: accept|reset} → a fresh single-use token (W16 specs)
 */
import { createServer } from 'node:http';
import { createMockBackend } from '../../mocks/backend.mjs';
import { fixtures } from '../../mocks/fixtures.mjs';

const port = Number(process.env.MOCK_API_PORT ?? 3100);
const log = [];
let backend = createMockBackend(fixtures);

// 1×1 transparent PNG for /files/* requests.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function readBody(req, url) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const type = req.headers['content-type'] ?? '';
  if (type.startsWith('multipart/form-data')) {
    const form = await new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req,
      duplex: 'half',
    }).formData();
    const file = form.get('file');
    return {
      docType: form.get('docType'),
      file:
        file && typeof file === 'object'
          ? { name: file.name, size: file.size, type: file.type }
          : undefined,
    };
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  if (!raw.length) return undefined;
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return { __bytes: raw.length };
  }
}

function send(res, status, body, headers = {}) {
  const isBuffer = Buffer.isBuffer(body);
  const isText = typeof body === 'string';
  res.writeHead(status, {
    ...(isBuffer || isText || body === null
      ? {}
      : { 'content-type': 'application/json; charset=utf-8' }),
    ...headers,
  });
  res.end(body === null ? undefined : isBuffer || isText ? body : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/__log') {
    if (req.method === 'DELETE') log.length = 0;
    return send(res, 200, log);
  }
  if (url.pathname === '/__site' && req.method === 'POST') {
    Object.assign(backend.db.fixtures.site.settings, (await readBody(req, url)) ?? {});
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/__auth-token' && req.method === 'POST') {
    const { purpose } = (await readBody(req, url)) ?? {};
    if (purpose !== 'accept' && purpose !== 'reset') return send(res, 400, { ok: false });
    const token = `e2e-${purpose}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    backend.db.authTokens.add(`${purpose}:${token}`);
    return send(res, 200, { token });
  }
  if (url.pathname === '/__reset') {
    // `?reference=SA-…` restores just that seeded application (and frees its interview slot) so
    // specs running in parallel keep their sessions; no query resets the whole backend.
    const reference = url.searchParams.get('reference');
    if (reference) {
      const seed = (fixtures.applications ?? []).find((a) => a.reference === reference);
      if (!seed) return send(res, 404, { ok: false });
      backend.db.applications.set(seed.id, structuredClone(seed));
      for (const slot of backend.db.fixtures.interviewSlots ?? []) {
        if (slot.applicationId === seed.id) slot.applicationId = null;
      }
      return send(res, 200, { ok: true });
    }
    backend = createMockBackend(fixtures);
    return send(res, 200, { ok: true });
  }

  log.push({
    method: req.method,
    path: url.pathname,
    search: url.search,
    headers: req.headers,
    at: Date.now(),
  });
  if (log.length > 2000) log.shift();

  if (url.pathname === '/api/v1/__echo') {
    const body = await readBody(req, url);
    return send(
      res,
      200,
      {
        method: req.method,
        path: url.pathname,
        search: url.search,
        headers: req.headers,
        bodyBytes: body ? JSON.stringify(body).length : 0,
      },
      { 'set-cookie': 'sf_echo=1; Path=/; HttpOnly; SameSite=Strict' },
    );
  }
  if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
    return send(res, 200, PNG, {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400',
    });
  }
  try {
    const body = await readBody(req, url);
    const out = backend.handle({
      method: req.method ?? 'GET',
      url: url.pathname + url.search,
      headers: req.headers,
      body,
    });
    const headers = { ...out.headers };
    return send(
      res,
      out.status,
      out.body === null && out.status !== 204 ? 'null' : out.body,
      headers,
    );
  } catch (err) {
    console.error(err);
    return send(
      res,
      500,
      { status: 500, code: 'INTERNAL_ERROR', title: 'mock error' },
      { 'content-type': 'application/problem+json' },
    );
  }
});

server.listen(port, '127.0.0.1', () => console.log(`mock API on http://127.0.0.1:${port}`));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => server.close(() => process.exit(0)));
