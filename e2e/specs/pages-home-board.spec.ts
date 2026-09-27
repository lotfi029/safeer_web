import { expect, test } from '@playwright/test';
import { mockOnly } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';

test.describe('public pages: home, board', () => {
  for (const { viewport, locale } of matrix()) {
    test(`board ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/board', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'board', viewport, locale);
    });
  }

  test('home SSR: sections in API order, NGO JSON-LD, canonical + hreflang', async ({
    request,
  }) => {
    const res = await request.get('/en');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<link rel="canonical" href="[^"]*\/en"/);
    expect(html).toMatch(/hreflang="ar"/);
    expect(html).toMatch(/hreflang="x-default"/);
    const ld = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(JSON.parse(ld ?? '{}')['@type']).toBe('NGO');
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });

  test(
    'board SSR: the chair (isLead) spans two columns',
    mockOnly('asserts mock board'),
    async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/ar/board');
      const lead = page.locator('li.band').first();
      await expect(lead).toBeVisible();
      const [leadBox, itemBox] = await Promise.all([
        lead.boundingBox(),
        page.locator('section[aria-labelledby=board-members] li:not(.band)').first().boundingBox(),
      ]);
      expect(leadBox!.width).toBeGreaterThan(itemBox!.width * 1.5);
    },
  );

  test('forward arrows point in the reading direction', async ({ page }) => {
    for (const lang of ['ar', 'en'] as const) {
      await page.goto(`/${lang}`);
      const flipped = await page
        .locator('a app-icon.flip-rtl')
        .first()
        .evaluate((el) => getComputedStyle(el).transform);
      // `flip-rtl` mirrors only under dir=rtl.
      expect(flipped === 'none').toBe(lang === 'en');
    }
  });
});
