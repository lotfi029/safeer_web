import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Flowing lines derived from the logo's rising leaf (spec §2 "اللغة البصرية": 14–25% opacity,
 * behind content, once per section). Paths copied from the prototype's `LINES()`.
 *
 * Put it as the first child of a `position: relative; overflow: hidden` section and give the
 * content `position: relative` (e.g. `relative z-[1]`) so it paints above the lines. It sits in
 * the inline-start top corner and is mirrored in LTR.
 */
@Component({
  selector: 'app-flowing-lines',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.band-tone]': 'tone() === "band"',
    '[style.inline-size.px]': 'width()',
  },
  template: `
    <svg
      viewBox="0 0 600 660"
      [attr.width]="width()"
      [attr.height]="height()"
      fill="none"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMinYMin meet"
    >
      <path d="M40 660C40 470 180 420 270 320C380 200 410 110 430 40" />
      <path d="M120 660C120 500 250 450 340 355C450 240 480 150 500 80" />
      <path class="accent" d="M200 660C200 530 320 485 405 395C510 285 540 200 560 130" />
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      z-index: 0;
      display: block;
      max-inline-size: 100%;
      opacity: var(--lines-opacity);
      color: var(--secondary);
      pointer-events: none;
    }
    :host-context([dir='ltr']) {
      transform: scaleX(-1);
    }
    :host(.band-tone) {
      color: var(--band-dim);
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: auto;
    }
    path {
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .accent {
      stroke: var(--primary);
    }
    :host(.band-tone) .accent {
      stroke: var(--band-soft);
    }
  `,
})
export class FlowingLines {
  /** `light` on light surfaces (teal lines), `band` on the dark band. */
  readonly tone = input<'light' | 'band'>('light');
  /** Rendered size in px (prototype: 600×660 hero, 420×300 page head). Scales down on narrow screens. */
  readonly width = input(600);
  readonly height = input(660);
}
