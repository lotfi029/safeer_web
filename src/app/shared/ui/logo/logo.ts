import { NgOptimizedImage } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// TODO(logo): replace with the official SVG (spec §6.1); never ship a traced SVG.
const LOGO_SRC = '/brand/safeer-logo.png';
const LOGO_WIDTH = 150;
const LOGO_HEIGHT = 228;

/**
 * Association logo on its white "logo chip" (the ink is deep teal, so it needs a light tile on
 * dark surfaces). `height` is the chip height in px (spec: 42–52 in the header).
 */
@Component({
  selector: 'app-logo',
  imports: [NgOptimizedImage, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center rounded-btn bg-(--logo-chip) p-1.25',
    '[style.block-size.px]': 'height()',
  },
  template: `
    <img
      [ngSrc]="src"
      [width]="intrinsicWidth"
      [height]="intrinsicHeight"
      [priority]="priority()"
      [alt]="alt() ?? ('common.orgName' | transloco)"
      disableOptimizedSrcset
      class="block h-full w-auto"
    />
  `,
})
export class Logo {
  /** Chip height in px (42–52 per spec). */
  readonly height = input(48);
  /** Accessible name; defaults to the org name. Pass '' when the name is shown next to it. */
  readonly alt = input<string | null>(null);
  /** Above-the-fold (header) logos: preload + high fetch priority. */
  readonly priority = input(false, { transform: booleanAttribute });

  protected readonly src = LOGO_SRC;
  // Intrinsic size for the aspect ratio (no CLS); the rendered size comes from the chip height.
  protected readonly intrinsicWidth = LOGO_WIDTH;
  protected readonly intrinsicHeight = LOGO_HEIGHT;
}

/**
 * Header/footer brand: logo chip + org name + tagline (prototype `.brand`). The name is real
 * text, so the logo's alt is empty to avoid announcing it twice. Wrap it in the home link.
 */
@Component({
  selector: 'app-brand',
  imports: [Logo, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex min-w-0 items-center gap-3 text-heading' },
  template: `
    <app-logo [height]="compact() ? 42 : 48" alt="" [priority]="priority()" />
    <span class="flex min-w-0 flex-col">
      <span
        class="truncate leading-snug font-bold"
        [class]="compact() ? 'text-base' : 'text-[15px] sm:text-base xl:text-[19px]'"
        >{{ name() ?? ('common.orgName' | transloco) }}</span
      >
      @if (tagline() && !compact()) {
        <span class="t-caption hidden md:block">{{ tagline() }}</span>
      }
    </span>
  `,
})
export class Brand {
  /** Defaults to `common.orgName`. */
  readonly name = input<string | null>(null);
  readonly tagline = input<string | null>(null);
  /** Smaller logo, no tagline (mobile header, sidebar). */
  readonly compact = input(false, { transform: booleanAttribute });
  readonly priority = input(false, { transform: booleanAttribute });
}
