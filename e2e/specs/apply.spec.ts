import { expect, type Page, test } from '@playwright/test';
import { usingMockApi } from '../support/env';
import { checkScreen, matrix, openAt } from '../support/matrix';

const PDF = {
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%mock\n'),
};

async function fillStep1(page: Page, emailAddress: string): Promise<void> {
  await page.getByRole('textbox', { name: 'First', exact: true }).fill('Sara');
  await page.getByRole('textbox', { name: 'Last', exact: true }).fill('Ali');
  await page.getByRole('textbox', { name: 'Date of birth' }).fill('2001-05-06');
  await page.getByRole('textbox', { name: 'Phone' }).fill('+966500000001');
  const nationality = page.getByLabel('Nationality');
  if ((await nationality.evaluate((el) => el.tagName)) === 'SELECT') {
    await nationality.selectOption('SA');
  } else {
    await nationality.fill('SA');
  }
  await page.getByRole('textbox', { name: 'Email' }).fill(emailAddress);
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
    await page.goto('/en/apply');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Next — academic details' }).click();
    await expect(page.getByRole('textbox', { name: 'First', exact: true })).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  test.describe('against the mock API', () => {
    test.skip(!usingMockApi, 'creates applications');

    test('happy path: create → autosave → uploads → submit → reference', async ({ page }) => {
      const email = `apply-${Date.now()}@mock.invalid`;
      await page.goto('/en/apply');
      await page.waitForLoadState('networkidle');
      await fillStep1(page, email);
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

    test('client rejects unsupported file types before uploading', async ({ page }) => {
      await page.goto('/en/apply');
      await page.waitForLoadState('networkidle');
      await fillStep1(page, `type-${Date.now()}@mock.invalid`);
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
      const email = `exists-${Date.now()}@mock.invalid`;
      const first = await request.post('/api/v1/applications', {
        data: {
          firstName: 'Sara',
          lastName: 'Ali',
          birthDate: '2001-05-06',
          phone: '+966500000001',
          nationality: 'SA',
          email,
          gender: 'female',
        },
      });
      expect(first.status()).toBe(201);
      await page.goto('/en/apply');
      await page.waitForLoadState('networkidle');
      await fillStep1(page, email);
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await expect(page.getByRole('main').getByRole('alert')).toContainText('already exists');
      await expect(page.getByRole('link', { name: 'Go to the student portal' })).toBeVisible();
    });

    test('offline autosave keeps a device copy without ID number/birth date, then restores it', async ({
      page,
    }) => {
      await page.goto('/en/apply');
      await page.waitForLoadState('networkidle');
      await fillStep1(page, `offline-${Date.now()}@mock.invalid`);
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
      await expect(page.getByText('We found a copy saved on this device')).toBeVisible();
      await page.getByRole('button', { name: 'Restore' }).click();
      await expect(page.getByRole('textbox', { name: 'University' })).toHaveValue(
        '[Offline university]',
      );
    });

    test('reload resumes the draft from /portal/me (B16 csrfToken keeps writes working)', async ({
      page,
    }) => {
      await page.goto('/en/apply');
      await page.waitForLoadState('networkidle');
      await fillStep1(page, `resume-${Date.now()}@mock.invalid`);
      await page.getByRole('button', { name: 'Next — academic details' }).click();
      await expect(page.getByRole('heading', { name: /Step 2/ })).toBeVisible();
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /Step 2/ })).toBeVisible();
      const patch = page.waitForResponse(
        (r) => /\/portal\/application(\?|$)/.test(r.url()) && r.request().method() === 'PATCH',
      );
      await page.getByRole('textbox', { name: 'Major' }).fill('[Major after reload]');
      expect((await patch).status()).toBe(200);
    });

    test('keyboard-only step 1', async ({ page }) => {
      await page.goto('/en/apply');
      await page.waitForLoadState('networkidle');
      await page.getByRole('textbox', { name: 'First', exact: true }).focus();
      await page.keyboard.type('Sara');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Ali');
      await expect(page.getByRole('textbox', { name: 'Last', exact: true })).toHaveValue('Ali');
    });
  });
});
