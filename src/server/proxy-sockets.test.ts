import express from 'express';
import { Agent, createServer, request, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiProxy } from './proxy';

/**
 * S8 (VPS deploy review): real-API e2e logged `MaxListenersExceededWarning: 11 timeout listeners
 * added to [Socket]`. The proxy set `timeout` as well as `proxyTimeout`; httpxy applies `timeout` as
 * `req.socket.setTimeout(…, cb)` on the visitor's socket for every request, so a keep-alive
 * connection gained one `timeout` listener per request, a slow leak under steady traffic.
 */

const listen = (server: Server) =>
  new Promise<number>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)),
  );
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

function get(port: number, path: string, agent: Agent): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, agent }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('apiProxy on keep-alive sockets (S8)', () => {
  let upstream: Server;
  let proxy: Server;
  let proxyPort: number;
  /** The proxy's server-side sockets: one per client connection. */
  const clientSockets = new Set<Socket>();
  const warnings: Error[] = [];
  const onWarning = (w: Error) => warnings.push(w);

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      if (req.url?.startsWith('/api/v1/slow')) return; // never answers
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    const upstreamPort = await listen(upstream);
    const app = express();
    app.use(apiProxy(`http://127.0.0.1:${upstreamPort}`, { timeoutMs: 300 }));
    proxy = createServer(app);
    proxy.on('connection', (s) => clientSockets.add(s));
    proxyPort = await listen(proxy);
    process.on('warning', onWarning);
  });

  afterAll(async () => {
    process.off('warning', onWarning);
    upstream.closeAllConnections();
    proxy.closeAllConnections();
    await close(proxy);
    await close(upstream);
  });

  it('500 sequential requests on one connection add no timeout listeners', async () => {
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    for (let i = 0; i < 500; i++) {
      const res = await get(proxyPort, `/api/v1/site?i=${i}`, agent);
      expect(res.status).toBe(200);
    }
    agent.destroy();
    const listeners = [...clientSockets].map((s) => s.listenerCount('timeout'));
    expect(Math.max(...listeners)).toBeLessThanOrEqual(1);
    expect(warnings.filter((w) => w.name === 'MaxListenersExceededWarning')).toEqual([]);
  });

  it('a concurrent batch on a few keep-alive connections stays bounded too', async () => {
    clientSockets.clear();
    const agent = new Agent({ keepAlive: true, maxSockets: 4 });
    for (let round = 0; round < 25; round++) {
      const batch = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          get(proxyPort, `/api/v1/home?r=${round}&i=${i}`, agent),
        ),
      );
      expect(batch.every((r) => r.status === 200)).toBe(true);
    }
    agent.destroy();
    expect(clientSockets.size).toBeLessThanOrEqual(4);
    const listeners = [...clientSockets].map((s) => s.listenerCount('timeout'));
    expect(Math.max(...listeners)).toBeLessThanOrEqual(1);
    expect(warnings.filter((w) => w.name === 'MaxListenersExceededWarning')).toEqual([]);
  });

  it('a hanging upstream still answers 504 problem+json after the upstream timeout', async () => {
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    const started = Date.now();
    const res = await get(proxyPort, '/api/v1/slow', agent);
    agent.destroy();
    expect(res.status).toBe(504);
    expect(JSON.parse(res.body)).toMatchObject({ status: 504, code: 'UPSTREAM_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
