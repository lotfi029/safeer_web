import { expect, test } from '@playwright/test';
import { checkScreen, matrix, openAt } from '../support/matrix';

/** About and work areas (phase 3, prototype `#/about`, `#/work`). */
const PAGES = [
  { name: 'about', path: '/about', title: 'من نحن' },
  { name: 'work-areas', path: '/work-areas', title: 'مجالات عمل الجمعية' },
] as const;

const MOBILE = { name: '390', width: 390, height: 844 };
const DESKTOP = { name: '1440', width: 1440, height: 900 };

test.describe('public pages A (about, work areas)', () => {
  for (const p of PAGES) {
    for (const { viewport, locale } of matrix()) {
      test(`${p.name} ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
        await openAt(page, p.path, viewport, locale);
        await expect(page.locator('h1')).toHaveCount(1);
        await checkScreen(page, testInfo, p.name, viewport, locale);
      });
    }

    test(`${p.name}: SSR renders title, canonical, hreflang and h1 without JS`, async ({
      request,
    }) => {
      const res = await request.get(`/ar${p.path}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toMatch(new RegExp(`<title>[^<]*${p.title}[^<]*</title>`));
      expect(html).toMatch(new RegExp(`<link[^>]+rel="canonical"[^>]+/ar${p.path}"`));
      expect(html).toMatch(/<link[^>]+hreflang="en"/);
      expect(html).toMatch(/<link[^>]+hreflang="ar"/);
      expect(html).toMatch(new RegExp(`<h1[^>]*>\\s*${p.title}\\s*</h1>`));
    });
  }

  test('about: the goals list has 5 numbered items', async ({ page }) => {
    await openAt(page, '/about', DESKTOP, 'ar');
    const goals = page.getByTestId('about-goals').locator('> li');
    await expect(goals).toHaveCount(5);
    await expect(goals.first()).toContainText('١');
    await expect(
      page.locator('a[href="/ar/documents?category=meeting-minutes"]').first(),
    ).toBeVisible();
  });

  test('work areas: accordion on mobile (first open, toggles), cards on desktop', async ({
    page,
  }) => {
    await openAt(page, '/work-areas', MOBILE, 'ar');
    const accordion = page.getByTestId('work-accordion');
    await expect(accordion).toBeVisible();
    const details = accordion.locator('details');
    await expect(details).toHaveCount(4);
    await expect(details.first()).toHaveAttribute('open', '');
    await expect(details.nth(1)).not.toHaveAttribute('open', '');
    await details.nth(1).locator('summary').click();
    await expect(details.nth(1)).toHaveAttribute('open', '');
    await expect(details.nth(1).locator('li').first()).toBeVisible();
    await details.first().locator('summary').click();
    await expect(details.first()).not.toHaveAttribute('open', '');

    await page.setViewportSize(DESKTOP);
    await expect(accordion).toBeHidden();
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  });

  test('work areas: improvement themes carry a pill', async ({ page }) => {
    await openAt(page, '/work-areas', DESKTOP, 'ar');
    const themes = page.locator('#work-themes').locator('xpath=ancestor::section[1]');
    await expect(themes.locator('ul > li')).toHaveCount(5);
    await expect(themes.getByText('فرصة تحسين')).toHaveCount(2);
  });
});
