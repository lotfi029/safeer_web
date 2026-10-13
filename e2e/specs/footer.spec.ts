import { expect, test } from '@playwright/test';
import { waitForHydration } from '../support/hydration';
import { ALL_VIEWPORTS, LOCALES, expectNoHorizontalScroll } from '../support/matrix';

/**
 * The compact footer: main pages only; desktop four columns, tablet the about block as one row
 * over three columns, phone (< 600px) each section an accordion. Runs on both backends (no data
 * of its own). The section open/closed state is decided after hydration, so every test waits
 * for it.
 */
const PHONE_MAX = 599.98;

async function openFooter(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
  lang: string,
) {
  await page.setViewportSize({ width, height });
  await page.goto(`/${lang}`);
  await page.waitForLoadState('networkidle');
  await waitForHydration(page);
  await page.locator('app-site-footer').scrollIntoViewIfNeeded();
  return page.locator('app-site-footer details.sf-sec');
}

test.describe('compact footer', () => {
  for (const viewport of ALL_VIEWPORTS) {
    for (const lang of LOCALES) {
      test(`${lang} @${viewport.name}: sections ${viewport.width <= PHONE_MAX ? 'closed (accordion)' : 'always open'}, no sideways scroll`, async ({
        page,
      }) => {
        const sections = await openFooter(page, viewport.width, viewport.height, lang);
        await expect(sections).toHaveCount(3);
        const phone = viewport.width <= PHONE_MAX;
        for (let i = 0; i < 3; i++) {
          if (phone) {
            await expect(sections.nth(i)).not.toHaveAttribute('open');
          } else {
            await expect(sections.nth(i)).toHaveAttribute('open', '');
          }
        }
        await expectNoHorizontalScroll(page);
      });
    }
  }

  test('server HTML has every section open (works without JS)', async ({ request }) => {
    const html = await (await request.get('/ar')).text();
    const tags = html.match(/<details class="sf-sec"[^>]*>/g) ?? [];
    expect(tags).toHaveLength(3);
    for (const tag of tags) {
      expect(tag).toMatch(/\sopen(=""|\s|>)/);
    }
  });

  test('phone: a section opens and closes by tap and by keyboard', async ({ page }) => {
    const sections = await openFooter(page, 390, 844, 'ar');
    const gov = sections.nth(1);
    const summary = gov.locator('summary');
    await summary.click();
    await expect(gov).toHaveAttribute('open', '');
    await expect(gov.getByRole('link').first()).toBeVisible();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(gov).not.toHaveAttribute('open');
  });

  test('desktop: a section heading does nothing and is not a tab stop', async ({ page }) => {
    const sections = await openFooter(page, 1440, 900, 'ar');
    const summary = sections.nth(0).locator('summary');
    await expect(summary).toHaveAttribute('tabindex', '-1');
    await summary.click();
    await expect(sections.nth(0)).toHaveAttribute('open', '');
  });

  test('main pages only: five quick links, at most three governance sections + licences', async ({
    page,
  }) => {
    await openFooter(page, 1440, 900, 'ar');
    const footer = page.locator('app-site-footer');
    const quick = footer.getByRole('navigation', { name: 'روابط مهمة' });
    await expect(quick.getByRole('link')).toHaveText([
      'من نحن',
      'مجلس الإدارة',
      'مجالات عملنا',
      'الأخبار',
      'تواصل معنا',
    ]);
    const gov = footer.getByRole('navigation', { name: 'الحوكمة' }).getByRole('link');
    const count = await gov.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(4);
    await expect(gov.last()).toHaveAttribute('href', '/ar/governance/licences');
  });
});
