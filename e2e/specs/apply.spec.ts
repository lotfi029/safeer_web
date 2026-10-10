import { expect, type Page, test } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { gotoHydrated, waitForHydration } from '../support/hydration';
import { checkScreen, matrix, openAt } from '../support/matrix';

const PDF = {
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%mock\n'),
};

interface Applicant {
  email: string;
  phone: string;
}

/**
 * A fresh email and phone: the API refuses a second active application for either (409
 * APPLICATION_EXISTS), so every run against the real API needs unused ones.
 */
function newApplicant(tag: string): Applicant {
  const n = String(randomInt(0, 1e8)).padStart(8, '0');
  return { email: `${tag}-${n}@example.invalid`, phone: `+9665${n}` };
}

async function fillStep1(page: Page, applicant: Applicant): Promise<void> {
  await page.getByRole('textbox', { name: 'First', exact: true }).fill('Sara');
  await page.getByRole('textbox', { name: 'Last', exact: true }).fill('Ali');
  await page.getByRole('textbox', { name: 'Date of birth' }).fill('2001-05-06');
  await page.getByRole('textbox', { name: 'Phone' }).fill(applicant.phone);
  const nationality = page.getByLabel('Nationality');
  if ((await nationality.evaluate((el) => el.tagName)) === 'SELECT') {
    await nationality.selectOption('SA');
  } else {
    await nationality.fill('SA');
  }
  await page.getByRole('textbox', { name: 'Email' }).fill(applicant.email);
  await page.getByRole('radio', { name: 'Female' }).check();
}

async function fillStep2(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'University' }).fill('[University]');
  await page.getByRole('textbox', { name: 'Major' }).fill('[Major]');
  await page.getByRole('radio', { name: 'Master' }).check();
}

