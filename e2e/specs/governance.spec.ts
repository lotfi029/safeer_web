import { expect, test } from '@playwright/test';
import { mockOnly, usingMockApi } from '../support/env';
import { gotoHydrated } from '../support/hydration';
import { checkScreen, matrix, openAt } from '../support/matrix';

/** Governance pages (W4): a document section, the licences page, and the governance menus. */
const DESKTOP = { name: '1440', width: 1440, height: 900 };
const SCREENS = [
  {
    name: 'governance-section',
    path: '/governance/bylaws-policies',
    lede: 'شفافية كاملة في وثائق الجمعية وتقاريرها.',
  },
  {
    name: 'governance-licences',
    path: '/governance/licences',
    lede: 'تراخيص الجمعية وشهاداتها الرسمية.',
  },
] as const;

test.describe('governance pages', () => {
  for (const s of SCREENS) {
    for (const { viewport, locale } of matrix()) {
      test(`${s.name} ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
        await openAt(page, s.path, viewport, locale);
        await expect(page.locator('h1')).toHaveCount(1);
        await checkScreen(page, testInfo, s.name, viewport, locale);
      });
    }

    test(`${s.name} is server-rendered (title, canonical, hreflang, one h1)`, async ({
      request,
    }) => {
      const res = await request.get(`/ar${s.path}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/ar${s.path}"`));
      expect(html).toMatch(/hreflang="en"/);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toContain(s.lede);
    });
  }

  test('/governance lands on the first section; an unknown section is a 404', async ({
    page,
    request,
  }) => {
    await page.goto('/ar/governance');
    await expect(page).toHaveURL(/\/ar\/governance\/bylaws-policies$/);
    await expect(page.locator('h1')).toHaveText('اللوائح والسياسات');
    expect((await request.get('/ar/governance/no-such-section')).status()).toBe(404);
    expect((await request.get('/ar/governance/Bad_Slug')).status()).toBe(404);
  });

  test('a section lists its documents: download to /files/:publicId, meta line, date', async ({
    page,
  }) => {
    await openAt(page, '/governance/bylaws-policies', DESKTOP, 'ar');
    const docs = page.getByTestId('governance-documents').locator('> li');
    expect(await docs.count()).toBeGreaterThan(0);
    const links = page.getByTestId('governance-documents').locator('a[download]');
    const count = await links.count();
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toHaveAttribute('href', /^\/files\/[\w-]+$/);
      const name = (await links.nth(i).textContent())?.replace(/\s+/g, ' ').trim() ?? '';
      expect(name.length).toBeGreaterThan('تحميل'.length + 1);
    }
    // The section nav marks the current section; the licences and board entries follow.
    const nav = page.locator('nav[aria-labelledby="governance-nav"]');
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('اللوائح والسياسات');
    await expect(nav.getByRole('link', { name: 'التراخيص' })).toHaveAttribute(
      'href',
      '/ar/governance/licences',
    );
    await expect(nav.getByRole('link', { name: 'مجلس الإدارة' })).toHaveAttribute(
      'href',
      '/ar/board',
    );
  });

  test(
    'a document without a file is «قريبًا»; the bylaws show the licence details',
    mockOnly('fixture content: a document with no file, and a licence number in the settings'),
    async ({ page }) => {
      await openAt(page, '/governance/bylaws-policies', DESKTOP, 'ar');
      const soon = page.getByTestId('doc-soon');
      await expect(soon).toHaveCount(1);
      await expect(soon).toContainText('قريبًا');
      await expect(page.getByTestId('governance-documents')).toContainText('[الإصدار]');
      const aside = page.getByTestId('licence-details');
      await expect(aside.getByRole('heading', { name: 'بيانات الترخيص' })).toBeVisible();
      await expect(aside).toContainText('[جهة الترخيص]');
      // Only on the bylaws section.
      await page.goto('/ar/governance/general-assembly');
      await expect(page.getByTestId('licence-details')).toHaveCount(0);
    },
  );

  test(
    'an empty section shows the empty state',
    mockOnly('fixture: financial-reports has no documents'),
    async ({ page }) => {
      await openAt(page, '/governance/financial-reports', DESKTOP, 'en');
      await expect(page.locator('h1')).toHaveText('Financial reports');
      await expect(
        page.getByText('No documents have been published in this section yet.'),
      ).toBeVisible();
    },
  );

  test(
    'licences: the primary band, then a card each with a valid/expired status',
    mockOnly('fixture licences: one primary valid licence and one expired licence'),
    async ({ page }) => {
      await openAt(page, '/governance/licences', DESKTOP, 'ar');
      const band = page.getByTestId('primary-licence');
      await expect(band.getByRole('heading', { level: 2 })).toHaveText('ترخيص الجمعية');
      await expect(band).toContainText('الترخيص الرئيسي');
      await expect(band.locator('a[target="_blank"]')).toHaveAttribute('href', /^\/files\//);
      await expect(band.locator('a[download]')).toHaveAttribute('href', /^\/files\//);
      // Western digits in Arabic too.
      await expect(band).toContainText('2019');
      const cards = page.getByTestId('licence-cards').locator('> li');
      await expect(cards).toHaveCount(2);
      await expect(cards.nth(0).getByTestId('licence-status')).toHaveText('سارٍ');
      await expect(cards.nth(1).getByTestId('licence-status')).toHaveText('منتهٍ');
      await expect(cards.nth(1).locator('a[download]')).toHaveCount(0);
    },
  );

  test('the header «الحوكمة» menu opens, lists the sections and closes on Escape', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await gotoHydrated(page, '/ar');
    const button = page
      .locator('app-site-header')
      .getByRole('button', { name: 'الحوكمة', exact: true });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#governance-menu')).toBeHidden();
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('#governance-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'التراخيص' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'مجلس الإدارة' })).toBeVisible();
    if (usingMockApi) await expect(menu.getByRole('link')).toHaveCount(11);
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await menu.getByRole('link', { name: 'التراخيص' }).click();
    await expect(page).toHaveURL(/\/ar\/governance\/licences$/);
    await expect(menu).toBeHidden();
    await expect(button).toHaveClass(/border-secondary/);
  });

  test('the drawer has a collapsible governance group', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHydrated(page, '/en');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog');
    const group = dialog.getByRole('button', { name: 'Governance' });
    await expect(group).toHaveAttribute('aria-expanded', 'false');
    await group.click();
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    await dialog.getByRole('link', { name: 'Licences' }).click();
    await expect(page).toHaveURL(/\/en\/governance\/licences$/);
    await expect(dialog).toBeHidden();
  });

  test(
    'the footer has a governance column and the licence number links to the licences page',
    mockOnly('the licence number comes from the mock settings ([...]); the dev seed has none'),
    async ({ page }) => {
      await openAt(page, '/', DESKTOP, 'ar');
      const footer = page.locator('app-site-footer');
      const column = footer.getByRole('navigation', { name: 'الحوكمة' });
      await expect(column.getByRole('link', { name: 'اللوائح والسياسات' })).toHaveAttribute(
        'href',
        '/ar/governance/bylaws-policies',
      );
      await expect(column.getByRole('link', { name: 'التراخيص' })).toBeVisible();
      const licence = footer.getByTestId('footer-licence');
      await expect(licence).toHaveText('رقم الترخيص: [...]');
      await expect(licence).toHaveAttribute('href', '/ar/governance/licences');
    },
  );
});
