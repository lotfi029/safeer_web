import { expect, test } from '@playwright/test';
import { MOCK_API_URL, usingMockApi } from '../support/env';
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

  test('the page loads no iframe and makes no third-party request (A12)', async ({ page }) => {
    const thirdParty: string[] = [];
    page.on('request', (r) => {
      if (!/^http:\/\/localhost:/.test(r.url())) thirdParty.push(r.url());
    });
    await page.goto('/en/contact');
    await page.waitForLoadState('networkidle');
    // Holds whatever the settings say: an embed only loads after a click.
    await expect(page.getByTestId('contact-map').locator('iframe')).toHaveCount(0);
    expect(thirdParty).toEqual([]);
  });

  test.describe('map embed (A12)', () => {
    test.describe.configure({ mode: 'serial' });
    test.skip(!usingMockApi, 'sets the map through the mock API');
    // Test-only values (never shipped): the mock's site settings are patched, then restored.
    const EMBED = 'https://www.openstreetmap.org/export/embed.html?bbox=46.6,24.6,46.7,24.7';
    const setSite = (request: import('@playwright/test').APIRequestContext, data: object) =>
      request.post(`${MOCK_API_URL}/__site`, { data });
    test.afterEach(async ({ request }) => {
      await setSite(request, { mapEmbedUrl: null, mapLat: null, mapLng: null });
    });

    test('loads the iframe only on click, from an allowed host, within the CSP', async ({
      page,
      request,
    }) => {
      await setSite(request, { mapEmbedUrl: EMBED, mapLat: 24.65, mapLng: 46.65 });
      await page.route('https://www.openstreetmap.org/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<p>map</p>' }),
      );
      const violations: string[] = [];
      page.on('console', (m) => {
        if (/Content.Security.Policy/i.test(m.text())) violations.push(m.text());
      });
      await page.goto('/en/contact');
      await page.waitForLoadState('networkidle');
      const map = page.getByTestId('contact-map');
      await expect(map.locator('iframe')).toHaveCount(0);
      await expect(map.getByRole('link', { name: 'Open the location in maps' })).toHaveAttribute(
        'href',
        /query=24\.65%2C46\.65$/,
      );
      const frameRequest = page.waitForRequest((r) => r.url().startsWith(EMBED.split('?')[0]));
      await map.getByRole('button', { name: 'Show the interactive map' }).click();
      await expect(map.locator('iframe')).toHaveAttribute('src', EMBED);
      await expect(map.locator('iframe')).toHaveAttribute('title', /Map of the office/);
      await frameRequest;
      expect(violations).toEqual([]);
    });

    test('without a map or pin, "open in maps" searches the address', async ({ page }) => {
      await page.goto('/en/contact');
      const map = page.getByTestId('contact-map');
      await expect(map.getByRole('button', { name: 'Show the interactive map' })).toHaveCount(0);
      await expect(map.getByRole('link', { name: 'Open the location in maps' })).toHaveAttribute(
        'href',
        /google\.com\/maps\/search\/\?api=1&query=Riyadh/,
      );
    });

    test('a host outside the allow-list never becomes an iframe', async ({ page, request }) => {
      await setSite(request, { mapEmbedUrl: 'https://maps.example.com/embed?x=1' });
      await page.goto('/en/contact');
      await page.waitForLoadState('networkidle');
      const map = page.getByTestId('contact-map');
      await expect(map.getByRole('button', { name: 'Show the interactive map' })).toHaveCount(0);
      await expect(map.locator('iframe')).toHaveCount(0);
    });
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
