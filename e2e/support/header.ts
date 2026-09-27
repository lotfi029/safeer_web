import type { Page } from '@playwright/test';

export interface HeaderLayout {
  /** Page horizontal overflow in px (must be ≤ 0). */
  overflow: number;
  /** Pairs of header regions whose boxes intersect (brand, nav, tools). */
  overlaps: string[];
  /** Header controls cut off by the viewport or their container. */
  clipped: string[];
  /** Header nav links wrapping onto a second line. */
  wrapped: string[];
  /** The org name is cut off (ellipsis or line clamp). */
  nameTruncated: boolean;
}

/** W5: measures the site header the way a person would notice it breaking. */
export function measureHeader(page: Page): Promise<HeaderLayout> {
  return page.evaluate(() => {
    const header = document.querySelector('app-site-header header') as HTMLElement;
    const box = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const visible = (el: Element | null) =>
      !!el && getComputedStyle(el).display !== 'none' && (el as HTMLElement).offsetWidth > 0;
    const regions: [string, Element | null][] = [
      ['brand', header.querySelector(':scope > a')],
      ['nav', header.querySelector(':scope > nav')],
      ['tools', header.querySelector(':scope > div')],
    ];
    const shown = regions.filter(([, el]) => visible(el)) as [string, Element][];
    const overlaps: string[] = [];
    for (let i = 0; i < shown.length; i++) {
      for (let j = i + 1; j < shown.length; j++) {
        const a = box(shown[i][1])!;
        const b = box(shown[j][1])!;
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) overlaps.push(`${shown[i][0]}×${shown[j][0]} (${Math.round(x)}px)`);
      }
    }
    const vw = document.documentElement.clientWidth;
    const clipped = [...header.querySelectorAll('a, button')]
      .filter((el) => visible(el))
      .filter((el) => {
        const r = box(el)!;
        return r.left < -1 || r.right > vw + 1 || (el as HTMLElement).scrollWidth > r.width + 1;
      })
      .map((el) => (el.textContent ?? '').trim() || el.getAttribute('aria-label') || el.tagName);
    const wrapped = [...header.querySelectorAll('nav a')]
      .filter((el) => visible(el))
      .filter((el) => {
        const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
        return (el as HTMLElement).getClientRects().length > 1 || box(el)!.height > lh * 1.6 + 16;
      })
      .map((el) => (el.textContent ?? '').trim());
    const name = header.querySelector('app-brand .font-bold') as HTMLElement | null;
    return {
      overflow: document.documentElement.scrollWidth - vw,
      overlaps,
      clipped,
      wrapped,
      nameTruncated:
        !!name &&
        (name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1),
    };
  });
}
