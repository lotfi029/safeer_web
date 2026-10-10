import type { Page } from '@playwright/test';

/**
 * W8: links/buttons in `selector` whose touch target is under `min` px on either side. A link that
 * stretches over its card with an absolutely positioned `::after` (news cards) is measured by the
 * box that pseudo-element covers, which is what a finger actually hits.
 */
export function smallTargets(page: Page, selector: string, min = 44): Promise<string[]> {
  return page.evaluate(
    ([sel, size]) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
        let target: HTMLElement = el;
        if (getComputedStyle(el, '::after').position === 'absolute') {
          let p = el.parentElement;
          while (p && getComputedStyle(p).position === 'static') p = p.parentElement;
          if (p) target = p;
        }
        const r = target.getBoundingClientRect();
        if (r.width + 0.5 < size || r.height + 0.5 < size) {
          const name = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
          out.push(
            `${name || el.getAttribute('aria-label')} (${Math.round(r.width)}×${Math.round(r.height)})`,
          );
        }
      }
      return out;
    },
    [selector, min] as const,
  );
}
