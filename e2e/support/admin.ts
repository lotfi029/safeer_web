import { expect, type Page } from '@playwright/test';
import { waitForHydration } from './hydration';
import type { StaffAccount } from './real-api';

/** Signs `user` in through the SSR origin (the cookie lands in the page's context), then opens `path`. */
export async function signInAs(
  page: Page,
  user: StaffAccount,
  path = '/admin',
  locale: 'ar' | 'en' = 'en',
): Promise<void> {
  const res = await page.request.post('/api/v1/admin/auth/login', {
    data: { email: user.email, password: user.password },
  });
  expect(res.ok(), `login ${user.email} → ${res.status()}`).toBe(true);
  await page.goto(`/${locale}${path}`);
  await page.waitForLoadState('networkidle');
  await waitForHydration(page);
}

/** Fills and submits the staff login form. */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('form button[type=submit]').click();
}
