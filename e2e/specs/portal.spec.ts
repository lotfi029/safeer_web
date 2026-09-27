import { expect, type Page, test } from '@playwright/test';
import { MOCK_API_URL, usingMockApi } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';

const MOCK_OTP = '123456';
const PDF = {
  name: 'id.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%mock\n'),
};

/** Seeded in mocks/fixtures/applications.json (one application per status). */
const REFS = {
  under_review: 'SA-2026-00101',
  docs_missing: 'SA-2026-00102',
  interview: 'SA-2026-00103',
  accepted: 'SA-2026-00104',
  rejected: 'SA-2026-00105',
  new: 'SA-2026-00106',
  draft: 'SA-2026-00107',
} as const;

async function signIn(
  page: Page,
  reference: string,
  lang: 'ar' | 'en' = 'en',
  path = '/portal/login',
) {
  await page.goto(`/${lang}${path}`);
  await page.waitForLoadState('networkidle');
  await page.locator('input[autocomplete="username"]').fill(reference);
  await page.locator('form button[type=submit]').click();
  const firstBox = page.locator('app-otp-input input').first();
  await expect(firstBox).toBeVisible();
  await firstBox.click();
  await page.keyboard.type(MOCK_OTP);
  await expect(page).not.toHaveURL(/\/portal\/login/);
  await page.waitForLoadState('networkidle');
}

test.describe('student portal', () => {
  test.skip(!usingMockApi, 'uses seeded mock applications and the mock OTP');
  // Tests that change an application restore just that one first (`__reset?reference=`), so
  // other specs' mock sessions survive; tests using the same application run serially.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ request }) => {
    for (const reference of Object.values(REFS)) {
      await request.post(`${MOCK_API_URL}/__reset?reference=${reference}`);
    }
  });

  for (const { viewport, locale } of matrix()) {
    test(`login ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/portal/login', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'portal-login', viewport, locale);
    });
    test(`status + documents ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await signIn(page, REFS.docs_missing, locale);
      await expect(page.getByTestId('reference')).toHaveText(REFS.docs_missing);
      await checkScreen(page, testInfo, 'portal-status', viewport, locale);
      await page.goto(`/${locale}/portal/documents`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'portal-docs', viewport, locale);
    });
  }

  test('guard: anonymous → login with returnUrl → back to the page after the OTP', async ({
    page,
  }) => {
    await page.goto('/en/portal/documents');
    await expect(page).toHaveURL(/\/en\/portal\/login\?returnUrl=%2Fen%2Fportal%2Fdocuments$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await page.waitForLoadState('networkidle');
    await page.locator('input[autocomplete="username"]').fill(REFS.under_review);
    await page.locator('form button[type=submit]').click();
    await page.locator('app-otp-input input').first().click();
    await page.keyboard.type(MOCK_OTP);
    await expect(page).toHaveURL(/\/en\/portal\/documents$/);
  });

  test('a wrong code shows OTP_INVALID with the 1-hour lockout hint (A1); nothing reveals whether the account exists', async ({
    page,
  }) => {
    await page.goto('/en/portal/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[autocomplete="username"]').fill('nobody@mock.invalid');
    await page.locator('form button[type=submit]').click();
    // A4: the request-otp answer never means a code was sent, so the copy doesn't say it was.
    const sent = page.getByRole('main').getByRole('status');
    await expect(sent).toContainText('If these details match an application');
    await expect(sent).not.toContainText(/was sent|on its way/i);
    await page.locator('app-otp-input input').first().click();
    await page.keyboard.type('000000');
    const alert = page.getByRole('main').getByRole('alert');
    await expect(alert).toContainText('wrong or has expired');
    await expect(alert).toContainText('try again in an hour');
    await expect(alert).not.toContainText(/tomorrow/i);
    await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  });

  for (const [status, label] of [
    ['under_review', 'Under review'],
    ['interview', 'Interview'],
    ['accepted', 'Accepted'],
    ['rejected', 'Rejected'],
    ['new', 'New'],
    ['draft', 'Draft'],
  ] as const) {
    test(`status page: ${status}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, REFS[status]);
      await expect(page.getByTestId('reference')).toHaveText(REFS[status]);
      await expect(page.locator('app-status-pill').first()).toContainText(label);
      await expect(page.locator('app-timeline li')).toHaveCount(5);
      if (status === 'draft') {
        await expect(
          page.getByRole('link', { name: 'Continue your application' }).first(),
        ).toBeVisible();
      }
    });
  }

  test('docs_missing: action needed → re-upload the rejected ID copy; accepted documents stay locked', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, REFS.docs_missing);
    const action = page.getByRole('main').getByRole('alert').filter({ hasText: 'Action needed' });
    await expect(action).toContainText('Document rejected: ID copy');
    await action.getByRole('link', { name: 'Replace file' }).click();
    await expect(page).toHaveURL(/\/en\/portal\/documents$/);
    await page.waitForLoadState('networkidle');

    const idRow = page.getByRole('row').filter({ hasText: 'id-card.jpg' });
    const certRow = page.getByRole('row').filter({ hasText: 'certificate.pdf' });
    await expect(certRow.getByRole('button')).toHaveCount(0);
    await idRow.getByRole('button', { name: 'Re-upload' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type=file]').setInputFiles(PDF);
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Document uploaded').first()).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'id.pdf' })).toContainText('Under review');
  });

  test('reload then write: the CSRF token comes back from /portal/me (B16)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(
      page,
      REFS.docs_missing,
      'en',
      '/portal/login?returnUrl=%2Fen%2Fportal%2Fdocuments',
    );
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('row')
      .filter({ hasText: 'id-card.jpg' })
      .getByRole('button', { name: 'Re-upload' })
      .click();
    const upload = page.waitForResponse(
      (r) => /\/portal\/documents(\?|$)/.test(r.url()) && r.request().method() === 'POST',
    );
    await page.getByRole('dialog').locator('input[type=file]').setInputFiles(PDF);
    expect((await upload).status()).toBe(201);
  });

  test('interview: book a slot, then cancel it (C17)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, REFS.interview);
    const section = page.getByTestId('interview');
    await section.getByRole('button', { name: 'Book this slot' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm booking' }).click();
    await expect(section).toContainText('Your interview:');
    await section.getByRole('button', { name: 'Cancel interview' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Yes, cancel it' }).click();
    await expect(section.getByRole('button', { name: 'Book this slot' }).first()).toBeVisible();
  });

  test('interview: SLOT_ALREADY_BOOKED is shown in the dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, REFS.interview);
    await page.route(/\/api\/v1\/portal\/interview(\?|$)/, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 409, code: 'SLOT_ALREADY_BOOKED', title: 'Conflict' }),
          })
        : route.continue(),
    );
    await page
      .getByTestId('interview')
      .getByRole('button', { name: 'Book this slot' })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(dialog.getByRole('alert')).toContainText('This slot is taken');
  });

  test('interview: a 429 on booking or cancelling says to try again in an hour (A9)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, REFS.interview);
    await page.route(/\/api\/v1\/portal\/interview(\?|$)/, (route) =>
      ['POST', 'DELETE'].includes(route.request().method())
        ? route.fulfill({
            status: 429,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 429, code: 'RATE_LIMITED', title: 'Too Many Requests' }),
          })
        : route.continue(),
    );
    await page
      .getByTestId('interview')
      .getByRole('button', { name: 'Book this slot' })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Try again in an hour');
  });

  test('sign out clears the session', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, REFS.under_review);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en\/portal\/login$/);
    await page.goto('/en/portal');
    await expect(page).toHaveURL(/\/en\/portal\/login\?returnUrl=/);
  });
});
