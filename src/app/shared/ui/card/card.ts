import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon-names';

export type CardTone = 'default' | 'surface' | 'band';

/**
 * Card surface (spec §2: white, 1px border, radius 20, no heavy shadow; hover lifts 4px and the
 * border turns `--secondary` over ~280ms). Styles live in components.css (`.card*`).
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'card block',
    '[class.card-hover]': 'hover()',
    '[class.card-flush]': 'flush()',
    '[class.bg-surface]': 'tone() === "surface"',
    '[class.band]': 'tone() === "band"',
    '[class.border-transparent]': 'tone() === "band"',
  },
  template: `<ng-content />`,
})
export class Card {
  readonly hover = input(false, { transform: booleanAttribute });
  /** No padding, clipped corners (media cards). */
  readonly flush = input(false, { transform: booleanAttribute });
  readonly tone = input<CardTone>('default');
}

/**
 * Icon + title + text card for work areas and care pillars. Extra content (item list, a link)
 * is projected below the body text.
 */
@Component({
  selector: 'app-feature-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'card flex flex-col gap-4',
    '[class.card-hover]': 'hover()',
    '[class.bg-surface]': 'tone() === "surface"',
    '[class.band]': 'tone() === "band"',
    '[class.border-transparent]': 'tone() === "band"',
  },
  template: `
    <span class="icon-tile"><app-icon [name]="icon()" [size]="26" /></span>
    @switch (level()) {
      @case (2) {
        <h2 class="t-h4">{{ heading() }}</h2>
      }
      @case (4) {
        <h4 class="t-h4">{{ heading() }}</h4>
      }
      @default {
        <h3 class="t-h4">{{ heading() }}</h3>
      }
    }
    @if (body()) {
      <p class="t-muted">{{ body() }}</p>
    }
    <ng-content />
  `,
})
export class FeatureCard {
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  readonly body = input<string | null>(null);
  readonly level = input<2 | 3 | 4>(3);
  readonly hover = input(true, { transform: booleanAttribute });
  readonly tone = input<CardTone>('default');
}
