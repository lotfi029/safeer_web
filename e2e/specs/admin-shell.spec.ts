import { expect, test } from '@playwright/test';
import { signInAs } from '../support/admin';
import { checkScreen, matrix, PR_VIEWPORTS } from '../support/matrix';
import { disposeSetupAdmin, staffAccount, type StaffAccount } from '../support/real-api';
import { type StaffRole, useRealDb } from '../support/real-db';

useRealDb(test);
test.afterAll(disposeSetupAdmin);

const CONTENT = [
  'Pages',
  'News',
  'Work areas',
  'Board',
  'Partners',
  'Documents',
  'Licences',
  'Figures',
  'About items',
  'Media',
];
const CONTENT_AND_INBOX = [...CONTENT.slice(0, 4), 'Testimonials', ...CONTENT.slice(4)];

/**
 * The menu and the overview blocks each role gets (GET /admin/roles + GET /admin/overview, A5). The
 * application blocks (stat cards, chart, latest list) were removed with the scholarship feature.
 */
const EXPECT: Record<StaffRole, { menu: string[]; stats: string[]; audit: boolean }> = {
  admin: {
    menu: [
      'Overview',
      'Messages',
      'Newsletter',
      ...CONTENT_AND_INBOX,
      'Redirects',
      'Users',
      'Settings',
      'Email',
      'Activity log',
    ],
    stats: ['unreadMessages'],
    audit: true,
  },
  support: {
    menu: ['Overview', 'Messages', 'Newsletter', 'Testimonials'],
    stats: ['unreadMessages'],
    audit: false,
  },
  editor: {
    menu: ['Overview', ...CONTENT, 'Redirects'],
    stats: [],
    audit: false,
  },
};

test.describe('admin shell + overview', () => {
  for (const role of Object.keys(EXPECT) as StaffRole[]) {
    test(`${role}: menu and overview blocks follow the role`, async ({ page }) => {
      const want = EXPECT[role];
      const user: StaffAccount = await staffAccount(role, { fresh: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await signInAs(page, user);
      const nav = page.getByTestId('admin-sidebar').getByRole('navigation');
      await expect(nav.getByRole('link')).toHaveText(want.menu.map((m) => new RegExp(`^${m}`)));
      await expect(page.locator('h1')).toHaveText('Overview');

      const stats = page.locator('[data-stat]');
      await expect(stats).toHaveCount(want.stats.length);
      for (const key of want.stats)
        await expect(page.locator(`[data-stat="${key}"]`)).toBeVisible();
      await expect(page.getByTestId('series-chart')).toHaveCount(0);
      await expect(page.getByTestId('latest-applications')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Recent activity' })).toHaveCount(
        want.audit ? 1 : 0,
      );
      await expect(page.getByRole('heading', { name: 'Content alerts' })).toBeVisible();
    });
  }

  for (const { viewport, locale } of matrix()) {
    test(`overview ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      const admin = await staffAccount('admin', { fresh: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await signInAs(page, admin, '/admin', locale);
      await expect(page.locator('[data-stat]').first()).toBeVisible();
      await checkScreen(page, testInfo, 'admin-overview', viewport, locale);
    });
  }

  test('support overview @1440', async ({ page }, testInfo) => {
    const support = await staffAccount('support', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['ar', 'en'] as const) {
      await signInAs(page, support, '/admin', locale);
      await expect(page.locator('[data-stat]').first()).toBeVisible();
      await checkScreen(page, testInfo, 'admin-overview-support', PR_VIEWPORTS[1], locale);
    }
  });

  test('below lg the menu is a drawer; following a link closes it', async ({ page }, testInfo) => {
    const admin = await staffAccount('admin', { fresh: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['ar', 'en'] as const) {
      await signInAs(page, admin, '/admin', locale);
      await expect(page.getByTestId('admin-sidebar')).toBeHidden();
      await page
        .getByRole('button', { name: locale === 'en' ? 'Open menu' : 'فتح القائمة' })
        .click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible();
      await checkScreen(page, testInfo, 'admin-drawer', PR_VIEWPORTS[0], locale);
      await drawer.getByRole('link', { name: locale === 'en' ? /Messages/ : /الرسائل/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/messages$`));
      await expect(drawer).toBeHidden();
    }
  });

  test('at lg the sidebar is an icon rail with names as tooltips', async ({ page }) => {
    const admin = await staffAccount('admin', { fresh: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await signInAs(page, admin);
    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar).toBeVisible();
    const box = await sidebar.boundingBox();
    expect(box!.width).toBeLessThan(120);
    const link = sidebar.getByRole('link', { name: 'Messages' });
    await expect(link).toHaveAttribute('title', 'Messages');
  });
});
