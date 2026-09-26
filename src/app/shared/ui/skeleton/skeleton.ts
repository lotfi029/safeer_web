import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading placeholder (spec `.skeleton`, pulse stops under reduced motion). Always aria-hidden:
 * the PARENT region announces loading with `aria-busy="true"` (and optionally a visually-hidden
 * "loading" text), then drops it when content arrives.
 *
 *   <section [attr.aria-busy]="loading()">
 *     @if (loading()) { <app-skeleton [lines]="3" /> } @else { … }
 *   </section>
 *
 * With `lines > 1` the last line is shortened to 60% to read as a paragraph.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2', 'aria-hidden': 'true', '[style.inline-size]': 'width()' },
  template: `
    @for (line of lineList(); track line; let last = $last) {
      <span
        class="skeleton"
        [class.rounded-full]="rounded()"
        [style.block-size]="height()"
        [style.inline-size]="last && lineList().length > 1 ? '60%' : '100%'"
      ></span>
    }
  `,
})
export class Skeleton {
  /** Any CSS length. */
  readonly width = input('100%');
  readonly height = input('1em');
  readonly lines = input(1);
  /** Fully rounded (avatars, pills). */
  readonly rounded = input(false, { transform: booleanAttribute });

  protected readonly lineList = computed(() =>
    Array.from({ length: Math.max(1, Math.floor(this.lines())) }, (_, i) => i),
  );
}
