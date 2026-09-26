import { expect, test } from '@playwright/test';
import { usingMockApi } from '../support/env';

/** StaffSessionStore + staffGuard/roleGuard through the stub login (Session 2 builds the real UI). */
test.describe('staff auth plumbing', () => {
  test.skip(!usingMockApi, 'uses mock staff accounts');

  test('anonymous → login with returnUrl → back to the guarded page → logout', async ({ page }) => {
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/admin\/login\?returnUrl=%2Fen%2Fadmin$/);
    await page.getByLabel('Email').fill('admin@mock.invalid');
    await page.getByLabel('Password').fill('mock-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(page.getByText('admin@mock.invalid')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
  });

  test('wrong password shows the problem message', async ({ page }) => {
    await page.goto('/en/admin/login');
    await page.getByLabel('Email').fill('admin@mock.invalid');
    await page.getByLabel('Password').fill('nope');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Incorrect email or password.');
  });

  test('roleGuard: a reviewer cannot open an admin-only area (matrix from GET /admin/roles)', async ({
    page,
  }) => {
    await page.goto('/ar/admin/login?returnUrl=%2Far%2Fadmin%2Fsystem%2Fusers');
    await page.locator('input[type=email]').fill('reviewer@mock.invalid');
    await page.locator('input[type=password]').fill('mock-password');
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/ar\/admin\/forbidden$/);
    await expect(page.locator('h1')).toHaveText('لا تملك صلاحية الوصول');
  });

  test('client validation blocks an empty submit', async ({ page }) => {
    await page.goto('/en/admin/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('This field is required.').first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
  });
});
