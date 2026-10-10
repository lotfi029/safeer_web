import { expect, test } from '@playwright/test';
import { submitLogin } from '../support/admin';
import { gotoHydrated } from '../support/hydration';
import { checkScreen, matrix, openAt } from '../support/matrix';
import { staffAccount, unlockNow } from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);

const INVALID = 'Incorrect email or password.';

/** Staff sign-in, forgot password and the guards, on the mock and the real API (seeded staff). */
test.describe('staff auth', () => {
  for (const { viewport, locale } of matrix()) {
    test(`login + forgot ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/admin/login', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'admin-login', viewport, locale);
      await openAt(page, '/admin/forgot', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'admin-forgot', viewport, locale);
    });
  }

  test('anonymous → login with returnUrl → back to the page → sign out', async ({ page }) => {
    const admin = await staffAccount('admin', { fresh: true });
    await page.goto('/en/admin/applications');
    await expect(page).toHaveURL(/\/en\/admin\/login\?returnUrl=%2Fen%2Fadmin%2Fapplications$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.waitForLoadState('networkidle');
    await submitLogin(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/en\/admin\/applications$/);
    await expect(page.getByTestId('admin-user')).toContainText('Administrator');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/admin\/login\?returnUrl=/);
  });

  test('wrong password, disabled and locked accounts all get the same message (A2/C3)', async ({
    page,
  }) => {
    const active = await staffAccount('reviewer', { fresh: true });
    const disabled = await staffAccount('reviewer', { status: 'disabled' });
    const locked = await staffAccount('editor', { locked: true });
    await gotoHydrated(page, '/en/admin/login');
    const messages: string[] = [];
    for (const [email, password] of [
      [active.email, 'not-the-password'],
      [disabled.email, disabled.password],
      [locked.email, locked.password],
      [`nobody-${Date.now()}@e2e.invalid`, 'whatever-123'],
    ]) {
      const res = page.waitForResponse((r) => r.url().includes('/admin/auth/login'));
      await submitLogin(page, email, password);
      expect((await res).status()).toBe(401);
      const alert = page.getByRole('alert');
      await expect(alert).toHaveText(INVALID);
      messages.push(((await alert.textContent()) ?? '').trim());
    }
    expect(new Set(messages).size).toBe(1);
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
  });

  test('a locked account signs in again once its lock has run out', async ({ page }) => {
    const locked = await staffAccount('support', { locked: true });
    await gotoHydrated(page, '/en/admin/login');
    await submitLogin(page, locked.email, locked.password);
    await expect(page.getByRole('alert')).toHaveText(INVALID);
    await unlockNow(locked);
    await submitLogin(page, locked.email, locked.password);
    await expect(page).toHaveURL(/\/en\/admin$/);
  });

  test('the per-email limiter answers the sixth attempt in a minute with its own message', async ({
    page,
  }) => {
    const user = await staffAccount('editor', { fresh: true });
    await gotoHydrated(page, '/en/admin/login');
    for (let i = 0; i < 5; i++) {
      const res = page.waitForResponse((r) => r.url().includes('/admin/auth/login'));
      await submitLogin(page, user.email, `wrong-${i}-password`);
      expect((await res).status()).toBe(401);
    }
    const res = page.waitForResponse((r) => r.url().includes('/admin/auth/login'));
    await submitLogin(page, user.email, user.password);
    expect((await res).status()).toBe(429);
    await expect(page.getByRole('alert')).toContainText('Too many attempts for this account');
  });

  test('client validation blocks an empty submit', async ({ page }) => {
    await gotoHydrated(page, '/en/admin/login');
    let calls = 0;
    page.on('request', (r) => {
      if (r.url().includes('/admin/auth/login')) calls++;
    });
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('This field is required.').first()).toBeVisible();
    expect(calls).toBe(0);
  });

  test('forgot: the same neutral confirmation for any address', async ({ page }) => {
    const user = await staffAccount('admin', { fresh: true });
    for (const email of [user.email, `unknown-${Date.now()}@e2e.invalid`]) {
      await gotoHydrated(page, '/en/admin/login');
      await page.getByRole('link', { name: 'Forgot your password?' }).click();
      await expect(page).toHaveURL(/\/en\/admin\/forgot$/);
      await page.waitForLoadState('networkidle');
      await page.locator('input[type=email]').fill(email);
      const res = page.waitForResponse((r) => r.url().includes('/admin/auth/forgot'));
      await page.getByRole('button', { name: 'Send the link' }).click();
      expect((await res).ok()).toBe(true);
      await expect(page.getByRole('status')).toContainText('If this email belongs to an account');
    }
  });

  test('roleGuard: an editor opening applications gets the no-access page (GET /admin/roles)', async ({
    page,
  }) => {
    const editor = await staffAccount('editor', { fresh: true });
    await page.goto('/ar/admin/login?returnUrl=%2Far%2Fadmin%2Fapplications');
    await page.waitForLoadState('networkidle');
    await submitLogin(page, editor.email, editor.password);
    await expect(page).toHaveURL(/\/ar\/admin\/forbidden$/);
    await expect(page.locator('h1')).toHaveText('لا تملك صلاحية الوصول');
  });
});
