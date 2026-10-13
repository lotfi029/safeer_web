import { expect, type Page, test } from '@playwright/test';
import { signInAs } from '../support/admin';
import { content, tagOf } from '../support/content';
import { gotoHydrated } from '../support/hydration';
import { checkScreen, matrix, openAt } from '../support/matrix';
import { disposeSetupAdmin, staffAccount } from '../support/real-api';
import { useRealDb } from '../support/real-db';

/**
 * The organisational structure (023): the public page under «من نحن», the «من نحن» dropdown and
 * drawer group, and the dashboard's tree screen. Runs on both backends: the tree is created through
 * the admin API (tagged), so the real API and the mock serve the same shape.
 */
const PATH = '/about/org-structure';
// Fresh names on every beforeAll: fullyParallel can run this file's beforeAll more than once in
// one worker, and a tree an earlier run left behind must never share a name with this one (two
// boxes with one name break every locator below).
let root = '';
let child = '';
let leaf = '';
let member = '';
/** This run's tree (the tests read it). */
const ids = { root: '', child: '' };
/**
 * Everything any beforeAll created and no afterAll has removed yet — kept across runs so a second
 * beforeAll in the same worker never loses track of the first one's rows (cleanup would leak them).
 */
const created: { members: string[]; positions: string[] } = { members: [], positions: [] };

test.beforeAll(async () => {
  root = tagOf('OrgRoot');
  child = tagOf('OrgChild');
  leaf = tagOf('OrgLeaf');
  member = tagOf('OrgMember');
  const r = await content.create('org-positions', { nameAr: root, nameEn: `${root} EN` });
  const c = await content.create('org-positions', { nameAr: child, parentId: r.id });
  const l = await content.create('org-positions', { nameAr: leaf, parentId: r.id });
  ids.root = r.id;
  ids.child = c.id;
  created.positions.push(r.id, c.id, l.id);
  const m = await content.create('board', {
    nameAr: member,
    nameEn: `${member} EN`,
    roleAr: '[المنصب]',
    grp: 'board',
    orgPositionId: c.id,
    isPublished: true,
  });
  created.members.push(m.id);
});

test.afterAll(async () => {
  // Members first (they point at positions), then positions children-first.
  for (const id of created.members.splice(0)) await content.remove('board', id);
  for (const id of created.positions.splice(0).reverse()) await content.remove('org-positions', id);
  await disposeSetupAdmin();
});

// After this file's own afterAll, on purpose: useRealDb's afterAll deletes the seeded admin user,
// and the cleanup above needs that admin's session (hooks run in registration order).
useRealDb(test);

/** The public chart's box for a position (its own label, not a descendant's). */
const box = (page: Page, name: string) =>
  page.locator('app-org-chart .box').filter({ has: page.locator('.box-label', { hasText: name }) });

