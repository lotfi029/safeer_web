import { type APIRequestContext, expect, test } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { mockOnly } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';
import { newsletterToken } from '../support/newsletter-token';
import { disposeSetupAdmin, findSubscriber, postNewsletter } from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);
test.afterAll(disposeSetupAdmin);

interface PostSummary {
  slug: string;
  category: { slug: string; name: string } | null;
}

/** Published posts as the API lists them (mock fixtures or the real dev seed). */
async function publishedPosts(request: APIRequestContext, lang = 'ar'): Promise<PostSummary[]> {
  const res = await request.get(`/api/v1/news?lang=${lang}&limit=50`);
  return ((await res.json()) as { data: PostSummary[] }).data;
}

test.describe('news', () => {
  for (const { viewport, locale } of matrix()) {
    test(`news list ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/news', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'news', viewport, locale);
    });
    test(`article ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      const [post] = await publishedPosts(page.request, locale);
      await openAt(page, `/news/${post.slug}`, viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
      await checkScreen(page, testInfo, 'article', viewport, locale);
    });
  }

  test.describe('SSR', () => {
    test('an unknown category is a 404 page, not a 500 (C42)', async ({ request }) => {
      const res = await request.get('/en/news?category=no-such-category');
      expect(res.status()).toBe(404);
    });

    test('category filter and search live in the URL and render server-side', async ({
      request,
    }) => {
      const posts = await publishedPosts(request);
      const inCategory = posts.find((p) => p.category);
      expect(inCategory, 'at least one published post has a category').toBeTruthy();
      const category = inCategory!.category!;
      const other = posts.find((p) => p.category?.slug !== category.slug);

      const all = await (await request.get('/ar/news')).text();
      expect(all).toContain(`href="/ar/news?category=${category.slug}"`);
      expect(all).toMatch(/<link rel="canonical" href="[^"]*\/ar\/news"/);

      const filtered = await (await request.get(`/ar/news?category=${category.slug}`)).text();
      expect(filtered).toContain(`/ar/news/${inCategory!.slug}`);
      if (other) expect(filtered).not.toContain(`/ar/news/${other.slug}"`);
      expect(filtered).toContain(category.name);

      const search = await (await request.get('/en/news?q=zzzz-no-match')).text();
      expect(search).toContain('No matching news');
      expect(search).toContain('noindex');
    });

    test(
      'pagination: page 2 is linked, has rel=prev and its own canonical',
      mockOnly(
        'needs more published posts than one page; the dev seed has 3 (Phase 8 creates them)',
      ),
      async ({ request }) => {
        const all = await (await request.get('/ar/news')).text();
        expect(all).toMatch(/href="\/ar\/news\?page=2"/);
        const page2 = await (await request.get('/en/news?page=2')).text();
        expect(page2).toMatch(/rel="prev"/);
        expect(page2).toMatch(/<link rel="canonical" href="[^"]*\/en\/news\?page=2"/);
      },
    );

    test('article SSR: SEO, JSON-LD NewsArticle + BreadcrumbList', async ({ request }) => {
      const [post] = await publishedPosts(request, 'en');
      const res = await request.get(`/en/news/${post.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<meta property="og:type" content="article"/);
      expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/en/news/${post.slug}"`));
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
  });

  test.describe(
    'unpublished article + preview',
    mockOnly(
      'needs an unpublished post and a preview token (Phase 8 creates them through the admin API)',
    ),
    () => {
      test('unpublished article: 404 without preview, noindex with ?preview=', async ({
        request,
      }) => {
        expect((await request.get('/ar/news/draft-preview')).status()).toBe(404);
        const res = await request.get('/ar/news/draft-preview?preview=mock-preview');
        expect(res.status()).toBe(200);
        expect(await res.text()).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      });

      test('preview: the cover loads through previewFileQuery (C41)', async ({ page }) => {
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
    },
  );

  test('?preview=junk on a published article: no banner, no noindex, but no-store (W18)', async ({
    page,
    request,
  }) => {
    const [post] = await publishedPosts(request, 'en');
    const path = `/en/news/${post.slug}`;
    const plain = await request.get(path);
    expect(plain.headers()['cache-control']).toBe('no-cache');

    const res = await request.get(`${path}?preview=junk`);
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toBe('no-store');
    const html = await res.text();
    expect(html).not.toContain('Preview — this story is not published yet');
    expect(html).not.toMatch(/<meta name="robots" content="noindex/);

    await page.goto(`${path}?preview=junk`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Preview — this story is not published yet')).toHaveCount(0);
  });

  test('search is debounced and updates the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/news');
    await page.waitForLoadState('networkidle');
    await page.getByRole('searchbox', { name: 'Search the news' }).fill('dates');
    await expect(page).toHaveURL(/\/en\/news\?q=dates$/);
  });

  test('newsletter signup asks to confirm by email and stores a pending subscriber (C27)', async ({
    page,
  }) => {
    const email = `reader-${randomInt(1e8, 1e9)}@example.invalid`;
    // The API drops sign-ups sent less than 3 s after the form rendered: start the page clock 5 s
    // in the past so the form's formRenderedAt is already old enough.
    await page.clock.install({ time: Date.now() - 5000 });
    await page.goto('/en/news');
    await page.waitForLoadState('networkidle');
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    const band = page.locator('app-newsletter-form');
    await expect(band.getByLabel('Email')).toBeVisible();
    await band.getByLabel('Email').fill(email);
    await band.getByRole('button', { name: 'Subscribe' }).click();
    await expect(band.getByRole('status')).toContainText('confirm');
    // `{ ok: true }` alone proves nothing (a dropped sign-up answers the same): read the row.
    await expect.poll(async () => (await findSubscriber(email))?.email).toBe(email);
  });

  test('confirm page confirms in the browser; bad or incomplete links show an error', async ({
    page,
  }) => {
    const email = await postNewsletter(`confirm-${randomInt(1e8, 1e9)}`);
    const token = newsletterToken('confirm', email);
    const res = await page.goto(
      `/en/newsletter/confirm?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
    );
    expect(await res?.text()).toMatch(/noindex/);
    await expect(page.getByRole('main').getByRole('status')).toContainText('confirmed');
    await expect
      .poll(
        async () => (await findSubscriber(email)) as { confirmedAt?: string | null } | undefined,
      )
      .toMatchObject({ confirmedAt: expect.any(String) });

    await page.goto(`/en/newsletter/confirm?email=${encodeURIComponent(email)}&token=bad`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('invalid');
    // C27: the API needs both values from the link; a link without the email never posts.
    await page.goto(`/en/newsletter/confirm?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  });

  test('unsubscribe needs an explicit click', async ({ page }) => {
    const email = await postNewsletter(`leave-${randomInt(1e8, 1e9)}`);
    const token = newsletterToken('unsubscribe', email);
    await page.goto(
      `/ar/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
    );
    await page.waitForLoadState('networkidle');
    const button = page.getByRole('button', { name: 'إلغاء الاشتراك' });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole('main').getByRole('status')).toContainText('تم إلغاء اشتراكك');
    await expect
      .poll(
        async () => (await findSubscriber(email)) as { unsubscribedAt?: string | null } | undefined,
      )
      .toMatchObject({ unsubscribedAt: expect.any(String) });
  });
});
