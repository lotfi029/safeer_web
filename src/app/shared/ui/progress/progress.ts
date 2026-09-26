import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DigitsPipe } from '../../pipes/format';

/** Clamp to 0–100 and round (progress values come from upload events and step counts). */
export function clampPercent(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Determinate progress bar (spec `.bar`: 12px, raise track, secondary fill).
 * `label` is the accessible name (required: a progressbar must be named).
 *
 *   <app-progress [value]="66" [label]="'…' | transloco" showValue />
 */
@Component({
  selector: 'app-progress',
  imports: [TranslocoPipe, DigitsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-3' },
  template: `
    <div
      class="progress grow"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="percent()"
      [attr.aria-valuetext]="'ui.progress' | transloco: { percent: (percent() | digits) }"
      [attr.aria-label]="label()"
    >
      <span [style.inline-size.%]="percent()"></span>
    </div>
    @if (showValue()) {
      <span class="t-caption shrink-0 font-semibold text-text-muted" aria-hidden="true">
        {{ 'ui.progress' | transloco: { percent: (percent() | digits) } }}
      </span>
    }
  `,
})
export class Progress {
  readonly value = input<number | null>(0);
  readonly label = input.required<string>();
  /** Visible percentage text next to the bar. */
  readonly showValue = input(false, { transform: booleanAttribute });

  protected readonly percent = computed(() => clampPercent(this.value()));
}
