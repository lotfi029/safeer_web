import { expect, type Page, test } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { signInAs, submitLogin } from '../support/admin';
import { content, tagOf } from '../support/content';
import { gotoHydrated } from '../support/hydration';
import { checkScreen, matrix } from '../support/matrix';
import {
  applicationIn,
  authToken,
  disposeSetupAdmin,
  postNewsletter,
  setupAdmin,
  staffAccount,
  type StaffAccount,
} from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);
test.afterAll(disposeSetupAdmin);

const dialog = (page: Page) => page.getByRole('dialog');
const rand = () => String(randomInt(1e6, 1e7));

async function asAdmin(
  page: Page,
  path: string,
  locale: 'ar' | 'en' = 'en',
): Promise<StaffAccount> {
  const admin = await staffAccount('admin', { fresh: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, admin, path, locale);
  return admin;
}

test.describe('admin system', () => {
  const SCREENS = [
    ['admin-users', '/admin/system/users'],
    ['admin-settings', '/admin/system/settings'],
    ['admin-mail', '/admin/system/mail'],
    ['admin-mail-templates', '/admin/system/mail?tab=templates'],
    ['admin-sms-log', '/admin/system/sms?tab=log'],
    ['admin-audit', '/admin/system/audit'],
    ['admin-redirects', '/admin/redirects'],
    ['admin-newsletter', '/admin/newsletter'],
    ['admin-interview-slots', '/admin/interview-slots'],
    ['admin-account', '/admin/account'],
  ] as const;

  for (const { viewport, locale } of matrix()) {
    test(`system screens ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const admin = await staffAccount('admin', { fresh: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await signInAs(page, admin, '/admin', locale);
      for (const [name, path] of SCREENS) {
        await page.goto(`/${locale}${path}`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1')).toBeVisible();
        await checkScreen(page, testInfo, name, viewport, locale);
      }
    });
  }

  test('users: invite → accept the link → active; role change; disable blocks sign-in', async ({
    page,
    browser,
  }) => {
    await asAdmin(page, '/admin/system/users');
    const email = `e2e-invite-${rand()}@e2e.invalid`;
    await page.getByRole('button', { name: 'Invite a user' }).click();
    await dialog(page).getByLabel('Name').fill('E2E Invitee');
    await dialog(page).getByLabel('Email').fill(email);
    await dialog(page).getByLabel('Role').selectOption('reviewer');
    await dialog(page).getByRole('button', { name: 'Send invitation' }).click();
    const row = page.locator(`[data-user="${email}"]`);
    await expect(row.getByTestId('user-status')).toHaveText('Invitation pending');

    // The invited user accepts the (mailed) link.
    const users = await (
      await setupAdmin()
    ).get<Array<{ id: string; email: string }>>('admin/users');
    const invited = users.find((u) => u.email === email)!;
    const token = await authToken(
      { ...invited, name: 'E2E Invitee', password: '', role: 'reviewer' },
      'invite',
    );
    const other = await browser.newPage();
    await gotoHydrated(other, `/en/admin/accept/${token}`);
    await other
      .getByRole('textbox', { name: 'New password', exact: true })
      .fill('invitee-password-1');
    await other
      .getByRole('textbox', { name: 'Confirm password', exact: true })
      .fill('invitee-password-1');
    await other.getByRole('button', { name: /Set/ }).click();
    await expect(other.getByRole('status')).toContainText('You can now sign in');

    await page.reload();
    await expect(row.getByTestId('user-status')).toHaveText('Active');
    await row.getByRole('button', { name: /^Edit/ }).click();
    await dialog(page).getByLabel('Role').selectOption('editor');
    await dialog(page)
      .getByLabel(/Disable the account/)
      .check();
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(row).toContainText('Editor');
    await expect(row.getByTestId('user-status')).toHaveText('Disabled');

    await gotoHydrated(other, '/en/admin/login');
    await submitLogin(other, email, 'invitee-password-1');
    await expect(other.getByRole('alert')).toHaveText('Incorrect email or password.');
    await other.close();

    await row.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
  });

  test('users: unlock a locked account; your own role is fixed; the matrix follows GET /admin/roles', async ({
    page,
  }) => {
    const locked = await staffAccount('support', { locked: true });
    const me = await asAdmin(page, '/admin/system/users');
    const row = page.locator(`[data-user="${locked.email}"]`);
    await expect(row.getByTestId('user-locked')).toBeVisible();
    await row.getByRole('button', { name: /^Unlock/ }).click();
    await expect(row.getByTestId('user-locked')).toHaveCount(0);

    const mine = page.locator(`[data-user="${me.email}"]`);
    await expect(mine.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
    await mine.getByRole('button', { name: /^Edit/ }).click();
    await expect(dialog(page).getByLabel('Role')).toBeDisabled();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();

    const matrixRows = page.getByTestId('role-matrix').locator('tbody tr');
    await expect(matrixRows).toHaveCount(9);
    // Deleting redirects: admin only.
    const redirectsRow = matrixRows.filter({ hasText: 'Deleting redirects' });
    await expect(redirectsRow.getByText('Allowed', { exact: true })).toHaveCount(1);
  });

  test('settings: the map only takes allowed hosts; a save shows up in the audit log', async ({
    page,
  }) => {
    await asAdmin(page, '/admin/system/settings');
    const map = page.getByLabel('Map embed link');
    const original = await map.inputValue();
    await map.fill('https://maps.example.com/embed?x=1');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Only a Google Maps embed')).toBeVisible();
    await map.fill(original);

    const tagline = page.getByLabel('Tagline (English)');
    const before = await tagline.inputValue();
    const value = `E2E tagline ${rand()}`;
    await tagline.fill(value);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Settings saved.' })).toBeVisible();
    try {
      await page.goto('/en/admin/system/audit?entity=site_settings');
      const first = page.getByTestId('audit-rows').locator('li').first();
      await first.locator('summary').click();
      await expect(first).toContainText('taglineEn');
      await expect(first).toContainText(value);
    } finally {
      await (
        await setupAdmin()
      ).ctx.put('admin/settings', {
        data: { taglineEn: before || null },
        headers: { 'x-csrf-token': (await setupAdmin()).csrf },
      });
    }
  });

  test('mail: unknown variables are refused; a test send without SMTP reports why', async ({
    page,
  }) => {
    await asAdmin(page, '/admin/system/mail?tab=templates');
    const row = page.locator('[data-template="password_reset"]');
    await row.getByRole('button', { name: /^Edit/ }).click();
    const d = dialog(page);
    await expect(d.getByTestId('template-variables')).toContainText('{{ link }}');
    const subject = d.getByLabel('Subject (Arabic)');
    const original = await subject.inputValue();
    await subject.fill(`${original} {{ nonexistent }}`);
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d.getByText('Unknown variables in the template: nonexistent')).toBeVisible();
    await subject.fill(original);
    // The dialog's own Preview action (the Markdown editors have Preview switches too).
    await d.getByRole('button', { name: 'Preview', exact: true }).last().click();
    await expect(d.getByTestId('template-preview')).toBeVisible();
    await d.getByRole('button', { name: 'Cancel' }).click();

    await page
      .getByRole('navigation', { name: 'Page sections' })
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await expect(page.getByLabel('Sending method')).toBeVisible();
    await page.getByLabel('To email', { exact: true }).fill('someone@example.invalid');
    await page.getByRole('button', { name: 'Send a test' }).click();
    await expect(page.getByTestId('last-test')).toContainText('The last test failed');
    await expect(page.getByTestId('last-test')).toContainText('SMTP is not configured');
  });

  test('redirects: create, a chain is refused on its field, the legacy path answers 301; only admins delete', async ({
    page,
    request,
  }) => {
    const from = `/e2e-old-${rand()}`;
    await asAdmin(page, '/admin/redirects');
    await page.getByRole('button', { name: 'Add redirect' }).click();
    await dialog(page).getByLabel('From path').fill(from);
    await dialog(page).getByLabel('To path').fill('/ar/about');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page)).toBeHidden();
    const row = page.locator('[data-row]').filter({ hasText: from });
    await expect(row).toContainText('301');

    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toBe('/ar/about');

    await page.getByRole('button', { name: 'Add redirect' }).click();
    await dialog(page).getByLabel('From path').fill(`/e2e-older-${rand()}`);
    await dialog(page).getByLabel('To path').fill(from);
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(
      dialog(page).getByText('This redirect would chain through another redirect.').first(),
    ).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Sign out' }).click();
    const editor = await staffAccount('editor', { fresh: true });
    await signInAs(page, editor, '/admin/redirects');
    await expect(row.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await asAdmin(page, '/admin/redirects');
    await row.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
  });

  test('newsletter: pending subscribers, CSV export, delete', async ({ page }) => {
    const email = await postNewsletter(`news-${rand()}`);
    await asAdmin(page, '/admin/newsletter?status=pending');
    const row = page.locator(`[data-email="${email}"]`);
    await expect(row).toContainText('Awaiting confirmation');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(readFileSync((await file.path())!, 'utf8')).toContain(email);
    await row.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
  });

  test('interview slots: times in Riyadh, the end must follow the start', async ({ page }) => {
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, reviewer, '/admin/interview-slots');
    const day = new Date(Date.now() + (30 + randomInt(0, 200)) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await page.getByRole('button', { name: 'Add slot' }).click();
    await dialog(page).getByLabel('Starts').fill(`${day}T10:00`);
    await dialog(page).getByLabel('Ends').fill(`${day}T09:30`);
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page).getByText('Must be after the start time.')).toBeVisible();
    await dialog(page).getByLabel('Ends').fill(`${day}T10:30`);
    const loc = tagOf('Room');
    await dialog(page).getByLabel('Location (English)').fill(loc);
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page)).toBeHidden();
    const row = page.locator('[data-row]').filter({ hasText: loc });
    await expect(row).toContainText('10:00–10:30');
    await expect(row).toContainText('Open');
    const slots = await content.list<{ id: string; startsAt: string; locationEn: string }>(
      'interview-slots',
    );
    const slot = slots.data.find((s) => s.locationEn === loc)!;
    expect(new Date(slot.startsAt).toISOString()).toBe(new Date(`${day}T07:00:00Z`).toISOString());
    await content.remove('interview-slots', slot.id);
  });

  test('account: wrong current password; sessions on another device can be ended', async ({
    page,
    browser,
  }) => {
    const user = await staffAccount('support', { fresh: true });
    const phone = await browser.newPage();
    await signInAs(phone, user, '/admin');
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, user, '/admin/account');
    await expect(page.getByTestId('session-rows').locator('li')).toHaveCount(2);
    await expect(page.getByText('This device')).toBeVisible();

    await page.getByLabel('Current password').fill('not-it');
    await page
      .getByRole('textbox', { name: 'New password', exact: true })
      .fill('another-password-9');
    await page
      .getByRole('textbox', { name: 'Confirm password', exact: true })
      .fill('another-password-9');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('The current password is incorrect.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign out other devices' }).click();
    await expect(page.getByTestId('session-rows').locator('li')).toHaveCount(1);
    await phone.goto('/en/admin/applications');
    await expect(phone).toHaveURL(/\/en\/admin\/login/);
    await phone.close();

    await page.getByLabel('Current password').fill(user.password);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Password changed.' })).toBeVisible();
  });

  test('anonymise: admins delete an application’s personal data; reviewers don’t see the action', async ({
    page,
  }) => {
    const app = await applicationIn('under_review', `anon${rand()}`);
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, reviewer, `/admin/applications/${app.id}`);
    await expect(page.getByTestId('review-documents')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete personal data' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Sign out' }).click();

    await asAdmin(page, `/admin/applications/${app.id}`);
    await page.getByRole('button', { name: 'Delete personal data' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete personal data' })
      .click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: `Personal data of application ${app.reference} deleted.` }),
    ).toBeVisible();
    await expect(page.getByText('No documents uploaded yet.')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('[—]');
  });
});
