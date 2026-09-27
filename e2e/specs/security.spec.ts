import { type APIRequestContext, expect, test } from '@playwright/test';
import { signInAs } from '../support/admin';
import { trackCspViolations } from '../support/csp';
import { staffAccount } from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);

/**
 * One page per route type (Phase 10): SSR home in both locales, a CMS page, a list, an article, the
 * contact page (map host), the apply form, and the CSR admin and portal entry points.
 */
const PAGES = [
  '/ar',
  '/en',
  '/en/about',
  '/ar/news',
  'article',
  '/ar/contact',
  '/en/apply',
  '/ar/admin',
  '/ar/portal',
];

/** `article` stands for the newest published post (the mock fixtures or the real seed). */
async function resolvePath(request: APIRequestContext, path: string): Promise<string> {
  if (path !== 'article') return path;
  const res = await request.get('/api/v1/news?lang=ar&limit=1');
  const [post] = ((await res.json()) as { data: { slug: string }[] }).data;
  return `/ar/news/${post.slug}`;
}

function nonceFromCsp(csp: string): string {
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce, 'CSP must contain a nonce').toBeTruthy();
  return nonce!;
}

test.describe('security headers + CSP (R1, R2)', () => {
  for (const path of PAGES) {
    test(`${path}: every inline <script>/<style> carries the header nonce`, async ({ request }) => {
      const res = await request.get(await resolvePath(request, path));
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
      await page.goto(await resolvePath(page.request, path));
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await violations()).toEqual([]);
    });
  }
});

test.describe('CSP on the remaining route types', () => {
  test('the 404 page carries the CSP and loads without violations', async ({ page }) => {
    const violations = await trackCspViolations(page);
    const res = await page.goto('/en/no-such-page-anywhere');
    expect(res?.status()).toBe(404);
    expect(res?.headers()['content-security-policy']).toContain("script-src 'self' 'nonce-");
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await violations()).toEqual([]);
  });

  test('signed-in admin screens (CSR) run without violations', async ({ page }) => {
    const admin = await staffAccount('admin');
    const violations = await trackCspViolations(page);
    await signInAs(page, admin, '/admin', 'ar');
    for (const path of [
      '/admin',
      '/admin/applications',
      '/admin/news/new',
      '/admin/media',
      '/admin/system/settings',
      '/admin/system/mail?tab=templates',
    ]) {
      await page.goto(`/ar${path}`);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
    }
    expect(await violations()).toEqual([]);
  });

  test('frame-src: the two map hosts load, any other host is blocked (A12)', async ({ page }) => {
    for (const host of [
      'https://www.openstreetmap.org',
      'https://www.google.com',
      'https://evil.example',
    ]) {
      await page.route(`${host}/**`, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<p>map</p>' }),
      );
    }
    const violations = await trackCspViolations(page);
    await page.goto('/en/contact');
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const embed = (src: string) =>
      page.evaluate((url) => {
        const frame = document.createElement('iframe');
        frame.src = url;
        document.body.append(frame);
      }, src);
    await embed('https://www.openstreetmap.org/export/embed.html?bbox=46.6,24.6,46.7,24.7');
    await embed('https://www.google.com/maps/embed?pb=1');
    await page.waitForTimeout(500);
    expect(await violations()).toEqual([]);
    await embed('https://evil.example/embed');
    await expect
      .poll(async () => (await violations()).join(' '))
      .toMatch(/frame-src.*evil.example|evil.example.*frame-src/);
  });
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
