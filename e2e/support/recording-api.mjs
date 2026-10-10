/**
 * B2 (VPS deploy review): a zero-dependency recording proxy in front of the API (the mock or the real
 * one), used as API_INTERNAL_URL by the `safeer.test` SSR server in playwright.config.ts. It forwards
 * every request unchanged to RECORDING_UPSTREAM and remembers what reached it, so a spec can prove that
 * SSR called the API on the internal origin, and not through its own public domain.
 *   GET    /__recorded → [{ method, path, search, xff }] of the requests forwarded so far
 *   DELETE /__recorded → clears that list
 */
import { createServer, request as httpRequest } from 'node:http';

const port = Number(process.env.RECORDING_PORT ?? 3102);
const upstream = new URL(process.env.RECORDING_UPSTREAM ?? 'http://127.0.0.1:3100');
const recorded = [];

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://recorder');
  if (url.pathname === '/__recorded') {
    if (req.method === 'DELETE') recorded.length = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(recorded));
    return;
  }
  recorded.push({
    method: req.method,
    path: url.pathname,
    search: url.search,
    xff: req.headers['x-forwarded-for'] ?? null,
  });
  if (recorded.length > 1000) recorded.splice(0, recorded.length - 1000);
  const forward = httpRequest(
    {
      host: upstream.hostname,
      port: upstream.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: upstream.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  forward.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('recording-api: upstream unavailable');
  });
  req.pipe(forward);
}).listen(port, '127.0.0.1', () => {
  console.log(`recording-api on http://127.0.0.1:${port} → ${upstream.origin}`);
});
