import { expect, test } from '@playwright/test';
import { SSR_DEAD_API_URL, mockOnly, usingMockApi } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';
import { measureHeader } from '../support/header';
import { smallTargets } from '../support/targets';

test.describe('public shell', () => {
  for (const { viewport, locale } of matrix()) {
    test(`shell ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/', viewport, locale);
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
      await checkScreen(page, testInfo, 'shell', viewport, locale);
    });
    test(`404 ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/no-such-page', viewport, locale);
      await expect(page.locator('h1')).toHaveText(
        locale === 'ar' ? 'الصفحة غير موجودة' : 'Page not found',
      );
      await checkScreen(page, testInfo, '404', viewport, locale);
    });
  }

  test('dark theme shell', async ({ page }, testInfo) => {
    await openAt(page, '/', { name: '1440', width: 1440, height: 900 }, 'ar', 'dark');
    await checkScreen(
      page,
      testInfo,
      'shell-dark',
      { name: '1440', width: 1440, height: 900 },
      'ar',
    );
  });

  test('desktop nav comes from GET /site in API order and marks the current page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar');
    const nav = page.getByRole('navigation', { name: 'القائمة الرئيسية' });
    const links = nav.getByRole('link');
    // Header bar: the 7 primary pages (prototype NAV) in API order; the drawer lists all 10.
    await expect(links).toHaveCount(7);
    await expect(links.first()).toHaveText('الرئيسية');
    await expect(links.first()).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'مجالات عملنا' })).toHaveAttribute(
      'href',
      '/ar/work-areas',
    );
  });

  // W5: with real API titles the English header overflowed at 1440. Every width, both languages.
  for (const lang of ['ar', 'en'] as const) {
    test(`header never overflows, overlaps, clips or truncates (${lang}, 360–1920)`, async ({
      page,
    }) => {
      const failures: string[] = [];
      for (const width of [360, 390, 768, 1024, 1100, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${lang}`);
        await page.waitForLoadState('networkidle');
        const m = await measureHeader(page);
        const problems = [
          m.overflow > 0 && `overflow ${m.overflow}px`,
          ...m.overlaps.map((o) => `overlap ${o}`),
          ...m.clipped.map((c) => `clipped "${c}"`),
          ...m.wrapped.map((w) => `wrapped "${w}"`),
          m.nameTruncated && 'org name truncated',
        ].filter(Boolean);
        if (problems.length) failures.push(`@${width}: ${problems.join(', ')}`);
      }
      expect(failures).toEqual([]);
    });
  }

  test('below 1100px the nav is in a focus-trapped drawer that closes on Escape (F7)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/en');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    const burger = page.getByRole('button', { name: 'Open menu' });
    await burger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Apply for a scholarship' })).toBeVisible();
    if (usingMockApi) {
      await expect(dialog.getByRole('navigation').getByRole('link')).toHaveCount(10);
    }
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(burger).toBeFocused();
  });

  test('language switch keeps the path and query', async ({ page }) => {
    await page.goto('/ar/no-such-page?x=1');
    await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute(
      'href',
      '/en/no-such-page?x=1',
    );
  });

  test('theme toggle switches data-theme and persists in a cookie', async ({ page, context }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect((await context.cookies()).find((c) => c.name === 'theme')?.value).toBe('dark');
  });

  test('skip link moves focus to main', async ({ page }) => {
    await page.goto('/en');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});

test.describe('server: legacy URLs, SEO files, failure modes', () => {
  test('clinic-template WordPress paths answer 410', async ({ request }) => {
    for (const path of ['/doctor/some-doctor', '/appointment', '/cart', '/category/neurology']) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(410);
    }
  });

  test(
    'redirect table hits answer 301 (redirects/resolve)',
    mockOnly('uses the mock redirect fixture'),
    async ({ request }) => {
      const res = await request.get('/about-us', { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(res.headers()['location']).toBe('/ar/about');
    },
  );

  test('unknown legacy paths and locale-less paths answer 404', async ({ request }) => {
    expect((await request.get('/some-old-page', { maxRedirects: 0 })).status()).toBe(404);
  });

  test('robots.txt and sitemap.xml', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /ar/admin');
    expect(robots).toContain('Sitemap: http://localhost:4100/sitemap.xml');
    const res = await request.get('/sitemap.xml');
    expect(res.headers()['content-type']).toContain('application/xml');
    const xml = await res.text();
    expect(xml).toContain('<loc>http://localhost:4100/ar/about</loc>');
    expect(xml).toContain('hreflang="en"');
  });

  test('API unreachable during SSR → 503 + Retry-After and the unavailable page (F8)', async ({
    request,
  }) => {
    const res = await request.get(`${SSR_DEAD_API_URL}/ar`);
    expect(res.status()).toBe(503);
    expect(res.headers()['retry-after']).toBe('30');
    expect(await res.text()).toContain('نعود قريبًا');
  });
});

test.describe('touch targets (W8)', () => {
  for (const lang of ['ar', 'en'] as const) {
    test(`footer, breadcrumb and news-card links are at least 44px (${lang} @390)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const failures: string[] = [];
      for (const path of ['', '/news', '/about']) {
        await page.goto(`/${lang}${path}`);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForLoadState('networkidle');
        const small = await smallTargets(
          page,
          'footer a, nav[aria-label] ol a, app-news-card h3 a, app-news-card h2 a',
        );
        failures.push(...small.map((s) => `${path || '/'}: ${s}`));
      }
      expect(failures).toEqual([]);
    });
  }
});
