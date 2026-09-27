import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { waitForHydration } from './hydration';

export type Locale = 'ar' | 'en';
export interface Viewport {
  name: string;
  width: number;
  height: number;
}

/** Full QA matrix (plan §5): run nightly / before session exit (review F10). */
export const ALL_VIEWPORTS: readonly Viewport[] = [
  { name: '360', width: 360, height: 740 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];
/** Per-PR subset (review F10). */
export const PR_VIEWPORTS = ALL_VIEWPORTS.filter((v) => v.name === '390' || v.name === '1440');
export const LOCALES: readonly Locale[] = ['ar', 'en'];

export function matrixViewports(): readonly Viewport[] {
  return process.env['E2E_FULL_MATRIX'] ? ALL_VIEWPORTS : PR_VIEWPORTS;
}

/** Every combination of viewport × locale for the current run. */
export function matrix(): { viewport: Viewport; locale: Locale }[] {
  return matrixViewports().flatMap((viewport) => LOCALES.map((locale) => ({ viewport, locale })));
}

/** axe: serious or critical violations fail the test. */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    blocking.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes
          .slice(0, 3)
          .map(
            (n) =>
              `${n.target.join(' ')} [${(n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 160)}]`,
          )
          .join(' | ')}`,
    ),
  ).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

const SCREEN_MAX_BYTES = 150 * 1024;

/**
 * Viewport-only screenshot, palette-compressed to ≤ 150 KB (review F10). Always attached to the test
 * (CI artifact); written into docs/frontend/screens/phase-N/ only when E2E_SCREENS_DIR is set and the
 * viewport is 390 or 1440.
 */
export async function screenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  viewport: Viewport,
  locale: Locale,
) {
  const raw = await page.screenshot({ fullPage: false, animations: 'disabled' });
  let png = await sharp(raw).png({ palette: true, quality: 80, compressionLevel: 9 }).toBuffer();
  if (png.length > SCREEN_MAX_BYTES) {
    png = await sharp(raw).png({ palette: true, colours: 64, compressionLevel: 9 }).toBuffer();
  }
  expect(png.length, `${name} screenshot must be ≤ 150 KB`).toBeLessThanOrEqual(SCREEN_MAX_BYTES);
  const fileName = `${name}-${locale}-${viewport.name}.png`;
  await testInfo.attach(fileName, { body: png, contentType: 'image/png' });
  const dir = process.env['E2E_SCREENS_DIR'];
  if (dir && (viewport.name === '390' || viewport.name === '1440')) {
    const path = `${dir}/${fileName}`;
    mkdirSync(dirname(path), { recursive: true });
    await sharp(png).toFile(path);
  }
}

export type Theme = 'light' | 'dark';

/**
 * Opens `/{locale}{path}` at a viewport with reduced motion (deterministic screenshots) and an
 * optional theme cookie (SSR renders `data-theme` from it). Waits for hydration to settle.
 */
export async function openAt(
  page: Page,
  path: string,
  viewport: Viewport,
  locale: Locale,
  theme: Theme | null = null,
): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme ?? 'light' });
  if (theme) {
    await page.context().addCookies([
      {
        name: 'theme',
        value: theme,
        url: page.url().startsWith('http') ? page.url() : 'http://localhost:4100',
      },
    ]);
  }
  await page.goto(`/${locale}${path === '/' ? '' : path}`);
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  await page.waitForLoadState('networkidle');
  await waitForHydration(page);
}

/**
 * Whether a screen is also checked in the dark theme at this viewport: every viewport in the full
 * matrix, 1440 only per PR (Phase 10).
 */
export function checksDark(viewport: Viewport): boolean {
  return !!process.env['E2E_FULL_MATRIX'] || viewport.name === '1440';
}

/**
 * The standard per-screen check: no horizontal scroll + axe (serious/critical fail) + screenshot,
 * then the same in the other theme (`checksDark`) by flipping `data-theme` on the rendered page,
 * which is exactly what the theme toggle does.
 */
export async function checkScreen(
  page: Page,
  testInfo: TestInfo,
  name: string,
  viewport: Viewport,
  locale: Locale,
): Promise<void> {
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11yViolations(page);
  await screenshot(page, testInfo, name, viewport, locale);
  if (!checksDark(viewport) || name.endsWith('-dark')) return;
  const before = await page.evaluate(() => {
    const root = document.documentElement;
    const was = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'dark');
    return was;
  });
  if (before === 'dark') return;
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11yViolations(page);
  await screenshot(page, testInfo, `${name}-dark`, viewport, locale);
  await page.evaluate((was) => {
    const root = document.documentElement;
    if (was === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', was);
  }, before);
}