test.describe('org structure page', () => {
  for (const { viewport, locale } of matrix()) {
    test(`org-structure ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, PATH, viewport, locale);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(box(page, root)).toBeVisible();
      await checkScreen(page, testInfo, 'org-structure', viewport, locale);
    });
  }

  test('is server-rendered with the tree as a labelled nested list', async ({ request }) => {
    const res = await request.get(`/ar${PATH}`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/ar${PATH}"`));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain(root);
    expect(html).toContain(`تحت ${root}`);
  });

  test('shows holders under their position, English names, and mirrors in Arabic', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/en${PATH}`);
    await expect(box(page, `${root} EN`)).toBeVisible();
    await expect(box(page, child).locator('.holders')).toHaveText(`${member} EN`);
    await expect(box(page, leaf).locator('.holders')).toHaveCount(0);

    await gotoHydrated(page, `/ar${PATH}`);
    await expect(box(page, leaf)).toBeVisible();
    const [a, b] = await Promise.all([
      box(page, child).boundingBox(),
      box(page, leaf).boundingBox(),
    ]);
    // RTL: the first child sits to the right of the second — or, when a wide chart stacks sibling
    // leaves in one column (the stacked layout), above it.
    if (a!.x === b!.x) expect(a!.y).toBeLessThan(b!.y);
    else expect(a!.x).toBeGreaterThan(b!.x);
  });

  test('draws the vertical tree on a phone without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoHydrated(page, `/ar${PATH}`);
    await expect(box(page, child)).toBeVisible();
    const [r, c] = await Promise.all([
      box(page, root).boundingBox(),
      box(page, child).boundingBox(),
    ]);
    expect(c!.y).toBeGreaterThan(r!.y + r!.height - 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('«من نحن» menu', () => {
  test('the header dropdown lists the about page, the org structure and the licences', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, '/ar');
    const button = page.locator('app-site-header').getByRole('button', { name: 'من نحن' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    const menu = page.locator('#about-menu');
    await expect(menu.getByRole('link')).toHaveCount(3);
    await expect(menu.getByRole('link', { name: 'عن الجمعية' })).toBeVisible();
    // As on ta3lom: the licences page is also under «من نحن» (same URL as under «الحوكمة»).
    await expect(menu.getByRole('link', { name: 'التراخيص' })).toHaveAttribute(
      'href',
      '/ar/governance/licences',
    );
    await menu.getByRole('link', { name: 'الهيكل التنظيمي' }).click();
    await expect(page).toHaveURL(/\/ar\/about\/org-structure$/);
    await expect(menu).toBeHidden();
    await expect(button).toHaveClass(/border-secondary/);
    await button.click();
    // Only the org-structure link is current, not the about page (exact match).
    await expect(menu.locator('[aria-current="page"]')).toHaveText('الهيكل التنظيمي');
  });

  test('the drawer has a collapsible «من نحن» group', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHydrated(page, '/en');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog');
    const group = dialog.getByRole('button', { name: 'About' });
    await expect(group).toHaveAttribute('aria-expanded', 'false');
    await group.click();
    await dialog.getByRole('link', { name: 'Organisational structure' }).click();
    await expect(page).toHaveURL(/\/en\/about\/org-structure$/);
  });

  test('the footer links the org structure', async ({ page }) => {
    await gotoHydrated(page, '/ar');
    await expect(
      page.locator('app-site-footer').getByRole('link', { name: 'الهيكل التنظيمي' }),
    ).toHaveAttribute('href', `/ar${PATH}`);
  });
});

test.describe('dashboard «الهيكل التنظيمي»', () => {
  test('builds the tree, keeps «يرفع إلى» acyclic, previews it and refuses deleting a used position', async ({
    page,
  }) => {
    const editor = await staffAccount('editor', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, editor, '/admin/org-chart', 'en');
    const dialog = page.getByRole('dialog');
    const rows = page.getByTestId('org-rows');
    const rowOf = (name: string) => rows.locator('[data-row]').filter({ hasText: name });

    // A child under the seeded root, from the row's «Add below».
    const added = tagOf('OrgAdded');
    await rowOf(root)
      .getByRole('button', { name: /^Add a position under/ })
      .click();
    await expect(dialog.getByLabel('Reports to')).toHaveValue(ids.root);
    await dialog.getByLabel('Name (Arabic)').fill(added);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(rowOf(added)).toBeVisible();
    await expect(page.locator('app-org-chart .box-label', { hasText: added })).toBeVisible();

    // «Reports to» never offers the position itself or anything under it.
    await rowOf(root)
      .getByRole('button', { name: /^Edit: / })
      .click();
    const options = await dialog.getByLabel('Reports to').locator('option').allTextContents();
    expect(options.some((o) => o.includes(root))).toBe(false);
    expect(options.some((o) => o.includes(child))).toBe(false);
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Deleting a position members or sub-positions point at is refused, with the list.
    await rowOf(child)
      .getByRole('button', { name: `Delete: ${child}` })
      .click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    const inUse = page.getByTestId('org-in-use');
    await expect(inUse).toBeVisible();
    await expect(inUse).toContainText(member);

    // The added leaf can be deleted.
    await rowOf(added)
      .getByRole('button', { name: `Delete: ${added}` })
      .click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(rowOf(added)).toHaveCount(0);
  });

  test('the board form links a member to a position', async ({ page }) => {
    const editor = await staffAccount('editor', { fresh: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, editor, '/admin/board', 'en');
    const row = page.locator('[data-row]').filter({ hasText: member }).last();
    await row.getByRole('button', { name: /Edit/ }).click();
    const select = page.getByRole('dialog').getByLabel('Position in the org structure');
    await expect(select).toHaveValue(ids.child);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  });
});
