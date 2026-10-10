import { expect, test } from '@playwright/test';
import { MOCK_API_URL } from '../support/env';

/** The origin SSR calls (playwright.config.ts API_INTERNAL_URL): the mock or the real API. */
const INTERNAL_ORIGIN = new URL(process.env['E2E_API_URL'] || MOCK_API_URL).host;

test.describe('HTTP transfer cache (W9)', () => {
  test('the browser reuses SSR responses: no /api/v1 request after hydration', async ({
    page,
    request,
  }) => {
    const news = (await (await request.get('/api/v1/news?lang=en&limit=1')).json()) as {
      data: { slug: string }[];
    };
    const paths = ['/ar', '/en/news', ...(news.data[0] ? [`/en/news/${news.data[0].slug}`] : [])];
    expect(paths.length, 'the seed should have at least one article').toBe(3);
    for (const path of paths) {
      const apiCalls: string[] = [];
      const listener = (r: { url(): string }) => {
        if (new URL(r.url()).pathname.startsWith('/api/v1')) apiCalls.push(r.url());
      };
      page.on('request', listener);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState('networkidle');
      // Hydrate the deferred sections too.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForLoadState('networkidle');
      page.off('request', listener);
      expect(apiCalls, `${path} fetched again after SSR`).toEqual([]);
    }
  });

  test('the internal API origin never appears in the HTML', async ({ request }) => {
    for (const path of ['/ar', '/en/news', '/en/board', '/ar/partners']) {
      const html = await (await request.get(path)).text();
      expect(html, path).not.toContain(INTERNAL_ORIGIN);
      expect(html, path).toContain('ng-state');
    }
  });
});
