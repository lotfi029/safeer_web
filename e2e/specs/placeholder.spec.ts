import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  matrix,
  screenshot,
} from '../support/matrix';

test.describe('Phase 0 placeholder shell', () => {
  test('SSR HTML is complete without JavaScript', async ({ request }) => {
    const ar = await (await request.get('/ar')).text();
    expect(ar).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
    expect(ar).toContain('جمعية سفير الدعوية');
    const en = await (await request.get('/en')).text();
    expect(en).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/);
  });

  test('admin and portal render client-side with noindex', async ({ page }) => {
    await page.goto('/ar/admin');
    await expect(page.locator('h1')).toHaveText('لوحة التحكم');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await page.goto('/ar/portal');
    await expect(page.locator('h1')).toHaveText('بوابة الطالب');
  });

  for (const { viewport, locale } of matrix()) {
    test(`home ${locale} @${viewport.name}: no overflow, axe clean, screenshot`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('h1')).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yViolations(page);
      await screenshot(page, testInfo, 'home', viewport, locale);
    });
  }
});
