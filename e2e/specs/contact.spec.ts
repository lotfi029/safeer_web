import { expect, test } from '@playwright/test';
import { usingMockApi } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';

test.describe('contact page', () => {
  for (const { viewport, locale } of matrix()) {
    test(`contact ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/contact', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('form')).toBeVisible();
      await checkScreen(page, testInfo, 'contact', viewport, locale);
    });
  }

  test('SSR HTML carries SEO tags and the form without JS', async ({ request }) => {
    const res = await request.get('/en/contact');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<link rel="canonical" href="[^"]*\/en\/contact"/);
    expect(html).toMatch(/hreflang="ar"/);
    expect(html).toContain('<form');
    expect(html).toContain('id="contact-website"');
  });

  test('client validation blocks an empty submit and links errors to fields', async ({ page }) => {
    await page.goto('/en/contact');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Send' }).click();
    const name = page.getByRole('textbox', { name: 'Name' });
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('your message has arrived')).toHaveCount(0);
  });

  test('the honeypot is hidden from people and assistive tech', async ({ page }) => {
    await page.goto('/ar/contact');
    const hp = page.locator('#contact-website');
    await expect(hp).toHaveAttribute('tabindex', '-1');
    expect(await hp.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
  });

  test('?subject=partnership preselects the subject', async ({ page }) => {
    await page.goto('/en/contact?subject=partnership');
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Subject')).toHaveValue('partnership');
  });

  test('a valid message is sent with formRenderedAt and an empty honeypot', async ({ page }) => {
    test.skip(!usingMockApi, 'real API drops submits under 3s; covered by the mock');
    await page.goto('/en/contact');
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: 'Name' }).fill('Test Person');
    await page.getByLabel('Email').fill('person@example.invalid');
    await page.getByRole('textbox', { name: 'Message' }).fill('[...]');
    const [req] = await Promise.all([
      page.waitForRequest((r) => /\/api\/v1\/contact(\?|$)/.test(r.url()) && r.method() === 'POST'),
      page.getByRole('button', { name: 'Send' }).click(),
    ]);
    const body = req.postDataJSON();
    expect(body).toMatchObject({ name: 'Test Person', subject: 'scholarship', website: '' });
    expect(typeof body.formRenderedAt).toBe('number');
    await expect(page.getByText('your message has arrived')).toBeVisible();
  });

  test('server field errors from problem+json land on the field', async ({ page }) => {
    await page.route(/\/api\/v1\/contact(\?|$)/, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          code: 'VALIDATION_FAILED',
          issues: [{ path: ['email'], message: 'Invalid email', code: 'invalid_string' }],
        }),
      }),
    );
    await page.goto('/en/contact');
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: 'Name' }).fill('Test Person');
    await page.getByLabel('Email').fill('person@example.invalid');
    await page.getByRole('textbox', { name: 'Message' }).fill('[...]');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('form p.note[role=alert]')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});
