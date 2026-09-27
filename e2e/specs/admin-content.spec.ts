import { expect, type Locator, type Page, test } from '@playwright/test';
import { signInAs } from '../support/admin';
import { content, tagOf, uniquePdf, uniquePng } from '../support/content';
import { checkScreen, matrix } from '../support/matrix';
import { disposeSetupAdmin, staffAccount } from '../support/real-api';
import { useRealDb } from '../support/real-db';

useRealDb(test);
test.afterAll(disposeSetupAdmin);

async function asEditor(page: Page, path: string, locale: 'ar' | 'en' = 'en') {
  const editor = await staffAccount('editor', { fresh: true });
  await signInAs(page, editor, path, locale);
}

/** The innermost list row showing `title` (tags are unique, so a substring match is enough). */
function rowOf(scope: Page | Locator, title: string): Locator {
  return scope.locator('[data-row]').filter({ hasText: title }).last();
}

const dialog = (page: Page) => page.getByRole('dialog');

test.describe('admin content', () => {
  const SCREENS = [
    ['admin-work-areas', '/admin/work-areas'],
    ['admin-board', '/admin/board'],
    ['admin-testimonials', '/admin/testimonials'],
    ['admin-partners', '/admin/partners'],
    ['admin-documents', '/admin/documents'],
    ['admin-stats', '/admin/stats'],
    ['admin-about-items', '/admin/about-items'],
    ['admin-pages', '/admin/pages'],
    ['admin-news', '/admin/news'],
    ['admin-news-new', '/admin/news/new'],
    ['admin-media', '/admin/media'],
  ] as const;

  for (const { viewport, locale } of matrix()) {
    test(`content screens ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
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
      // The page editor (sections of the home page).
      const pages = await content.list<{ id: string; slug: string }>('pages');
      const home = pages.data.find((p) => p.slug === 'home') ?? pages.data[0];
      await page.goto(`/${locale}/admin/pages/${home.id}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('crud-rows')).toBeVisible();
      await checkScreen(page, testInfo, 'admin-page-editor', viewport, locale);
    });
  }

  test('partners: add with the category tab, edit, hide, reorder by keyboard, delete', async ({
    page,
  }) => {
    const a = tagOf('Partner');
    const b = tagOf('Partner');
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin/partners?tab=supporter');
    for (const name of [a, b]) {
      await page.getByRole('button', { name: 'Add partner' }).click();
      const d = dialog(page);
      await expect(d.getByLabel('Category')).toHaveValue('supporter');
      await d.getByLabel('Name (Arabic)').fill(name);
      await d.getByLabel('Link').fill('ftp://bad');
      await d.getByRole('button', { name: 'Save' }).click();
      await expect(d.getByText('must be an http(s), mailto: or tel: URL')).toBeVisible();
      await d.getByLabel('Link').fill('https://example.org');
      await d.getByRole('button', { name: 'Save' }).click();
      await expect(d).toBeHidden();
      await expect(rowOf(page, name)).toBeVisible();
    }

    const rowA = rowOf(page, a);
    await rowA.getByRole('button', { name: /^Edit/ }).click();
    await dialog(page).getByLabel('Name (English)').fill(`${a} en`);
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page)).toBeHidden();

    const toggle = rowA.getByRole('switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // a was added before b: moving a down puts it after b, and the order survives a reload.
    await rowA.getByRole('button', { name: `Move down: ${a}` }).click();
    await expect(page.getByRole('status').filter({ hasText: `moved to position` })).toBeAttached();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const titles = await page.getByTestId('row-title').allTextContents();
    // a now shows its English name (the UI language), so match by prefix.
    const at = (name: string) => titles.findIndex((t) => t.trim().startsWith(name));
    expect(at(b)).toBeGreaterThanOrEqual(0);
    expect(at(b)).toBeLessThan(at(a));
    const list = await content.list<{ nameAr: string; isPublished: boolean }>('partners', {
      category: 'supporter',
    });
    expect(list.data.find((p) => p.nameAr === a)?.isPublished).toBe(false);

    for (const name of [a, b]) {
      await rowOf(page, name)
        .getByRole('button', { name: `Delete: ${name}` })
        .click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(rowOf(page, name)).toHaveCount(0);
    }
  });

  test('work areas: items nest under their area with their own visibility switch', async ({
    page,
  }) => {
    const title = tagOf('Area');
    const area = await content.create<{ id: string }>('work-areas', { titleAr: title });
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await asEditor(page, '/admin/work-areas');
      // Area and item ids can coincide: the first match is the outer (area) row.
      const row = page
        .locator('app-crud-list[data-collection="workAreas"]')
        .locator(`[data-row="${area.id}"]`)
        .first();
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: 'Add item' }).click();
      const item = tagOf('Item');
      await dialog(page).getByLabel('Text (Arabic)').fill(item);
      await dialog(page).getByRole('button', { name: 'Save' }).click();
      const itemRow = rowOf(row, item);
      await expect(itemRow).toBeVisible();
      await itemRow.getByRole('switch').click();
      await expect(itemRow.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
      const items = await content.list<{
        textAr: string;
        isPublished: boolean;
        workAreaId: string;
      }>('work-area-items', {
        workAreaId: area.id,
      });
      expect(items.data).toEqual([expect.objectContaining({ textAr: item, isPublished: false })]);
    } finally {
      await content.remove('work-areas', area.id);
    }
  });

  test('board: groups are tabs; a member is added to the open group', async ({ page }) => {
    const name = tagOf('Member');
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin/board');
    await expect(page.getByRole('link', { name: 'Board of directors' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.getByRole('link', { name: 'Executive management' }).click();
    await expect(page).toHaveURL(/tab=executive/);
    await page.getByRole('button', { name: 'Add member' }).click();
    await dialog(page).getByLabel('Name (Arabic)').fill(name);
    await dialog(page).getByLabel('Position (Arabic)').fill('Director');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(rowOf(page, name)).toBeVisible();
    const rows = await content.list<{ id: string; nameAr: string; grp: string }>('board', {
      grp: 'executive',
    });
    const created = rows.data.find((r) => r.nameAr === name);
    expect(created?.grp).toBe('executive');
    await content.remove('board', created!.id);
  });

  test('testimonials: a new one waits for review; publishing moves it to "published"', async ({
    page,
  }) => {
    const author = tagOf('Author');
    await page.setViewportSize({ width: 1440, height: 900 });
    const support = await staffAccount('support', { fresh: true });
    await signInAs(page, support, '/admin/testimonials?tab=pending');
    const list = page.locator('app-crud-list[data-collection="testimonials"]');
    await list.getByRole('button', { name: 'Add testimonial' }).click();
    await dialog(page).getByLabel('Quote (Arabic)').fill('[نص الشهادة]');
    await dialog(page).getByRole('textbox', { name: 'Author', exact: true }).fill(author);
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    const row = list.locator('[data-row]').filter({ hasText: author });
    await expect(row).toContainText('Pending review');
    await row.getByRole('button', { name: 'Publish' }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole('link', { name: 'Published', exact: true }).click();
    await expect(list.locator('[data-row]').filter({ hasText: author })).toBeVisible();
    const rows = await content.list<{ id: string; authorName: string; status: string }>(
      'testimonials',
    );
    const created = rows.data.find((r) => r.authorName === author);
    expect(created?.status).toBe('published');
    await content.remove('testimonials', created!.id);
  });

  test('documents: slug rule, PDF upload through the picker, category in use cannot be deleted', async ({
    page,
  }) => {
    const slug = `e2e-${Date.now()}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin/documents');
    const cats = page.locator('app-crud-list[data-collection="docCategories"]');
    await cats.getByRole('button', { name: 'Add section' }).click();
    await dialog(page).getByLabel('Slug').fill('Bad Slug');
    await dialog(page).getByLabel('Name (Arabic)').fill(tagOf('Section'));
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page).getByText('Lower-case letters and digits')).toBeVisible();
    await dialog(page).getByLabel('Slug').fill(slug);
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page)).toBeHidden();
    const catRow = cats.locator('[data-row]').filter({ hasText: slug });
    await expect(catRow).toBeVisible();

    const docs = page.locator('app-crud-list[data-collection="documents"]');
    const title = tagOf('Document');
    await docs.getByRole('button', { name: 'Add document' }).click();
    const d = dialog(page).first();
    await d
      .getByLabel('Section')
      .selectOption({ label: await catRow.getByTestId('row-title').innerText() });
    await d.getByLabel('Title (Arabic)').fill(title);
    await d.getByRole('button', { name: /Choose/ }).click();
    const picker = page.getByRole('dialog', { name: 'Choose a file' });
    await picker.locator('input[type=file]').setInputFiles(uniquePdf());
    await expect(picker).toBeHidden();
    await expect(d.getByTestId('media-field-value')).toContainText('.pdf');
    await d.getByRole('button', { name: 'Save' }).click();
    const docRow = docs.locator('[data-row]').filter({ hasText: title });
    await expect(docRow).toBeVisible();

    await catRow.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'linked to other records' }),
    ).toBeVisible();

    await docRow.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(docRow).toHaveCount(0);
    await catRow.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(catRow).toHaveCount(0);
  });

  test('stats: the figure accepts digits only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin/stats');
    await page.getByRole('button', { name: 'Add figure' }).click();
    await dialog(page).getByLabel('Label (Arabic)').fill(tagOf('Figure'));
    await dialog(page).getByLabel('Figure').fill('12a');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page).getByText('The format is not valid.')).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  });

  test('pages: a new page gets sections that are added, edited with Markdown preview, hidden and deleted', async ({
    page,
  }) => {
    const slug = `e2e-${Date.now()}`;
    const p = await content.create<{ id: string }>('pages', { slug, titleAr: tagOf('Page') });
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await asEditor(page, '/admin/pages');
      await rowOf(
        page,
        (await content.list<{ id: string; titleAr: string }>('pages')).data.find(
          (x) => x.id === p.id,
        )!.titleAr,
      )
        .getByRole('link', { name: /^Sections/ })
        .click();
      await expect(page).toHaveURL(new RegExp(`/admin/pages/${p.id}$`));
      await page.getByRole('button', { name: 'Add section' }).click();
      const d = dialog(page);
      await d.getByLabel('Section key').fill('intro');
      await d.getByLabel('Heading (Arabic)').fill('[عنوان القسم]');
      const body = d.locator('app-markdown-editor').first();
      await body.getByRole('textbox').fill('نص');
      await body.getByRole('textbox').selectText();
      await body.getByRole('button', { name: 'Bold' }).click();
      await body.getByRole('button', { name: 'Preview' }).click();
      await expect(body.getByTestId('markdown-preview').locator('strong')).toHaveCount(1);
      await d.getByLabel('Primary button link').fill('javascript:alert(1)');
      await d.getByRole('button', { name: 'Save' }).click();
      await expect(d.getByRole('alert').first()).toBeVisible();
      await d.getByLabel('Primary button link').fill('/apply');
      await d.getByRole('button', { name: 'Save' }).click();
      await expect(d).toBeHidden();
      const row = rowOf(page, '[عنوان القسم]');
      await row.getByRole('switch').click();
      await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
      const sections = await content.list<{
        sectionKey: string;
        bodyAr: string;
        isPublished: boolean;
      }>('page-sections', {
        pageId: p.id,
      });
      expect(sections.data[0]).toMatchObject({
        sectionKey: 'intro',
        isPublished: false,
        bodyAr: '**نص**',
      });
    } finally {
      await content.remove('pages', p.id);
    }
  });

  test('news: create, publish without a cover (COVER_MISSING notice), slug rules, preview link', async ({
    page,
    context,
  }) => {
    const cats = await content.list<{ id: string; nameAr: string }>('news-categories');
    const title = tagOf('Story');
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin/news/new');
    await page.getByLabel('Title (English)').fill(title);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('This field is required.').first()).toBeVisible();
    await page.getByLabel('Title (Arabic)').fill(`[${title}]`);
    await page.getByLabel('Category').selectOption(cats.data[0].id);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/news\/\d+$/);
    await expect(page.getByTestId('news-status')).toHaveText('Draft');
    const slug = title.toLowerCase().replace(/ /g, '-');
    await expect(page.getByLabel('Slug')).toHaveValue(slug);

    await page.getByRole('button', { name: 'Save and publish' }).click();
    await expect(page.getByTestId('news-status')).toHaveText('Published');
    await expect(page.getByTestId('cover-missing')).toBeVisible();

    await page.getByLabel('Slug').fill('preview');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('This word is reserved')).toBeVisible();
    const other = (await content.list<{ slug: string; id: string }>('news')).data.find(
      (n) => n.slug !== slug,
    )!;
    await page.getByLabel('Slug').fill(other.slug);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      page.getByText('That slug is already used by another story.').first(),
    ).toBeVisible();
    await page.getByLabel('Slug').fill(slug);

    const popup = context.waitForEvent('page');
    await page.locator('app-admin-page-head').getByRole('button', { name: 'Preview' }).click();
    const tab = await popup;
    await tab.waitForURL(/\/en\/news\/.+\?preview=/);
    expect(tab.url()).toContain(`/en/news/${slug}?preview=`);
    await tab.close();

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/news$/);
  });

  test('news list: filters in the URL and the legacy "delete all"', async ({ page }) => {
    const cats = await content.list<{ id: string }>('news-categories');
    await content.create('news', {
      titleAr: tagOf('Legacy'),
      categoryId: cats.data[0].id,
      isLegacy: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin/news');
    await page
      .getByRole('navigation', { name: 'Filter news' })
      .getByRole('link', { name: 'Draft' })
      .click();
    await expect(page).toHaveURL(/filter=draft/);
    for (const pill of await page
      .getByTestId('news-rows')
      .locator('.pill')
      .filter({ hasText: /^(Published|Draft)$/ })
      .allTextContents()) {
      expect(pill.trim()).toBe('Draft');
    }
    await page.getByRole('button', { name: 'Delete all' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name: 'Delete all' })).toHaveCount(0);
    expect((await content.list('news', { isLegacy: 1 })).total).toBe(0);
  });

  test('media: an image needs alt text; an asset in use cannot be deleted', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin/media');
    const png = await uniquePng();
    await page.getByTestId('media-upload').setInputFiles(png);
    const alt = page.getByRole('dialog', { name: 'Image alt text' });
    await alt.getByRole('button', { name: 'Save' }).click();
    await expect(alt.getByText('This field is required.')).toBeVisible();
    const altText = tagOf('Alt');
    await alt.getByLabel('Alt text (Arabic)').fill(altText);
    await alt.getByRole('button', { name: 'Save' }).click();
    await expect(alt).toBeHidden();
    const card = page.locator('[data-asset]').filter({ hasText: altText });
    await expect(card).toBeVisible();

    // Use it as a partner logo, then try to delete it.
    const assetId = await card.getAttribute('data-asset');
    const partner = await content.create<{ id: string }>('partners', {
      nameAr: tagOf('Logo'),
      category: 'supporter',
      logoAssetId: assetId,
      isPublished: false,
    });
    await card.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('media-in-use')).toContainText('Partner');
    await content.remove('partners', partner.id);
    await card.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(card).toHaveCount(0);
  });

  test('roles: editors get content but not the inbox; reviewers get no content', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await asEditor(page, '/admin');
    const nav = page.getByTestId('admin-sidebar').getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'News' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Testimonials' })).toHaveCount(0);
    await page.goto('/en/admin/testimonials');
    await expect(page).toHaveURL(/\/admin\/forbidden$/);
    await page.getByRole('button', { name: 'Sign out' }).click();
    const reviewer = await staffAccount('reviewer', { fresh: true });
    await signInAs(page, reviewer, '/admin/pages');
    await expect(page).toHaveURL(/\/admin\/forbidden$/);
  });
});
