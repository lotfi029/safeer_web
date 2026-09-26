import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Arched divider (spec §2 "فاصل مقوّس بدل الخط المستقيم"): one wide, shallow arch echoing the
 * logo's architectural arch, stretched to the full width. Decorative only; 14–25% opacity via
 * `--lines-opacity` (raised in dark mode for the same perceived weight).
 */
@Component({
  selector: 'app-arc-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.flipped]': 'flip()',
    '[class.band-tone]': 'tone() === "band"',
    '[style.block-size.px]': 'height()',
  },
  template: `
    <svg
      viewBox="0 0 1200 48"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 46C260 46 380 4 600 4S940 46 1200 46" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      inline-size: 100%;
      color: var(--secondary);
      opacity: var(--lines-opacity);
      pointer-events: none;
    }
    :host(.flipped) {
      transform: scaleY(-1);
    }
    :host(.band-tone) {
      color: var(--band-dim);
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      overflow: visible;
    }
    path {
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
  `,
})
export class ArcDivider {
  /** false: arch opening downwards (∩); true: opening upwards (∪). */
  readonly flip = input(false, { transform: booleanAttribute });
  readonly tone = input<'light' | 'band'>('light');
  /** Arch height in px. */
  readonly height = input(40);
}
