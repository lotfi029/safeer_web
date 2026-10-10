import { expect, type Page, test } from '@playwright/test';
import { MOCK_API_URL, mockOnly } from '../support/env';
import { gotoHydrated } from '../support/hydration';

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
    test(
      `${mode}: a valid link sets the password once, then leads to sign in`,
      mockOnly('the real API only mails its tokens; the mock mints one per test'),
      async ({ page, request }) => {
        const { token } = (await (
          await request.post(`${MOCK_API_URL}/__auth-token`, { data: { purpose: mode } })
        ).json()) as { token: string };
        await gotoHydrated(page, `/en/admin/${mode}/${token}`);
        await fill(page, 'a-new-password');
        await page.getByRole('button', { name: /Set/ }).click();
        await expect(page.getByRole('status')).toContainText('You can now sign in');
        await page.getByRole('link', { name: 'Go to sign in' }).click();
        await expect(page).toHaveURL(/\/en\/admin\/login$/);

        // Single-use: the same link is refused the second time.
        await gotoHydrated(page, `/en/admin/${mode}/${token}`);
        await fill(page, 'a-new-password');
        await page.getByRole('button', { name: /Set/ }).click();
        await expect(page.getByRole('alert')).toContainText('invalid or has expired');
      },
    );
  }
});
