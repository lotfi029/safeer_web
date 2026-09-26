import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { langRedirects, preferredLang, readCookie } from './redirects';

describe('cookie helpers', () => {
  it('reads cookies and picks the language', () => {
    expect(readCookie('a=1; lang=en; b=2', 'lang')).toBe('en');
    expect(readCookie(undefined, 'lang')).toBeUndefined();
    expect(preferredLang('lang=en')).toBe('en');
    expect(preferredLang('lang=fr')).toBe('ar');
    expect(preferredLang(undefined)).toBe('ar');
  });
});

describe('langRedirects (R6)', () => {
  let base = '';
  let server: ReturnType<express.Express['listen']>;

  beforeAll(async () => {
    const app = express();
    app.use(langRedirects());
    app.use((_req, res) => {
      res.status(200).send('passed');
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(base + path, { redirect: 'manual', headers });

  it('302s / to /ar with Vary: Cookie and no-store', async () => {
    const res = await get('/');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/ar');
    expect(res.headers.get('vary')).toMatch(/Cookie/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('honours the lang cookie and keeps the query string', async () => {
    const res = await get('/?utm=1', { cookie: 'lang=en' });
    expect(res.headers.get('location')).toBe('/en?utm=1');
  });

  it('301s trailing slashes', async () => {
    const res = await get('/ar/?q=1');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/ar?q=1');
    expect((await get('/en/news/')).headers.get('location')).toBe('/en/news');
  });

  it('never produces a protocol-relative redirect', async () => {
    const res = await get('//evil.example/');
    expect(res.headers.get('location')?.startsWith('//')).toBe(false);
  });

  it('leaves /api and /files alone, and non-GET requests', async () => {
    expect((await get('/api/v1/')).status).toBe(200);
    expect((await get('/files/x/')).status).toBe(200);
    expect((await fetch(`${base}/ar/`, { method: 'POST', redirect: 'manual' })).status).toBe(200);
  });
});