test.describe('apply flow', () => {
  for (const { viewport, locale } of matrix()) {
    test(`apply ${locale} @${viewport.name}`, async ({ page }, testInfo) => {
      await openAt(page, '/apply', viewport, locale);
      await expect(page.locator('h1')).toBeVisible();
      await checkScreen(page, testInfo, 'apply', viewport, locale);
    });
  }

  test('SSR renders the form shell', async ({ request }) => {
    const res = await request.get('/ar/apply');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form');
    expect(html).toContain('لتسجيل طلب منحة');
  });

  test('step 1 validation blocks Next and focuses the first invalid field', async ({ page }) => {
    await gotoHydrated(page, '/en/apply');
    await page.getByRole('button', { name: 'Next — academic details' }).click();
    await expect(page.getByRole('textbox', { name: 'First', exact: true })).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  test.describe('applying (creates applications; runs against the real API too)', () => {
    test('happy path: create → autosave → uploads → submit → reference', async ({ page }) => {
      await gotoHydrated(page, '/en/apply');
      await fillStep1(page, newApplicant('apply'));
      const created = page.waitForResponse(
        (r) => /\/api\/v1\/applications(\?|$)/.test(r.url()) && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      expect((await created).status()).toBe(201);
      await expect(page.getByRole('heading', { name: /Step 2/ })).toBeVisible();

      // Autosave (1.5s debounce) with the F4 payload: only changed fields, no "" and no nulls for required.
      const patch = page.waitForRequest(
        (r) => /\/portal\/application(\?|$)/.test(r.url()) && r.method() === 'PATCH',
      );
      await fillStep2(page);
      const body = (await patch).postDataJSON() as Record<string, unknown>;
      expect(Object.values(body)).not.toContain('');
      await expect(page.getByTestId('autosave')).toContainText('Saved');

      await page.getByRole('button', { name: 'Next — documents and consent' }).click();
      await expect(page.getByRole('heading', { name: /Step 3/ })).toBeVisible();

      // Submit without documents → DOCUMENTS_INCOMPLETE highlights the missing types.
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Submit application' }).click();
      await expect(
        page.getByRole('alert').filter({ hasText: 'required before submitting' }),
      ).toBeVisible();

      for (const type of ['id_copy', 'certificate', 'admission_letter']) {
        await page.locator(`[data-doc-type="${type}"] input[type=file]`).setInputFiles(PDF);
        await expect(page.locator(`[data-doc-type="${type}"] li`)).toHaveCount(1);
      }
      await page.getByRole('button', { name: 'Submit application' }).click();
      await expect(
        page.getByRole('heading', { name: 'Your application has been submitted' }),
      ).toBeVisible();
      await expect(page.getByTestId('reference')).toHaveText(/^SA-\d{4}-\d{5}$/);
    });

    test('a second upload of a type replaces the first, with no client-side delete (W4)', async ({
      page,
    }) => {
      await gotoHydrated(page, '/en/apply');
      await fillStep1(page, newApplicant('replace'));
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await fillStep2(page);
      await page.getByRole('button', { name: 'Next — documents and consent' }).click();
      const deletes: string[] = [];
      page.on('request', (r) => r.method() === 'DELETE' && deletes.push(r.url()));
      const slot = page.locator('[data-doc-type="certificate"]');
      await expect(slot.locator('input[type=file]')).not.toHaveAttribute('multiple');
      for (const name of ['first.pdf', 'second.pdf']) {
        const uploaded = page.waitForResponse(
          (r) => /\/portal\/documents(\?|$)/.test(r.url()) && r.request().method() === 'POST',
        );
        await slot.locator('input[type=file]').setInputFiles({ ...PDF, name });
        expect((await uploaded).status()).toBe(201);
      }
      await expect(slot.locator('li')).toHaveCount(1);
      await expect(slot.locator('li')).toContainText('second.pdf');
      // The server agrees: one current certificate, the latest (same session cookie as the page).
      const res = await page.request.get('/api/v1/portal/documents');
      const { documents } = (await res.json()) as {
        documents: { docType: string; originalName: string }[];
      };
      expect(documents.filter((d) => d.docType === 'certificate')).toEqual([
        expect.objectContaining({ originalName: 'second.pdf' }),
      ]);
      expect(deletes).toEqual([]);
    });

    test('client rejects unsupported file types before uploading', async ({ page }) => {
      await gotoHydrated(page, '/en/apply');
      await fillStep1(page, newApplicant('type'));
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await fillStep2(page);
      await page.getByRole('button', { name: 'Next — documents and consent' }).click();
      let uploads = 0;
      page.on(
        'request',
        (r) => /\/portal\/documents(\?|$)/.test(r.url()) && r.method() === 'POST' && uploads++,
      );
      await page
        .locator('[data-doc-type="id_copy"] input[type=file]')
        .setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
      await expect(page.locator('[data-doc-type="id_copy"]')).toContainText(
        'Unsupported file type',
      );
      expect(uploads).toBe(0);
    });

    test('an existing application shows the portal hint (APPLICATION_EXISTS)', async ({
      page,
      request,
    }) => {
      const applicant = newApplicant('exists');
      const first = await request.post('/api/v1/applications', {
        data: {
          firstName: 'Sara',
          lastName: 'Ali',
          birthDate: '2001-05-06',
          phone: applicant.phone,
          nationality: 'SA',
          email: applicant.email,
          gender: 'female',
        },
      });
      expect(first.status()).toBe(201);
      await gotoHydrated(page, '/en/apply');
      await fillStep1(page, applicant);
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await expect(page.getByRole('main').getByRole('alert')).toContainText('already exists');
      await expect(page.getByRole('link', { name: 'Go to the student portal' })).toBeVisible();
    });

    test('offline autosave keeps a device copy without ID number/birth date, then restores it', async ({
      page,
    }) => {
      await gotoHydrated(page, '/en/apply');
      await fillStep1(page, newApplicant('offline'));
      await page.getByRole('textbox', { name: 'ID / residency number' }).fill('1234567890');
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await expect(page.getByRole('heading', { name: /Step 2/ })).toBeVisible();

      await page.route(/\/api\/v1\/portal\/application(\?|$)/, (route) =>
        route.abort('internetdisconnected'),
      );
      await page.getByRole('textbox', { name: 'University' }).fill('[Offline university]');
      await expect(page.getByTestId('autosave')).toContainText('saved on this device');
      const stored = await page.evaluate(() => sessionStorage.getItem('safeer.apply.draft') ?? '');
      expect(stored).toContain('[Offline university]');
      expect(stored).not.toContain('idNumber');
      expect(stored).not.toContain('birthDate');

      await page.reload();

      await page.waitForLoadState('networkidle');
      await waitForHydration(page);
      await expect(page.getByText('We found a copy saved on this device')).toBeVisible();
      await page.getByRole('button', { name: 'Restore' }).click();
      await expect(page.getByRole('textbox', { name: 'University' })).toHaveValue(
        '[Offline university]',
      );
    });

    test('reload resumes the draft from /portal/me (B16 csrfToken keeps writes working)', async ({
      page,
    }) => {
      await gotoHydrated(page, '/en/apply');
      await fillStep1(page, newApplicant('resume'));
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await expect(page.getByRole('heading', { name: /Step 2/ })).toBeVisible();
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForHydration(page);
      await expect(page.getByRole('heading', { name: /Step 2/ })).toBeVisible();
      const patch = page.waitForResponse(
        (r) => /\/portal\/application(\?|$)/.test(r.url()) && r.request().method() === 'PATCH',
      );
      await page.getByRole('textbox', { name: 'Major' }).fill('[Major after reload]');
      expect((await patch).status()).toBe(200);
    });

    test('validation mirrors the API: Arabic-Indic phone digits pass, a dotted name is stopped (W14)', async ({
      page,
    }) => {
      const applicant = newApplicant('digits');
      // +9665XXXXXXXX → the local form ٠٥XXXXXXXX typed on an Arabic keyboard.
      const local = `0${applicant.phone.slice(4)}`.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
      await gotoHydrated(page, '/ar/apply');
      let posts = 0;
      page.on('request', (r) => /\/api\/v1\/applications(\?|$)/.test(r.url()) && posts++);
      const next = page.getByRole('button', { name: /التالي/ });

      await page.locator('input[autocomplete="given-name"]').fill('Dr. Sara');
      await page.locator('input[autocomplete="family-name"]').fill('علي');
      await page.locator('input[type="date"]').fill('2001-05-06');
      await page.locator('input[type="tel"]').fill(local);
      const nationality = page.locator('[autocomplete="country"]');
      if ((await nationality.evaluate((el) => el.tagName)) === 'SELECT') {
        await nationality.selectOption('SA');
      } else {
        await nationality.fill('SA');
      }
      await page.locator('input[type="email"]').fill(applicant.email);
      await page.getByRole('radio').first().check();
      await next.click();
      const first = page.locator('input[autocomplete="given-name"]');
      await expect(first).toHaveAttribute('aria-invalid', 'true');
      await expect(first).toBeFocused();
      expect(posts).toBe(0);

      await first.fill('سارة');
      const created = page.waitForResponse(
        (r) => /\/api\/v1\/applications(\?|$)/.test(r.url()) && r.request().method() === 'POST',
      );
      await next.click();
      expect((await created).status()).toBe(201);
    });

    test('signing out removes the offline copy from the device (W10)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, '/en/apply');
      await fillStep1(page, newApplicant('signout'));
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await expect(page.getByRole('heading', { name: /Step 2/ })).toBeVisible();
      await page.route(/\/api\/v1\/portal\/application(\?|$)/, (route) =>
        route.abort('internetdisconnected'),
      );
      await page.getByRole('textbox', { name: 'University' }).fill('[Offline university]');
      await expect(page.getByTestId('autosave')).toContainText('saved on this device');
      const draft = () => page.evaluate(() => sessionStorage.getItem('safeer.apply.draft'));
      expect(await draft()).toContain('[Offline university]');
      await page.unroute(/\/api\/v1\/portal\/application(\?|$)/);

      await page.goto('/en/portal');
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/en\/portal\/login$/);
      expect(await draft()).toBeNull();
    });

    test('keyboard-only step 1', async ({ page }) => {
      await gotoHydrated(page, '/en/apply');
      await page.getByRole('textbox', { name: 'First', exact: true }).focus();
      await page.keyboard.type('Sara');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Ali');
      await expect(page.getByRole('textbox', { name: 'Last', exact: true })).toHaveValue('Ali');
    });
  });
});
