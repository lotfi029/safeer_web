import { expect, test } from '@playwright/test';
import { cleanupContent, ensurePublishedTestimonial } from '../support/content';
import { usingMockApi } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';
import { disposeSetupAdmin } from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);
test.afterAll(async () => {
  await cleanupContent();
  await disposeSetupAdmin();
});

const PAGES = ['testimonials', 'partners', 'documents'] as const;

test.describe('public pages: testimonials, partners, documents', () => {
  for (const name of PAGES) {
    for (const { viewport, locale } of matrix()) {
      test(`${name} ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
        await openAt(page, `/${name}`, viewport, locale);
        await expect(page.locator('h1')).toHaveCount(1);
        await checkScreen(page, testInfo, name, viewport, locale);
      });
    }

    test(`${name} is server-rendered (title, canonical, hreflang, h1)`, async ({ request }) => {
      const res = await request.get(`/ar/${name}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/ar/${name}"`));
      expect(html).toMatch(/hreflang="ar"/);
      expect(html).toMatch(/hreflang="en"/);
      expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
    });
  }

  test('testimonials: SSR renders quotes as blockquote/figure', async ({ request }) => {
    // Real API: the dev seed publishes no quote, so publish one through the admin API.
    await ensurePublishedTestimonial();
    const html = await (await request.get('/ar/testimonials')).text();
    expect(html).toContain('<blockquote');
    expect(html).toContain('<figcaption');
  });

  test('testimonials: the improvement pill marks exactly the flagged themes', async ({
    page,
    request,
  }) => {
    const api = await (
      await request.get('/api/v1/testimonials?lang=ar', { headers: { 'Accept-Language': 'ar' } })
    ).json();
    const flagged = (api.themes as { isImprovement: boolean }[]).filter((t) => t.isImprovement);
    await openAt(page, '/testimonials', { name: '1440', width: 1440, height: 900 }, 'ar');
    const themes = page.locator('section[aria-labelledby="testimonials-themes"] li');
    const pills = themes.locator('app-pill', { hasText: 'فرصة تحسين' });
    await expect(pills).toHaveCount(flagged.length);
    await expect(themes.filter({ has: page.locator('app-pill') })).toHaveCount(flagged.length);
    await expect(page.locator('li[data-improvement="true"] app-pill')).toHaveCount(flagged.length);
    if (usingMockApi) {
      expect(flagged.length).toBe(2);
    }
    const share = page.getByRole('link', { name: 'أرسل رأيك' });
    await expect(share).toHaveAttribute('href', '/ar/contact?subject=feedback');
  });

  test('partners: ?category=university shows only universities, chip is current', async ({
    page,
    request,
  }) => {
    const html = await (await request.get('/en/partners?category=university')).text();
    const chipTag = html.match(
      /<a class="chip"[^>]*href="\/en\/partners\?category=university"[^>]*>/,
    );
    expect(chipTag?.[0]).toContain('aria-current="page"');

    await openAt(
      page,
      '/partners?category=university',
      { name: '1440', width: 1440, height: 900 },
      'en',
    );
    const cards = page.locator('[data-testid="partners-grid"] > li');
    await expect(cards.first()).toBeVisible();
    const categories = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-category')),
    );
    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories)).toEqual(new Set(['university']));
    const chip = page.getByRole('link', { name: 'Universities', exact: true });
    await expect(chip).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'All', exact: true })).not.toHaveAttribute(
      'aria-current',
      'page',
    );

    // Client-side filter change through the chip links.
    await page.getByRole('link', { name: 'Government', exact: true }).click();
    await expect(page).toHaveURL(/category=government/);
    await expect(page.getByRole('link', { name: 'Government', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const after = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-category')),
    );
    expect(new Set(after)).toEqual(new Set(['government']));

    await expect(page.getByRole('link', { name: 'Contact us' }).last()).toHaveAttribute(
      'href',
      '/en/contact?subject=partnership',
    );
  });

  test('documents: download links point to /files/:publicId and carry download', async ({
    page,
  }) => {
    await openAt(page, '/documents', { name: '1440', width: 1440, height: 900 }, 'ar');
    const links = page.locator('a[download]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      // The asset's publicId (a UUID from the API, `doc-…` in the mock fixtures).
      await expect(links.nth(i)).toHaveAttribute('href', /^\/files\/[\w-]+$/);
      // Accessible name includes the document title, not just "تحميل".
      const name = (await links.nth(i).textContent())?.replace(/\s+/g, ' ').trim() ?? '';
      expect(name.length).toBeGreaterThan('تحميل'.length + 1);
    }
  });

  test('documents: ?category= deep link scrolls to and highlights the section', async ({
    page,
  }) => {
    await openAt(
      page,
      '/documents?category=meeting-minutes',
      { name: '1440', width: 1440, height: 900 },
      'en',
    );
    const section = page.locator('section#meeting-minutes');
    await expect(section).toHaveAttribute('data-active', 'true');
    await expect(section).toBeInViewport();
    await expect(
      page.locator('nav[aria-labelledby="documents-nav"] a[aria-current="true"]'),
    ).toHaveText('Meeting minutes');
  });
});
