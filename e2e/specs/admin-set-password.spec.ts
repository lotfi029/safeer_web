import { expect, type Page, test } from '@playwright/test';
import { submitLogin } from '../support/admin';
import { gotoHydrated } from '../support/hydration';
import { authToken, staffAccount } from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);

async function fill(page: Page, password: string, confirm = password): Promise<void> {
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill(password);
  await page.getByRole('textbox', { name: 'Confirm password', exact: true }).fill(confirm);
}

/** W16: the invitation and reset links the API mails to staff (C2). */
test.describe('staff invitation and password reset links (W16)', () => {
  for (const mode of ['accept', 'reset'] as const) {
    test(`${mode}: an unknown token shows "invalid or expired", not a 404`, async ({ page }) => {
      await gotoHydrated(page, `/en/admin/${mode}/not-a-real-token-${Date.now()}`);
      await expect(page.locator('h1')).toHaveText(
        mode === 'accept' ? 'Accept your invitation' : 'Reset your password',
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await fill(page, 'long-enough-password');
      const res = page.waitForResponse((r) => r.url().includes(`/admin/auth/${mode}/`));
      await page.getByRole('button', { name: /Set/ }).click();
      expect((await res).status()).toBe(400);
      await expect(page.getByRole('alert')).toContainText('invalid or has expired');
    });
  }

  test('client validation: minimum length and matching confirmation, before any request', async ({
    page,
  }) => {
    await gotoHydrated(page, '/ar/admin/reset/whatever');
    await expect(page.locator('h1')).toHaveText('إعادة تعيين كلمة المرور');
    let calls = 0;
    page.on('request', (r) => r.url().includes('/admin/auth/reset/') && calls++);
    const submit = page.getByRole('button', { name: 'تعيين كلمة المرور الجديدة' });

    await page.getByRole('textbox', { name: 'كلمة المرور الجديدة', exact: true }).fill('short');
    await page.getByRole('textbox', { name: 'تأكيد كلمة المرور', exact: true }).fill('short');
    await submit.click();
    await expect(page.getByText('يجب ألا تقل كلمة المرور عن 8 أحرف.')).toBeVisible();

    await page
      .getByRole('textbox', { name: 'كلمة المرور الجديدة', exact: true })
      .fill('long-enough-1');
    await page
      .getByRole('textbox', { name: 'تأكيد كلمة المرور', exact: true })
      .fill('long-enough-2');
    await submit.click();
    await expect(page.getByText('كلمتا المرور غير متطابقتين.')).toBeVisible();
    expect(calls).toBe(0);
  });

  for (const mode of ['accept', 'reset'] as const) {
    test(`${mode}: a valid link sets the password once, then that password signs in`, async ({
      page,
    }) => {
      // An invitation is for an invited account (C3); a reset is for an active one.
      const user = await staffAccount(
        'reviewer',
        mode === 'accept' ? { status: 'invited' } : { fresh: true },
      );
      const token = await authToken(user, mode === 'accept' ? 'invite' : 'reset');
      const password = `new-${Date.now()}-password`;
      await gotoHydrated(page, `/en/admin/${mode}/${token}`);
      await fill(page, password);
      await page.getByRole('button', { name: /Set/ }).click();
      await expect(page.getByRole('status')).toContainText('You can now sign in');
      await page.getByRole('link', { name: 'Go to sign in' }).click();
      await expect(page).toHaveURL(/\/en\/admin\/login$/);
      await page.waitForLoadState('networkidle');
      await submitLogin(page, user.email, password);
      await expect(page).toHaveURL(/\/en\/admin$/);

      // Single-use: the same link is refused the second time.
      await page.getByRole('button', { name: 'Sign out' }).click();
      await gotoHydrated(page, `/en/admin/${mode}/${token}`);
      await fill(page, `${password}-again`);
      await page.getByRole('button', { name: /Set/ }).click();
      await expect(page.getByRole('alert')).toContainText('invalid or has expired');
    });
  }
});
