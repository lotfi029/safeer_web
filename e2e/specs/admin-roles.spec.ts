import { expect, type Page, test } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { signInAs } from '../support/admin';
import { checkScreen, matrix } from '../support/matrix';
import { customRole, disposeSetupAdmin, staffAccount } from '../support/real-api';
import { useRealDb } from '../support/real-db';

/**
 * safeer_api v1.1.0: custom roles and permissions, on both backends. The dashboard reads
 * `GET /admin/me` → `permissions`; screens a role can't view are missing from the menu and answer a
 * direct URL with the no-access page; write buttons a role can't use are hidden.
 */
useRealDb(test);
test.afterAll(disposeSetupAdmin);

const dialog = (page: Page) => page.getByRole('dialog');
const NEWS_ONLY = ['news.view', 'news.manage', 'news.delete'];

test.describe('roles and permissions', () => {
  for (const { viewport, locale } of matrix()) {
    test(`roles screen ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      const admin = await staffAccount('admin', { fresh: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await signInAs(page, admin, '/admin/system/roles', locale);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('[data-role="admin"]')).toBeVisible();
      await checkScreen(page, testInfo, 'admin-roles-list', viewport, locale);
      await page.locator('[data-role="editor"]').getByTestId('role-open').click();
      await expect(dialog(page).locator('[data-module="news"]')).toBeVisible();
      await checkScreen(page, testInfo, 'admin-role-editor', viewport, locale);
    });
  }

  test('a custom "news only" role sees only News; a direct URL to another screen is no access', async ({
    page,
  }) => {
    const role = await customRole(NEWS_ONLY, 'news');
    const writer = await staffAccount(role, { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, writer, '/admin');

    const nav = page.getByTestId('admin-sidebar').getByRole('navigation');
    await expect(nav.getByRole('link')).toHaveText([/^Overview/, /^News/]);
    // No message counts and no activity log without messages.view / audit.view.
    await expect(page.locator('[data-stat]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toHaveCount(0);

    await page.goto('/en/admin/news');
    await expect(page.locator('h1')).toHaveText('News');
    await expect(page.getByRole('link', { name: 'New story' })).toBeVisible();

    for (const path of [
      '/admin/pages',
      '/admin/messages',
      '/admin/system/users',
      '/admin/system/roles',
    ]) {
      await page.goto(`/en${path}`);
      await expect(page, path).toHaveURL(/\/en\/admin\/forbidden$/);
      await expect(page.locator('h1')).toHaveText('No access');
    }
  });

  test('view-only: lists show, write buttons are hidden', async ({ page }) => {
    const role = await customRole(['news.view', 'partners.view'], 'viewer');
    const viewer = await staffAccount(role, { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, viewer, '/admin/news');
    await expect(page.locator('h1')).toHaveText('News');
    await expect(page.getByRole('link', { name: 'New story' })).toHaveCount(0);

    await page.goto('/en/admin/partners');
    await expect(page.locator('h1')).toHaveText('Partners');
    await expect(page.getByRole('button', { name: 'Add partner' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Edit/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
    // The quick actions need the permission to create what they open.
    await page.goto('/en/admin');
    await expect(page.getByTestId('quick-actions')).toHaveCount(0);
  });

  test('admin creates a role in the grid, assigns it, and a role in use cannot be deleted', async ({
    page,
  }) => {
    const admin = await staffAccount('admin', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, admin, '/admin/system/roles');

    const n = randomInt(1e5, 1e6);
    const key = `e2e-docs-${n}`;
    // Unique names: the pickers select by label, and other runs may have left roles behind.
    const nameEn = `Documents officer ${n}`;
    await page.getByTestId('role-add').click();
    await dialog(page).getByTestId('role-name-ar').fill('مسؤول وثائق');
    await dialog(page).getByTestId('role-name-en').fill(nameEn);
    await dialog(page).getByTestId('role-key').fill(key);
    // Delete implies manage and view; clearing view clears the row again.
    const docs = dialog(page).locator('[data-module="documents"]');
    await docs.locator('[data-permission="documents.delete"]').check();
    await expect(docs.locator('[data-permission="documents.view"]')).toBeChecked();
    await expect(docs.locator('[data-permission="documents.manage"]')).toBeChecked();
    const partners = dialog(page).locator('[data-module="partners"]');
    await partners.locator('[data-permission="partners.manage"]').check();
    await partners.locator('[data-permission="partners.view"]').uncheck();
    await expect(partners.locator('[data-permission="partners.manage"]')).not.toBeChecked();
    // Newsletter has no "manage" column entry.
    await expect(dialog(page).locator('[data-permission="newsletter.manage"]')).toHaveCount(0);
    await dialog(page).getByTestId('role-save').click();

    const row = page.locator(`[data-role="${key}"]`);
    await expect(row).toContainText(nameEn);
    await expect(row).toContainText('Permissions: 3');
    await expect(row.getByTestId('role-users')).toHaveText('Users: 0');

    // Assign it through the users screen (the invite picker lists it).
    await page.goto('/en/admin/system/users');
    await page.getByRole('button', { name: 'Invite a user' }).click();
    await dialog(page).getByLabel('Name').fill('E2E Docs');
    await dialog(page).getByLabel('Email').fill(`${key}@e2e.invalid`);
    await dialog(page).getByLabel('Role').selectOption({ label: nameEn });
    await dialog(page).getByRole('button', { name: 'Send invitation' }).click();
    await expect(
      page.locator(`[data-user="${key}@e2e.invalid"]`).getByTestId('user-role-name'),
    ).toHaveText(nameEn);

    await page.goto('/en/admin/system/roles');
    await expect(row.getByTestId('role-users')).toHaveText('Users: 1');
    await row.getByTestId('role-delete').click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'is assigned to 1 users' }),
    ).toBeVisible();

    // The admin role opens read-only; system roles have no delete button.
    await page.locator('[data-role="admin"]').getByTestId('role-open').click();
    await expect(dialog(page).getByTestId('role-readonly')).toBeVisible();
    await expect(dialog(page).getByTestId('role-save')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('[data-role="editor"]').getByTestId('role-delete')).toHaveCount(0);
  });
});
