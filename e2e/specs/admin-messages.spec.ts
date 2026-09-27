import { expect, test } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { signInAs } from '../support/admin';
import { checkScreen, matrix } from '../support/matrix';
import { disposeSetupAdmin, findMessage, postContact, staffAccount } from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);
test.afterAll(disposeSetupAdmin);

const tag = (name: string) => `msg-${name}-${randomInt(1e6, 1e7)}`;

test.describe('messages', () => {
  for (const { viewport, locale } of matrix()) {
    test(`messages ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      const m = await postContact(tag('shot'));
      const support = await staffAccount('support', { fresh: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await signInAs(page, support, '/admin/messages', locale);
      await expect(page.getByTestId('message-list')).toBeVisible();
      await checkScreen(page, testInfo, 'admin-messages', viewport, locale);
      await page
        .getByTestId('message-list')
        .getByRole('link', { name: new RegExp(m.name) })
        .click();
      await expect(page.getByTestId('message-detail')).toContainText(m.body);
      if (viewport.width < 1024) await expect(page.getByTestId('message-list')).toBeHidden();
      await checkScreen(page, testInfo, 'admin-message', viewport, locale);
    });
  }

  test('opening marks it read; reply is kept on the message', async ({ page }) => {
    const m = await postContact(tag('reply'));
    expect((await findMessage(m.name))?.status).toBe('unread');
    const support = await staffAccount('support', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, support, `/admin/messages/${m.id}`);
    const detail = page.getByTestId('message-detail');
    await expect(detail).toContainText(m.body);
    await expect.poll(async () => (await findMessage(m.name))?.status).toBe('read');

    await page.getByLabel('Reply').fill('[Thank you for your message]');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByTestId('message-replies')).toContainText('[Thank you for your message]');
    await page.reload();
    await expect(page.getByTestId('message-replies')).toContainText('[Thank you for your message]');
  });

  test('archive moves it to the archived filter; mark unread brings the dot back', async ({
    page,
  }) => {
    const m = await postContact(tag('archive'));
    const support = await staffAccount('support', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, support, `/admin/messages/${m.id}`);
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByTestId('message-detail')).toContainText('Archived');
    await expect.poll(async () => (await findMessage(m.name))?.status).toBe('archived');
    await page.getByRole('link', { name: 'Archived', exact: true }).click();
    await expect(page).toHaveURL(/status=archived/);
    await page
      .getByTestId('message-list')
      .getByRole('link', { name: new RegExp(m.name) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/messages/${m.id}\\?status=archived$`));

    await page.getByRole('button', { name: 'Move back to inbox' }).click();
    await expect(page.getByTestId('message-detail')).toContainText('Read');
    await page.getByRole('button', { name: 'Mark as unread' }).click();
    await expect.poll(async () => (await findMessage(m.name))?.status).toBe('unread');
  });

  test('convert to testimonial saves a pending testimonial', async ({ page }) => {
    const m = await postContact(tag('convert'), 'feedback');
    const support = await staffAccount('support', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, support, `/admin/messages/${m.id}`);
    await page.getByRole('button', { name: 'Convert to testimonial' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Quote in Arabic')).toHaveValue(m.body);
    await expect(dialog.getByLabel('Author name')).toHaveValue(m.name);
    const res = page.waitForResponse((r) => r.url().includes('/convert-to-testimonial'));
    await dialog.getByRole('button', { name: 'Save testimonial' }).click();
    const created = await (await res).json();
    expect(created).toMatchObject({ status: 'pending', sourceMessageId: m.id, authorName: m.name });
    await expect(
      page.getByRole('status').filter({ hasText: 'Testimonial saved for review.' }),
    ).toBeVisible();
  });

  test('only admins can delete (inbox.delete)', async ({ page }) => {
    const m = await postContact(tag('delete'));
    const support = await staffAccount('support', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, support, `/admin/messages/${m.id}`);
    await expect(page.getByTestId('message-detail')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete message' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Sign out' }).click();
    const admin = await staffAccount('admin', { fresh: true });
    await signInAs(page, admin, `/admin/messages/${m.id}`);
    await page.getByRole('button', { name: 'Delete message' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/messages$/);
    expect(await findMessage(m.name)).toBeUndefined();
  });

  test('reviewers have no inbox', async ({ page }) => {
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await signInAs(page, reviewer, '/admin/messages');
    await expect(page).toHaveURL(/\/en\/admin\/forbidden$/);
  });
});
