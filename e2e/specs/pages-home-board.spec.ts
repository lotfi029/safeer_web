import { expect, test } from '@playwright/test';
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

  test('board: every member of both API groups is rendered in its section (W1)', async ({
    page,
    request,
  }) => {
    const api = (await (await request.get('/api/v1/board?lang=en')).json()) as Record<
      'board' | 'executive',
      { name: string }[]
    >;
    expect(api.board.length).toBeGreaterThan(0);
    const res = await page.goto('/en/board');
    expect(res?.status()).toBe(200);
    const names = (id: string) =>
      page.locator(`section[aria-labelledby="${id}"] li h3`).allTextContents();
    expect((await names('board-members')).map((n) => n.trim())).toEqual(
      api.board.map((m) => m.name),
    );
    expect((await names('board-exec')).map((n) => n.trim())).toEqual(
      api.executive.map((m) => m.name),
    );
  });

  test('board SSR: the chair (isLead) spans two columns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar/board');
    const lead = page.locator('li.band').first();
    await expect(lead).toBeVisible();
    const [leadBox, itemBox] = await Promise.all([
      lead.boundingBox(),
      page.locator('section[aria-labelledby=board-members] li:not(.band)').first().boundingBox(),
    ]);
    expect(leadBox!.width).toBeGreaterThan(itemBox!.width * 1.5);
  });

  test('home: CMS section names never show; images are either the asset or a labelled placeholder (W6, W7)', async ({
    page,
    request,
  }) => {
    const home = (await (await request.get('/api/v1/home?lang=ar')).json()) as {
      sections: { sectionKey: string; label: string | null; imageAsset: unknown }[];
    };
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/ar');
    await page.waitForLoadState('networkidle');
    // Load every deferred section.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');
    const main = page.locator('main');
    for (const key of ['hero', 'cta']) {
      const label = home.sections.find((s) => s.sectionKey === key)?.label;
      if (label) await expect(main.getByText(label, { exact: true })).toHaveCount(0);
    }
    const hero = main.locator('section').first();
    if (home.sections.find((s) => s.sectionKey === 'hero')?.imageAsset) {
      await expect(hero.locator('img[src*="/files/"]')).toHaveAttribute('alt', /.+/);
    }
    const placeholders = main.locator('.img-placeholder[role="img"]');
    for (const ph of await placeholders.all()) {
      const text = (await ph.textContent())?.trim() ?? '';
      expect(text).toMatch(/^\[صورة: .+\]$/);
      await expect(ph).toHaveAttribute('aria-label', text);
    }
  });

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
