import { expect, type Page } from '@playwright/test';

/**
 * Waits for `<html data-hydrated>` (App's first afterNextRender). `networkidle` alone isn't enough
 * under load: text typed before hydration never reaches the form (event replay covers clicks only).
 */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-hydrated]')).toHaveCount(1, { timeout: 15_000 });
}

export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await waitForHydration(page);
}
