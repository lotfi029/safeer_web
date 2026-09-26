import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isGone, legacyRedirects, type Resolver, sanitizeRedirect, shouldLookup } from './legacy';
import { TtlCache } from './ttl-cache';

describe('legacy path rules', () => {
  it('marks the clinic-template families as gone', () => {
    for (const p of [
      '/doctor',
      '/doctors/dr-x',
      '/doctor-category/a',
      '/appointment',
      '/cart',
      '/category/neurology/post',
    ]) {
      expect(isGone(p), p).toBe(true);
    }
    expect(isGone('/doctorate')).toBe(false);
    expect(isGone('/category/news')).toBe(false);
  });

  it('only looks up paths outside /ar|/en, /api, /files and static files (F9)', () => {
    expect(shouldLookup('/about-us')).toBe(true);
    expect(shouldLookup('/2020/07/30/post-name')).toBe(true);
    expect(shouldLookup('/index.php')).toBe(true);
    expect(shouldLookup('/ar/news')).toBe(false);
    expect(shouldLookup('/en')).toBe(false);
    expect(shouldLookup('/api/v1/site')).toBe(false);
    expect(shouldLookup('/files/abc')).toBe(false);
    expect(shouldLookup('/main-ABC.js')).toBe(false);
    expect(shouldLookup('/favicon.ico')).toBe(false);
    expect(shouldLookup('/')).toBe(false);
  });

  it('never follows off-site redirects', () => {
    expect(sanitizeRedirect({ toPath: '/ar/about', statusCode: 301 })).toEqual({
      toPath: '/ar/about',
      statusCode: 301,
    });
    expect(sanitizeRedirect({ toPath: '/x', statusCode: 302 })?.statusCode).toBe(302);
    expect(sanitizeRedirect({ toPath: '//evil.example' })).toBeNull();
    expect(sanitizeRedirect({ toPath: 'https://evil.example' })).toBeNull();
    expect(sanitizeRedirect(null)).toBeNull();
  });
});

describe('legacyRedirects middleware', () => {
  let base = '';
  let server: ReturnType<express.Express['listen']>;
  const resolve = vi.fn<Resolver>(async (path) =>
    path === '/about-us'
      ? { toPath: '/ar/about', statusCode: 301 }
      : path === '/boom'
        ? 'error'
        : null,
  );

  beforeAll(async () => {
    const app = express();
    app.use(legacyRedirects(resolve, new TtlCache(60_000)));
    app.use((_req, res) => {
      res.status(404).send('angular');
    });
    await new Promise<void>((r) => {
      server = app.listen(0, () => r());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  const get = (p: string) => fetch(base + p, { redirect: 'manual' });

  it('410 for gone families without an API lookup', async () => {
    const res = await get('/doctor/dr-x');
    expect(res.status).toBe(410);
    expect(resolve).not.toHaveBeenCalledWith('/doctor/dr-x');
  });

  it('301 from the API and caches the hit', async () => {
    const res = await get('/about-us');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/ar/about');
    await get('/about-us');
    expect(resolve.mock.calls.filter(([p]) => p === '/about-us')).toHaveLength(1);
  });

  it('caches misses too, falls through to Angular', async () => {
    expect((await get('/old-page')).status).toBe(404);
    expect((await get('/old-page')).status).toBe(404);
    expect(resolve.mock.calls.filter(([p]) => p === '/old-page')).toHaveLength(1);
  });

  it('does not cache API errors', async () => {
    await get('/boom');
    await get('/boom');
    expect(resolve.mock.calls.filter(([p]) => p === '/boom')).toHaveLength(2);
  });

  it('never looks up locale routes', async () => {
    await get('/ar/news');
    expect(resolve).not.toHaveBeenCalledWith('/ar/news');
  });
});

describe('TtlCache', () => {
  it('expires entries and evicts the least recently used', () => {
    let now = 0;
    const cache = new TtlCache<number>(100, 2, () => now);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    now = 200;
    expect(cache.get('a')).toBeUndefined();
  });
});
