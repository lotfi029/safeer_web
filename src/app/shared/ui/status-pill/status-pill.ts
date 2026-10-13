import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type PillVariant = 'teal' | 'ok' | 'warn' | 'plain' | 'solid';

const PILL_HOST = {
  class: 'pill',
  '[class.pill-ok]': 'variant() === "ok"',
  '[class.pill-warn]': 'variant() === "warn"',
  '[class.pill-plain]': 'variant() === "plain"',
  '[class.pill-solid]': 'variant() === "solid"',
};

/** Generic pill (spec: teal default · ok · warn · plain · solid). Text is projected. */
@Component({
  selector: 'app-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: PILL_HOST,
  template: `<ng-content />`,
})
export class Pill {
  readonly variant = input<PillVariant>('teal');
}
