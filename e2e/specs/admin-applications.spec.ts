import { expect, type Page, test } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { signInAs } from '../support/admin';
import { checkScreen, matrix } from '../support/matrix';
import {
  applicationIn,
  disposeSetupAdmin,
  setupAdmin,
  staffAccount,
  type TestApplication,
} from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);
test.afterAll(disposeSetupAdmin);

const tag = (name: string) => `${name}${randomInt(1e6, 1e7)}`;

async function openList(page: Page, query: string, locale: 'ar' | 'en' = 'en') {
  const reviewer = await staffAccount('reviewer', { fresh: true });
  await signInAs(page, reviewer, `/admin/applications${query}`, locale);
}

function row(page: Page, app: TestApplication) {
  return page.getByRole('row').filter({ hasText: app.reference });
}

test.describe('applications list', () => {
  for (const { viewport, locale } of matrix()) {
    test(`list ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      const t = tag('shot');
      await applicationIn('under_review', t);
      await applicationIn('docs_missing', t);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openList(page, `?q=${t}`, locale);
      await expect(page.locator('h1')).toBeVisible();
      await expect(
        page
          .getByText(/SA-\d{4}-\d{5}/)
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await checkScreen(page, testInfo, 'admin-applications', viewport, locale);
    });
  }

  test('status tabs carry counts and filter through the URL', async ({ page }) => {
    const t = tag('tabs');
    const review = await applicationIn('under_review', t);
    const fresh = await applicationIn('new', t);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openList(page, `?q=${t}`);
    await expect(row(page, review)).toBeVisible();
    await expect(row(page, fresh)).toBeVisible();
    const tab = page.getByRole('link', { name: /^Under review \d+$/ });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page).toHaveURL(/status=under_review/);
    await expect(row(page, review)).toBeVisible();
    await expect(row(page, fresh)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Under review/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('search by reference finds exactly that application', async ({ page }) => {
    const app = await applicationIn('new', tag('search'));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openList(page, '');
    await page.getByRole('searchbox').fill(app.reference);
    await page.getByRole('searchbox').press('Enter');
    await expect(page).toHaveURL(new RegExp(`q=${app.reference}`));
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(row(page, app)).toBeVisible();
  });

  test('bulk status change reports partial failures per row (transition map)', async ({ page }) => {
    const t = tag('bulk');
    const fresh = await applicationIn('new', t);
    const decided = await applicationIn('accepted', t);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openList(page, `?q=${t}`);
    for (const app of [fresh, decided]) {
      await row(page, app).getByRole('checkbox').check();
    }
    const bar = page.getByTestId('bulk-bar');
    await expect(bar).toContainText('2 selected');
    await bar.getByRole('button', { name: 'Change status' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').selectOption('under_review');
    const res = page.waitForResponse((r) => r.url().includes('/admin/applications/bulk'));
    await dialog.getByRole('button', { name: 'Change', exact: true }).click();
    expect((await res).ok()).toBe(true);
    const failures = page.getByTestId('bulk-failures');
    await expect(failures).toContainText('1 succeeded, 1 failed');
    await expect(failures).toContainText(decided.reference);
    await expect(row(page, fresh)).toContainText('Under review');
    await expect(row(page, decided)).toContainText('Accepted');
  });

  test('bulk assign sets the reviewer on every selected application', async ({ page }) => {
    const t = tag('assign');
    const a = await applicationIn('new', t);
    const b = await applicationIn('under_review', t);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openList(page, `?q=${t}`);
    await row(page, a).getByRole('checkbox').check();
    await row(page, b).getByRole('checkbox').check();
    await page.getByTestId('bulk-bar').getByRole('button', { name: 'Assign reviewer' }).click();
    const dialog = page.getByRole('dialog');
    const choice = await dialog.getByRole('combobox').locator('option').first().textContent();
    await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Applied to 2 applications' }),
    ).toBeVisible();
    const name = (choice ?? '').split(' · ')[0].trim();
    await expect(row(page, a)).toContainText(name);
    await expect(row(page, b)).toContainText(name);
  });

  test('CSV export downloads the filtered list', async ({ page }) => {
    const t = tag('csv');
    const app = await applicationIn('under_review', t);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openList(page, `?q=${t}`);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('applications.csv');
    const csv = readFileSync((await file.path())!, 'utf8');
    expect(csv).toContain(app.reference);
  });

  test('below md: cards with a selection mode for bulk actions', async ({ page }) => {
    const t = tag('mobile');
    const app = await applicationIn('new', t);
    await page.setViewportSize({ width: 390, height: 844 });
    await openList(page, `?q=${t}`);
    const cards = page.getByRole('list', { name: 'Scholarship applications' });
    await expect(cards.getByRole('link', { name: app.reference, exact: true })).toBeVisible();
    await expect(cards.getByRole('checkbox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Select' }).click();
    await cards.getByRole('checkbox').first().check();
    await expect(page.getByTestId('bulk-bar')).toBeVisible();
  });
});

test.describe('application review', () => {
  for (const { viewport, locale } of matrix()) {
    test(`review ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      const app = await applicationIn('under_review', tag('rshot'));
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reviewer = await staffAccount('reviewer', { fresh: true });
      await signInAs(page, reviewer, `/admin/applications/${app.id}`, locale);
      await expect(page.getByTestId('review-documents')).toBeVisible();
      if (viewport.width < 1024) await expect(page.getByTestId('decision-footer')).toBeVisible();
      await checkScreen(page, testInfo, 'admin-review', viewport, locale);
    });
  }

  test('documents: accept, and reject with a required reason; files open only with a downloadPath', async ({
    page,
  }) => {
    const app = await applicationIn('under_review', tag('docs'));
    await page.setViewportSize({ width: 1440, height: 900 });
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await signInAs(page, reviewer, `/admin/applications/${app.id}`);
    const docs = page.getByTestId('review-documents');
    const cert = docs.locator('[data-doc-type="certificate"]');
    const idCopy = docs.locator('[data-doc-type="id_copy"]');

    // Every current document has a file link to the admin file route.
    await expect(docs.getByTestId('doc-view').first()).toHaveAttribute(
      'href',
      new RegExp(`/api/v1/admin/applications/${app.id}/documents/[^/]+/file$`),
    );
    const href = (await idCopy.getByTestId('doc-view').getAttribute('href'))!;
    expect((await page.request.get(href)).status()).toBe(200);

    if (!/Accepted/.test((await cert.textContent()) ?? '')) {
      await cert.getByRole('button', { name: /^Accept/ }).click();
      await expect(cert).toContainText('Accepted');
    }
    await idCopy.getByRole('button', { name: /^Reject/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Reject document' }).click();
    await expect(dialog.getByText('This field is required.')).toBeVisible();
    await dialog.getByRole('textbox').fill('[The ID copy is not readable]');
    await dialog.getByRole('button', { name: 'Reject document' }).click();
    await expect(dialog).toBeHidden();
    await expect(idCopy).toContainText('Rejected');
    await expect(idCopy).toContainText('[The ID copy is not readable]');
    await expect(page.getByTestId('review-log')).toContainText('Document rejected: ID copy');
  });

  test('status transitions come from the shared map; accepting asks first', async ({ page }) => {
    const app = await applicationIn('under_review', tag('accept'));
    await page.setViewportSize({ width: 1440, height: 900 });
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await signInAs(page, reviewer, `/admin/applications/${app.id}`);
    const head = page.locator('app-admin-page-head');
    // under_review → docs_missing | interview | accepted | rejected (+ request documents)
    await expect(head.locator('[data-to]')).toHaveCount(4);
    await head.getByRole('button', { name: 'Accept application' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('The student will be notified');
    await confirm.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByTestId('review-status')).toHaveText('Accepted');
    await expect(head.locator('[data-to]')).toHaveCount(0);
    await expect(page.getByText('This status is final and cannot change.')).toBeVisible();
    await expect(page.getByTestId('review-log')).toContainText('Status changed to “Accepted”');
  });

  test('a status that changed meanwhile (409) reloads the current state', async ({ page }) => {
    const app = await applicationIn('under_review', tag('race'));
    await page.setViewportSize({ width: 1440, height: 900 });
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await signInAs(page, reviewer, `/admin/applications/${app.id}`);
    // Someone else moves it to interview first.
    const admin = await setupAdmin();
    await admin.patch(`admin/applications/${app.id}`, { status: 'interview' });
    await page
      .locator('app-admin-page-head')
      .getByRole('button', { name: 'Move to: Documents missing' })
      .click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'The status changed before' }),
    ).toBeVisible();
    await expect(page.getByTestId('review-status')).toHaveText('Interview');
  });

  test('request documents, internal note, reviewer assignment', async ({ page }) => {
    const app = await applicationIn('new', tag('req'));
    await page.setViewportSize({ width: 1440, height: 900 });
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await signInAs(page, reviewer, `/admin/applications/${app.id}`);

    await page.getByLabel('New note').fill('[Checked the certificate]');
    await page.getByRole('button', { name: 'Add note' }).click();
    await expect(page.getByTestId('review-notes')).toContainText('[Checked the certificate]');

    const select = page.getByRole('combobox', { name: 'Assigned reviewer' });
    const value = await select.locator('option').nth(1).getAttribute('value');
    await select.selectOption(value!);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reviewer updated.' })).toBeVisible();

    await page
      .locator('app-admin-page-head')
      .getByRole('button', { name: 'Request documents' })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Send request' }).click();
    await expect(dialog.getByText('Choose at least one document.')).toBeVisible();
    await dialog.getByLabel('Admission letter').check();
    await dialog.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByTestId('review-status')).toHaveText('Documents missing');
    await expect(page.getByTestId('review-log')).toContainText(
      'Documents requested: Admission letter',
    );
  });

  test('support staff cannot open an application (area applications)', async ({ page }) => {
    const app = await applicationIn('new', tag('deny'));
    const support = await staffAccount('support', { fresh: true });
    await signInAs(page, support, `/admin/applications/${app.id}`);
    await expect(page).toHaveURL(/\/en\/admin\/forbidden$/);
  });
});
