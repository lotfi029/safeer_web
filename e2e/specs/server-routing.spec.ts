import { expect, test } from '@playwright/test';
import { SSR_DEAD_API_URL } from '../support/env';

test.describe('server routing (R6, R7)', () => {
  test('/ → 302 /ar with Vary: Cookie and no-store', async ({ request }) => {
    const res = await request.get('/', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toBe('/ar');
    expect(res.headers()['vary']).toMatch(/Cookie/);
    expect(res.headers()['cache-control']).toBe('no-store');
  });

  test('/ honours the lang cookie', async ({ request }) => {
    const res = await request.get('/', { maxRedirects: 0, headers: { cookie: 'lang=en' } });
    expect(res.headers()['location']).toBe('/en');
  });

  test('trailing slash → 301', async ({ request }) => {
    const res = await request.get('/ar/', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toBe('/ar');
  });

  test('unknown language and unknown paths → 404', async ({ request }) => {
    for (const path of ['/fr', '/fr/news', '/ar/does-not-exist', '/wp-admin.php']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
  });

  test('HTML files are never served statically (they need a nonce)', async ({ request }) => {
    const res = await request.get('/index.csr.html');
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain('__CSP_NONCE__');
  });

  test('GET /healthz on the SSR server itself', async ({ request }) => {
    const res = await request.get('/healthz');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers()['cache-control']).toBe('no-store');
  });

  test('API down → 502 application/problem+json', async ({ request }) => {
    const res = await request.get(`${SSR_DEAD_API_URL}/api/v1/site`);
    expect(res.status()).toBe(502);
    expect(res.headers()['content-type']).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 502, code: 'UPSTREAM_UNAVAILABLE' });
  });
});
