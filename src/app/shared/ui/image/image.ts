import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Asset } from '../../../core/api/models';
import { srcsetWidths } from './files-image-loader';

/**
 * API image with a responsive srcset from the thumb/card/full variants and explicit width/height
 * (no CLS). Without an asset it renders the labelled placeholder `[صورة: …]` (hard rule 1).
 * The LCP image gets `priority`.
 */
@Component({
  selector: 'app-image',
  imports: [NgOptimizedImage, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (asset(); as a) {
      <img
        [ngSrc]="'files/' + a.publicId"
        [width]="width()"
        [height]="height()"
        [ngSrcset]="srcset()"
        [sizes]="sizes()"
        [priority]="priority()"
        [loaderParams]="fileQuery() ? { fileQuery: fileQuery() } : {}"
        [alt]="alt() ?? a.alt ?? ''"
        [class]="imgClass()"
      />
    } @else {
      <div
        class="img-placeholder min-w-0"
        [class]="placeholderClass()"
        [style.aspect-ratio]="ratio()"
        role="img"
        [attr.aria-label]="'common.imagePlaceholder' | transloco: { label: placeholder() }"
      >
        {{ 'common.imagePlaceholder' | transloco: { label: placeholder() } }}
      </div>
    }
  `,
})
export class Image {
  readonly asset = input<Asset | null | undefined>(null);
  /** Label for the placeholder slot, e.g. "طلاب في فعالية". */
  readonly placeholder = input('...');
  /** Alt override; defaults to the asset's alt (empty = decorative). */
  readonly alt = input<string | null>(null);
  readonly sizes = input('100vw');
  readonly priority = input(false);
  /** Fallback aspect ratio when the asset has no dimensions (and for the placeholder). */
  readonly aspect = input<[number, number]>([16, 9]);
  readonly imgClass = input('');
  /** C41: a news preview's `previewFileQuery`, appended to the `/files/…` URLs. */
  readonly fileQuery = input<string | null | undefined>(null);

  /** The placeholder is a flex box: display utilities meant for the `<img>` would break its centring. */
  protected readonly placeholderClass = computed(() =>
    this.imgClass()
      .split(/\s+/)
      .filter((c) => c && !/^(block|inline|inline-block)$/.test(c))
      .join(' '),
  );
  protected readonly width = computed(() => this.asset()?.widthPx ?? this.aspect()[0] * 100);
  protected readonly height = computed(() => this.asset()?.heightPx ?? this.aspect()[1] * 100);
  protected readonly ratio = computed(() => `${this.aspect()[0]} / ${this.aspect()[1]}`);
  protected readonly srcset = computed(() =>
    srcsetWidths(this.asset()?.widthPx ?? null)
      .map((w) => `${w}w`)
      .join(', '),
  );
}
