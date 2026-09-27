import { expect, test } from '@playwright/test';
import { usingMockApi } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';

test.describe('news', () => {
  for (const { viewport, locale } of matrix()) {
    test(`news list ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/news', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'news', viewport, locale);
    });
    test(`article ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/news/dates-distribution-2020', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'article', viewport, locale);
    });
  }

  test.describe('SSR (mock content)', () => {
    test.skip(!usingMockApi, 'asserts mock fixtures');

    test('an unknown category is a 404 page, not a 500 (C42)', async ({ request }) => {
      const res = await request.get('/en/news?category=no-such-category');
      expect(res.status()).toBe(404);
    });

    test('category filter, search and pagination live in the URL and render server-side', async ({
      request,
    }) => {
      const all = await (await request.get('/ar/news')).text();
      expect(all).toContain('href="/ar/news?category=community-activities"');
      expect(all).toMatch(/href="\/ar\/news\?page=2"/);
      expect(all).toMatch(/<link rel="canonical" href="[^"]*\/ar\/news"/);

      const filtered = await (await request.get('/ar/news?category=community-activities')).text();
      expect(filtered).toContain('/ar/news/dates-distribution-2020');
      expect(filtered).not.toContain('/ar/news/placeholder-1');
      expect(filtered).toMatch(/aria-current="page"[^>]*>أنشطة مجتمعية|أنشطة مجتمعية<\/a>/);

      const page2 = await (await request.get('/en/news?page=2')).text();
      expect(page2).toMatch(/rel="prev"/);
      expect(page2).toMatch(/<link rel="canonical" href="[^"]*\/en\/news\?page=2"/);

      const search = await (await request.get('/en/news?q=zzzz-no-match')).text();
      expect(search).toContain('No matching news');
      expect(search).toContain('noindex');
    });

    test('article SSR: SEO, JSON-LD NewsArticle + BreadcrumbList', async ({ request }) => {
      const res = await request.get('/en/news/dates-distribution-2020');
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<meta property="og:type" content="article"/);
      expect(html).toMatch(/<link rel="canonical" href="[^"]*\/en\/news\/dates-distribution-2020"/);
      const ld = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(
        html,
      )?.[1];
      const items = JSON.parse(ld ?? '[]') as { '@type': string }[];
      expect(items.map((i) => i['@type'])).toEqual(['NewsArticle', 'BreadcrumbList']);
    });

    test('missing article → 404 page', async ({ request }) => {
      const res = await request.get('/ar/news/no-such-story');
      expect(res.status()).toBe(404);
    });

    test('unpublished article: 404 without preview, noindex with ?preview=', async ({
      request,
    }) => {
      expect((await request.get('/ar/news/draft-preview')).status()).toBe(404);
      const res = await request.get('/ar/news/draft-preview?preview=mock-preview');
      expect(res.status()).toBe(200);
      expect(await res.text()).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    });

    test('preview: the cover loads through previewFileQuery (C41)', async ({ page }) => {
      test.skip(!usingMockApi, 'needs the mock preview token');
      await page.goto('/en/news/draft-preview?preview=mock-preview');
      const cover = page.locator('article img, main img[src*="/files/"]').first();
      await expect(cover).toHaveAttribute('src', /\/files\/[^?]+\?preview=mock-preview&post=/);
    });

    test('article body HTML is sanitized again on the client', async ({ page }) => {
      await page.goto('/en/news/draft-preview?preview=mock-preview');
      await expect(page.locator('app-rich-text')).toBeVisible();
      expect(await page.locator('app-rich-text script').count()).toBe(0);
      expect(await page.locator('app-rich-text [onerror]').count()).toBe(0);
      expect(
        await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
      ).toBeUndefined();
    });
  });

  test('search is debounced and updates the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/news');
    await page.waitForLoadState('networkidle');
    await page.getByRole('searchbox', { name: 'Search the news' }).fill('dates');
    await expect(page).toHaveURL(/\/en\/news\?q=dates$/);
  });

  test('newsletter signup asks to confirm by email (C27)', async ({ page }) => {
    test.skip(!usingMockApi, 'real API drops submits under 3s; covered by the mock');
    await page.goto('/en/news');
    await page.waitForLoadState('networkidle');
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    const band = page.locator('app-newsletter-form');
    await expect(band.getByLabel('Email')).toBeVisible();
    await band.getByLabel('Email').fill('reader@example.invalid');
    await band.getByRole('button', { name: 'Subscribe' }).click();
    await expect(band.getByRole('status')).toContainText('confirm');
  });

  test('confirm page confirms in the browser; bad token shows an error', async ({ page }) => {
    test.skip(!usingMockApi, 'needs the mock token');
    const res = await page.goto(
      '/en/newsletter/confirm?email=reader%40example.com&token=mock-token',
    );
    expect(await res?.text()).toMatch(/noindex/);
    await expect(page.getByRole('main').getByRole('status')).toContainText('confirmed');
    await page.goto('/en/newsletter/confirm?email=reader%40example.com&token=bad');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('invalid');
    // C27: the API needs both values from the link; a link without the email never posts.
    await page.goto('/en/newsletter/confirm?token=mock-token');
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  });

  test('unsubscribe needs an explicit click', async ({ page }) => {
    test.skip(!usingMockApi, 'needs the mock token');
    await page.goto('/ar/newsletter/unsubscribe?email=reader%40example.com&token=mock-token');
    await page.waitForLoadState('networkidle');
    const button = page.getByRole('button', { name: 'إلغاء الاشتراك' });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole('main').getByRole('status')).toContainText('تم إلغاء اشتراكك');
  });
});
