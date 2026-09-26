import { expect, test } from '@playwright/test';
import { checkScreen, matrix, openAt } from '../support/matrix';

/** The e2e build includes the dev-only kit (review F6); production does not (check-prod-artifact). */
test.describe('/_kit component kit', () => {
  for (const { viewport, locale } of matrix()) {
    for (const theme of ['light', 'dark'] as const) {
      test(`kit ${locale} ${theme} @${viewport.name}`, async ({ page }, testInfo) => {
        await openAt(page, '/_kit', viewport, locale, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('h1')).toBeVisible();
        await checkScreen(page, testInfo, theme === 'light' ? 'kit' : 'kit-dark', viewport, locale);
      });
    }
  }

  test('SSR renders the theme from the cookie (no flash)', async ({ request }) => {
    const html = await (
      await request.get('/en/_kit', { headers: { cookie: 'theme=dark' } })
    ).text();
    expect(html).toMatch(/<html[^>]*data-theme="dark"/);
    const plain = await (await request.get('/en/_kit')).text();
    expect(plain).not.toMatch(/<html[^>]*data-theme=/);
  });

  test('kit page is noindex', async ({ page }) => {
    await page.goto('/ar/_kit');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
