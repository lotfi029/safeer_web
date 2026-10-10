import { expect, test } from '@playwright/test';
import { trackCspViolations } from '../support/csp';

const PAGES = ['/ar', '/en', '/ar/admin', '/ar/portal'];

function nonceFromCsp(csp: string): string {
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce, 'CSP must contain a nonce').toBeTruthy();
  return nonce!;
}

test.describe('security headers + CSP (R1, R2)', () => {
  for (const path of PAGES) {
    test(`${path}: every inline <script>/<style> carries the header nonce`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const headers = res.headers();
      const csp = headers['content-security-policy'];
      expect(csp).toBeTruthy();
      expect(csp).not.toContain('strict-dynamic');
      expect(csp).toContain("style-src-attr 'unsafe-inline'");
      expect(csp).toContain('frame-src https://www.google.com https://www.openstreetmap.org;');
      const nonce = nonceFromCsp(csp);

      const html = await res.text();
      expect(html).not.toContain('__CSP_NONCE__');
      const inline = [...html.matchAll(/<(script|style)\b([^>]*)>/g)].filter(
        ([, tag, attrs]) =>
          !(tag === 'script' && /\bsrc=|type="application\/(ld\+)?json"/.test(attrs)),
      );
      expect(inline.length).toBeGreaterThan(0);
      for (const [whole, , attrs] of inline) {
        expect(attrs, whole).toContain(`nonce="${nonce}"`);
      }
      expect(
        html,
        'no inline event handlers (critical-CSS loader must use a nonce script)',
      ).not.toMatch(/\son(load|error|click)=/);

      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy']).toContain('camera=()');
      expect(headers['strict-transport-security']).toContain('max-age=');
      expect(headers['x-powered-by']).toBeUndefined();
    });
  }

  test('a fresh nonce per response', async ({ request }) => {
    const a = nonceFromCsp((await request.get('/ar')).headers()['content-security-policy']);
    const b = nonceFromCsp((await request.get('/ar')).headers()['content-security-policy']);
    expect(a).not.toBe(b);
  });

  test('public HTML is no-cache; admin and portal are no-store + noindex', async ({ request }) => {
    expect((await request.get('/ar')).headers()['cache-control']).toBe('no-cache');
    for (const path of [
      '/ar/admin',
      '/en/admin/applications',
      '/ar/portal',
      '/en/portal/documents',
    ]) {
      const h = (await request.get(path)).headers();
      expect(h['cache-control'], path).toBe('no-store');
      expect(h['x-robots-tag'], path).toBe('noindex, nofollow');
    }
  });

  for (const path of PAGES) {
    test(`${path}: zero CSP violations in the browser after hydration`, async ({ page }) => {
      const violations = await trackCspViolations(page);
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await violations()).toEqual([]);
    });
  }
});

test('control: the violation tracker does catch an injected inline script', async ({ page }) => {
  const violations = await trackCspViolations(page);
  await page.goto('/ar');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__pwned = true';
    document.body.appendChild(s);
  });
  await expect.poll(async () => (await violations()).length).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned),
  ).toBeUndefined();
});
