import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { inViewport, motionAllowed } from './motion';

/**
 * Scroll reveal (spec §2: opacity 0→1 + translateY 30px→0, 600ms, 100ms stagger).
 *
 * SSR-safe by construction: the hidden start state (`.reveal-init`) is only added in the browser,
 * after hydration, to elements that are still below the fold — so server HTML, no-JS visitors,
 * crawlers, reduced-motion users and above-the-fold content always see the content.
 *
 *   @for (item of items; track item.id; let i = $index) {
 *     <article appReveal [revealIndex]="i">…</article>
 *   }
 */
@Directive({
  selector: '[appReveal]',
  host: { '[style.--reveal-delay]': 'delay()' },
})
export class Reveal {
  /** Position in a group; the transition delay is `index × --reveal-stagger` (100ms). */
  readonly revealIndex = input(0);

  protected readonly delay = computed(() =>
    this.revealIndex() > 0 ? `calc(var(--reveal-stagger, 100ms) * ${this.revealIndex()})` : null,
  );

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const win = inject(DOCUMENT).defaultView;
    const destroyRef = inject(DestroyRef);
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    afterNextRender(() => {
      if (!isBrowser || !win || !motionAllowed(win) || inViewport(el, win)) {
        return;
      }
      el.classList.add('reveal-init');
      const observer = new win.IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            el.classList.replace('reveal-init', 'reveal-in');
            observer.disconnect();
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      );
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
